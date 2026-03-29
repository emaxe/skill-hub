import { createContext, useContext } from 'react';
import { StatusType } from '../components/StatusBar';

export interface StatusContextValue {
  message: string | undefined;
  status: StatusType;
  setStatus: (message: string | undefined, type?: StatusType) => void;
  clearStatus: () => void;
}

export const StatusContext = createContext<StatusContextValue>({
  message: undefined,
  status: 'idle',
  setStatus: () => undefined,
  clearStatus: () => undefined,
});

export function useStatus(): StatusContextValue {
  return useContext(StatusContext);
}
