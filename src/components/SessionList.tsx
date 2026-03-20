import React from "react";
import { Box, Text } from "ink";
import type { OrchestraSession, SessionStatus, GitStatus } from "../types.js";
import * as path from "path";

type Props = {
  sessions: OrchestraSession[];
  selectedIndex: number;
};

const STATUS_CONFIG: Record<SessionStatus, { icon: string; label: string; color: string }> = {
  working:           { icon: "\u25CF", label: "working", color: "green" },
  waiting_for_input: { icon: "\u25CF", label: "waiting", color: "yellow" },
  idle:              { icon: "\u25CB", label: "idle",    color: "gray" },
  error:             { icon: "\u2717", label: "error",   color: "red" },
};

function elapsed(startMs: number): string {
  const seconds = Math.floor((Date.now() - startMs) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "\u2026" : str;
}

function gitIndicator(git?: GitStatus): { text: string; color: string } | null {
  if (!git) return null;
  const parts: string[] = [];
  if (git.dirty > 0) parts.push(`${git.dirty} changed`);
  if (git.untracked > 0) parts.push(`${git.untracked} new`);
  if (git.ahead > 0) parts.push(`${git.ahead} unpushed`);
  if (parts.length === 0) return { text: "\u2713 clean", color: "green" };
  return { text: parts.join(", "), color: "yellow" };
}

export function SessionList({ sessions, selectedIndex }: Props) {
  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text dimColor>No active Claude sessions.</Text>
        <Text> </Text>
        <Text dimColor>Start a session with <Text color="cyan">claude</Text> in another terminal,</Text>
        <Text dimColor>or press <Text bold color="cyan">n</Text> to create one from here.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {sessions.map((session, i) => {
        const isSelected = i === selectedIndex;
        const { icon, label, color } = STATUS_CONFIG[session.status];
        const project = path.basename(session.cwd);
        const git = gitIndicator(session.git);

        return (
          <Box key={session.id} flexDirection="column">
            <Box gap={1}>
              <Text color={isSelected ? "cyan" : undefined}>
                {isSelected ? "\u25B8" : " "}
              </Text>
              <Text color={color} bold>
                {icon}
              </Text>
              <Box width={9}>
                <Text color={color}>{label}</Text>
              </Box>
              <Text bold color={isSelected ? "white" : undefined}>
                {truncate(session.summary, 50)}
              </Text>
              <Text dimColor>{project}</Text>
              {session.git && (
                <Text dimColor>{session.git.branch}</Text>
              )}
              {git && (
                <Text color={git.color}>{git.text}</Text>
              )}
              <Text dimColor>{elapsed(session.lastModified)}</Text>
            </Box>
            {i < sessions.length - 1 && <Text> </Text>}
          </Box>
        );
      })}
    </Box>
  );
}
