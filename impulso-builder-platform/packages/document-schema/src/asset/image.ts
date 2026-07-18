import { z } from "zod";
import { AssetBaseSchema } from "./base.js";

/** El único tipo de Asset implementado en Asset Library v1 — PNG/SVG. */
export const ImageAssetSchema = AssetBaseSchema.extend({
  type: z.literal("image"),
  width: z.number().positive(),
  height: z.number().positive(),
});
export type ImageAsset = z.infer<typeof ImageAssetSchema>;
