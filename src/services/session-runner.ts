import { query as sdkQuery } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage, Query } from "@anthropic-ai/claude-agent-sdk";
import { store } from "./session-store.js";
import type { SessionDisplayMessage } from "../types.js";

function sdkMessageToDisplay(msg: SDKMessage): SessionDisplayMessage | null {
  if (msg.type === "assistant") {
    const content = extractAssistantText(msg);
    if (content) {
      return { role: "assistant", text: content };
    }
  } else if (msg.type === "user" && "message" in msg) {
    const content = extractUserText(msg);
    if (content) {
      return { role: "user", text: content };
    }
  } else if (msg.type === "result") {
    if (msg.subtype === "success") {
      return { role: "system", text: `Done (${msg.num_turns} turns, $${msg.total_cost_usd.toFixed(4)})` };
    } else {
      return { role: "system", text: `Error: ${msg.subtype}` };
    }
  }
  return null;
}

function extractAssistantText(msg: SDKMessage): string {
  if (msg.type !== "assistant") return "";
  const betaMsg = msg.message;
  if (!betaMsg || typeof betaMsg !== "object") return "";

  const content = (betaMsg as { content?: unknown[] }).content;
  if (!Array.isArray(content)) return "";

  const parts: string[] = [];
  for (const block of content) {
    if (block && typeof block === "object") {
      const b = block as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string") {
        parts.push(b.text);
      } else if (b.type === "tool_use") {
        parts.push(`[tool: ${b.name}]`);
      }
    }
  }
  return parts.join("\n");
}

function extractUserText(msg: SDKMessage): string {
  if (msg.type !== "user") return "";
  const userMsg = msg.message;
  if (!userMsg || typeof userMsg !== "object") return "";

  const m = userMsg as Record<string, unknown>;
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    return m.content
      .map((b: unknown) => {
        if (typeof b === "string") return b;
        if (b && typeof b === "object" && (b as Record<string, unknown>).type === "text") {
          return (b as Record<string, unknown>).text as string;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export async function createSession(prompt: string, cwd?: string): Promise<string> {
  const q = sdkQuery({
    prompt,
    options: {
      cwd: cwd ?? process.cwd(),
      permissionMode: "default",
    },
  });

  // Read the first message to get the session ID
  const firstResult = await q.next();
  const sessionId = firstResult.value?.session_id ?? `orchestra-${Date.now()}`;

  store.upsert(sessionId, {
    summary: prompt.slice(0, 60),
    status: "working",
    cwd: cwd ?? process.cwd(),
    lastModified: Date.now(),
    messages: [{ role: "user", text: prompt }],
    query: q,
  });

  // Process first message
  if (firstResult.value) {
    const display = sdkMessageToDisplay(firstResult.value);
    if (display) store.appendMessage(sessionId, display);
  }

  // Stream remaining messages in background
  streamQueryMessages(sessionId, q);

  return sessionId;
}

export async function resumeSession(sessionId: string, prompt: string): Promise<void> {
  const q = sdkQuery({
    prompt,
    options: {
      resume: sessionId,
      permissionMode: "default",
    },
  });

  store.upsert(sessionId, {
    status: "working",
    lastModified: Date.now(),
    query: q,
  });

  store.appendMessage(sessionId, { role: "user", text: prompt });

  streamQueryMessages(sessionId, q);
}

async function streamQueryMessages(sessionId: string, q: Query): Promise<void> {
  try {
    for await (const msg of q) {
      const display = sdkMessageToDisplay(msg);
      if (display) {
        store.appendMessage(sessionId, display);
      }

      // Update cost from result messages
      if (msg.type === "result" && "total_cost_usd" in msg) {
        store.upsert(sessionId, { cost: msg.total_cost_usd });
      }
    }
  } catch (err) {
    store.appendMessage(sessionId, {
      role: "system",
      text: `Error: ${err instanceof Error ? err.message : String(err)}`,
    });
    store.setStatus(sessionId, "error");
  } finally {
    store.upsert(sessionId, { query: undefined });
    // Keep status as-is if error, otherwise set to idle
    const session = store.get(sessionId);
    if (session && session.status !== "error") {
      store.setStatus(sessionId, "idle");
    }
  }
}

export function abortSession(sessionId: string): void {
  const session = store.get(sessionId);
  if (session?.query) {
    session.query.interrupt().catch(() => {});
    store.upsert(sessionId, { query: undefined });
    store.setStatus(sessionId, "idle");
  }
}
