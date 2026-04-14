import React, { useState, useMemo } from 'react';
import path from 'path';
import { Box, Text, useInput } from 'ink';
import { Extension, AgentName, ExtensionType } from '../../catalog';
import { getCachePath } from '../../git';
import { useStatus } from '../contexts/StatusContext';
import { Confirm } from '../components/Confirm';
import { HintBar, Hint } from '../components/HintBar';
import { normalizeInput } from '../keymap';
import { readExtensionContent } from '../utils/readExtensionContent';
import { ScrollableBox } from '../components/ScrollableBox';
import { theme } from '../theme';


export interface DetailScreenProps {
  extension: Extension;
  agent: AgentName;
  onBack: () => void;
  install: (ext: Extension, agent: AgentName, scope: 'global' | 'project') => Promise<void>;
  remove: (ext: Extension, agent: AgentName, scope: 'global' | 'project', deleteFromDisk?: boolean) => Promise<void>;
  isInstalled: (name: string, type: ExtensionType, agent: AgentName) => boolean;
  defaultScope: 'global' | 'project';
  onOpenContent: (title: string, content: string) => void;
  viewHeight: number;
  inputActive?: boolean;
}

export const DetailScreen: React.FC<DetailScreenProps> = ({
  extension, agent, onBack, install, remove, isInstalled, defaultScope, onOpenContent, viewHeight, inputActive,
}) => {
  const { setStatus } = useStatus();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDiskConfirm, setShowDiskConfirm] = useState(false);

  const installed = isInstalled(extension.name, extension.type, agent);

  const contentResult = useMemo(() => {
    const sourceFile = extension.platforms[agent] ||
      (extension.type === 'agent' ? 'AGENT.md' : extension.type === 'command' ? 'COMMAND.md' : 'SKILL.md');
    const filePath = path.join(getCachePath(), extension.path, sourceFile);
    return readExtensionContent(filePath);
  }, [extension, agent]);

  useInput((input, key) => {
    if (showConfirm || showDiskConfirm) return;
    if (key.escape) {
      onBack();
      return;
    }
    const ni = normalizeInput(input);
    if (ni === 'i' && !installed) {
      install(extension, agent, defaultScope)
        .then(() => setStatus(`Установлен: ${extension.name}`, 'success'))
        .catch((err: unknown) => setStatus(String(err), 'error'));
    }
    if (ni === 'd' && installed) {
      setShowConfirm(true);
    }
    if (ni === 'c' && contentResult) {
      onOpenContent(extension.name, contentResult);
    }
  }, { isActive: inputActive !== false });

  const Row = ({ label, value }: { label: string; value: string }) => (
    <Box>
      <Text color={theme.muted}>{label.padEnd(12)}</Text>
      <Text color={theme.secondary}>{value}</Text>
    </Box>
  );

  const platformList = Object.entries(extension.platforms)
    .filter(([, file]) => file != null && file !== '')
    .map(([platform]) => platform)
    .join(', ');

  const hints: Hint[] = [
    ...(installed ? [] : [{ key: 'i', description: 'установить' }]),
    ...(installed ? [{ key: 'd', description: 'удалить' }] : []),
    ...(contentResult ? [{ key: 'c', description: 'содержимое' }] : []),
  ];

  // padding(1 top + 1 bottom) + title(1) + hintbar(1) = 4 fixed rows
  const scrollHeight = Math.max(3, viewHeight - 4);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.primary}>{extension.name}</Text>
      <ScrollableBox height={scrollHeight} isActive={!showConfirm && !showDiskConfirm}>
        <Box marginTop={1} flexDirection="column">
          <Row label="Тип:" value={extension.type} />
          {extension.version && <Row label="Версия:" value={extension.version} />}
          {extension.author && <Row label="Автор:" value={extension.author} />}
          <Row label="Scope:" value={extension.scope} />
          {extension.tags.length > 0 && (
            <Row label="Теги:" value={extension.tags.join(', ')} />
          )}
          {platformList && <Row label="Платформы:" value={platformList} />}
          {extension.dependencies.length > 0 && (
            <Row label="Зависим.:" value={extension.dependencies.join(', ')} />
          )}
          <Row label="Статус:" value={installed ? '✓ установлен' : 'не установлен'} />
        </Box>
        <Box marginTop={1}>
          <Text color={theme.muted}>{extension.description}</Text>
        </Box>
        {showConfirm && (
          <Box marginTop={1}>
            <Confirm
              message={`Удалить ${extension.name}?`}
              onConfirm={() => {
                setShowConfirm(false);
                setShowDiskConfirm(true);
              }}
              onCancel={() => setShowConfirm(false)}
            />
          </Box>
        )}
        {showDiskConfirm && (
          <Box marginTop={1}>
            <Confirm
              message={`Удалить файлы ${extension.name} с диска? (n = только из реестра)`}
              onConfirm={() => {
                setShowDiskConfirm(false);
                remove(extension, agent, defaultScope, true)
                  .then(() => {
                    setStatus(`Удалён: ${extension.name}`, 'success');
                    onBack();
                  })
                  .catch((err: unknown) => setStatus(String(err), 'error'));
              }}
              onCancel={() => {
                setShowDiskConfirm(false);
                remove(extension, agent, defaultScope, false)
                  .then(() => {
                    setStatus(`Удалён: ${extension.name} (файлы сохранены)`, 'success');
                    onBack();
                  })
                  .catch((err: unknown) => setStatus(String(err), 'error'));
              }}
            />
          </Box>
        )}
      </ScrollableBox>
      <Box marginTop={1}>
        <HintBar hints={hints} />
      </Box>
    </Box>
  );
};
