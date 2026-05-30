import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Extension, AgentName } from '../../catalog';
import { InstalledEntry } from '../hooks/useRegistry';
import { useCatalog } from '../hooks/useCatalog';
import { Confirm } from '../components/Confirm';
import { HintBar } from '../components/HintBar';
import { normalizeInput, isUpArrow, isDownArrow } from '../keymap';
import { readExtensionContent } from '../utils/readExtensionContent';
import { ScrollableBox } from '../components/ScrollableBox';
import { useStatus } from '../contexts/StatusContext';
import { theme } from '../theme';
import { ScanResult } from '../../adapters/types';

export interface InstalledDetailScreenProps {
  entry: InstalledEntry;
  agent: AgentName;
  onBack: () => void;
  remove: (ext: Extension, agent: AgentName, scope: 'global' | 'project', deleteFromDisk?: boolean) => Promise<void>;
  move: (ext: Extension, agent: AgentName, fromScope: 'global' | 'project') => Promise<void>;
  update: (ext: Extension, agent: AgentName, scope: 'global' | 'project') => Promise<void>;
  install: (ext: Extension, agent: AgentName, scope: 'global' | 'project') => Promise<void>;
  defaultScope: 'global' | 'project';
  onOpenContent: (title: string, content: string) => void;
  viewHeight: number;
  inputActive?: boolean;
  /** Есть ли write-доступ к каталогу */
  hasUploadAccess?: boolean;
  /** Открыть экран загрузки с предвыбранным расширением */
  onOpenUpload?: (preselected?: ScanResult[]) => void;
  /** Ширина колонки метки (по умолчанию 14) */
  labelPadWidth?: number;
  /** Ширина терминала в колонках — для обрезки длинных значений */
  termColumns?: number;
}

type Action = 'delete' | 'move' | 'update' | 'register' | 'upload';

export const InstalledDetailScreen: React.FC<InstalledDetailScreenProps> = ({
  entry, agent, onBack, remove, move, update, install, defaultScope, onOpenContent, viewHeight, inputActive,
  hasUploadAccess, onOpenUpload, labelPadWidth: lpw, termColumns,
}) => {
  const labelPadWidth = lpw ?? 14;
  const SEP = <Text color={theme.muted} dimColor>{'─'.repeat(Math.min(40, (termColumns ?? 80) - 4))}</Text>;
  const { catalog } = useCatalog();
  const { setStatus } = useStatus();
  const [actionIndex, setActionIndex] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDiskConfirm, setShowDiskConfirm] = useState(false);

  const contentResult = useMemo(() => readExtensionContent(entry.path), [entry.path]);

  const catalogExt = catalog?.extensions.find(e => e.name === entry.name && e.type === entry.type);
  const isManualWithCatalog = entry.entrySource === 'manual' && catalogExt != null;

  const isParent = entry.effectiveScope === 'parent';

  const actions = useMemo<{ id: Action; label: string }[]>(() => {
    if (isParent) return [];
    const isConventions = agent === 'agents-conventions';
    const list: { id: Action; label: string }[] = [
      { id: 'delete', label: 'Удалить' },
    ];
    if (!isConventions) {
      list.push({ id: 'move', label: `Переместить в ${entry.scope === 'global' ? 'project' : 'global'}` });
    }
    if (catalogExt && entry.entrySource === 'registry') {
      list.push({ id: 'update', label: 'Обновить' });
    }
    if (isManualWithCatalog) {
      list.push({ id: 'register', label: 'Установить из skill-hub (зарегистрировать)' });
    }
    // Действие «Загрузить в каталог» — только если расширения нет в каталоге и есть доступ
    if (!catalogExt && hasUploadAccess && onOpenUpload) {
      list.push({ id: 'upload', label: 'Загрузить в каталог' });
    }
    return list;
  }, [entry.scope, entry.entrySource, isManualWithCatalog, catalogExt, isParent, agent, hasUploadAccess, onOpenUpload]);

  const makeExt = (): Extension => ({
    type: entry.type, name: entry.name,
    description: catalogExt?.description ?? '',
    tags: catalogExt?.tags ?? [],
    scope: entry.scope === 'parent' ? 'project' : entry.scope, platforms: catalogExt?.platforms ?? {},
    path: entry.path, dependencies: catalogExt?.dependencies ?? [],
    version: entry.version,
    author: catalogExt?.author,
    projects: catalogExt?.projects ?? [],
    source: entry.source?.startsWith('skillssh:') ? { type: 'skillssh', uri: entry.source } : undefined,
  });

  useInput((input, key) => {
    if (showConfirm || showDiskConfirm) return;

    if (key.escape) { onBack(); return; }

    const ni = normalizeInput(input);

    if (isUpArrow(input, key))   { setActionIndex(i => Math.max(0, i - 1)); return; }
    if (isDownArrow(input, key)) { setActionIndex(i => Math.min(actions.length - 1, i + 1)); return; }

    if (ni === 'c' && contentResult) {
      onOpenContent(entry.name, contentResult);
      return;
    }

    if (key.return || ni === ' ') {
      const action = actions[actionIndex].id;
      if (action === 'delete') { setShowConfirm(true); return; }
      if (action === 'move') {
        move(makeExt(), entry.sourceAgent || agent, entry.scope as 'global' | 'project')
          .then(() => { setStatus(`Перемещено: ${entry.name}`, 'success'); onBack(); })
          .catch((err: unknown) => setStatus(String(err), 'error'));
        return;
      }
      if (action === 'update') {
        update(makeExt(), entry.sourceAgent || agent, entry.scope as 'global' | 'project')
          .then(() => { setStatus(`Обновлено: ${entry.name}`, 'success'); onBack(); })
          .catch((err: unknown) => setStatus(String(err), 'error'));
        return;
      }
      if (action === 'register' && catalogExt) {
        install(catalogExt, agent, defaultScope)
          .then(() => { setStatus(`Зарегистрировано: ${entry.name}`, 'success'); onBack(); })
          .catch((err: unknown) => setStatus(String(err), 'error'));
        return;
      }
      if (action === 'upload' && onOpenUpload) {
        const preselected: ScanResult[] = [{ type: entry.type, name: entry.name, scope: entry.scope as 'global' | 'project', path: entry.path }];
        onOpenUpload(preselected);
        return;
      }
    }
  }, { isActive: inputActive !== false });

  const handleConfirmDelete = () => {
    setShowConfirm(false);
    setShowDiskConfirm(true);
  };

  const handleDiskDeleteChoice = (deleteFromDisk: boolean) => {
    setShowDiskConfirm(false);
    remove(makeExt(), entry.sourceAgent || agent, entry.scope as 'global' | 'project', deleteFromDisk)
      .then(() => { setStatus(`Удалено: ${entry.name}${deleteFromDisk ? '' : ' (файлы сохранены)'}`, 'success'); onBack(); })
      .catch((err: unknown) => setStatus(String(err), 'error'));
  };

  const Row = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => {
    let display = value;
    if (termColumns != null) {
      const maxLen = termColumns - labelPadWidth - 4;
      if (maxLen > 0 && display.length > maxLen) {
        display = display.slice(0, maxLen - 1) + '…';
      }
    }
    return (
      <Box>
        <Text color={theme.muted}>{label.padEnd(labelPadWidth)}</Text>
        <Text color={valueColor ?? theme.secondary}>{display}</Text>
      </Box>
    );
  };

  const platformList = catalogExt
    ? Object.entries(catalogExt.platforms)
        .filter(([, f]) => f != null && f !== '')
        .map(([p]) => p)
        .join(', ')
    : null;

  // padding(1+1) + title(1) + author(1) + separator(1) + hintbar(1) = 6 fixed rows
  const scrollHeight = Math.max(3, viewHeight - 6);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.primary}>{entry.name}</Text>
      {catalogExt?.author && (
        <Text color={theme.muted} dimColor>by {catalogExt.author}</Text>
      )}
      {SEP}

      <ScrollableBox height={scrollHeight} isActive={!showConfirm && !showDiskConfirm} activeIndex={actionIndex}>
        <Box marginTop={1} flexDirection="column">
          <Row label="Тип:"        value={entry.type} />
          <Row label="Версия:"     value={entry.version || '?'} />
          <Row
            label="Установлен:"
            value={entry.effectiveScope}
            valueColor={entry.effectiveScope === 'global' ? theme.success : entry.effectiveScope === 'parent' ? theme.accent : theme.warning}
          />
          <Row
            label="Источник:"
            value={entry.entrySource}
            valueColor={entry.entrySource === 'registry' ? theme.accent : theme.muted}
          />
          {entry.installed_at && (
            <Row label="Дата:"     value={new Date(entry.installed_at).toLocaleDateString('ru-RU')} />
          )}
          {catalogExt?.scope && (
            <Row label="Scope:"    value={catalogExt.scope} />
          )}
          {platformList && (
            <Row label="Платформы:" value={platformList} />
          )}
          {catalogExt?.tags && catalogExt.tags.length > 0 && (
            <Row label="Теги:"     value={catalogExt.tags.join(', ')} />
          )}
          {catalogExt?.dependencies && catalogExt.dependencies.length > 0 && (
            <Row label="Зависим.:" value={catalogExt.dependencies.join(', ')} />
          )}
          <Row label="Путь:"       value={entry.path} />
        </Box>

        {catalogExt?.description && (
          <Box marginTop={1}>
            <Text color={theme.muted}>{catalogExt.description}</Text>
          </Box>
        )}

        {SEP}

        <Box marginTop={1} flexDirection="column">
          <Text color={theme.muted} dimColor>Действия:</Text>
          {isParent ? (
            <Box>
              <Text color={theme.accent}>  Управляется из родительского проекта</Text>
            </Box>
          ) : (
            <Box flexDirection="column">
              {actions.map((action, i) => {
                const isSelected = i === actionIndex;
                const isRegister = action.id === 'register';
                return (
                  <Box key={action.id} flexDirection="row">
                    <Text color={isSelected ? theme.selected : theme.muted}>
                      {isSelected ? '▶ ' : '  '}
                    </Text>
                    <Text
                      color={isSelected ? theme.selected : (isRegister ? theme.success : theme.secondary)}
                      bold={isSelected}
                    >
                      {action.label}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
        {SEP}

        {showConfirm && (
          <Box marginTop={1}>
            <Confirm
              message={`Удалить ${entry.name}?`}
              onConfirm={handleConfirmDelete}
              onCancel={() => setShowConfirm(false)}
            />
          </Box>
        )}

        {showDiskConfirm && (
          <Box marginTop={1}>
            <Confirm
              message={`Удалить файлы ${entry.name} с диска? (n = только из реестра)`}
              onConfirm={() => handleDiskDeleteChoice(true)}
              onCancel={() => handleDiskDeleteChoice(false)}
            />
          </Box>
        )}
      </ScrollableBox>

      <Box marginTop={1}>
        <HintBar hints={[
          { key: '↑↓', description: 'выбор' },
          { key: 'Enter', description: 'выполнить' },
          ...(contentResult ? [{ key: 'c', description: 'содержимое' }] : []),
          { key: 'Esc', description: 'назад' },
        ]} />
      </Box>
    </Box>
  );
};
