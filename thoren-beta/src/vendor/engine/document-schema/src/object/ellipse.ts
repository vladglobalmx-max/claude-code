import { z } from "zod";
import { SceneObjectBaseSchema } from "./base.js";
import { SizeSchema } from "../primitives/geometry.js";

export const EllipseObjectSchema = SceneObjectBaseSchema.extend({
  type: z.literal("ellipse"),
  size: SizeSchema,
});
export type EllipseObject = z.infer<typeof EllipseObjectSchema>;
