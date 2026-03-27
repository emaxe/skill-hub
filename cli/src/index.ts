#!/usr/bin/env node
import { Command } from 'commander';
import { makeSearchCommand } from './commands/search';
import { makeListCommand } from './commands/list';
import { makeInfoCommand } from './commands/info';
import { makeInstallCommand } from './commands/install';
import { makeRemoveCommand } from './commands/remove';
import { makeUpdateCommand } from './commands/update';
import { makeSetupMcpCommand } from './commands/setup-mcp';

const program = new Command();
program
  .name('skill-hub')
  .description('Extension manager for AI coding agents (Claude Code, Cursor, Copilot)')
  .version('0.1.0');

program.addCommand(makeSearchCommand());
program.addCommand(makeListCommand());
program.addCommand(makeInfoCommand());
program.addCommand(makeInstallCommand());
program.addCommand(makeRemoveCommand());
program.addCommand(makeUpdateCommand());
program.addCommand(makeSetupMcpCommand());

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
