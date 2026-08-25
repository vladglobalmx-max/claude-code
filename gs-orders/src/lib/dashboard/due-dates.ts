import { differenceInCalendarDays, parseISO } from "date-fns";
import type { OrderOperationalStatus } from "@/types/domain";

/**
 * THÖREN Fase 6K — vencimiento contra fechas compromiso reales
 * (0034_order_commitment_dates.sql). Módulo separado de
 * lib/dashboard/attention-queue.ts a propósito: son dos ejes distintos —
 * attention-queue.ts mide antigüedad EN EL ESTADO ACTUAL (cuánto lleva sin
 * avanzar); este módulo mide si el pedido va a tiempo contra una fecha
 * compromiso real capturada por el usuario. Ambos se combinan en el orden
 * de prioridad de "Requieren atención" (ver buildAttentionQueue), pero
 * cada uno es su única fuente de verdad para su propio cálculo.
 *
 * REGLA FINAL (Fase 6K — AJUSTE FINAL, confirmada por el usuario) — "la
 * fecha relevante" según operational_status:
 *   pedido / en_proceso                       -> sin vencimiento por fecha
 *                                                 (solo antigüedad, Fase 6J)
 *   ordenado_a_proveedor                      -> supplier_commitment_date,
 *                                                 si falta usa como fallback
 *                                                 estimated_reception_date
 *   en_transito                               -> estimated_reception_date
 *   recibido / programado_entrega_instalacion -> scheduled_delivery_date
 *   completado / cancelado                    -> sin vencimiento
 * actual_completion_date es dato histórico/auditoría — nunca se usa para
 * calcular vencimiento.
 *
 * Umbral de "Próximo a vencer": 2 días (vence hoy, mañana o pasado mañana),
 * confirmado por el usuario en el mismo mensaje.
 */
export type DueDateStatus = "en_tiempo" | "proximo_a_vencer" | "vencido" | "sin_fecha";

export const DUE_DATE_STATUS_LABELS: Record<DueDateStatus, string> = {
  en_tiempo: "En tiempo",
  proximo_a_vencer: "Próximo a vencer",
  vencido: "Vencido",
  sin_fecha: "Sin fecha",
};

/** Mismos tokens de color ya usados en el resto de la app — sin dependencias nuevas. */
export const DUE_DATE_STATUS_DOT_COLOR: Record<DueDateStatus, string> = {
  en_tiempo: "bg-success",
  proximo_a_vencer: "bg-warning",
  vencido: "bg-danger",
  sin_fecha: "bg-ink-faint",
};

const PROXIMO_A_VENCER_THRESHOLD_DAYS = 2;

export interface OrderCommitmentDates {
  supplierCommitmentDate: string | null;
  estimatedReceptionDate: string | null;
  scheduledDeliveryDate: string | null;
}

/**
 * Estados sin concepto de vencimiento por fecha en absoluto — 'pedido'/
 * 'en_proceso' solo usan la antigüedad de Fase 6J, y
 * 'completado'/'cancelado' ya salieron del pipeline. Para estos,
 * classifyDueDateStatus devuelve null (nada que mostrar), a diferencia de
 * un estado que SÍ requiere fecha pero no la tiene capturada ('sin_fecha').
 */
const STATES_WITHOUT_DUE_DATE: OrderOperationalStatus[] = ["pedido", "en_proceso", "completado", "cancelado"];

export function operationalStatusRequiresDueDate(operationalStatus: OrderOperationalStatus): boolean {
  return !STATES_WITHOUT_DUE_DATE.includes(operationalStatus);
}

/**
 * Resuelve qué fecha es "la relevante" para el vencimiento según el
 * operational_status actual del pedido (ver REGLA FINAL arriba). Devuelve
 * null cuando el estado no requiere fecha, o cuando el campo
 * correspondiente (con su fallback, si aplica) todavía no fue capturado —
 * nunca inventa una fecha.
 */
export function resolveRelevantDueDate(
  operationalStatus: OrderOperationalStatus,
  dates: OrderCommitmentDates
): string | null {
  switch (operationalStatus) {
    case "ordenado_a_proveedor":
      return dates.supplierCommitmentDate ?? dates.estimatedReceptionDate ?? null;
    case "en_transito":
      return dates.estimatedReceptionDate;
    case "recibido":
    case "programado_entrega_instalacion":
      return dates.scheduledDeliveryDate;
    default:
      // 'pedido' / 'en_proceso' / 'completado' / 'cancelado' — sin vencimiento por fecha.
      return null;
  }
}

/**
 * Clasifica el vencimiento de un pedido para su operational_status actual.
 *   - null: el estado no requiere fecha (pedido/en_proceso/completado/cancelado) — no mostrar nada.
 *   - 'sin_fecha': el estado SÍ requiere fecha pero todavía no está capturada — nunca se marca
 *     artificialmente "En tiempo" sin dato real.
 *   - 'vencido' / 'proximo_a_vencer' / 'en_tiempo': fecha capturada, comparada contra hoy.
 */
export function classifyDueDateStatus(
  operationalStatus: OrderOperationalStatus,
  dates: OrderCommitmentDates,
  now: Date
): DueDateStatus | null {
  if (!operationalStatusRequiresDueDate(operationalStatus)) return null;
  const dueDate = resolveRelevantDueDate(operationalStatus, dates);
  if (!dueDate) return "sin_fecha";
  const daysUntilDue = differenceInCalendarDays(parseISO(dueDate), now);
  if (daysUntilDue < 0) return "vencido";
  if (daysUntilDue <= PROXIMO_A_VENCER_THRESHOLD_DAYS) return "proximo_a_vencer";
  return "en_tiempo";
}
