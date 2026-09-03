/**
 * GS Orders opera por defecto en Monterrey, Nuevo León, México — pero
 * desde THÖREN 7C cada organización puede tener su propia zona horaria de
 * negocio (organizations.timezone, 0053). La "fecha de negocio" de un
 * pedido/cotización (order_date/quote_date, y por lo tanto el segmento de
 * fecha del folio) debe corresponder siempre al día calendario en la zona
 * horaria DE ESA organización — nunca al día UTC del servidor ni,
 * necesariamente, al de Monterrey si la organización opera en otra zona.
 *
 * Vercel ejecuta en UTC. `new Date().toISOString().slice(0, 10)` da el día
 * calendario en UTC: entrada la noche en una zona con offset negativo,
 * UTC ya está en el día siguiente, y ese cálculo adelantaba la fecha un
 * día.
 *
 * order_date/quote_date (columna `date` en Postgres) son la única fuente
 * de verdad: estas funciones se usan para CALCULARLAS una vez, del lado de
 * la app (resolviendo el timezone de la organización actual vía
 * getCurrentOrganizationTimezone(), src/lib/auth/organization.ts), nunca
 * para volver a derivarlas a partir de otra cosa.
 */
export const DEFAULT_BUSINESS_TIMEZONE = "America/Monterrey";

/** Fecha calendario "de hoy" en `timezone`, como "YYYY-MM-DD". Default: DEFAULT_BUSINESS_TIMEZONE (Monterrey) para compatibilidad con llamadas existentes que todavía no resuelven el timezone de una organización. */
export function getBusinessToday(timezone: string = DEFAULT_BUSINESS_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`No se pudo calcular la fecha de negocio (${timezone})`);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Rango [start, end) del mes calendario de negocio en `timezone`, como
 * "YYYY-MM-DD" — end es el primer día del mes siguiente (exclusivo), para
 * usar directamente en `.gte("order_date", start).lt("order_date", end)`.
 * monthsAgo=0 es el mes actual, 1 el mes anterior, etc. order_date ya es
 * una fecha calendario (columna `date` de Postgres, sin componente de
 * hora/zona), así que esto es aritmética de fechas pura una vez resuelto
 * "hoy" — no requiere volver a resolver zona horaria por cada mes.
 */
export function getBusinessMonthRange(
  monthsAgo = 0,
  timezone: string = DEFAULT_BUSINESS_TIMEZONE
): { start: string; end: string } {
  const today = getBusinessToday(timezone);
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
 * requiere resolver zona horaria (el timezone ya se resolvió al calcular
 * `dateStr` con getBusinessToday). Se usa para calcular la vigencia por
 * default de una Quote nueva (quote_date + 15 días, mismo default que
 * rpc_create_quote aplica en DB si no se manda valid_until — ver
 * 0020_core_quotes.sql).
 */
export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Saludo por hora del día en `timezone` (Fase 6Q — Command Center), misma
 * zona horaria de negocio que el resto de este módulo — nunca la hora UTC
 * del servidor (Vercel).
 */
export function getBusinessGreeting(
  timezone: string = DEFAULT_BUSINESS_TIMEZONE
): "Buenos días" | "Buenas tardes" | "Buenas noches" {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(new Date())
  );
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}
