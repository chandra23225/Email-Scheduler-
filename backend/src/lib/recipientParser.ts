import { parse } from 'csv-parse/sync';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRecipientText(content: string): string[] {
  const candidates = content
    .split(/[\n,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(candidates.filter((value) => EMAIL_PATTERN.test(value)))];
}

export function parseRecipientCsv(content: string): string[] {
  const rows = parse(content, {
    skip_empty_lines: true,
    relax_column_count: true,
  }) as string[][];
  if (rows.length === 0) return [];

  const firstRow = rows[0].map((value) => value.trim().toLowerCase());
  const emailColumn = firstRow.findIndex((value) => value === 'email');
  const values = emailColumn >= 0
    ? rows.slice(1).map((row) => row[emailColumn] || '')
    : rows.flat();

  return parseRecipientText(values.join('\n'));
}

export function parseRecipients(content: string, isCsv: boolean): string[] {
  return isCsv ? parseRecipientCsv(content) : parseRecipientText(content);
}
