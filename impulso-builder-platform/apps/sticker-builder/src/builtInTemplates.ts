import type { Project } from "@impulso/document-schema";
import type { TemplateStore } from "@impulso/template-library";
import { createProjectFromSize, type StickerShape } from "./projectPresets.js";

export interface BuiltInTemplateSeed {
  /** Id fijo y estable del Template en el catálogo — se usa SOLO para
   * detectar "¿ya sembré este built-in?" en `seedBuiltInTemplates`, nunca
   * para los ids internos del `Project` que contiene (esos siguen siendo
   * frescos vía `generateId`, ver `createProjectFromSize`). */
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  shape: StickerShape;
}

/**
 * Los 3 tamaños de sticker curados de Epic 1 (`STICKER_SIZE_PRESETS`,
 * ahora eliminado de `projectPresets.ts`) reencarnados como Templates
 * incorporados — un tamaño-preset siempre fue, en esencia, una plantilla
 * mínima (sin contenido más allá de la línea de corte del círculo). Ver
 * ADR-0013.
 */
export const BUILT_IN_STICKER_TEMPLATES: readonly BuiltInTemplateSeed[] = [
  { id: "builtin_square-5x5", name: "Sticker cuadrado (5×5 cm)", widthMm: 50, heightMm: 50, shape: "square" },
  { id: "builtin_circle-5x5", name: "Sticker circular (5×5 cm)", widthMm: 50, heightMm: 50, shape: "circle" },
  { id: "builtin_rect-7x5", name: "Sticker rectangular (7×5 cm)", widthMm: 70, heightMm: 50, shape: "rectangle" },
];

export interface SeedBuiltInTemplatesOptions {
  now: string;
  generateId?: () => string;
  /** Cómo generar el thumbnail de cada Template sembrado — inyectable
   * para tests deterministicos sin canvas real; en producción,
   * `app.ts` inyecta una función que llama a `exportProject` de
   * `@impulso/export-engine` (Templates no depende de Export Engine). */
  generateThumbnail: (project: Project) => Promise<Blob>;
}

/**
 * Siembra los Templates incorporados en `store` si todavía no existen —
 * idempotente: una vez sembrado un `id` fijo, las llamadas siguientes lo
 * saltan (aunque el contenido interno de cada siembra use ids frescos vía
 * `generateId`, irrelevante para la idempotencia, que se decide solo por
 * el `id` del catálogo).
 */
export async function seedBuiltInTemplates(store: TemplateStore, options: SeedBuiltInTemplatesOptions): Promise<void> {
  const { now, generateThumbnail } = options;
  const generateId = options.generateId ?? (() => crypto.randomUUID());

  const existing = await store.listDescriptors({ moduleId: "sticker-builder" });
  const existingIds = new Set(existing.map((descriptor) => descriptor.id));

  for (const seed of BUILT_IN_STICKER_TEMPLATES) {
    if (existingIds.has(seed.id)) continue;

    const project = createProjectFromSize({
      widthMm: seed.widthMm,
      heightMm: seed.heightMm,
      shape: seed.shape,
      now,
      generateId,
    });
    const thumbnail = await generateThumbnail(project);

    await store.save(
      {
        id: seed.id,
        moduleId: "sticker-builder",
        name: seed.name,
        tags: [seed.shape],
        builtIn: true,
        createdAt: now,
        updatedAt: now,
      },
      { project, thumbnail },
    );
  }
}

export interface LazyBuiltInTemplateSeeder {
  /** Siembra los built-in a lo sumo una vez por instancia — nunca lanza:
   * un fallo (cuota agotada, error de rasterización) se registra y se
   * traga, para que quien llame pueda seguir con su flujo (abrir la
   * galería de Templates) sin importar si sembrar tuvo éxito. */
  ensureSeeded(): Promise<void>;
}

/**
 * Envuelve `seedBuiltInTemplates` en el patrón "perezoso, una sola vez,
 * nunca lanza" que tanto `workspace.ts` como `app.ts` necesitan antes de
 * abrir su propia galería de "Nuevo proyecto" — cada mount tiene su propia
 * instancia (su propio flag `seeded`), pero eso es inofensivo: el segundo
 * intento simplemente encuentra los 3 built-in ya sembrados en el store y
 * no hace nada (ver `seedBuiltInTemplates`, idempotente por `id` de
 * catálogo).
 */
export function createLazyBuiltInTemplateSeeder(
  store: TemplateStore,
  options: { now: () => string; generateThumbnail: (project: Project) => Promise<Blob> },
): LazyBuiltInTemplateSeeder {
  let seeded = false;
  return {
    async ensureSeeded() {
      if (seeded) return;
      seeded = true;
      try {
        await seedBuiltInTemplates(store, { now: options.now(), generateThumbnail: options.generateThumbnail });
      } catch (error) {
        console.error("No se pudieron sembrar los Templates incorporados:", error);
      }
    },
  };
}
