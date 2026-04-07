#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
// If no arguments provided — launch TUI
if (process.argv.length <= 2) {
    Promise.resolve().then(() => __importStar(require('./tui'))).then(({ startTUI }) => startTUI()).catch((err) => {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
    });
}
else {
    const { Command } = require('commander');
    const { makeSearchCommand } = require('./commands/search');
    const { makeListCommand } = require('./commands/list');
    const { makeInfoCommand } = require('./commands/info');
    const { makeInstallCommand } = require('./commands/install');
    const { makeRemoveCommand } = require('./commands/remove');
    const { makeMoveCommand } = require('./commands/move');
    const { makeUpdateCommand } = require('./commands/update');
    const { makeSetupMcpCommand } = require('./commands/setup-mcp');
    const { makeConfigCommand } = require('./commands/config');
    const { makeAgentsConventionsCommand } = require('./commands/agents-conventions');
    const { makeLaunchCommand } = require('./commands/launch');
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
    program.addCommand(makeMoveCommand());
    program.addCommand(makeUpdateCommand());
    program.addCommand(makeSetupMcpCommand());
    program.addCommand(makeConfigCommand());
    program.addCommand(makeAgentsConventionsCommand());
    program.addCommand(makeLaunchCommand());
    program.parseAsync(process.argv).catch((err) => {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
    });
}
