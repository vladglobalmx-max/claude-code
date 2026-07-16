/**
 * Parser de CSV mínimo pero correcto (RFC 4180) — la contraparte de lectura
 * de `dashboard/csv.ts` (Módulo 13, que solo escribe). Soporta campos
 * entrecomillados con comas, comillas dobles (`""`) y saltos de línea
 * dentro del campo. No usa una librería externa por la misma razón que el
 * exportador: el formato es simple y una dependencia nueva no se justifica
 * (docs/ARCHITECTURE.md §10, Módulo 14 — "vía Excel/CSV": solo CSV aquí,
 * ver README).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Normaliza CRLF/CR a LF antes de recorrer, para no duplicar casos.
  const input = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Última fila: solo se agrega si el archivo no terminó en un salto de
  // línea limpio (evita una fila vacía fantasma al final).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/** Convierte filas crudas de `parseCsv` en objetos por encabezado, recortando espacios. */
export function csvRowsToRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const [header, ...dataRows] = rows;
  const headers = header.map((h) => h.trim());
  return dataRows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = (row[i] ?? "").trim();
    });
    return record;
  });
}
