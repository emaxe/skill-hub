#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const program = new commander_1.Command();
program
    .name('skill-hub')
    .description('Extension manager for AI coding agents (Claude Code, Cursor, Copilot)')
    .version('0.1.0');
program.parse(process.argv);
