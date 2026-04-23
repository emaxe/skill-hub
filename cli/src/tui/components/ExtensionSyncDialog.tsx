import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { theme } from '../theme';
import { MissingExtension, UntrackedExtension } from '../../sync';
import { ScanResult } from '../../adapters/types';

interface Props {
  missing: MissingExtension[];
  untracked: UntrackedExtension[];
  onSync: () => void;
  onDismiss: () => void;
  /** Есть ли write-доступ к каталогу */
  hasUploadAccess?: boolean;
  /** Идёт проверка доступа */
  loadingUploadAccess?: boolean;
  /** Открыть экран загрузки */
  onOpenUpload?: (preselected?: ScanResult[]) => void;
  /** Ширина содержимого диалога (без рамки) */
  dialogWidth?: number;
}

const BG = '#1e1e2e';
const BORDER_COLOR = theme.warning;

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const ExtensionSyncDialog: React.FC<Props> = ({ missing, untracked, onSync, onDismiss, hasUploadAccess, loadingUploadAccess, onOpenUpload, dialogWidth }) => {
  const { stdout } = useStdout();
  const innerWidth = dialogWidth ?? Math.min(58, (stdout?.columns ?? 80) - 12);
  const hasActionable = missing.some(e => e.inCatalog) || untracked.some(e => e.inCatalog);
  const uploadable = untracked.filter(e => !e.inCatalog);
  const canUpload = hasUploadAccess && onOpenUpload && uploadable.length > 0;
  const showUploadLoading = loadingUploadAccess && onOpenUpload && uploadable.length > 0;

  const [spinnerIdx, setSpinnerIdx] = useState(0);
  useEffect(() => {
    if (!showUploadLoading) return;
    const t = setInterval(() => setSpinnerIdx(i => (i + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(t);
  }, [showUploadLoading]);

  useInput((input, key) => {
    if (key.return && hasActionable) onSync();
    if (key.escape) onDismiss();
    // Hotkey 'p' для загрузки в каталог
    const ni = input.toLowerCase();
    if ((ni === 'p' || ni === 'з') && canUpload && onOpenUpload) {
      const preselected: ScanResult[] = uploadable.map(e => ({
        type: e.type, name: e.name, scope: e.scope, path: e.path,
      }));
      onDismiss();
      onOpenUpload(preselected);
    }
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
      if (e.inCatalog) {
        lines.push({
          text: <Text backgroundColor={BG} color={theme.secondary}>{fill(`  ${e.type}:${e.name}${e.version ? ` v${e.version}` : ''}`)}</Text>,
        });
      } else {
        lines.push({
          text: <Text backgroundColor={BG} color={theme.muted}>{fill(`  ${e.type}:${e.name}  (нет в каталоге)`)}</Text>,
        });
      }
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
      { text: <Text backgroundColor={BG} color={theme.accent}>{fill('Расширения не указаны в проектном конфиге')}</Text> },
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
    const actionLabel = missing.some(e => e.inCatalog) && untracked.some(e => e.inCatalog)
      ? 'синхронизировать'
      : missing.some(e => e.inCatalog)
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

  // Подсказка для загрузки в каталог (если есть доступ и есть расширения не из каталога)
  if (showUploadLoading) {
    lines.push({
      text: (
        <Text backgroundColor={BG} color={theme.muted}>
          <Text backgroundColor={BG} color={theme.warning}>{SPINNER_FRAMES[spinnerIdx]}</Text>
          {' проверка доступа к каталогу'}
          {' '.repeat(Math.max(0, innerWidth - stripAnsi('• проверка доступа к каталогу').length))}
        </Text>
      ),
    });
  } else if (canUpload) {
    lines.push({
      text: (
        <Text backgroundColor={BG} color={theme.muted}>
          {'Нажми '}
          <Text backgroundColor={BG} color={theme.accent}>p</Text>
          {' \u2192 загрузить в каталог'}
          {' '.repeat(Math.max(0, innerWidth - stripAnsi('Нажми p \u2192 загрузить в каталог').length))}
        </Text>
      ),
    });
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
