/**
 * Диалоговое окно: обновление каталога при старте TUI.
 *
 * Три состояния:
 * - loading: спиннер + кнопка Пропустить (Esc)
 * - error: текст ошибки + Продолжить (Esc) / Повторить (r)
 * - success: не отображается (авто-закрытие из App.tsx)
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { theme } from '../theme';

export type CatalogUpdateStatus = 'loading' | 'error' | 'success';

interface Props {
  /** Текущий статус операции обновления */
  status: CatalogUpdateStatus;
  /** Текст ошибки (только для status === 'error') */
  errorMessage?: string;
  /** Пользователь нажал Esc (пропустить / продолжить без обновления) */
  onSkip: () => void;
  /** Пользователь нажал r (повторить попытку) */
  onRetry: () => void;
  /** Ширина содержимого диалога (без рамки) */
  dialogWidth?: number;
}

const BG = '#1e1e2e';
const BORDER_COLOR = theme.accent;

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

export const CatalogUpdateDialog: React.FC<Props> = ({ status, errorMessage, onSkip, onRetry, dialogWidth }) => {
  const { stdout } = useStdout();
  const innerWidth = dialogWidth ?? Math.min(58, (stdout?.columns ?? 80) - 12);

  const [spinnerIdx, setSpinnerIdx] = useState(0);
  useEffect(() => {
    if (status !== 'loading') return;
    const t = setInterval(() => setSpinnerIdx(i => (i + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(t);
  }, [status]);

  useInput((_input, key) => {
    if (key.escape) { onSkip(); return; }
    const ni = _input.toLowerCase();
    if ((ni === 'r' || ni === 'к') && status === 'error') { onRetry(); return; }
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

  if (status === 'loading') {
    lines.push(
      {
        text: (
          <Text backgroundColor={BG} color={theme.accent}>
            {fill('Обновление каталога...')}
          </Text>
        ),
      },
      { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
      {
        text: (
          <Text backgroundColor={BG} color={theme.muted}>
            <Text backgroundColor={BG} color={theme.warning}>{SPINNER_FRAMES[spinnerIdx]}</Text>
            {' загружаю последние обновления из репозитория'}
            {' '.repeat(Math.max(0, innerWidth - stripAnsi('• загружаю последние обновления из репозитория').length))}
          </Text>
        ),
      },
      { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
      {
        text: (
          <Text backgroundColor={BG} color={theme.muted}>
            {'Нажми '}
            <Text backgroundColor={BG} color={theme.error}>Esc</Text>
            {' \u2192 пропустить'}
            {' '.repeat(Math.max(0, innerWidth - stripAnsi('Нажми Esc → пропустить').length))}
          </Text>
        ),
      },
    );
  } else if (status === 'error') {
    lines.push(
      {
        text: (
          <Text backgroundColor={BG} color={theme.error}>
            {fill('Не удалось обновить каталог')}
          </Text>
        ),
      },
      { text: <Text backgroundColor={BG}>{emptyLine}</Text> },
    );
    if (errorMessage) {
      const maxErrLen = innerWidth - 2;
      const shortErr = errorMessage.length > maxErrLen ? errorMessage.slice(0, maxErrLen - 1) + '…' : errorMessage;
      lines.push({
        text: <Text backgroundColor={BG} color={theme.muted}>{fill(`  ${shortErr}`)}</Text>,
      });
      lines.push({ text: <Text backgroundColor={BG}>{emptyLine}</Text> });
    }
    lines.push(
      {
        text: (
          <Text backgroundColor={BG} color={theme.muted}>
            {'Нажми '}
            <Text backgroundColor={BG} color={theme.warning}>r</Text>
            {' \u2192 повторить, '}
            <Text backgroundColor={BG} color={theme.error}>Esc</Text>
            {' \u2192 продолжить без обновления'}
            {' '.repeat(Math.max(0, innerWidth - stripAnsi('Нажми r → повторить, Esc → продолжить без обновления').length))}
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
