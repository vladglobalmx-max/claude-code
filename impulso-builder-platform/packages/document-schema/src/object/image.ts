import { z } from "zod";
import { SceneObjectBaseSchema } from "./base.js";
import { SizeSchema, RectSchema } from "../primitives/geometry.js";
import { AssetIdSchema } from "../primitives/identifiers.js";

export const ImageObjectSchema = SceneObjectBaseSchema.extend({
  type: z.literal("image"),
  /** Referencia a un Asset — nunca el binario embebido (ver asset.ts). */
  assetId: AssetIdSchema,
  size: SizeSchema,
  cropRect: RectSchema.optional(),
});
export type ImageObject = z.infer<typeof ImageObjectSchema>;
