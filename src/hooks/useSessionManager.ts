import { useState, useEffect } from "react";
import { store } from "../services/session-store.js";
import type { OrchestraSession } from "../types.js";

export function useSessionManager() {
  const [sessions, setSessions] = useState<OrchestraSession[]>(store.getAll());

  useEffect(() => {
    const onUpdate = () => {
      setSessions(store.getAll());
    };

    store.on("sessions-updated", onUpdate);
    store.on("session-messages-updated", onUpdate);

    return () => {
      store.off("sessions-updated", onUpdate);
      store.off("session-messages-updated", onUpdate);
    };
  }, []);

  return { sessions };
}
