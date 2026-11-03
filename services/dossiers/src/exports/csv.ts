/** Neutralise les formules de tableur (`=`, `+`, `-`, `@`, tabulation) en préfixant une apostrophe. */
function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(value: string | number | undefined): string {
  const text = neutralize(value === undefined ? '' : String(value));
  return /[";,\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Sérialise des lignes en CSV (RFC 4180, séparateur virgule, fin de ligne CRLF) précédé d'un
 * BOM UTF-8 pour qu'Excel lise correctement les accents.
 */
export function toCsv(headers: string[], rows: Array<Array<string | number | undefined>>): string {
  const lines = [headers, ...rows].map((row) => row.map(cell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
