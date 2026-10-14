/**
 * Arma un CSV para abrir en Excel en español: separador ";" (la coma es el separador decimal) y
 * BOM de UTF-8 para que se vean bien las tildes.
 */
export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const cell = (value: string | number) => {
    // Los números van con coma decimal, como los lee Excel en español.
    const text = typeof value === 'number' ? String(value).replace('.', ',') : value;
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers, ...rows].map((row) => row.map(cell).join(';'));
  return `\uFEFF${lines.join('\r\n')}`;
}

/** Descarga un texto como archivo desde el navegador. */
export function downloadText(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
