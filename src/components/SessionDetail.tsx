import React from "react";
import { Box, Text } from "ink";
import type { OrchestraSession } from "../types.js";

type Props = {
  session: OrchestraSession | null;
};

function truncate(str: string, max: number): string {
  const oneLine = str.replace(/\n/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max - 1) + "\u2026" : oneLine;
}

export function SessionDetail({ session }: Props) {
  if (!session) return null;

  const { git } = session;

  return (
    <Box flexDirection="column" paddingX={2} borderStyle="single" borderColor="gray">
      <Box gap={2} marginBottom={1}>
        <Text bold color="cyan">{session.summary}</Text>
        <Text dimColor>{session.cwd}</Text>
        <Text dimColor>pid:{session.pid ?? "?"}</Text>
      </Box>

      {git && (
        <Box marginBottom={1} gap={2}>
          <Text dimColor>branch:</Text>
          <Text bold>{git.branch}</Text>
          {git.dirty > 0 && (
            <Text color="yellow">{git.dirty} uncommitted</Text>
          )}
          {git.untracked > 0 && (
            <Text color="yellow">{git.untracked} untracked</Text>
          )}
          {git.ahead > 0 && (
            <Text color="magenta">{git.ahead} unpushed commit{git.ahead !== 1 ? "s" : ""}</Text>
          )}
          {git.dirty === 0 && git.untracked === 0 && git.ahead === 0 && (
            <Text color="green">clean</Text>
          )}
        </Box>
      )}

      <Text bold dimColor>Recent prompts:</Text>
      {session.recentPrompts.length === 0 ? (
        <Text dimColor>  No prompts found</Text>
      ) : (
        session.recentPrompts.map((prompt, i) => (
          <Box key={i} gap={1}>
            <Text dimColor>{i + 1}.</Text>
            <Text>{truncate(prompt, 120)}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}
