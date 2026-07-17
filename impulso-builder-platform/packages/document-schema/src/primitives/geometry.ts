import { z } from "zod";

/** Un punto en el espacio de coordenadas local del objeto/página que lo contiene. */
export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Point = z.infer<typeof PointSchema>;

/** Dimensiones no negativas. Usado por páginas, formas e imágenes. */
export const SizeSchema = z.object({
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});
export type Size = z.infer<typeof SizeSchema>;

/** Rectángulo con posición y dimensiones — usado por ejemplo para recortes (crop). */
export const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});
export type Rect = z.infer<typeof RectSchema>;

/**
 * Posición/rotación/escala de un objeto relativa a su contenedor (Layer o
 * Group padre). No es una matriz de transformación de una librería de
 * render concreta — son cinco números planos, deliberadamente simples de
 * validar, serializar y migrar.
 */
export const TransformSchema = z.object({
  x: z.number(),
  y: z.number(),
  rotation: z.number().default(0),
  scaleX: z.number().default(1),
  scaleY: z.number().default(1),
});
export type Transform = z.infer<typeof TransformSchema>;
