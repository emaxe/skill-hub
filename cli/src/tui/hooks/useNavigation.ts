import { useState, useCallback } from 'react';
import { TabName } from '../components/Header';

export type Screen = 'catalog' | 'installed' | 'settings' | 'detail' | 'move';

export interface NavigationState {
  activeTab: TabName;
  screenStack: Screen[];
}

export interface NavigationActions {
  setTab: (tab: TabName) => void;
  pushScreen: (screen: Screen) => void;
  popScreen: () => void;
  currentScreen: Screen;
}

export function useNavigation(): NavigationState & NavigationActions {
  const [activeTab, setActiveTab] = useState<TabName>('catalog');
  const [screenStack, setScreenStack] = useState<Screen[]>(['catalog']);

  const setTab = useCallback((tab: TabName) => {
    setActiveTab(tab);
    setScreenStack([tab as Screen]);
  }, []);

  const pushScreen = useCallback((screen: Screen) => {
    setScreenStack(prev => [...prev, screen]);
  }, []);

  const popScreen = useCallback(() => {
    setScreenStack(prev => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const currentScreen = screenStack[screenStack.length - 1];

  return { activeTab, screenStack, setTab, pushScreen, popScreen, currentScreen };
}
