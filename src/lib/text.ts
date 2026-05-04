export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isChordToken(token: string): boolean {
  const chordRegex = /^(do|re|mi|fa|sol|la|si|c|d|e|f|g|a|b)(#|b)?[a-z0-9#/]*$/i;
  return chordRegex.test(token.trim());
}