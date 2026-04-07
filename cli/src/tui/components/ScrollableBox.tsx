import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme';

export interface ScrollableBoxProps {
  /** Maximum visible height in rows */
  height: number;
  /** Array of child elements (each assumed ~1 row unless itemHeight specified) */
  children: React.ReactNode;
  /** Whether this component handles keyboard input */
  isActive?: boolean;
  /** Index of the currently focused item — auto-scrolls to keep it visible */
  activeIndex?: number;
}

/**
 * Scrollable container for Ink 3.x.
 * Flattens children into an array and renders only the visible window.
 * Shows ▲/▼ indicators when content overflows.
 */
export const ScrollableBox: React.FC<ScrollableBoxProps> = ({
  height,
  children,
  isActive = true,
  activeIndex,
}) => {
  const items = React.Children.toArray(children);
  const totalItems = items.length;
  const [offset, setOffset] = useState(0);

  // Reserve 1 row for each indicator when scrolling is needed
  const indicatorRows = totalItems > height ? 1 : 0;
  const visibleCount = Math.max(1, height - indicatorRows * 2);

  const maxOffset = Math.max(0, totalItems - visibleCount);

  // Auto-scroll to keep activeIndex visible
  useEffect(() => {
    if (activeIndex == null) return;
    if (activeIndex < offset) {
      setOffset(activeIndex);
    } else if (activeIndex >= offset + visibleCount) {
      setOffset(Math.min(maxOffset, activeIndex - visibleCount + 1));
    }
  }, [activeIndex, visibleCount, maxOffset]);

  // Clamp offset when content or height changes
  useEffect(() => {
    if (offset > maxOffset) setOffset(maxOffset);
  }, [maxOffset, offset]);

  useInput((_, key) => {
    if (!isActive || totalItems <= height) return;

    if (key.pageUp) {
      setOffset(o => Math.max(0, o - Math.floor(visibleCount / 2)));
      return;
    }
    if (key.pageDown) {
      setOffset(o => Math.min(maxOffset, o + Math.floor(visibleCount / 2)));
      return;
    }
  }, { isActive });

  const canScrollUp = offset > 0;
  const canScrollDown = offset + visibleCount < totalItems;
  const visibleItems = items.slice(offset, offset + visibleCount);

  return (
    <Box flexDirection="column" height={height}>
      {canScrollUp && (
        <Box justifyContent="center">
          <Text color={theme.muted} dimColor>▲ ещё</Text>
        </Box>
      )}
      <Box flexDirection="column" flexGrow={1}>
        {visibleItems}
      </Box>
      {canScrollDown && (
        <Box justifyContent="center">
          <Text color={theme.muted} dimColor>▼ ещё</Text>
        </Box>
      )}
    </Box>
  );
};
