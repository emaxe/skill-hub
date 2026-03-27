#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const search_1 = require("./commands/search");
const list_1 = require("./commands/list");
const info_1 = require("./commands/info");
const install_1 = require("./commands/install");
const remove_1 = require("./commands/remove");
const update_1 = require("./commands/update");
const setup_mcp_1 = require("./commands/setup-mcp");
const program = new commander_1.Command();
program
    .name('skill-hub')
    .description('Extension manager for AI coding agents (Claude Code, Cursor, Copilot)')
    .version('0.1.0');
program.addCommand((0, search_1.makeSearchCommand)());
program.addCommand((0, list_1.makeListCommand)());
program.addCommand((0, info_1.makeInfoCommand)());
program.addCommand((0, install_1.makeInstallCommand)());
program.addCommand((0, remove_1.makeRemoveCommand)());
program.addCommand((0, update_1.makeUpdateCommand)());
program.addCommand((0, setup_mcp_1.makeSetupMcpCommand)());
program.parseAsync(process.argv).catch((err) => {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
});
