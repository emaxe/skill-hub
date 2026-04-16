/**
 * Диалог ввода учётных данных git.
 * Показывается когда git-операция требует аутентификации (clone/pull с HTTPS).
 * Tab / стрелки переключают между полями username и password.
 * Пароль отображается как «*».
 */
import React, { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { theme } from '../theme';

export interface GitCredentials {
  username: string;
  password: string;
}

interface Props {
  /** URL репозитория, для которого нужна аутентификация */
  url: string;
  /** Вызывается с введёнными учётными данными при подтверждении */
  onConfirm: (creds: GitCredentials) => void;
  /** Вызывается при отмене */
  onCancel: () => void;
}

type Field = 'username' | 'password';

export const GitCredentialsDialog: React.FC<Props> = ({ url, onConfirm, onCancel }) => {
  const { stdout } = useStdout();
  const innerWidth = Math.min(56, (stdout?.columns ?? 80) - 12);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeField, setActiveField] = useState<Field>('username');

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      if (activeField === 'username') {
        // Enter на username переключает на password
        setActiveField('password');
        return;
      }
      // Enter на password — подтвердить
      if (username.trim()) {
        onConfirm({ username: username.trim(), password });
      }
      return;
    }

    if (key.tab || key.upArrow || key.downArrow) {
      setActiveField(f => (f === 'username' ? 'password' : 'username'));
      return;
    }

    if (key.backspace || key.delete) {
      if (activeField === 'username') {
        setUsername(prev => prev.slice(0, -1));
      } else {
        setPassword(prev => prev.slice(0, -1));
      }
      return;
    }

    if (input && !key.ctrl && !key.meta && input.length === 1) {
      if (activeField === 'username') {
        setUsername(prev => prev + input);
      } else {
        setPassword(prev => prev + input);
      }
    }
  });

  const BG = '#1e1e2e';
  const BORDER_COLOR = theme.warning;

  const pad = (s: string) => {
    const len = s.replace(/\x1b\[[0-9;]*m/g, '').length;
    return s + ' '.repeat(Math.max(0, innerWidth - len));
  };

  const empty = ' '.repeat(innerWidth);
  const top = '╭' + '─'.repeat(innerWidth + 2) + '╮';
  const bot = '╰' + '─'.repeat(innerWidth + 2) + '╯';
  const divider = '├' + '─'.repeat(innerWidth + 2) + '┤';

  // Форматирование поля ввода с курсором
  const renderField = (label: string, value: string, masked: boolean, active: boolean) => {
    const displayValue = masked ? '*'.repeat(value.length) : value;
    const cursor = active ? '▌' : '';
    const labelStr = `${label}: `;
    const maxValueLen = innerWidth - labelStr.length - 1;
    const truncated = displayValue.length > maxValueLen
      ? displayValue.slice(displayValue.length - maxValueLen)
      : displayValue;

    return (
      <Text key={label} backgroundColor={BG}>
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
        <Text backgroundColor={BG}>{' '}</Text>
        <Text backgroundColor={BG} color={active ? theme.primary : theme.muted}>{labelStr}</Text>
        <Text backgroundColor={BG} color={active ? theme.warning : theme.secondary}>{truncated}</Text>
        {active ? <Text backgroundColor={BG} color={theme.primary}>{cursor}</Text> : null}
        <Text backgroundColor={BG}>{' '.repeat(Math.max(0, innerWidth - labelStr.length - truncated.length - (active ? 1 : 0)))}</Text>
        {' '}
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
      </Text>
    );
  };

  const shortUrl = url.length > innerWidth - 4 ? '…' + url.slice(-(innerWidth - 5)) : url;

  return (
    <Box flexDirection="column">
      <Text backgroundColor={BG} color={BORDER_COLOR}>{top}</Text>

      {/* Заголовок */}
      <Text backgroundColor={BG}>
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
        <Text backgroundColor={BG}>{' '}</Text>
        <Text backgroundColor={BG} color={theme.warning} bold>{pad('Требуется аутентификация git')}</Text>
        <Text backgroundColor={BG}>{' '}</Text>
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
      </Text>

      {/* URL */}
      <Text backgroundColor={BG}>
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
        <Text backgroundColor={BG}>{' '}</Text>
        <Text backgroundColor={BG} color={theme.muted}>{pad(shortUrl)}</Text>
        <Text backgroundColor={BG}>{' '}</Text>
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
      </Text>

      {/* Пустая строка */}
      <Text backgroundColor={BG}>
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
        <Text backgroundColor={BG}>{' '}{empty}{' '}</Text>
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
      </Text>

      <Text backgroundColor={BG} color={BORDER_COLOR}>{divider}</Text>

      {/* Поле username */}
      {renderField('Username', username, false, activeField === 'username')}

      {/* Пустая строка */}
      <Text backgroundColor={BG}>
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
        <Text backgroundColor={BG}>{' '}{empty}{' '}</Text>
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
      </Text>

      {/* Поле password */}
      {renderField('Password', password, true, activeField === 'password')}

      {/* Пустая строка */}
      <Text backgroundColor={BG}>
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
        <Text backgroundColor={BG}>{' '}{empty}{' '}</Text>
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
      </Text>

      <Text backgroundColor={BG} color={BORDER_COLOR}>{divider}</Text>

      {/* Подсказки */}
      <Text backgroundColor={BG}>
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
        <Text backgroundColor={BG}>{' '}</Text>
        <Text backgroundColor={BG} color={theme.muted}>
          {'Нажми '}
          <Text backgroundColor={BG} color={theme.success}>Enter</Text>
          {' → подтвердить, '}
          <Text backgroundColor={BG} color={theme.error}>Esc</Text>
          {' → отмена, '}
          <Text backgroundColor={BG} color={theme.muted}>Tab</Text>
          {' → поле'}
          {' '.repeat(Math.max(0, innerWidth - 46))}
        </Text>
        <Text backgroundColor={BG}>{' '}</Text>
        <Text backgroundColor={BG} color={BORDER_COLOR}>{'│'}</Text>
      </Text>

      <Text backgroundColor={BG} color={BORDER_COLOR}>{bot}</Text>
    </Box>
  );
};
