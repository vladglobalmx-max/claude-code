/**
 * CSV mínimo pero correcto (RFC 4180): entrecomilla cualquier valor que
 * contenga la coma, una comilla o un salto de línea, duplicando comillas
 * internas. No se agregó una dependencia nueva (`csv-stringify`, `xlsx`)
 * para un formato este simple — Excel/PDF del dashboard quedan fuera de
 * este alcance (ver README).
 */
function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCsvField(String(cell))).join(","),
  );
  return lines.join("\r\n") + "\r\n";
}
