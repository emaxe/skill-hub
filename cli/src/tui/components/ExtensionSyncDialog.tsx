import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { theme } from '../theme';
import { ProjectExtensionRecord } from '../../config';

interface Props {
  missing: ProjectExtensionRecord[];
  onInstall: () => void;
  onDismiss: () => void;
}

const BG = '#1e1e2e';
const BORDER_COLOR = theme.warning;

export const ExtensionSyncDialog: React.FC<Props> = ({ missing, onInstall, onDismiss }) => {
  const { stdout } = useStdout();
  const innerWidth = Math.min(58, (stdout?.columns ?? 80) - 12);

  useInput((_input, key) => {
    if (key.return) onInstall();
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

  const maxItems = 5;
  const shown = missing.slice(0, maxItems);
  const moreCount = missing.length - shown.length;

  const lines: Array<{ text: React.ReactNode }> = [
    { text: <Text backgroundColor={BG} color={theme.warning}>{fill('Расширения из проекта не установлены')}</Text> },
    { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
    ...shown.map(e => ({
      text: <Text backgroundColor={BG} color={theme.secondary}>{fill(`  ${e.type}:${e.name}${e.version ? ` v${e.version}` : ''}`)}</Text>,
    })),
  ];

  if (moreCount > 0) {
    lines.push({
      text: <Text backgroundColor={BG} color={theme.muted}>{fill(`  ...и ещё ${moreCount}`)}</Text>,
    });
  }

  lines.push(
    { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
    {
      text: (
        <Text backgroundColor={BG} color={theme.muted}>
          {'Нажми '}
          <Text backgroundColor={BG} color={theme.success}>Enter</Text>
          {' \u2192 установить, '}
          <Text backgroundColor={BG} color={theme.error}>Esc</Text>
          {' \u2192 пропустить'}
          {' '.repeat(Math.max(0, innerWidth - 42))}
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
