import { useInput } from "ink";
import type { AppMode } from "../types.js";

type KeyBindingActions = {
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onSelect: () => void;
  onEnterInsert: () => void;
  onEscape: () => void;
  onNewSession: () => void;
  onDeleteSession: () => void;
  onQuit: () => void;
};

export function useKeyBindings(mode: AppMode, actions: KeyBindingActions) {
  useInput(
    (input, key) => {
      if (key.escape) {
        actions.onEscape();
        return;
      }

      // In insert/create mode, only handle escape (above)
      if (mode === "insert" || mode === "create") {
        return;
      }

      // Normal mode
      if (key.upArrow || input === "k") {
        actions.onNavigateUp();
      } else if (key.downArrow || input === "j") {
        actions.onNavigateDown();
      } else if (key.return) {
        actions.onSelect();
      } else if (input === "i" || input === "r") {
        actions.onEnterInsert();
      } else if (input === "n") {
        actions.onNewSession();
      } else if (input === "d") {
        actions.onDeleteSession();
      } else if (input === "q") {
        actions.onQuit();
      }
      // Unrecognized keys: do nothing (no re-render)
    },
  );
}
