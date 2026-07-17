import { z } from "zod";
import { SceneObjectBaseSchema } from "./base.js";
import { SizeSchema } from "../primitives/geometry.js";

export const TextAlignSchema = z.enum(["left", "center", "right"]);
export type TextAlign = z.infer<typeof TextAlignSchema>;

export const TextObjectSchema = SceneObjectBaseSchema.extend({
  type: z.literal("text"),
  content: z.string(),
  fontFamily: z.string().min(1),
  fontSize: z.number().positive(),
  fontWeight: z.number().int().min(100).max(900).default(400),
  textAlign: TextAlignSchema.default("left"),
  lineHeight: z.number().positive().default(1.2),
  /** Caja de ajuste de texto opcional; sin ella el texto no hace wrap. */
  size: SizeSchema.optional(),
});
export type TextObject = z.infer<typeof TextObjectSchema>;
