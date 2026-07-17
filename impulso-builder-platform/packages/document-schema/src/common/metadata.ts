import { z } from "zod";

/**
 * Metadata es un único esquema reutilizado en Project, Document, Page,
 * Layer y cada Object — en vez de una variante distinta por entidad.
 *
 * `visible` y `locked` solo tienen efecto práctico en Layer/Object (el
 * Renderer los usa para decidir qué dibujar y qué bloquear a interacción);
 * en Project/Document/Page se conservan por consistencia del esquema pero
 * el Engine los ignora ahí. Se prefirió este único tipo "de propósito
 * general" a fragmentar en 3-4 esquemas casi idénticos: mayor cohesión,
 * una sola fuente de verdad para "qué es la metadata de algo en Impulso".
 */
export const MetadataSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  /**
   * Marcador semántico específico de módulo, ej. "die-line" en Sticker
   * Builder. El Document Schema no conoce sus valores posibles — cada
   * plugin define e interpreta los suyos.
   */
  role: z.string().optional(),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Metadata = z.infer<typeof MetadataSchema>;
