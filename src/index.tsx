import React from "react";
import { render } from "ink";
import { App } from "./app.js";

// Enter alternate screen buffer for clean rendering
const enterAltScreen = () => {
  if (process.stdout.isTTY) {
    process.stdout.write("\x1b[?1049h");
    process.stdout.write("\x1b[?25l");
  }
};

const exitAltScreen = () => {
  if (process.stdout.isTTY) {
    process.stdout.write("\x1b[?25h");
    process.stdout.write("\x1b[?1049l");
  }
};

enterAltScreen();

const instance = render(<App />, {
  exitOnCtrlC: true,
  patchConsole: false,
});

instance.waitUntilExit().then(() => {
  exitAltScreen();
});

// Also clean up on unexpected exit
process.on("exit", exitAltScreen);
