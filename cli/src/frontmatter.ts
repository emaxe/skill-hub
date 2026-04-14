/**
 * Утилиты для работы с YAML frontmatter в .md файлах.
 */

const FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Удаляет YAML frontmatter из markdown-контента */
export function stripFrontmatter(content: string): string {
  return content.replace(FM_REGEX, '');
}

/** Извлекает тело (без frontmatter) и значение description из frontmatter */
export function parseFrontmatter(content: string): { body: string; description?: string } {
  const match = content.match(FM_REGEX);
  if (!match) return { body: content };

  const body = content.slice(match[0].length);
  const descMatch = match[1].match(/^description:\s*"?(.*?)"?\s*$/m);
  return { body, description: descMatch?.[1] };
}
