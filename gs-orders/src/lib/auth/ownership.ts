import type { CurrentProfile } from "./profile";

/**
 * Autoridad de ESCRITURA sobre un registro comercial (Quote/Order/Delivery)
 * propiedad de un salesperson. Deliberadamente NO recibe, consulta ni
 * conoce ninguna capability (can_view_all_sales u otra futura) — VIEW y
 * WRITE son conceptos separados: current_user_has_capability() (0040)
 * amplía LECTURA vía RLS, nunca la autoridad de escritura, que sigue
 * siendo exclusivamente "dueño del registro o admin" en toda la app. RLS
 * es la autoridad final de todas formas (esta función solo evita ofrecer
 * en la UI un control que el backend rechazaría) — nunca relaja ni
 * reemplaza ninguna policy.
 */
export function canWriteRecord(
  profile: Pick<CurrentProfile, "role" | "salespersonId" | "active"> | null,
  recordSalespersonId: string | null
): boolean {
  if (!profile || !profile.active) return false;
  if (profile.role === "admin") return true;
  return profile.salespersonId !== null && profile.salespersonId === recordSalespersonId;
}
