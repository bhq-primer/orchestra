import type { Query } from "@anthropic-ai/claude-agent-sdk";

export type SessionStatus = "idle" | "working" | "waiting_for_input" | "error";

export type GitStatus = {
  branch: string;
  dirty: number;      // uncommitted changed files
  untracked: number;  // untracked files
  ahead: number;      // commits ahead of remote
};

export type OrchestraSession = {
  id: string;
  summary: string;
  status: SessionStatus;
  cwd: string;
  lastModified: number;
  messages: SessionDisplayMessage[];
  recentPrompts: string[];
  git?: GitStatus;
  query?: Query;
  cost?: number;
  pid?: number;
};

export type SessionDisplayMessage = {
  role: "user" | "assistant" | "tool" | "system";
  text: string;
  timestamp?: number;
};

export type AppMode = "normal" | "insert" | "create";

export type StoreEvent = "sessions-updated" | "session-messages-updated";
