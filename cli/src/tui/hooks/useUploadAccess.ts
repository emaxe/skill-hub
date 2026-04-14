/**
 * Хук проверки write-доступа к репозиторию каталога.
 * Выполняет проверку при монтировании, кеширует результат в React state.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { checkCatalogWriteAccess, AccessCheckResult } from '../../upload';

export interface UploadAccessState {
  /** Есть ли write-доступ к репозиторию каталога */
  hasAccess: boolean;
  /** Идёт проверка */
  loading: boolean;
  /** Ошибка (если доступ отсутствует) */
  error: string | undefined;
  /** Перепроверить доступ */
  recheck: () => void;
}

export function useUploadAccess(): UploadAccessState {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const check = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result: AccessCheckResult = await checkCatalogWriteAccess();
      if (!mountedRef.current) return;
      setHasAccess(result.hasAccess);
      setError(result.error);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setHasAccess(false);
      setError(String(err.message || err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void check(); }, [check]);

  return { hasAccess, loading, error, recheck: check };
}
