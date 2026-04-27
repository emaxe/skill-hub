/**
 * Диалоговое окно: обновление базового скилла и/или MCP.
 *
 * Показывается при старте TUI если base-skill или MCP уже установлены
 * и доступно обновление из текущей версии пакета.
 * Enter = обновить, Esc = пропустить.
 */
import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { theme } from '../theme';

interface Props {
  /** Требует ли обновления базовый скилл */
  hasBaseSkill: boolean;
  /** Требует ли обновления MCP */
  hasMcp: boolean;
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

export const SelfUpdateDialog: React.FC<Props> = ({ hasBaseSkill, hasMcp, onUpdate, onSkip, dialogWidth }) => {
  const { stdout } = useStdout();
  const innerWidth = dialogWidth ?? Math.min(58, (stdout?.columns ?? 80) - 12);

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
          {fill('Доступно обновление компонентов skill-hub')}
        </Text>
      ),
    },
    { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
  ];

  if (hasBaseSkill) {
    lines.push({
      text: (
        <Text backgroundColor={BG} color={theme.secondary}>
          {fill('  • базовый скилл (base-skill)')}
        </Text>
      ),
    });
  }
  if (hasMcp) {
    lines.push({
      text: (
        <Text backgroundColor={BG} color={theme.secondary}>
          {fill('  • MCP-сервер')}
        </Text>
      ),
    });
  }

  lines.push(
    { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
    {
      text: (
        <Text backgroundColor={BG} color={theme.muted}>
          {'Нажми '}
          <Text backgroundColor={BG} color={theme.success}>Enter</Text>
          {' \u2192 обновить, '}
          <Text backgroundColor={BG} color={theme.error}>Esc</Text>
          {' \u2192 пропустить'}
          {' '.repeat(Math.max(0, innerWidth - stripAnsi('Нажми Enter → обновить, Esc → пропустить').length))}
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
