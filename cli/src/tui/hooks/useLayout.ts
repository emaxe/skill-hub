/**
 * Хук адаптивной раскладки — центральная точка для responsive TUI.
 *
 * Определяет breakpoint по ширине терминала и рассчитывает:
 * - конфигурацию колонок таблиц (ExtensionList, InstalledScreen)
 * - флаги видимости элементов (InfoBar, Separator)
 * - параметры для compact-режима компонентов
 */
import { useTerminalSize } from './useTerminalSize';

/** Breakpoint по ширине терминала */
export type Breakpoint = 'compact' | 'normal' | 'wide';

/** Конфигурация одной колонки таблицы */
export interface TableColumn {
  key: string;
  width: number;
  /** Длина для truncate (обычно width - 1..2) */
  truncateAt: number;
  visible: boolean;
}

/** Конфигурация колонок для CatalogScreen (ExtensionList) */
export interface CatalogTableConfig {
  selector: TableColumn;
  type: TableColumn;
  name: TableColumn;
  version: TableColumn;
  scope: TableColumn;
  tags: TableColumn;
  project: TableColumn;
  /** Ширина описания — рассчитывается динамически */
  descWidth: number;
}

/** Конфигурация колонок для InstalledScreen */
export interface InstalledTableConfig {
  selector: TableColumn;
  type: TableColumn;
  name: TableColumn;
  version: TableColumn;
  scope: TableColumn;
  tags: TableColumn;
  project: TableColumn;
  source: TableColumn;
  /** Ширина последней колонки (agent) — рассчитывается динамически */
  agentWidth: number;
}

/** Результат хука useLayout */
export interface LayoutConfig {
  breakpoint: Breakpoint;
  columns: number;
  rows: number;
  /** Конфиг таблицы каталога */
  catalogTable: CatalogTableConfig;
  /** Конфиг таблицы установленных */
  installedTable: InstalledTableConfig;
  /** Показывать InfoBar */
  showInfoBar: boolean;
  /** Показывать разделители между секциями */
  showSeparators: boolean;
  /** Максимальная ширина диалоговых окон */
  dialogInnerWidth: number;
  /** Ширина для padEnd в DetailScreen */
  labelPadWidth: number;
}

const COMPACT_THRESHOLD = 80;
const WIDE_THRESHOLD = 120;
const LOW_HEIGHT_THRESHOLD = 16;

function getBreakpoint(columns: number): Breakpoint {
  if (columns < COMPACT_THRESHOLD) return 'compact';
  if (columns >= WIDE_THRESHOLD) return 'wide';
  return 'normal';
}

function buildCatalogTable(columns: number, bp: Breakpoint): CatalogTableConfig {
  const paddingX = 2; // paddingX={1} слева и справа

  if (bp === 'compact') {
    // compact: скрыть TAGS и PROJECT
    const sel = { key: 'selector', width: 2, truncateAt: 1, visible: true };
    const type = { key: 'type', width: 6, truncateAt: 5, visible: true };
    const name = { key: 'name', width: 18, truncateAt: 16, visible: true };
    const ver = { key: 'version', width: 8, truncateAt: 7, visible: true };
    const scope = { key: 'scope', width: 8, truncateAt: 7, visible: true };
    const tags = { key: 'tags', width: 0, truncateAt: 0, visible: false };
    const project = { key: 'project', width: 0, truncateAt: 0, visible: false };
    const fixedTotal = sel.width + type.width + name.width + ver.width + scope.width;
    const descWidth = Math.max(8, columns - fixedTotal - paddingX);
    return { selector: sel, type, name, version: ver, scope, tags, project, descWidth };
  }

  // normal / wide
  const sel = { key: 'selector', width: 2, truncateAt: 1, visible: true };
  const type = { key: 'type', width: 7, truncateAt: 6, visible: true };
  const nameW = bp === 'wide' ? 26 : 22;
  const name = { key: 'name', width: nameW, truncateAt: nameW - 2, visible: true };
  const ver = { key: 'version', width: 10, truncateAt: 9, visible: true };
  const scope = { key: 'scope', width: 9, truncateAt: 8, visible: true };
  const tags = { key: 'tags', width: 16, truncateAt: 15, visible: true };
  const project = { key: 'project', width: 12, truncateAt: 11, visible: true };
  const fixedTotal = sel.width + type.width + name.width + ver.width + scope.width + tags.width + project.width;
  const descWidth = Math.max(10, columns - fixedTotal - paddingX);
  return { selector: sel, type, name, version: ver, scope, tags, project, descWidth };
}

function buildInstalledTable(columns: number, bp: Breakpoint): InstalledTableConfig {
  const paddingX = 2;

  if (bp === 'compact') {
    // compact: скрыть TAGS, PROJECT, SOURCE — экономия ~38 символов
    const sel = { key: 'selector', width: 2, truncateAt: 1, visible: true };
    const type = { key: 'type', width: 7, truncateAt: 6, visible: true };
    const name = { key: 'name', width: 18, truncateAt: 16, visible: true };
    const ver = { key: 'version', width: 7, truncateAt: 6, visible: true };
    const scope = { key: 'scope', width: 8, truncateAt: 7, visible: true };
    const tags = { key: 'tags', width: 0, truncateAt: 0, visible: false };
    const project = { key: 'project', width: 0, truncateAt: 0, visible: false };
    const source = { key: 'source', width: 0, truncateAt: 0, visible: false };
    const fixedTotal = sel.width + type.width + name.width + ver.width + scope.width;
    const agentWidth = Math.max(6, columns - fixedTotal - paddingX);
    return { selector: sel, type, name, version: ver, scope, tags, project, source, agentWidth };
  }

  // normal / wide
  const sel = { key: 'selector', width: 2, truncateAt: 1, visible: true };
  const type = { key: 'type', width: 9, truncateAt: 8, visible: true };
  const nameW = bp === 'wide' ? 26 : 22;
  const name = { key: 'name', width: nameW, truncateAt: nameW - 2, visible: true };
  const ver = { key: 'version', width: 8, truncateAt: 7, visible: true };
  const scope = { key: 'scope', width: 8, truncateAt: 7, visible: true };
  const tags = { key: 'tags', width: 16, truncateAt: 15, visible: true };
  const project = { key: 'project', width: 12, truncateAt: 11, visible: true };
  const source = { key: 'source', width: 10, truncateAt: 9, visible: true };
  const fixedTotal = sel.width + type.width + name.width + ver.width + scope.width + tags.width + project.width + source.width;
  const agentWidth = Math.max(8, columns - fixedTotal - paddingX);
  return { selector: sel, type, name, version: ver, scope, tags, project, source, agentWidth };
}

export function useLayout(): LayoutConfig {
  const { rows, columns } = useTerminalSize();
  const bp = getBreakpoint(columns);

  const catalogTable = buildCatalogTable(columns, bp);
  const installedTable = buildInstalledTable(columns, bp);

  const showInfoBar = rows >= LOW_HEIGHT_THRESHOLD;
  const showSeparators = rows >= LOW_HEIGHT_THRESHOLD;

  // Ширина диалогов: на compact — до columns-8, на normal/wide — до 58
  const dialogInnerWidth = bp === 'compact'
    ? Math.max(24, columns - 8)
    : Math.min(58, columns - 12);

  const labelPadWidth = bp === 'compact' ? 10 : 12;

  return {
    breakpoint: bp,
    columns,
    rows,
    catalogTable,
    installedTable,
    showInfoBar,
    showSeparators,
    dialogInnerWidth,
    labelPadWidth,
  };
}
