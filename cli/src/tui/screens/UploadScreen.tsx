/**
 * Экран загрузки расширений в каталог.
 *
 * Функциональность:
 * - Переключатель scope (global/project)
 * - Список расширений с чекбоксами (space — toggle, a — select all)
 * - Превью содержимого (c)
 * - Редактирование имени ветки (b) и заголовка PR (e)
 * - Загрузка (Enter) — валидация → commit → push → ссылка PR
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { spawn } from 'child_process';
import { Box, Text, useInput } from 'ink';
import { normalizeInput, isUpArrow, isDownArrow, isLeftArrow, isRightArrow } from '../keymap';
import { HintBar, Hint } from '../components/HintBar';
import { Confirm } from '../components/Confirm';
import { ScrollableBox } from '../components/ScrollableBox';
import { useStatus } from '../contexts/StatusContext';
import { theme } from '../theme';
import { AgentName, loadCatalog } from '../../catalog';
import { ScanResult } from '../../adapters/types';
import { getCachePath, ensureCache } from '../../git';
import { readExtensionContent } from '../utils/readExtensionContent';
import {
  getUploadCandidates,
  validateExtensionsForUpload,
  uploadExtensions,
  generatePrUrl,
  generatePrBody,
  generatePrTitle,
  generateBranchName,
  parseFrontmatter,
  Frontmatter,
  ValidationResult,
} from '../../upload';
import { getRegistryUrl } from '../../git';

export interface UploadScreenProps {
  agent: AgentName;
  onBack: () => void;
  /** Предвыбранные расширения (из точек входа) */
  preselected?: ScanResult[];
  /** Открыть экран просмотра содержимого */
  onOpenContent: (title: string, content: string) => void;
  viewHeight: number;
  inputActive?: boolean;
  /** Ширина терминала в колонках для адаптивной обрезки строк */
  termColumns?: number;
}

type Phase = 'select' | 'uploading' | 'done' | 'error';

export const UploadScreen: React.FC<UploadScreenProps> = ({
  agent, onBack, preselected, onOpenContent, viewHeight, inputActive, termColumns,
}) => {
  const { setStatus } = useStatus();

  const [scope, setScope] = useState<'global' | 'project'>('project');
  const [candidates, setCandidates] = useState<ScanResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursorIndex, setCursorIndex] = useState(0);
  const [branchName, setBranchName] = useState(generateBranchName);
  const [prTitle, setPrTitle] = useState('');
  const [phase, setPhase] = useState<Phase>('select');
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [resultMessage, setResultMessage] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Режим редактирования: branch или title
  const [editMode, setEditMode] = useState<'branch' | 'title' | null>(null);
  const [editValue, setEditValue] = useState('');

  // Загрузить кандидатов при смене scope
  useEffect(() => {
    try {
      const cachePath = getCachePath();
      const catalog = loadCatalog(cachePath);
      const cands = getUploadCandidates(agent, scope, catalog);
      setCandidates(cands);

      // Предвыбрать расширения если переданы
      if (preselected && preselected.length > 0) {
        const preKeys = new Set(preselected.map(e => `${e.type}:${e.name}`));
        const matchingKeys = new Set(
          cands.filter(c => preKeys.has(`${c.type}:${c.name}`)).map(c => `${c.type}:${c.name}`)
        );
        setSelected(matchingKeys);
      } else {
        setSelected(new Set());
      }
      setCursorIndex(0);
    } catch {
      setCandidates([]);
    }
  }, [scope, agent]);

  // При инициализации: если preselected заданы, определить scope
  useEffect(() => {
    if (preselected && preselected.length > 0) {
      const firstScope = preselected[0].scope === 'parent' ? 'project' : preselected[0].scope;
      setScope(firstScope as 'global' | 'project');
    }
  }, []);

  // Обновить заголовок PR при изменении выбранных
  useEffect(() => {
    if (selected.size === 0) {
      setPrTitle('');
      return;
    }
    const selectedExts = candidates.filter(c => selected.has(`${c.type}:${c.name}`));
    const fms = buildFrontmatterMap(selectedExts);
    setPrTitle(generatePrTitle(selectedExts, fms));
  }, [selected, candidates]);

  const key = (s: ScanResult) => `${s.type}:${s.name}`;

  const toggleSelect = useCallback((k: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map(c => key(c))));
    }
  }, [selected.size, candidates]);

  // Провести загрузку
  const doUpload = useCallback(async () => {
    setShowConfirm(false);
    setPhase('uploading');
    setStatus('Загрузка расширений в каталог...', 'loading');

    try {
      await ensureCache();
      const cachePath = getCachePath();
      const catalog = loadCatalog(cachePath);
      const selectedExts = candidates.filter(c => selected.has(key(c)));

      // Валидация
      const validations = validateExtensionsForUpload(selectedExts, catalog);
      setValidationResults(validations);

      const validExts = validations.filter(v => v.valid);
      const invalidExts = validations.filter(v => !v.valid);

      if (validExts.length === 0) {
        setPhase('error');
        setResultMessage(
          invalidExts.length > 0
            ? 'Ни одно расширение не прошло валидацию.'
            : 'Не выбрано расширений для загрузки.'
        );
        setStatus('Ошибка валидации', 'error');
        return;
      }

      // Собрать фронтматтеры для валидных расширений
      const frontmatters = new Map<string, Frontmatter>();
      for (const v of validExts) {
        if (v.frontmatter) {
          frontmatters.set(key(v.extension), v.frontmatter);
        }
      }

      const commitMsg = prTitle || generatePrTitle(validExts.map(v => v.extension), frontmatters);

      const result = await uploadExtensions({
        extensions: validExts.map(v => v.extension),
        frontmatters,
        catalog,
        agent,
        branchName,
        commitMessage: commitMsg,
      });

      if (!result.success) {
        setPhase('error');
        setResultMessage(result.error || 'Неизвестная ошибка при загрузке.');
        setStatus('Ошибка загрузки', 'error');
        return;
      }

      // Генерация URL для PR
      const registryUrl = getRegistryUrl();
      const body = generatePrBody(validExts.map(v => v.extension), frontmatters);
      const prUrl = generatePrUrl(registryUrl, branchName, commitMsg, body);

      setPhase('done');
      setResultUrl(prUrl.url);

      let msg = `✓ Загружено ${validExts.length} расширение(й) в ветку ${branchName}`;
      if (invalidExts.length > 0) {
        msg += `\n⚠ Пропущено ${invalidExts.length} с ошибками валидации`;
      }
      msg += '\n\n' + prUrl.instruction;
      if (prUrl.url) {
        msg += `\n${prUrl.url}`;
      }
      setResultMessage(msg);
      setStatus('Загрузка завершена', 'success');

    } catch (err: any) {
      setPhase('error');
      setResultMessage(String(err.message || err));
      setStatus('Ошибка загрузки', 'error');
    }
  }, [candidates, selected, branchName, prTitle, agent, setStatus]);

  // Открыть URL в браузере (кроссплатформенно)
  const openUrl = useCallback((url: string) => {
    const cmd = process.platform === 'darwin' ? 'open'
      : process.platform === 'win32' ? 'start'
      : 'xdg-open';
    spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
  }, []);

  // Клавиатурный ввод
  useInput((input, inputKey) => {
    if (phase === 'uploading') return;

    // Режим редактирования
    if (editMode) {
      if (inputKey.escape) {
        setEditMode(null);
        return;
      }
      if (inputKey.return) {
        if (editMode === 'branch') setBranchName(editValue);
        if (editMode === 'title') setPrTitle(editValue);
        setEditMode(null);
        return;
      }
      if (inputKey.backspace || inputKey.delete) {
        setEditValue(prev => prev.slice(0, -1));
        return;
      }
      if (input && !isLeftArrow(input, inputKey) && !isRightArrow(input, inputKey) && !isUpArrow(input, inputKey) && !isDownArrow(input, inputKey)) {
        setEditValue(prev => prev + input);
        return;
      }
      return;
    }

    if (showConfirm) return;

    // Фаза done/error — только Esc и o (открыть URL)
    if (phase === 'done' || phase === 'error') {
      if (inputKey.escape) onBack();
      if (phase === 'done' && resultUrl && normalizeInput(input) === 'o') openUrl(resultUrl);
      return;
    }

    // Фаза select
    if (inputKey.escape) { onBack(); return; }

    const ni = normalizeInput(input);

    if (isUpArrow(input, inputKey)) {
      setCursorIndex(i => Math.max(0, i - 1));
      return;
    }
    if (isDownArrow(input, inputKey)) {
      setCursorIndex(i => Math.min(candidates.length - 1, i + 1));
      return;
    }

    if (ni === ' ' && candidates.length > 0) {
      toggleSelect(key(candidates[cursorIndex]));
      return;
    }

    if (ni === 'a') { toggleAll(); return; }

    if (ni === 's') {
      setScope(s => s === 'global' ? 'project' : 'global');
      return;
    }

    if (ni === 'c' && candidates.length > 0) {
      const ext = candidates[cursorIndex];
      const content = readExtensionContent(ext.path);
      if (content) onOpenContent(ext.name, content);
      return;
    }

    if (ni === 'b') {
      setEditValue(branchName);
      setEditMode('branch');
      return;
    }

    if (ni === 'e') {
      setEditValue(prTitle);
      setEditMode('title');
      return;
    }

    if (inputKey.return && selected.size > 0) {
      setShowConfirm(true);
      return;
    }
  }, { isActive: inputActive !== false });

  // --- Рендеринг ---

  // Режим редактирования
  if (editMode) {
    const label = editMode === 'branch' ? 'Имя ветки' : 'Заголовок PR';
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={theme.primary}>{label}</Text>
        <Box marginTop={1}>
          <Text color={theme.warning}>{editValue}<Text color={theme.selected}>▌</Text></Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>[Enter] сохранить  [Esc] отмена</Text>
        </Box>
      </Box>
    );
  }

  // Фаза uploading
  if (phase === 'uploading') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={theme.primary}>Загрузка расширений...</Text>
        <Box marginTop={1}>
          <Text color={theme.muted}>Создание ветки, копирование файлов, push...</Text>
        </Box>
      </Box>
    );
  }

  // Фаза done / error
  if (phase === 'done' || phase === 'error') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color={phase === 'done' ? theme.success : theme.error}>
          {phase === 'done' ? '✓ Загрузка завершена' : '✗ Ошибка загрузки'}
        </Text>
        <Box marginTop={1} flexDirection="column">
          {resultMessage.split('\n').map((line, i) => (
            <Text key={i} color={line.startsWith('http') ? theme.accent : theme.secondary}>{line}</Text>
          ))}
        </Box>

        {/* Ошибки валидации */}
        {validationResults.filter(v => !v.valid).length > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text color={theme.warning} bold>Ошибки валидации:</Text>
            {validationResults.filter(v => !v.valid).map((v, i) => (
              <Box key={i} flexDirection="column">
                <Text color={theme.error}>  {v.extension.type}:{v.extension.name}</Text>
                {v.errors.map((err, j) => (
                  <Text key={j} color={theme.muted}>    • {err}</Text>
                ))}
              </Box>
            ))}
          </Box>
        )}

        <Box marginTop={1}>
          <HintBar hints={[
            ...(phase === 'done' && resultUrl ? [{ key: 'o', description: 'перейти к созданию merge request' }] : []),
            { key: 'Esc', description: 'назад' },
          ]} />
        </Box>
      </Box>
    );
  }

  // Фаза select
  const safeCursor = Math.min(cursorIndex, Math.max(0, candidates.length - 1));
  // title(1) + scope(1) + branch(1) + prTitle(1) + separator(1) + hintbar(1) + margin(2) = 8 fixed rows
  const listHeight = Math.max(3, viewHeight - 10);

  const hints: Hint[] = [
    { key: '↑↓', description: 'навигация' },
    { key: 'Space', description: 'выбрать' },
    { key: 'a', description: 'все' },
    { key: 'c', description: 'содержимое' },
    ...(selected.size > 0 ? [{ key: 'Enter', description: 'загрузить' }] : []),
    { key: 'Esc', description: 'назад' },
  ];

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.primary}>Загрузка расширений в каталог</Text>

      <Box marginTop={1} flexDirection="row">
        <Text color={theme.muted}>Scope </Text>
        <Text color={theme.warning} bold>[s]</Text>
        <Text color={theme.muted}>: </Text>
        <Text color={scope === 'project' ? theme.warning : theme.success} bold>{scope}</Text>
        <Text color={theme.muted}>  │  </Text>
        <Text color={theme.muted}>Ветка </Text>
        <Text color={theme.warning} bold>[b]</Text>
        <Text color={theme.muted}>: </Text>
        <Text color={theme.accent}>{branchName.length > (termColumns ? Math.min(30, termColumns - 25) : 30) ? branchName.slice(0, termColumns ? Math.min(30, termColumns - 25) : 30) + '…' : branchName}</Text>
      </Box>

      {prTitle ? (
        <Box>
          <Text color={theme.muted}>PR </Text>
          <Text color={theme.warning} bold>[e]</Text>
          <Text color={theme.muted}>: </Text>
          <Text color={theme.secondary}>{prTitle.length > (termColumns ? Math.min(50, termColumns - 12) : 50) ? prTitle.slice(0, termColumns ? Math.min(50, termColumns - 12) : 50) + '…' : prTitle}</Text>
        </Box>
      ) : null}

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted} dimColor>{'─'.repeat(termColumns ? Math.min(50, termColumns - 4) : 50)}</Text>
      </Box>

      {candidates.length === 0 ? (
        <Box marginTop={1}>
          <Text color={theme.muted}>Нет расширений для загрузки в scope «{scope}»</Text>
        </Box>
      ) : (
        <ScrollableBox height={listHeight} isActive={inputActive !== false} activeIndex={safeCursor}>
          {candidates.map((ext, i) => {
            const k = key(ext);
            const isSelected = selected.has(k);
            const isCursor = i === safeCursor;

            return (
              <Box key={k} flexDirection="row">
                <Text color={isCursor ? theme.selected : theme.muted}>
                  {isCursor ? '▶' : ' '}
                </Text>
                <Text color={isSelected ? theme.success : theme.muted}>
                  {isSelected ? ' ☑ ' : ' ☐ '}
                </Text>
                <Text color={theme.accent}>{ext.type.padEnd(8)}</Text>
                <Text color={isCursor ? theme.selected : theme.secondary} bold={isCursor}>
                  {ext.name}
                </Text>
              </Box>
            );
          })}
        </ScrollableBox>
      )}

      {showConfirm && (
        <Box marginTop={1}>
          <Confirm
            message={`Загрузить ${selected.size} расширение(й) в каталог?`}
            onConfirm={doUpload}
            onCancel={() => setShowConfirm(false)}
          />
        </Box>
      )}

      {selected.size > 0 && !showConfirm && (
        <Box>
          <Text color={theme.muted}>Выбрано: </Text>
          <Text color={theme.success} bold>{selected.size}</Text>
        </Box>
      )}

      <HintBar hints={hints} />
    </Box>
  );
};

/** Строит карту фронтматтеров по ScanResult[] */
function buildFrontmatterMap(extensions: ScanResult[]): Map<string, Frontmatter> {
  const map = new Map<string, Frontmatter>();
  for (const ext of extensions) {
    try {
      const content = readExtensionContent(ext.path);
      if (!content) continue;
      const fm = parseFrontmatter(content);
      if (fm.name && fm.description && fm.version && fm.author) {
        map.set(`${ext.type}:${ext.name}`, fm as Frontmatter);
      }
    } catch { /* ignore */ }
  }
  return map;
}
