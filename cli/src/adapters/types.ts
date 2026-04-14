import { AgentName, Extension, ExtensionType } from '../catalog';

/** Результат сканирования файловой системы — обнаруженное расширение на диске */
export interface ScanResult {
  type: ExtensionType;
  name: string;
  scope: 'global' | 'project' | 'parent';
  path: string;
}

/**
 * Стратегия работы с файлами для конкретного AI-агента.
 * Каждый агент (Claude Code, Cursor, Copilot) хранит расширения
 * в разных директориях и форматах — адаптер скрывает эти различия.
 */
export interface AgentAdapter {
  agentName: AgentName;

  /** Проверяет, поддерживает ли данный агент указанный тип расширения */
  supportsType(type: ExtensionType): boolean;

  /** Возвращает путь к исходному файлу расширения в кеше каталога */
  getSourceFile(ext: Extension): string;

  /** Вычисляет целевой путь установки расширения для заданного scope */
  getInstallPath(ext: Extension, scope: 'global' | 'project'): string;

  /** Копирует расширение из кеша каталога в целевую директорию агента */
  install(ext: Extension, scope: 'global' | 'project', cachePath: string): Promise<void>;

  /** Удаляет файлы расширения с диска */
  remove(ext: Extension, scope: 'global' | 'project'): Promise<void>;

  /** Проверяет наличие файлов расширения в целевой директории */
  isInstalled(ext: Extension, scope: 'global' | 'project'): boolean;

  /** Сканирует файловую систему для обнаружения всех установленных расширений данного агента */
  scanInstalled(): ScanResult[];
}
