import { z } from "zod";
import { SceneObjectBaseSchema } from "./base.js";
import { SizeSchema } from "../primitives/geometry.js";

export const RectangleObjectSchema = SceneObjectBaseSchema.extend({
  type: z.literal("rectangle"),
  size: SizeSchema,
  cornerRadius: z.number().nonnegative().default(0),
});
export type RectangleObject = z.infer<typeof RectangleObjectSchema>;
