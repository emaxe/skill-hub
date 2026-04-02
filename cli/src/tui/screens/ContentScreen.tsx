import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { HintBar } from '../components/HintBar';
import { theme } from '../theme';

export interface ContentScreenProps {
  title: string;
  content: string;
  onBack: () => void;
}

// Chrome inside ContentScreen: 1 (marginTop) + 1 (title) + 1 (border top) + 1 (border bottom) + 1 (HintBar)
const CHROME_LINES = 5;

export const ContentScreen: React.FC<ContentScreenProps> = ({ title, content }) => {
  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 24;
  // Parent provides height = termHeight - 3 (Header). Subtract our internal chrome.
  const viewHeight = Math.max(1, termHeight - 3 - CHROME_LINES);

  const lines = useMemo(() => content.split('\n'), [content]);
  const [offset, setOffset] = useState(0);

  const maxOffset = Math.max(0, lines.length - viewHeight);

  useInput((input, key) => {
    if (key.upArrow || input === 'k') { setOffset(o => Math.max(0, o - 1)); return; }
    if (key.downArrow || input === 'j') { setOffset(o => Math.min(maxOffset, o + 1)); return; }
    if (key.pageUp) { setOffset(o => Math.max(0, o - Math.floor(viewHeight / 2))); return; }
    if (key.pageDown) { setOffset(o => Math.min(maxOffset, o + Math.floor(viewHeight / 2))); return; }
  });

  const visibleLines = lines.slice(offset, offset + viewHeight);

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
        height={viewHeight + 2}
        paddingX={1}
      >
        {visibleLines.map((line, i) => (
          <Text key={offset + i} color={theme.secondary}>{line}</Text>
        ))}
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
