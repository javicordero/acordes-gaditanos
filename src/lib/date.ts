export function parseSpanishDate(str: string): Date {
  const [d, m, y] = str.split(/[-/]/).map(Number);
  return new Date(y, m - 1, d);
}

export function sortByDateDesc(a: string, b: string): number {
  const dateA = parseSpanishDate(a);
  const dateB = parseSpanishDate(b);
  return dateB.getTime() - dateA.getTime();
}

export function sortByYearDesc(a: string, b: string): number {
  return Number(b) - Number(a);
}