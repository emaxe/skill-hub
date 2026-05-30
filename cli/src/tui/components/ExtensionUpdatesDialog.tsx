/**
 * Диалоговое окно: доступны обновления установленных расширений.
 *
 * Показывается при старте TUI если есть расширения с устаревшими версиями.
 * Enter = обновить все, Esc = пропустить.
 */
import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { AgentName } from '../../catalog';
import { theme } from '../theme';

export interface ExtensionUpdateEntry {
  type: string;
  name: string;
  currentVersion: string;
  newVersion: string;
  scope: 'global' | 'project';
  sourceAgent?: AgentName;
  /** Источник установки (например, 'skillssh:owner/repo@slug') */
  source?: string;
}

interface Props {
  /** Список расширений с доступными обновлениями */
  updates: ExtensionUpdateEntry[];
  /** Пользователь подтвердил обновление */
  onUpdate: () => void;
  /** Пользователь пропустил */
  onSkip: () => void;
  /** Ширина содержимого диалога (без рамки) */
  dialogWidth?: number;
}

const BG = '#1e1e2e';
const BORDER_COLOR = theme.accent;

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

export const ExtensionUpdatesDialog: React.FC<Props> = ({ updates, onUpdate, onSkip, dialogWidth }) => {
  const { stdout } = useStdout();
  const innerWidth = dialogWidth ?? Math.min(62, (stdout?.columns ?? 80) - 12);

  useInput((_input, key) => {
    if (key.return) { onUpdate(); return; }
    if (key.escape) { onSkip(); return; }
  });

  const fill = (s: string) => {
    const visible = stripAnsi(s);
    const pad = Math.max(0, innerWidth - visible.length);
    return s + ' '.repeat(pad);
  };

  const emptyLine = ' '.repeat(innerWidth);
  const top = '\u256D' + '\u2500'.repeat(innerWidth + 2) + '\u256E';
  const bot = '\u2570' + '\u2500'.repeat(innerWidth + 2) + '\u256F';

  const lines: Array<{ text: React.ReactNode }> = [
    {
      text: (
        <Text backgroundColor={BG} color={theme.accent}>
          {fill(`Доступны обновления расширений (${updates.length})`)}
        </Text>
      ),
    },
    { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
  ];

  const maxItems = 7;
  const shown = updates.slice(0, maxItems);
  for (const entry of shown) {
    const label = `  ${entry.type}:${entry.name}`;
    const versions = ` ${entry.currentVersion} → ${entry.newVersion}`;
    const maxLabelLen = innerWidth - stripAnsi(versions).length;
    const truncated = label.length > maxLabelLen ? label.slice(0, maxLabelLen - 1) + '…' : label;
    const padded = truncated + ' '.repeat(Math.max(0, maxLabelLen - truncated.length));
    lines.push({
      text: (
        <Text backgroundColor={BG}>
          <Text backgroundColor={BG} color={theme.secondary}>{padded}</Text>
          <Text backgroundColor={BG} color={theme.muted}>{versions}</Text>
        </Text>
      ),
    });
  }
  const more = updates.length - shown.length;
  if (more > 0) {
    lines.push({
      text: <Text backgroundColor={BG} color={theme.muted}>{fill(`  ...и ещё ${more}`)}</Text>,
    });
  }

  lines.push(
    { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
    {
      text: (
        <Text backgroundColor={BG} color={theme.muted}>
          {'Нажми '}
          <Text backgroundColor={BG} color={theme.success}>Enter</Text>
          {' \u2192 обновить все, '}
          <Text backgroundColor={BG} color={theme.error}>Esc</Text>
          {' \u2192 пропустить'}
          {' '.repeat(Math.max(0, innerWidth - stripAnsi('Нажми Enter → обновить все, Esc → пропустить').length))}
        </Text>
      ),
    },
  );

  return (
    <Box flexDirection="column">
      <Text backgroundColor={BG} color={BORDER_COLOR}>{top}</Text>
      {lines.map((line, i) => (
        <Text key={i} backgroundColor={BG}>
          <Text backgroundColor={BG} color={BORDER_COLOR}>{'\u2502'}</Text>
          <Text backgroundColor={BG}>{' '}</Text>
          {line.text}
          <Text backgroundColor={BG}>{' '}</Text>
          <Text backgroundColor={BG} color={BORDER_COLOR}>{'\u2502'}</Text>
        </Text>
      ))}
      <Text backgroundColor={BG} color={BORDER_COLOR}>{bot}</Text>
    </Box>
  );
};
