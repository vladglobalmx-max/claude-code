import { z } from "zod";

/**
 * IDs son cadenas no vacías, "brandeadas" a nivel de tipo para que un
 * `LayerId` no pueda pasarse por error donde se espera un `AssetId`, aunque
 * ambos sean strings en tiempo de ejecución.
 *
 * Este paquete NO genera IDs (eso es responsabilidad del Engine, que decide
 * la estrategia — incremental, UUID, etc.). Aquí solo se define la forma.
 */
export const ProjectIdSchema = z.string().min(1).brand<"ProjectId">();
export type ProjectId = z.infer<typeof ProjectIdSchema>;

export const DocumentIdSchema = z.string().min(1).brand<"DocumentId">();
export type DocumentId = z.infer<typeof DocumentIdSchema>;

export const PageIdSchema = z.string().min(1).brand<"PageId">();
export type PageId = z.infer<typeof PageIdSchema>;

export const LayerIdSchema = z.string().min(1).brand<"LayerId">();
export type LayerId = z.infer<typeof LayerIdSchema>;

export const ObjectIdSchema = z.string().min(1).brand<"ObjectId">();
export type ObjectId = z.infer<typeof ObjectIdSchema>;

export const AssetIdSchema = z.string().min(1).brand<"AssetId">();
export type AssetId = z.infer<typeof AssetIdSchema>;
