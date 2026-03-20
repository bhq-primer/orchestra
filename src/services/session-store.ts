import { EventEmitter } from "events";
import type { OrchestraSession, SessionDisplayMessage, SessionStatus } from "../types.js";

const MAX_MESSAGES = 200;

class SessionStore extends EventEmitter {
  private sessions: Map<string, OrchestraSession> = new Map();

  getAll(): OrchestraSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.lastModified - a.lastModified
    );
  }

  get(id: string): OrchestraSession | undefined {
    return this.sessions.get(id);
  }

  upsert(id: string, updates: Partial<OrchestraSession>): void {
    const existing = this.sessions.get(id);
    if (existing) {
      // Only emit if something actually changed (compare scalars, join arrays for comparison)
      let changed = false;
      for (const key of Object.keys(updates) as (keyof OrchestraSession)[]) {
        if (updates[key] === undefined) continue;
        if (Array.isArray(updates[key]) && Array.isArray(existing[key])) {
          const a = updates[key] as unknown[];
          const b = existing[key] as unknown[];
          if (a.length !== b.length || a.some((v, i) => v !== b[i])) changed = true;
        } else if (existing[key] !== updates[key]) {
          changed = true;
        }
        if (changed) break;
      }
      if (!changed) return;
      Object.assign(existing, updates);
    } else {
      this.sessions.set(id, {
        id,
        summary: updates.summary ?? "Untitled",
        status: updates.status ?? "idle",
        cwd: updates.cwd ?? process.cwd(),
        lastModified: updates.lastModified ?? Date.now(),
        messages: updates.messages ?? [],
        recentPrompts: updates.recentPrompts ?? [],
        cost: updates.cost,
        query: updates.query,
        pid: updates.pid,
      });
    }
    this.emit("sessions-updated");
  }

  remove(id: string): void {
    this.sessions.delete(id);
    this.emit("sessions-updated");
  }

  appendMessage(id: string, message: SessionDisplayMessage): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.messages.push(message);
    if (session.messages.length > MAX_MESSAGES) {
      session.messages = session.messages.slice(-MAX_MESSAGES);
    }
    this.emit("session-messages-updated");
  }

  setMessages(id: string, messages: SessionDisplayMessage[]): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.messages = messages.slice(-MAX_MESSAGES);
    this.emit("session-messages-updated");
  }

  setStatus(id: string, status: SessionStatus): void {
    const session = this.sessions.get(id);
    if (!session || session.status === status) return;
    session.status = status;
    this.emit("sessions-updated");
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }
}

export const store = new SessionStore();
