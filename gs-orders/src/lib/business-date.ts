/**
 * GS Orders opera en Monterrey, Nuevo León, México. La "fecha de negocio"
 * de un pedido (order_date, y por lo tanto el segmento de fecha del folio)
 * debe corresponder siempre al día calendario en esa zona horaria — nunca
 * al día UTC del servidor.
 *
 * Vercel ejecuta en UTC. `new Date().toISOString().slice(0, 10)` da el día
 * calendario en UTC: entrada la noche en Monterrey (UTC-6), UTC ya está en
 * el día siguiente, y ese cálculo adelantaba la fecha del pedido un día.
 *
 * order_date (columna `date` en Postgres) es la única fuente de verdad:
 * esta función se usa para CALCULARLA una vez, del lado de la app, nunca
 * para volver a derivarla a partir de otra cosa.
 */
const BUSINESS_TIMEZONE = "America/Monterrey";

/** Fecha calendario "de hoy" en America/Monterrey, como "YYYY-MM-DD". */
export function getBusinessToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("No se pudo calcular la fecha de negocio (America/Monterrey)");
  }

  return `${year}-${month}-${day}`;
}

/**
 * Rango [start, end) del mes calendario de negocio (America/Monterrey),
 * como "YYYY-MM-DD" — end es el primer día del mes siguiente (exclusivo),
 * para usar directamente en `.gte("order_date", start).lt("order_date", end)`.
 * monthsAgo=0 es el mes actual, 1 el mes anterior, etc. order_date ya es
 * una fecha calendario (columna `date` de Postgres, sin componente de
 * hora/zona), así que esto es aritmética de fechas pura — no requiere
 * volver a resolver zona horaria.
 */
export function getBusinessMonthRange(monthsAgo = 0): { start: string; end: string } {
  const today = getBusinessToday();
  const [year, month] = today.split("-").map(Number) as [number, number];

  // month es 1-indexado (getBusinessToday da "MM"); Date usa mes 0-indexado.
  const targetMonthIndex = month - 1 - monthsAgo;
  const startDate = new Date(Date.UTC(year, targetMonthIndex, 1));
  const endDate = new Date(Date.UTC(year, targetMonthIndex + 1, 1));

  const toDateString = (d: Date) => d.toISOString().slice(0, 10);

  return { start: toDateString(startDate), end: toDateString(endDate) };
}

/**
 * Suma días calendario a una fecha "YYYY-MM-DD" (columna `date` de
 * Postgres, sin componente de hora/zona) — aritmética de fechas pura, no
 * requiere volver a resolver zona horaria. Se usa para calcular la
 * vigencia por default de una Quote nueva (quote_date + 15 días, mismo
 * default que rpc_create_quote aplica en DB si no se manda valid_until —
 * ver 0020_core_quotes.sql).
 */
export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}
