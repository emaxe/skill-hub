import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme';

export interface Hint {
  key: string;
  description: string;
}

interface Props {
  hints: Hint[];
  maxWidth?: number;
}

/** Ширина одного hint: [key] + пробел + description + разделитель (2 символа между хинтами) */
function calcHintWidth(hint: Hint, desc: string): number {
  return `[${hint.key}] ${desc}`.length;
}

function fitHints(hints: Hint[], maxWidth: number): { key: string; description: string }[] {
  const gap = 2; // "  " between hints
  const padding = 2; // paddingX={1} → 1 char each side

  // 1. Try full descriptions
  let total = padding;
  for (let i = 0; i < hints.length; i++) {
    if (i > 0) total += gap;
    total += calcHintWidth(hints[i], hints[i].description);
  }
  if (total <= maxWidth) return hints;

  // 2. Truncate descriptions to first word
  const truncated = hints.map(h => ({
    key: h.key,
    description: h.description.split(' ')[0],
  }));
  total = padding;
  for (let i = 0; i < truncated.length; i++) {
    if (i > 0) total += gap;
    total += calcHintWidth(truncated[i], truncated[i].description);
  }
  if (total <= maxWidth) return truncated;

  // 3. Drop hints from the end until fits
  const result = [...truncated];
  while (result.length > 0) {
    result.pop();
    total = padding;
    for (let i = 0; i < result.length; i++) {
      if (i > 0) total += gap;
      total += calcHintWidth(result[i], result[i].description);
    }
    if (total <= maxWidth) return result;
  }
  return [];
}

export const HintBar: React.FC<Props> = ({ hints, maxWidth }) => {
  const visibleHints = maxWidth != null ? fitHints(hints, maxWidth) : hints;

  return (
    <Box paddingX={1}>
      {visibleHints.map((hint, i) => (
        <React.Fragment key={hint.key}>
          {i > 0 && <Text color={theme.muted}>  </Text>}
          <Text color={theme.accent}>[{hint.key}]</Text>
          <Text color={theme.muted}> {hint.description}</Text>
        </React.Fragment>
      ))}
    </Box>
  );
};
