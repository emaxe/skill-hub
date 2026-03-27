#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();
program
  .name('skill-hub')
  .description('Extension manager for AI coding agents (Claude Code, Cursor, Copilot)')
  .version('0.1.0');

program.parse(process.argv);
