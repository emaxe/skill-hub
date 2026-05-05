import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme';
import { isUpArrow, isDownArrow, isLeftArrow, isRightArrow } from '../keymap';

interface TextEditModalProps {
  title: string;
  value: string;
  history: string[];
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const TextEditModal: React.FC<TextEditModalProps> = ({
  title,
  value,
  history,
  onConfirm,
  onCancel,
}) => {
  const [text, setText] = useState(value);
  // -1 = editing text field, 0..N = selecting from history
  const [selectedIdx, setSelectedIdx] = useState(-1);

  // Filter out current value and empty strings from history
  const filteredHistory = history.filter(h => h && h !== value);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      onConfirm(text);
      return;
    }

    if (isUpArrow(input, key) || isDownArrow(input, key)) {
      if (filteredHistory.length === 0) return;
      setSelectedIdx(prev => {
        const max = filteredHistory.length - 1;
        if (isDownArrow(input, key)) {
          if (prev === -1) {
            const next = 0;
            setText(filteredHistory[next]);
            return next;
          }
          if (prev >= max) {
            setText(value);
            return -1;
          }
          const next = prev + 1;
          setText(filteredHistory[next]);
          return next;
        } else {
          if (prev === -1) {
            const next = max;
            setText(filteredHistory[next]);
            return next;
          }
          if (prev <= 0) {
            setText(value);
            return -1;
          }
          const next = prev - 1;
          setText(filteredHistory[next]);
          return next;
        }
      });
      return;
    }

    // Text editing (only when in text field mode)
    if (key.backspace || key.delete) {
      setText(prev => prev.slice(0, -1));
      setSelectedIdx(-1);
      return;
    }

    if (input && !isLeftArrow(input, key) && !isRightArrow(input, key)) {
      setText(prev => prev + input);
      setSelectedIdx(-1);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.primary} paddingX={2} paddingY={1}>
      <Text bold color={theme.primary}>{title}</Text>

      <Box marginTop={1}>
        <Text color={selectedIdx === -1 ? theme.selected : theme.secondary}>
          {selectedIdx === -1 ? '▶ ' : '  '}
        </Text>
        <Text color={theme.warning}>
          {text}
          {selectedIdx === -1 ? '▌' : ''}
        </Text>
      </Box>

      {filteredHistory.length > 0 && (
        <>
          <Box marginTop={1}>
            <Text dimColor>{'  '}── История ──</Text>
          </Box>
          {filteredHistory.map((item, idx) => (
            <Box key={idx}>
              <Text color={selectedIdx === idx ? theme.selected : theme.muted}>
                {selectedIdx === idx ? '▶ ' : '  '}{item}
              </Text>
            </Box>
          ))}
        </>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          [Enter] сохранить  [Esc] отмена{filteredHistory.length > 0 ? '  [↑↓] история' : ''}
        </Text>
      </Box>
    </Box>
  );
};
