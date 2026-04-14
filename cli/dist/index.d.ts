#!/usr/bin/env node
/**
 * Транслирует сокращения -u / -U в команду update.
 * -u [name] → update [name]
 * -U        → update (без аргументов, обновить всё)
 */
declare function translateShortcuts(argv: string[]): string[];
/**
 * Выполнить одну skill-hub команду по переданному argv.
 */
declare function executeArgs(argv: string[]): Promise<void>;
