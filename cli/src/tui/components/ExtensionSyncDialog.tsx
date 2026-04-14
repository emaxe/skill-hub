import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { theme } from '../theme';
import { ProjectExtensionRecord } from '../../config';
import { UntrackedExtension } from '../../sync';

interface Props {
  missing: ProjectExtensionRecord[];
  untracked: UntrackedExtension[];
  onSync: () => void;
  onDismiss: () => void;
}

const BG = '#1e1e2e';
const BORDER_COLOR = theme.warning;

export const ExtensionSyncDialog: React.FC<Props> = ({ missing, untracked, onSync, onDismiss }) => {
  const { stdout } = useStdout();
  const innerWidth = Math.min(58, (stdout?.columns ?? 80) - 12);
  const hasActionable = missing.length > 0 || untracked.some(e => e.inCatalog);

  useInput((_input, key) => {
    if (key.return && hasActionable) onSync();
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
  const lines: Array<{ text: React.ReactNode }> = [];

  // --- Missing section ---
  if (missing.length > 0) {
    lines.push(
      { text: <Text backgroundColor={BG} color={theme.warning}>{fill('Расширения из проекта не установлены')}</Text> },
      { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
    );
    const shownMissing = missing.slice(0, maxItems);
    for (const e of shownMissing) {
      lines.push({
        text: <Text backgroundColor={BG} color={theme.secondary}>{fill(`  ${e.type}:${e.name}${e.version ? ` v${e.version}` : ''}`)}</Text>,
      });
    }
    const moreMissing = missing.length - shownMissing.length;
    if (moreMissing > 0) {
      lines.push({
        text: <Text backgroundColor={BG} color={theme.muted}>{fill(`  ...и ещё ${moreMissing}`)}</Text>,
      });
    }
  }

  // --- Untracked section ---
  if (untracked.length > 0) {
    if (missing.length > 0) {
      lines.push({ text: <Text backgroundColor={BG}>{emptyLine}</Text> });
    }
    lines.push(
      { text: <Text backgroundColor={BG} color={theme.accent}>{fill('Расширения не указаны в .skill-hub.json')}</Text> },
      { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
    );
    const shownUntracked = untracked.slice(0, maxItems);
    for (const e of shownUntracked) {
      if (e.inCatalog) {
        lines.push({
          text: <Text backgroundColor={BG} color={theme.secondary}>{fill(`  ${e.type}:${e.name}`)}</Text>,
        });
      } else {
        lines.push({
          text: <Text backgroundColor={BG} color={theme.muted}>{fill(`  ${e.type}:${e.name}  (нет в каталоге)`)}</Text>,
        });
      }
    }
    const moreUntracked = untracked.length - shownUntracked.length;
    if (moreUntracked > 0) {
      lines.push({
        text: <Text backgroundColor={BG} color={theme.muted}>{fill(`  ...и ещё ${moreUntracked}`)}</Text>,
      });
    }
  }

  // --- Footer ---

  if (hasActionable) {
    const actionLabel = missing.length > 0 && untracked.some(e => e.inCatalog)
      ? 'синхронизировать'
      : missing.length > 0
        ? 'установить'
        : 'добавить в конфиг';

    lines.push(
      { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
      {
        text: (
          <Text backgroundColor={BG} color={theme.muted}>
            {'Нажми '}
            <Text backgroundColor={BG} color={theme.success}>Enter</Text>
            {` \u2192 ${actionLabel}, `}
            <Text backgroundColor={BG} color={theme.error}>Esc</Text>
            {' \u2192 пропустить'}
            {' '.repeat(Math.max(0, innerWidth - stripAnsi(`Нажми Enter \u2192 ${actionLabel}, Esc \u2192 пропустить`).length))}
          </Text>
        ),
      },
    );
  } else {
    lines.push(
      { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
      {
        text: (
          <Text backgroundColor={BG} color={theme.muted}>
            {'Нажми '}
            <Text backgroundColor={BG} color={theme.error}>Esc</Text>
            {' \u2192 закрыть'}
            {' '.repeat(Math.max(0, innerWidth - stripAnsi('Нажми Esc \u2192 закрыть').length))}
          </Text>
        ),
      },
    );
  }

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
