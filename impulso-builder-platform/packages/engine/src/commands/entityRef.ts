import { z } from "zod";
import { PageIdSchema, LayerIdSchema, ObjectIdSchema, AssetIdSchema } from "@impulso/document-schema";

/**
 * A qué entidad apunta un comando de metadata genérico (`updateMetadata`).
 * Un único comando cubre los seis niveles en vez de
 * `updateProjectMetadata`/`updateDocumentMetadata`/`updatePageMetadata`/...
 * — mismo principio que el Document Schema aplicó a sus Object types:
 * un sistema genérico en vez de variantes case-by-case. `asset` reutiliza
 * este mecanismo ya genérico para `tags`/`description`/etc. de un Asset —
 * renombrar un Asset (su campo `name`, fuera de `metadata`) usa el comando
 * dedicado `renameAsset` en cambio (ver command.ts).
 */
export const EntityRefSchema = z.discriminatedUnion("level", [
  z.object({ level: z.literal("project") }),
  z.object({ level: z.literal("document") }),
  z.object({ level: z.literal("page"), pageId: PageIdSchema }),
  z.object({ level: z.literal("layer"), pageId: PageIdSchema, layerId: LayerIdSchema }),
  z.object({ level: z.literal("object"), objectId: ObjectIdSchema }),
  z.object({ level: z.literal("asset"), assetId: AssetIdSchema }),
]);
export type EntityRef = z.infer<typeof EntityRefSchema>;
