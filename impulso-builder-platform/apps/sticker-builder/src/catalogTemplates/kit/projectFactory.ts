import { CURRENT_SCHEMA_VERSION, type Project, type SceneObject, type Metadata, type Unit } from "@impulso/document-schema";
import { createIdFactory, type CatalogIdFactory } from "./ids.js";
import { buildElementMetadata } from "./metadata.js";

export interface CatalogProjectBuildContext {
  ids: CatalogIdFactory;
  now: string;
  /** Metadata base (`{tags:[], visible:true, locked:false, createdAt,
   * updatedAt}`, sin `role`/`name`) — cada `SceneObject` normalmente quiere
   * la suya propia con su propio `role`/`name` (ver `textObjects.ts`/
   * `graphicElements.ts`), pero se expone aquí por si un builder necesita
   * el Layer/Page/Document metadata base directamente. */
  metadata: Metadata;
}

export interface CreateCatalogProjectOptions {
  moduleId: string;
  name: string;
  widthMm: number;
  heightMm: number;
  now: string;
  /** Inyectable para tests determinísticos; por defecto `crypto.randomUUID()`. */
  generateId?: () => string;
  unit?: Unit;
  /** Construye los `SceneObject`s de la única Layer del Project — recibe
   * la misma fábrica de ids y `now` que usó el resto del scaffold, para
   * que un objeto de contenido y la línea de corte compartan exactamente
   * el mismo `generateId` inyectado (necesario para ids determinísticos
   * en tests). */
  buildObjects: (context: CatalogProjectBuildContext) => SceneObject[];
}

/**
 * Construye el scaffold completo de un `Project` (Project/Document/Page/
 * Layer, con ids, `schemaVersion`, `assets: []`, `history` vacío) —
 * exactamente el boilerplate que antes se repetía, casi idéntico, entre
 * `createProjectFromSize` (`projectPresets.ts`) y
 * `createSerumFacialPremiumProject` (`catalogTemplates/serumFacialPremium.ts`).
 * Cada uno de los 62 templates restantes solo necesita aportar su propio
 * `buildObjects` — nunca reconstruir el scaffold de Project/Document/Page/
 * Layer a mano.
 *
 * Preserva el orden de generación de ids del código original: `buildObjects`
 * se invoca ANTES de generar los ids de Project/Document/Page/Layer (mismo
 * orden que ya validaban los tests de determinismo de `createProjectFromSize`).
 */
export function createCatalogProject(options: CreateCatalogProjectOptions): Project {
  const { moduleId, name, widthMm, heightMm, now } = options;
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const ids = createIdFactory(generateId);
  const metadata = buildElementMetadata({ now });

  const objects = options.buildObjects({ ids, now, metadata });

  return {
    id: ids.projectId(),
    moduleId,
    document: {
      id: ids.documentId(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [
        {
          id: ids.pageId(),
          size: { width: widthMm, height: heightMm },
          unit: options.unit ?? "mm",
          grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
          layers: [
            {
              id: ids.layerId(),
              objects,
              metadata,
              pluginData: {},
              customProperties: {},
            },
          ],
          metadata,
          pluginData: {},
          customProperties: {},
        },
      ],
      assets: [],
      metadata,
      history: { entries: [] },
      pluginData: {},
      customProperties: {},
    },
    metadata: { ...metadata, name },
    pluginData: {},
    customProperties: {},
  };
}
