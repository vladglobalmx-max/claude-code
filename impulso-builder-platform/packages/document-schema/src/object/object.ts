import { z } from "zod";
import { SceneObjectBaseSchema, type SceneObjectBase } from "./base.js";
import { RectangleObjectSchema, type RectangleObject } from "./rectangle.js";
import { EllipseObjectSchema, type EllipseObject } from "./ellipse.js";
import { PathObjectSchema, type PathObject } from "./path.js";
import { ImageObjectSchema, type ImageObject } from "./image.js";
import { TextObjectSchema, type TextObject } from "./text.js";

export type {
  RectangleObject,
  EllipseObject,
  PathObject,
  ImageObject,
  TextObject,
};
export {
  RectangleObjectSchema,
  EllipseObjectSchema,
  PathObjectSchema,
  ImageObjectSchema,
  TextObjectSchema,
};

/**
 * Group es recursivo: contiene otros SceneObject, incluyendo otros Group.
 * `SceneObject` y `GroupObject` se declaran a mano (no se infieren con
 * `z.infer`) porque TypeScript no puede resolver por sí solo el ciclo
 * `SceneObject -> GroupObject -> SceneObject[]`; los esquemas se anotan
 * luego con `z.ZodType<Output, ZodTypeDef, unknown>` para que coincidan.
 * El tercer parámetro (`unknown` en vez del default `Output`) es
 * deliberado: como cada tipo concreto tiene campos con `.default()`, su
 * forma de "entrada" real es más permisiva que la de "salida", y anotar
 * el tercer genérico como la propia salida rechazaría esquemas válidos.
 *
 * Se usa `z.union` en vez de `z.discriminatedUnion` para esta unión en
 * particular: `discriminatedUnion` necesita inspeccionar el `.shape` de
 * cada miembro de forma síncrona al construir el esquema, lo cual no es
 * posible cuando uno de los miembros (`GroupObjectSchema`) está envuelto en
 * `z.lazy` para romper el ciclo. `z.union` sigue validando correctamente
 * (cada miembro conserva su propio literal `type`), a costa de mensajes de
 * error algo menos específicos que el `discriminatedUnion` que sí usan
 * Rectangle/Ellipse/Path/Image/Text entre sí donde no hay recursión.
 */
export interface GroupObject extends SceneObjectBase {
  type: "group";
  children: SceneObject[];
}

export type SceneObject =
  | RectangleObject
  | EllipseObject
  | PathObject
  | ImageObject
  | TextObject
  | GroupObject;

export const SceneObjectSchema: z.ZodType<SceneObject, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.union([
    RectangleObjectSchema,
    EllipseObjectSchema,
    PathObjectSchema,
    ImageObjectSchema,
    TextObjectSchema,
    GroupObjectSchema,
  ]),
);

export const GroupObjectSchema: z.ZodType<GroupObject, z.ZodTypeDef, unknown> = z.lazy(() =>
  SceneObjectBaseSchema.extend({
    type: z.literal("group"),
    children: z.array(SceneObjectSchema),
  }),
);
