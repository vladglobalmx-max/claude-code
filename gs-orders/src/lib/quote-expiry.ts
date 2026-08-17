import { getBusinessToday } from "./business-date";
import type { Quote } from "@/types/domain";

/**
 * "Vencida" es un indicador puramente visual — NUNCA un status nuevo en DB
 * (0020_core_quotes.sql define el lifecycle completo; esto no lo toca ni lo
 * amplía). Aplica únicamente a status "enviada": es el único caso donde
 * "vencida" comunica algo accionable (la cotización sigue pendiente de
 * respuesta del cliente y su vigencia ya pasó). "borrador" sigue en
 * captura, "aceptada"/"rechazada"/"cancelada" ya tienen un desenlace
 * decidido — el vencimiento es irrelevante retroactivamente en esos casos
 * (decisión explícita de la aprobación de Q5).
 */
export function isQuoteExpired(
  quote: Pick<Quote, "status" | "valid_until">,
  today: string = getBusinessToday()
): boolean {
  return quote.status === "enviada" && quote.valid_until < today;
}
