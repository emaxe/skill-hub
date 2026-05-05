import { useInput } from 'ink';
import { useCallback } from 'react';
import { isUpArrow, isDownArrow } from '../keymap';

export type KeyContext = 'catalog' | 'installed' | 'settings' | 'detail' | 'move' | 'global' | 'search' | 'confirm';

export interface KeyHandler {
  key: string;
  description: string;
  handler: () => void;
  contexts: KeyContext[];
}

export interface UseKeymapOptions {
  context: KeyContext;
  handlers: KeyHandler[];
  isActive?: boolean;
}

export function useKeymap({ context, handlers, isActive = true }: UseKeymapOptions): void {
  const handleInput = useCallback((
    input: string,
    key: {
      escape?: boolean;
      return?: boolean;
      upArrow?: boolean;
      downArrow?: boolean;
      tab?: boolean;
      shift?: boolean;
      ctrl?: boolean;
    }
  ) => {
    if (!isActive) return;

    for (const handler of handlers) {
      if (!handler.contexts.includes(context) && !handler.contexts.includes('global')) continue;

      if (handler.key === 'escape' && key.escape) { handler.handler(); return; }
      if (handler.key === 'return' && key.return) { handler.handler(); return; }
      if (handler.key === 'up' && isUpArrow(input, key)) { handler.handler(); return; }
      if (handler.key === 'down' && isDownArrow(input, key)) { handler.handler(); return; }
      if (handler.key === 'tab' && key.tab && !key.shift) { handler.handler(); return; }
      if (handler.key === 'shift+tab' && key.tab && key.shift) { handler.handler(); return; }
      if (handler.key === input) { handler.handler(); return; }
    }
  }, [context, handlers, isActive]);

  useInput(handleInput, { isActive });
}
