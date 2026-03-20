import React from "react";
import { Box, Text } from "ink";
import type { OrchestraSession, AppMode } from "../types.js";

type Props = {
  sessions: OrchestraSession[];
  mode: AppMode;
};

export function StatusBar({ sessions, mode }: Props) {
  const totalCost = sessions.reduce((sum, s) => sum + (s.cost ?? 0), 0);
  const working = sessions.filter((s) => s.status === "working").length;
  const idle = sessions.filter((s) => s.status === "idle").length;
  const errored = sessions.filter((s) => s.status === "error").length;

  return (
    <Box paddingX={1} justifyContent="space-between">
      <Text bold color="cyan">
        Orchestra
      </Text>
      <Box gap={2}>
        {working > 0 && <Text color="green">{working} working</Text>}
        {idle > 0 && <Text dimColor>{idle} idle</Text>}
        {errored > 0 && <Text color="red">{errored} error</Text>}
        {totalCost > 0 && <Text color="yellow">${totalCost.toFixed(2)}</Text>}
        <Text dimColor>
          {mode === "normal" ? "j/k:nav  i:msg  n:new  d:stop  q:quit" : mode === "insert" ? "Enter:send  Esc:cancel" : "Enter:create  Esc:cancel"}
        </Text>
      </Box>
    </Box>
  );
}
