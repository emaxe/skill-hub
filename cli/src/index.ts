#!/usr/bin/env node

// If no arguments provided — launch TUI
if (process.argv.length <= 2) {
  import('./tui').then(({ startTUI }) => startTUI()).catch((err: Error) => {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  });
} else {
  const { Command } = require('commander') as typeof import('commander');
  const { makeSearchCommand } = require('./commands/search') as typeof import('./commands/search');
  const { makeListCommand } = require('./commands/list') as typeof import('./commands/list');
  const { makeInfoCommand } = require('./commands/info') as typeof import('./commands/info');
  const { makeInstallCommand } = require('./commands/install') as typeof import('./commands/install');
  const { makeRemoveCommand } = require('./commands/remove') as typeof import('./commands/remove');
  const { makeMoveCommand } = require('./commands/move') as typeof import('./commands/move');
  const { makeUpdateCommand } = require('./commands/update') as typeof import('./commands/update');
  const { makeSetupMcpCommand } = require('./commands/setup-mcp') as typeof import('./commands/setup-mcp');
  const { makeConfigCommand } = require('./commands/config') as typeof import('./commands/config');
  const { makeAgentsConventionsCommand } = require('./commands/agents-conventions') as typeof import('./commands/agents-conventions');
  const { makeLaunchCommand } = require('./commands/launch') as typeof import('./commands/launch');

  const program = new Command();
  program
    .name('skill-hub')
    .description('Extension manager for AI coding agents (Claude Code, Cursor, Copilot)')
    .version('0.1.7');

  program.addCommand(makeSearchCommand());
  program.addCommand(makeListCommand());
  program.addCommand(makeInfoCommand());
  program.addCommand(makeInstallCommand());
  program.addCommand(makeRemoveCommand());
  program.addCommand(makeMoveCommand());
  program.addCommand(makeUpdateCommand());
  program.addCommand(makeSetupMcpCommand());
  program.addCommand(makeConfigCommand());
  program.addCommand(makeAgentsConventionsCommand());
  program.addCommand(makeLaunchCommand());

  program.parseAsync(process.argv).catch((err: Error) => {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  });
}
