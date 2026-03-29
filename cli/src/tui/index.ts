import { render } from 'ink';
import React from 'react';
import { App } from './App';

export async function startTUI(): Promise<void> {
  // Enter alternate screen and clear it
  process.stdout.write('\x1b[?1049h');
  process.stdout.write('\x1b[2J\x1b[H');

  const restoreTerminal = (): void => {
    process.stdout.write('\x1b[?1049l');
  };

  // Restore terminal on SIGINT (Ctrl+C)
  const sigintHandler = (): void => {
    restoreTerminal();
    process.exit(0);
  };
  process.once('SIGINT', sigintHandler);

  const { waitUntilExit } = render(React.createElement(App), {
    exitOnCtrlC: true,
  });

  try {
    await waitUntilExit();
  } finally {
    process.removeListener('SIGINT', sigintHandler);
    restoreTerminal();
  }
}
