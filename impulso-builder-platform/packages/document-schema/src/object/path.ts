import { z } from "zod";
import { SceneObjectBaseSchema } from "./base.js";
import { PointSchema } from "../primitives/geometry.js";

/**
 * Representación de un trazo vectorial deliberadamente propia — no la
 * mini-gramática de strings "d" de SVG. Aunque SVG path data es solo texto
 * y no arrastraría un renderer real, el encargo fue explícito: nada que
 * pueda leerse como "SVG" en el Document Schema. Un array de segmentos
 * tipados es igual de expresivo y más fácil de validar/migrar campo por
 * campo con Zod.
 */
export const PathSegmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("moveTo"), point: PointSchema }),
  z.object({ type: z.literal("lineTo"), point: PointSchema }),
  z.object({
    type: z.literal("quadraticCurveTo"),
    control: PointSchema,
    point: PointSchema,
  }),
  z.object({
    type: z.literal("cubicCurveTo"),
    control1: PointSchema,
    control2: PointSchema,
    point: PointSchema,
  }),
  z.object({ type: z.literal("close") }),
]);
export type PathSegment = z.infer<typeof PathSegmentSchema>;

export const PathObjectSchema = SceneObjectBaseSchema.extend({
  type: z.literal("path"),
  segments: z.array(PathSegmentSchema).min(1),
  closed: z.boolean().default(false),
});
export type PathObject = z.infer<typeof PathObjectSchema>;
