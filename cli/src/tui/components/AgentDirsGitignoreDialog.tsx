/**
 * Диалоговое окно: предупреждение о папках ИИ-агентов, не добавленных в .gitignore.
 *
 * Показывается при старте TUI если настройка gitignoreAgentDirs включена,
 * но часть агентских элементов отсутствует в .gitignore.
 */
import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { theme } from '../theme';

interface Props {
  /** Агентские записи, отсутствующие в .gitignore */
  missingEntries: string[];
  /** Пользователь подтвердил — добавить записи */
  onSync: () => void;
  /** Пользователь пропустил */
  onDismiss: () => void;
  /** Ширина содержимого диалога (без рамки) */
  dialogWidth?: number;
}

const BG = '#1e1e2e';
const BORDER_COLOR = theme.warning;

export const AgentDirsGitignoreDialog: React.FC<Props> = ({ missingEntries, onSync, onDismiss, dialogWidth }) => {
  const { stdout } = useStdout();
  const innerWidth = dialogWidth ?? Math.min(58, (stdout?.columns ?? 80) - 12);

  useInput((_input, key) => {
    if (key.return) onSync();
    if (key.escape) onDismiss();
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
    { text: <Text backgroundColor={BG} color={theme.warning}>{fill('Папки ИИ-агентов не в .gitignore')}</Text> },
    { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
  ];

  const maxItems = 6;
  const shown = missingEntries.slice(0, maxItems);
  for (const entry of shown) {
    lines.push({
      text: <Text backgroundColor={BG} color={theme.secondary}>{fill(`  ${entry}`)}</Text>,
    });
  }
  const more = missingEntries.length - shown.length;
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
          {' \u2192 добавить в .gitignore, '}
          <Text backgroundColor={BG} color={theme.error}>Esc</Text>
          {' \u2192 пропустить'}
          {' '.repeat(Math.max(0, innerWidth - stripAnsi('Нажми Enter → добавить в .gitignore, Esc → пропустить').length))}
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

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}
