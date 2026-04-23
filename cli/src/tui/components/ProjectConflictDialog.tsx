import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { theme } from '../theme';
import { ProjectConflict } from '../../sync';

interface Props {
  conflicts: ProjectConflict[];
  currentProject: string;
  onRemove: () => void;
  onDismiss: () => void;
  /** Ширина содержимого диалога (без рамки) */
  dialogWidth?: number;
}

const BG = '#1e1e2e';
const BORDER_COLOR = theme.warning;

export const ProjectConflictDialog: React.FC<Props> = ({ conflicts, currentProject, onRemove, onDismiss, dialogWidth }) => {
  const { stdout } = useStdout();
  const innerWidth = dialogWidth ?? Math.min(58, (stdout?.columns ?? 80) - 12);

  useInput((_input, key) => {
    if (key.return) onRemove();
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

  const lines: Array<{ text: React.ReactNode }> = [];

  lines.push(
    { text: <Text backgroundColor={BG} color={theme.warning}>{fill(`⚠ Конфликт проекта: ${currentProject}`)}</Text> },
    { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
    { text: <Text backgroundColor={BG} color={theme.muted}>{fill('Установлены расширения для другого проекта:')}</Text> },
    { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
  );

  const maxItems = 5;
  const shown = conflicts.slice(0, maxItems);
  for (const c of shown) {
    const projLabel = c.extensionProjects.join(', ');
    lines.push({
      text: <Text backgroundColor={BG} color={theme.secondary}>{fill(`  ${c.type}:${c.name}  [${projLabel}]`)}</Text>,
    });
  }
  const more = conflicts.length - shown.length;
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
          {' → удалить, '}
          <Text backgroundColor={BG} color={theme.error}>Esc</Text>
          {' → пропустить'}
          {' '.repeat(Math.max(0, innerWidth - 37))}
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
