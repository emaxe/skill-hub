// Russian → Latin mapping for keyboard hotkeys
const RU_TO_EN: Record<string, string> = {
  'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't',
  'н': 'y', 'г': 'u', 'ш': 'i', 'щ': 'o', 'з': 'p',
  'ф': 'a', 'ы': 's', 'в': 'd', 'а': 'f', 'п': 'g',
  'р': 'h', 'о': 'j', 'л': 'k', 'д': 'l',
  'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b',
  'т': 'n', 'ь': 'm',
};

/** Normalizes input: maps Russian chars to Latin equivalents */
export function normalizeInput(input: string): string {
  const lower = input.toLowerCase();
  const mapped = RU_TO_EN[lower];
  if (!mapped) return input;
  // Preserve case
  return input === lower ? mapped : mapped.toUpperCase();
}

/** Returns true if Ctrl or Cmd (Meta) is held */
export function isCtrl(key: { ctrl: boolean; meta: boolean }): boolean {
  return key.ctrl || key.meta;
}

// Escape-последовательности для стрелок:
// Normal mode: \u001B[A/B/C/D
// Application cursor keys mode (DECCKM): \u001BOA/B/C/D
const UP_SEQ = ['\u001B[A', '\u001BOA'];
const DOWN_SEQ = ['\u001B[B', '\u001BOB'];
const LEFT_SEQ = ['\u001B[D', '\u001BOD'];
const RIGHT_SEQ = ['\u001B[C', '\u001BOC'];

/** Проверяет, является ли input нажатием стрелки ВВЕРХ (normal или application cursor keys mode) */
export function isUpArrow(input: string, key?: { upArrow?: boolean }): boolean {
  return !!key?.upArrow || UP_SEQ.includes(input);
}

/** Проверяет, является ли input нажатием стрелки ВНИЗ (normal или application cursor keys mode) */
export function isDownArrow(input: string, key?: { downArrow?: boolean }): boolean {
  return !!key?.downArrow || DOWN_SEQ.includes(input);
}

/** Проверяет, является ли input нажатием стрелки ВЛЕВО (normal или application cursor keys mode) */
export function isLeftArrow(input: string, key?: { leftArrow?: boolean }): boolean {
  return !!key?.leftArrow || LEFT_SEQ.includes(input);
}

/** Проверяет, является ли input нажатием стрелки ВПРАВО (normal или application cursor keys mode) */
export function isRightArrow(input: string, key?: { rightArrow?: boolean }): boolean {
  return !!key?.rightArrow || RIGHT_SEQ.includes(input);
}
