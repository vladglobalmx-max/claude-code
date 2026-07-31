import { z } from "zod";
import { ImageAssetSchema, type ImageAsset } from "./image.js";
import { FontAssetSchema, type FontAsset } from "./font.js";

export type { ImageAsset, FontAsset };
export { ImageAssetSchema, FontAssetSchema };

/**
 * Asset Library: cada tipo concreto de Asset es una variante de esta
 * unión, exactamente el mismo patrón que `SceneObjectSchema`
 * (object/object.ts) — agregar un tipo nuevo (plantilla, ícono, patrón,
 * fondo, textura, marco, mockup, asset generado por IA...) es agregar un
 * archivo `xxx.ts` que extiende `AssetBaseSchema` (ver base.ts) y sumarlo
 * aquí; ningún otro consumidor (Document Schema, Engine, Asset Library)
 * necesita cambiar para reconocerlo. Sin recursión (a diferencia de
 * `SceneObject`/`GroupObject`), así que se puede usar
 * `z.discriminatedUnion` directamente — mensajes de error más precisos que
 * `z.union`.
 *
 * Solo `image` está implementado en Asset Library v1; `font` está
 * declarado desde antes de esta épica pero sigue sin ningún flujo que lo
 * produzca — ver ADR de esta épica.
 */
export const AssetSchema = z.discriminatedUnion("type", [ImageAssetSchema, FontAssetSchema]);
export type Asset = z.infer<typeof AssetSchema>;

/** Únicamente los tipos con una variante real en `AssetSchema` — no una
 * lista especulativa de tipos futuros (ver el comentario de arriba para
 * cómo se agregan esos). */
export const AssetTypeSchema = z.enum(["image", "font"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;
