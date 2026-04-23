import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { Extension } from '../../catalog';
import { theme } from '../theme';
import { CatalogTableConfig } from '../hooks/useLayout';

interface Props {
  extensions: Extension[];
  selectedIndex: number;
  installedNames?: Set<string>;
  installedScopes?: Map<string, 'global' | 'project' | 'parent'>;
  /** Текущий проект для отображения меток совместимости */
  currentProject?: string | null;
  /** Адаптивная конфигурация колонок таблицы (из useLayout). Без неё — фоллбэк на хардкод 78 символов. */
  tableConfig?: CatalogTableConfig;
}

const TYPE_LABELS: Record<string, string> = {
  skill: 'skill',
  agent: 'agent',
  command: 'cmd',
};

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Генерирует строку из символов «─» заданной длины */
function dashes(n: number): string {
  return n > 0 ? '─'.repeat(n) : '';
}

export const ExtensionList: React.FC<Props> = ({ extensions, selectedIndex, installedNames, installedScopes, currentProject, tableConfig }) => {
  // Фоллбэк: без tableConfig используем прежнюю логику с useStdout
  const { stdout } = useStdout();
  const fallbackWidth = stdout?.columns ?? 80;

  const tc = tableConfig;

  // Ширины колонок: из tableConfig или хардкод
  const selW    = tc ? tc.selector.width : 2;
  const typeW   = tc ? tc.type.width     : 7;
  const nameW   = tc ? tc.name.width     : 22;
  const verW    = tc ? tc.version.width  : 10;
  const scopeW  = tc ? tc.scope.width    : 9;
  const tagsW   = tc ? tc.tags.width     : 16;
  const projW   = tc ? tc.project.width  : 12;

  // Видимость опциональных колонок
  const showTags    = tc ? tc.tags.visible    : true;
  const showProject = tc ? tc.project.visible : true;

  // Длины для truncate
  const nameTr    = tc ? tc.name.truncateAt    : 20;
  const verTr     = tc ? tc.version.truncateAt : 9;
  const tagsTr    = tc ? tc.tags.truncateAt    : 15;
  const projTr    = tc ? tc.project.truncateAt : 11;

  // Ширина описания
  const descWidth = tc
    ? tc.descWidth
    : Math.max(10, fallbackWidth - 78 - 2); // 78 = сумма хардкод-колонок, 2 = paddingX

  if (extensions.length === 0) {
    return <Box paddingX={2}><Text color={theme.muted}>Ничего не найдено</Text></Box>;
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Table header */}
      <Box flexDirection="row">
        <Box minWidth={selW}><Text> </Text></Box>
        <Box minWidth={typeW}><Text dimColor>TYPE</Text></Box>
        <Box minWidth={nameW}><Text dimColor>NAME</Text></Box>
        <Box minWidth={verW}><Text dimColor>VER</Text></Box>
        <Box minWidth={scopeW}><Text dimColor>SCOPE</Text></Box>
        {showTags ? <Box minWidth={tagsW}><Text dimColor>TAGS</Text></Box> : null}
        {showProject ? <Box minWidth={projW}><Text dimColor>PROJECT</Text></Box> : null}
        <Text dimColor>DESCRIPTION</Text>
      </Box>
      {/* Separator */}
      <Box flexDirection="row">
        <Box minWidth={selW}><Text> </Text></Box>
        <Box minWidth={typeW}><Text dimColor>{dashes(typeW - 2)}</Text></Box>
        <Box minWidth={nameW}><Text dimColor>{dashes(nameW - 2)}</Text></Box>
        <Box minWidth={verW}><Text dimColor>{dashes(verW - 2)}</Text></Box>
        <Box minWidth={scopeW}><Text dimColor>{dashes(scopeW - 2)}</Text></Box>
        {showTags ? <Box minWidth={tagsW}><Text dimColor>{dashes(tagsW - 2)}</Text></Box> : null}
        {showProject ? <Box minWidth={projW}><Text dimColor>{dashes(projW - 2)}</Text></Box> : null}
        <Text dimColor>{dashes(Math.min(descWidth, 40))}</Text>
      </Box>
      {/* Rows */}
      {extensions.map((ext, i) => {
        const isSelected = i === selectedIndex;
        const isInstalled = installedNames?.has(ext.name) ?? false;
        const scope = installedScopes?.get(`${ext.type}:${ext.name}`);
        const typeLabel = TYPE_LABELS[ext.type] ?? ext.type;
        const verText = ext.version ? `v${ext.version}${isInstalled ? ' ✓' : ''}` : (isInstalled ? '✓' : '');
        const tagsText = ext.tags.length > 0 ? ext.tags.join(', ') : '—';
        const projectText = ext.projects && ext.projects.length > 0
          ? ext.projects[0] + (ext.projects.length > 1 ? '+' : '')
          : '—';
        return (
          <Box key={`${ext.type}:${ext.name}`} flexDirection="row">
            <Box minWidth={selW}>
              <Text color={isSelected ? theme.selected : theme.muted}>
                {isSelected ? '▶' : ' '}
              </Text>
            </Box>
            <Box minWidth={typeW}>
              <Text color={theme.accent} dimColor={!isSelected}>{typeLabel}</Text>
            </Box>
            <Box minWidth={nameW}>
              <Text color={isSelected ? theme.primary : theme.secondary} bold={isSelected}>
                {truncate(ext.name, nameTr)}
              </Text>
            </Box>
            <Box minWidth={verW}>
              <Text color={isInstalled ? theme.success : theme.muted} dimColor={!isInstalled}>
                {truncate(verText, verTr)}
              </Text>
            </Box>
            <Box minWidth={scopeW}>
              {scope ? (
                <Text color={scope === 'global' ? theme.success : scope === 'parent' ? theme.accent : theme.warning}>{scope}</Text>
              ) : (
                <Text dimColor>{'—'}</Text>
              )}
            </Box>
            {showTags ? (
              <Box minWidth={tagsW}>
                <Text color={theme.muted} dimColor>{truncate(tagsText, tagsTr)}</Text>
              </Box>
            ) : null}
            {showProject ? (
              <Box minWidth={projW}>
                <Text color={projectText === '—' ? theme.muted : theme.accent} dimColor={projectText === '—'}>
                  {truncate(projectText, projTr)}
                </Text>
              </Box>
            ) : null}
            <Text color={theme.muted} dimColor>
              {truncate(ext.description, descWidth)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
