/**
 * THÖREN | ASIGNACIÓN DE BUSINESS UNITS A USUARIOS — contraparte en TS del
 * mismo chequeo fallback-safe que vive en SQL
 * (fn_check_business_unit_assigned_to_salesperson, migración 0094): sin
 * ninguna Business Unit asignada activa, no se restringe nada
 * (comportamiento actual intacto); con 1+, solo las asignadas son
 * elegibles. Usado por cotizaciones/nueva/page.tsx para filtrar el
 * selector visual — la autoridad real sigue siendo el chequeo en SQL
 * (requisito 10: "aplicar la restricción también en el servidor/RPC, no
 * únicamente en el selector visual"), este helper es solo UX, igual
 * criterio que `disabledModules`/`departments` en sidebar.tsx.
 */
export function isBusinessUnitAllowedForPerson(
  businessUnitId: string,
  assignedBusinessUnitIds: readonly string[]
): boolean {
  if (assignedBusinessUnitIds.length === 0) return true;
  return assignedBusinessUnitIds.includes(businessUnitId);
}
