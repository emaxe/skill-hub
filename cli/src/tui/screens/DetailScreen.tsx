import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Extension, AgentName } from '../../catalog';
import { useRegistry } from '../hooks/useRegistry';
import { useSettings } from '../hooks/useSettings';
import { useStatus } from '../contexts/StatusContext';
import { Confirm } from '../components/Confirm';
import { HintBar, Hint } from '../components/HintBar';
import { theme } from '../theme';

export interface DetailScreenProps {
  extension: Extension;
  agent: AgentName;
  onBack: () => void;
}

export const DetailScreen: React.FC<DetailScreenProps> = ({ extension, agent, onBack }) => {
  const { install, remove, isInstalled } = useRegistry();
  const { config } = useSettings();
  const { setStatus } = useStatus();
  const [showConfirm, setShowConfirm] = useState(false);

  const installed = isInstalled(extension.name, extension.type, agent);

  useInput((input, key) => {
    if (showConfirm) return;
    if (key.escape) {
      onBack();
      return;
    }
    if (input === 'i' && !installed) {
      install(extension, agent, config.defaultScope)
        .then(() => setStatus(`Установлен: ${extension.name}`, 'success'))
        .catch((err: unknown) => setStatus(String(err), 'error'));
    }
    if (input === 'd' && installed) {
      setShowConfirm(true);
    }
  });

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
    { key: 'Esc', description: 'назад' },
  ];

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.primary}>{extension.name}</Text>
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
              remove(extension, agent, config.defaultScope)
                .then(() => {
                  setStatus(`Удалён: ${extension.name}`, 'success');
                  onBack();
                })
                .catch((err: unknown) => setStatus(String(err), 'error'));
            }}
            onCancel={() => setShowConfirm(false)}
          />
        </Box>
      )}
      <Box marginTop={1}>
        <HintBar hints={hints} />
      </Box>
    </Box>
  );
};
