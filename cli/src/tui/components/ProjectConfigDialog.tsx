import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { theme } from '../theme';

interface Props {
  onCreate: () => void;
  onDismiss: () => void;
  /** Ширина содержимого диалога (без рамки) */
  dialogWidth?: number;
}

const BG = '#1e1e2e';
const BORDER_COLOR = theme.primary;

export const ProjectConfigDialog: React.FC<Props> = ({ onCreate, onDismiss, dialogWidth }) => {
  const { stdout } = useStdout();
  const innerWidth = dialogWidth ?? Math.min(58, (stdout?.columns ?? 80) - 12);

  useInput((_input, key) => {
    if (key.return) onCreate();
    if (key.escape) onDismiss();
  });

  const fill = (s: string) => {
    const visible = stripAnsi(s);
    const pad = Math.max(0, innerWidth - visible.length);
    return s + ' '.repeat(pad);
  };

  const emptyLine = ' '.repeat(innerWidth);
  const top = '╭' + '─'.repeat(innerWidth + 2) + '╮';
  const bot = '╰' + '─'.repeat(innerWidth + 2) + '╯';

  const lines: Array<{ text: React.ReactNode }> = [
    { text: <Text backgroundColor={BG} color={theme.primary}>{fill('Проектный конфиг не найден')}</Text> },
    { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
    { text: <Text backgroundColor={BG} color={theme.secondary}>{fill('В этом проекте нет проектного конфига.')}</Text> },
    { text: <Text backgroundColor={BG} color={theme.secondary}>{fill('Создать из глобальных настроек?')}</Text> },
    { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
    {
      text: (
        <Text backgroundColor={BG} color={theme.muted}>
          {'Нажми '}
          <Text backgroundColor={BG} color={theme.success}>Enter</Text>
          {' → создать, '}
          <Text backgroundColor={BG} color={theme.error}>Esc</Text>
          {' → пропустить'}
          {' '.repeat(Math.max(0, innerWidth - 40))}
        </Text>
      ),
    },
  ];

  return (
    <Box flexDirection="column">
      <Text backgroundColor={BG} color={BORDER_COLOR}>{top}</Text>
      {lines.map((line, i) => (
        <Text key={i} backgroundColor={BG}>
          <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
          <Text backgroundColor={BG}>{' '}</Text>
          {line.text}
          <Text backgroundColor={BG}>{' '}</Text>
          <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
        </Text>
      ))}
      <Text backgroundColor={BG} color={BORDER_COLOR}>{bot}</Text>
    </Box>
  );
};

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}
