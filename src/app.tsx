import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useApp, useStdout } from "ink";
import { StatusBar } from "./components/StatusBar.js";
import { SessionList } from "./components/SessionList.js";
import { SessionDetail } from "./components/SessionDetail.js";
import { InputBar } from "./components/InputBar.js";
import { SessionCreateModal } from "./components/SessionCreateModal.js";
import { useSessionManager } from "./hooks/useSessionManager.js";
import { useKeyBindings } from "./hooks/useKeyBindings.js";
import { startDiscovery, stopDiscovery } from "./services/session-discovery.js";
import { createSession, resumeSession, abortSession } from "./services/session-runner.js";
import type { AppMode } from "./types.js";

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { sessions } = useSessionManager();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<AppMode>("normal");
  const [showDetail, setShowDetail] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    startDiscovery();
    return () => stopDiscovery();
  }, []);

  useEffect(() => {
    if (selectedIndex >= sessions.length && sessions.length > 0) {
      const clamped = sessions.length - 1;
      indexRef.current = clamped;
      setSelectedIndex(clamped);
    }
  }, [sessions.length, selectedIndex]);

  const selectedSession = sessions[selectedIndex] ?? null;
  const cols = stdout?.columns ?? 80;
  const rows = stdout?.rows ?? 24;

  const handleNewSession = useCallback(async (prompt: string) => {
    setMode("normal");
    try {
      await createSession(prompt);
      indexRef.current = 0;
      setSelectedIndex(0);
    } catch {}
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!selectedSession) return;
    setMode("normal");
    try {
      await resumeSession(selectedSession.id, text);
    } catch {}
  }, [selectedSession]);

  useKeyBindings(mode, {
    onNavigateUp: () => {
      const next = Math.max(0, indexRef.current - 1);
      if (next !== indexRef.current) {
        indexRef.current = next;
        setSelectedIndex(next);
      }
    },
    onNavigateDown: () => {
      const max = Math.max(0, sessions.length - 1);
      const next = Math.min(max, indexRef.current + 1);
      if (next !== indexRef.current) {
        indexRef.current = next;
        setSelectedIndex(next);
      }
    },
    onSelect: () => {
      if (selectedSession) setShowDetail((d) => !d);
    },
    onEnterInsert: () => {
      if (selectedSession && mode !== "insert") setMode("insert");
    },
    onEscape: () => {
      if (mode !== "normal") {
        setMode("normal");
      } else if (showDetail) {
        setShowDetail(false);
      }
    },
    onNewSession: () => {
      if (mode !== "create") setMode("create");
    },
    onDeleteSession: () => {
      if (selectedSession) abortSession(selectedSession.id);
    },
    onQuit: () => {
      stopDiscovery();
      exit();
    },
  });

  return (
    <Box flexDirection="column" height={rows}>
      <StatusBar sessions={sessions} mode={mode} />
      <Box paddingX={1}>
        <Text dimColor>{"─".repeat(Math.max(1, cols - 2))}</Text>
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        <SessionList sessions={sessions} selectedIndex={selectedIndex} />
      </Box>

      {showDetail && selectedSession && (
        <SessionDetail session={selectedSession} />
      )}

      {mode === "create" && (
        <SessionCreateModal onSubmit={handleNewSession} />
      )}
      {mode === "insert" && selectedSession && (
        <InputBar
          active
          label={selectedSession.summary.slice(0, 20)}
          onSubmit={handleSendMessage}
        />
      )}
    </Box>
  );
}
