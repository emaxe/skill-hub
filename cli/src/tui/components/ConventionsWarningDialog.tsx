import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { theme } from '../theme';

export interface ConventionsIssue {
  label: string;
}

interface Props {
  issues: ConventionsIssue[];
  onGoToSettings: () => void;
  onDismiss: () => void;
  /** Восстановить структуру conventions автоматически (ensureConventionsStructure) */
  onRepair?: () => void;
  /** Ширина содержимого диалога (без рамки) */
  dialogWidth?: number;
}

const BG = '#1e1e2e';
const BORDER_COLOR = theme.warning;

export const ConventionsWarningDialog: React.FC<Props> = ({ issues, onGoToSettings, onDismiss, onRepair, dialogWidth }) => {
  const { stdout } = useStdout();
  const innerWidth = dialogWidth ?? Math.min(58, (stdout?.columns ?? 80) - 12);

  useInput((_input, key) => {
    if (key.return) onGoToSettings();
    if (key.escape) onDismiss();
    const ni = _input.toLowerCase();
    if ((ni === 'r' || ni === 'к') && onRepair) { onRepair(); return; }
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
    { text: <Text backgroundColor={BG} color={theme.warning}>{fill('Режим agents-conventions: проблемы')}</Text> },
    { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
  ];

  for (const issue of issues) {
    lines.push({
      text: <Text backgroundColor={BG} color={theme.secondary}>{fill(`• ${issue.label}`)}</Text>,
    });
  }

  lines.push({ text: <Text backgroundColor={BG}>{emptyLine}</Text> });

  if (onRepair) {
    lines.push({
      text: (
        <Text backgroundColor={BG} color={theme.muted}>
          {'Нажми '}
          <Text backgroundColor={BG} color={theme.accent}>r</Text>
          {' → восстановить, '}
          <Text backgroundColor={BG} color={theme.success}>Enter</Text>
          {' → настройки, '}
          <Text backgroundColor={BG} color={theme.error}>Esc</Text>
          {' → закрыть'}
          {' '.repeat(Math.max(0, innerWidth - stripAnsi('Нажми r → восстановить, Enter → настройки, Esc → закрыть').length))}
        </Text>
      ),
    });
  } else {
    lines.push({
      text: (
        <Text backgroundColor={BG} color={theme.muted}>
          {'Нажми '}
          <Text backgroundColor={BG} color={theme.success}>Enter</Text>
          {' → настройки, '}
          <Text backgroundColor={BG} color={theme.error}>Esc</Text>
          {' → закрыть'}
          {' '.repeat(Math.max(0, innerWidth - 39))}
        </Text>
      ),
    });
  }

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
