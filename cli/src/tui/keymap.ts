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
