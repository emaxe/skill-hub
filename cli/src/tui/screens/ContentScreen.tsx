import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { HintBar } from '../components/HintBar';
import { theme } from '../theme';
import { normalizeInput } from '../keymap';

export interface ContentScreenProps {
  title: string;
  content: string;
  onBack: () => void;
  viewHeight: number;
}

export const ContentScreen: React.FC<ContentScreenProps> = ({ title, content, onBack, viewHeight }) => {
  const lines = useMemo(() => content.split('\n'), [content]);
  const [offset, setOffset] = useState(0);

  const maxOffset = Math.max(0, lines.length - viewHeight);

  useInput((rawInput, key) => {
    const input = normalizeInput(rawInput);
    if (key.escape) { onBack(); return; }
    if (key.upArrow || input === 'k') { setOffset(o => Math.max(0, o - 1)); return; }
    if (key.downArrow || input === 'j') { setOffset(o => Math.min(maxOffset, o + 1)); return; }
    if (key.pageUp) { setOffset(o => Math.max(0, o - Math.floor(viewHeight / 2))); return; }
    if (key.pageDown) { setOffset(o => Math.min(maxOffset, o + Math.floor(viewHeight / 2))); return; }
  });

  const visibleLines = lines.slice(offset, offset + viewHeight);
  const emptyLinesCount = Math.max(0, viewHeight - visibleLines.length);
  const emptyLines = Array(emptyLinesCount).fill('');

  return (
    <Box flexDirection="column" height="100%">
      <Box paddingX={1} marginTop={1}>
        <Text bold color={theme.primary}>{title}</Text>
        <Text color={theme.muted}>  строка {offset + 1}/{lines.length}</Text>
      </Box>

      <Box
        borderStyle="round"
        borderColor={theme.border}
        flexDirection="column"
        flexGrow={1}
        justifyContent="space-between"
        paddingX={1}
      >
        <Box flexDirection="column">
          {visibleLines.map((line, i) => (
            <Text key={offset + i} color={theme.secondary}>{line}</Text>
          ))}
        </Box>
        {emptyLinesCount > 0 && (
          <Box flexDirection="column">
            {emptyLines.map((_, i) => (
              <Text key={`empty-${i}`} color={theme.secondary}> </Text>
            ))}
          </Box>
        )}
      </Box>

      <Box paddingX={1}>
        <HintBar hints={[
          { key: '↑↓/jk', description: 'скролл' },
          { key: 'PgUp/PgDn', description: 'полстраницы' },
          { key: 'Esc', description: 'назад' },
        ]} />
      </Box>
    </Box>
  );
};
