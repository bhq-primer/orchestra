import { store } from "./session-store.js";
import type { GitStatus } from "../types.js";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const POLL_INTERVAL = 3000;
const HOME = process.env.HOME ?? "~";
const SESSIONS_DIR = path.join(HOME, ".claude", "sessions");
const PROJECTS_DIR = path.join(HOME, ".claude", "projects");

let pollTimer: ReturnType<typeof setInterval> | null = null;

type ActiveSessionFile = {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
};

type ResolvedSession = ActiveSessionFile & {
  realSessionId: string;
  customTitle: string | null;
};

function readActiveSessionFiles(): ActiveSessionFile[] {
  try {
    const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"));
    const sessions: ActiveSessionFile[] = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(SESSIONS_DIR, file), "utf-8");
        const data = JSON.parse(raw) as ActiveSessionFile;
        if (data.pid && data.sessionId) {
          sessions.push(data);
        }
      } catch {}
    }
    return sessions;
  } catch {
    return [];
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getProcessCpuPercent(pids: number[]): Map<number, number> {
  const result = new Map<number, number>();
  if (pids.length === 0) return result;
  try {
    const out = execSync(
      `ps -o pid=,pcpu= -p ${pids.join(",")}`,
      { encoding: "utf-8", timeout: 2000 },
    );
    for (const line of out.trim().split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        result.set(Number(parts[0]), Number(parts[1]));
      }
    }
  } catch {}
  return result;
}

/**
 * Find the real session JSONL being written to by this process,
 * and extract any custom title from it.
 */
function resolveRealSession(active: ActiveSessionFile): { realSessionId: string; customTitle: string | null } {
  const projName = active.cwd.replaceAll("/", "-");
  const projDir = path.join(PROJECTS_DIR, projName);

  if (!fs.existsSync(projDir)) {
    return { realSessionId: active.sessionId, customTitle: null };
  }

  try {
    const jsonls = fs.readdirSync(projDir).filter((f) => f.endsWith(".jsonl"));
    let newestFile: string | null = null;
    let newestMtime = 0;

    for (const j of jsonls) {
      const stat = fs.statSync(path.join(projDir, j));
      if (stat.mtimeMs > newestMtime) {
        newestMtime = stat.mtimeMs;
        newestFile = j;
      }
    }

    // Use the most recently modified JSONL if it was touched since process started
    const realId = newestFile && newestMtime >= active.startedAt
      ? newestFile.replace(".jsonl", "")
      : active.sessionId;

    // Read custom title from the real session JSONL
    const jsonlPath = path.join(projDir, realId + ".jsonl");
    const customTitle = readCustomTitle(jsonlPath);

    return { realSessionId: realId, customTitle };
  } catch {
    return { realSessionId: active.sessionId, customTitle: null };
  }
}

function readCustomTitle(jsonlPath: string): string | null {
  try {
    if (!fs.existsSync(jsonlPath)) return null;
    const content = fs.readFileSync(jsonlPath, "utf-8");
    // Scan from end for the last custom-title entry
    const lines = content.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]!.trim();
      if (!line || !line.includes("custom-title")) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === "custom-title" && entry.customTitle) {
          return entry.customTitle;
        }
      } catch {}
    }
  } catch {}
  return null;
}

function readFirstPrompt(jsonlPath: string): string | null {
  try {
    if (!fs.existsSync(jsonlPath)) return null;
    const content = fs.readFileSync(jsonlPath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === "user" && !entry.isSynthetic && entry.message?.content) {
          const text = typeof entry.message.content === "string"
            ? entry.message.content
            : Array.isArray(entry.message.content)
              ? entry.message.content
                  .filter((b: { type: string }) => b.type === "text")
                  .map((b: { text: string }) => b.text)
                  .join(" ")
              : "";
          const trimmed = text.trim();
          if (trimmed && !trimmed.startsWith("<")) return trimmed.slice(0, 80);
        }
      } catch {}
    }
  } catch {}
  return null;
}

function getGitStatus(cwd: string): GitStatus | undefined {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf-8",
      timeout: 2000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const statusOut = execSync("git status --porcelain", {
      cwd,
      encoding: "utf-8",
      timeout: 2000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const lines = statusOut ? statusOut.split("\n") : [];
    let dirty = 0;
    let untracked = 0;
    for (const line of lines) {
      if (line.startsWith("??")) {
        untracked++;
      } else {
        dirty++;
      }
    }

    let ahead = 0;
    try {
      const aheadOut = execSync("git rev-list --count @{upstream}..HEAD", {
        cwd,
        encoding: "utf-8",
        timeout: 2000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      ahead = parseInt(aheadOut, 10) || 0;
    } catch {
      // No upstream configured
    }

    return { branch, dirty, untracked, ahead };
  } catch {
    return undefined;
  }
}

function readRecentPrompts(jsonlPath: string, count: number = 5): string[] {
  const prompts: string[] = [];
  try {
    if (!fs.existsSync(jsonlPath)) return prompts;
    const content = fs.readFileSync(jsonlPath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type !== "user" || entry.isSynthetic) continue;
        const msg = entry.message;
        if (!msg?.content) continue;
        let text = "";
        if (typeof msg.content === "string") {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          text = msg.content
            .filter((b: { type: string }) => b.type === "text")
            .map((b: { text: string }) => b.text)
            .join(" ");
        }
        const trimmed = text.trim();
        if (trimmed && !trimmed.startsWith("<") && !trimmed.startsWith("[")) {
          prompts.push(trimmed);
        }
      } catch {}
    }
  } catch {}
  return prompts.slice(-count);
}

async function discoverSessions(): Promise<void> {
  try {
    const activeFiles = readActiveSessionFiles();
    const aliveSessions = activeFiles.filter((s) => isProcessAlive(s.pid));
    const cpuMap = getProcessCpuPercent(aliveSessions.map((s) => s.pid));
    const currentIds = new Set<string>();

    for (const active of aliveSessions) {
      const { realSessionId, customTitle } = resolveRealSession(active);
      // Use pid as the stable key (a process = a running session)
      const key = String(active.pid);
      currentIds.add(key);

      const cpu = cpuMap.get(active.pid) ?? 0;
      const status = cpu > 5 ? "working" : "idle";
      const existing = store.get(key);

      // Resolve summary: custom title > first prompt > directory name
      let summary: string;
      if (customTitle) {
        summary = customTitle;
      } else {
        const projName = active.cwd.replaceAll("/", "-");
        const jsonlPath = path.join(PROJECTS_DIR, projName, realSessionId + ".jsonl");
        const firstPrompt = readFirstPrompt(jsonlPath);
        summary = firstPrompt ?? path.basename(active.cwd);
      }

      const projName = active.cwd.replaceAll("/", "-");
      const jsonlPath = path.join(PROJECTS_DIR, projName, realSessionId + ".jsonl");
      const recentPrompts = readRecentPrompts(jsonlPath);
      const git = getGitStatus(active.cwd);

      store.upsert(key, {
        summary,
        cwd: active.cwd,
        lastModified: active.startedAt,
        status: existing?.query ? "working" : status,
        pid: active.pid,
        recentPrompts,
        git,
      });
    }

    // Remove sessions whose processes have exited
    for (const session of store.getAll()) {
      if (!currentIds.has(session.id) && !session.query) {
        store.remove(session.id);
      }
    }
  } catch {}
}

export function startDiscovery(): void {
  discoverSessions();
  pollTimer = setInterval(discoverSessions, POLL_INTERVAL);
}

export function stopDiscovery(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
