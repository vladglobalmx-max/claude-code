import type { Document } from "@impulso/document-schema";

/**
 * Una pieza generada y concreta — lo que la persona ve como "una
 * propuesta" (THOREN_TECHNICAL_ARCHITECTURE.md §5). Se exporta a SVG bajo
 * demanda con `exportarSVG(composition.document)` de Fase 1, nunca se
 * pre-exporta aquí — generar y exportar siguen siendo dos pasos distintos,
 * igual que en Fase 1.
 */
export interface Composition {
  readonly id: string;
  /** Identificador interno del arquetipo que la generó — nunca se expone a la interfaz (principio 2). */
  readonly archetypeId: string;
  readonly document: Document;
}
