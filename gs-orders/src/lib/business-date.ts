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
