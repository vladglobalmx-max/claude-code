import { z } from "zod";
import { JsonValueSchema } from "../primitives/json.js";

/**
 * `HistoryEntry` es una entrada de bitácora de que un cambio ocurrió — no
 * la lógica de undo/redo en sí (eso es la "History Engine" del siguiente
 * micro-sprint, deliberadamente fuera de este paquete). `patch` es un slot
 * reservado y opaco (`JsonValue`): la History Engine decidirá su formato
 * real (ej. JSON Patch); el Document Schema solo garantiza que, sea cual
 * sea, es serializable.
 */
export const HistoryEntrySchema = z
  .object({
    id: z.string().min(1),
    createdAt: z.string().datetime(),
    description: z.string().optional(),
    documentVersionBefore: z.number().int().nonnegative(),
    documentVersionAfter: z.number().int().nonnegative(),
    patch: JsonValueSchema.optional(),
  })
  .superRefine((entry, ctx) => {
    if (entry.documentVersionAfter <= entry.documentVersionBefore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '"documentVersionAfter" debe ser mayor que "documentVersionBefore".',
        path: ["documentVersionAfter"],
      });
    }
  });
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const DocumentHistorySchema = z.object({
  entries: z.array(HistoryEntrySchema).default([]),
});
export type DocumentHistory = z.infer<typeof DocumentHistorySchema>;
