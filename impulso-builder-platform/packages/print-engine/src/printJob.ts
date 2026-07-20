import type { DocumentId, PageId } from "@impulso/document-schema";
import { PRINT_PROFILES } from "./profiles.js";
import {
  PRINT_JOB_SCHEMA_VERSION,
  type BleedSpec,
  type CropMarksSpec,
  type CutPathSpec,
  type ImpositionSpec,
  type PhysicalSize,
  type PrintJob,
  type PrintOutputFormat,
  type PrintProfileId,
  type SafeAreaSpec,
} from "./types.js";

export interface CreatePrintJobOverrides {
  output?: PrintOutputFormat;
  scale?: number;
  resolution?: { targetPpi: number };
  bleed?: BleedSpec;
  safeArea?: SafeAreaSpec;
  cropMarks?: CropMarksSpec;
  cutPath?: CutPathSpec;
  imposition?: ImpositionSpec;
  background?: PrintJob["background"];
  name?: string;
}

export interface CreatePrintJobOptions {
  documentId: DocumentId;
  pageIds: PageId[];
  dimensions: PhysicalSize;
  profile: PrintProfileId;
  /** Inyectable para determinismo en tests — mismo patrón que
   * `ProjectSaveCoordinator`/`duplicateProject` (Epic 8). */
  now: () => string;
  overrides?: CreatePrintJobOverrides;
}

/**
 * Construye un `PrintJob` completo a partir de un perfil base (sección 12)
 * más los datos específicos del documento — nunca deja un campo a medio
 * llenar (principio de la sección 2: "no depender de la UI para construir
 * resultados válidos"). `overrides` permite que la UI modifique cualquier
 * valor del perfil sin ocultar nada — el resultado siempre es un
 * `PrintJob` completo y explícito, nunca un diff parcial.
 */
export function createPrintJob(options: CreatePrintJobOptions): PrintJob {
  const defaults = PRINT_PROFILES[options.profile];
  const overrides = options.overrides ?? {};

  // Nunca devolver una referencia compartida con `PRINT_PROFILES` (el
  // singleton de `profiles.ts`) ni con `options.dimensions`/`overrides` tal
  // cual — un `PrintJob` es un valor propio del llamador, que puede
  // mutarlo (la UI, o un test) sin que eso corrompa el preset base ni
  // ningún otro `PrintJob` construido antes o después a partir del mismo
  // perfil. `structuredClone` es suficiente porque todo el contenido es
  // JSON-plano (sin funciones/clases).
  return structuredClone({
    schemaVersion: PRINT_JOB_SCHEMA_VERSION,
    documentId: options.documentId,
    pageIds: options.pageIds,
    output: overrides.output ?? defaults.output,
    profile: options.profile,
    dimensions: options.dimensions,
    scale: overrides.scale ?? 1,
    resolution: overrides.resolution ?? defaults.resolution,
    bleed: overrides.bleed ?? defaults.bleed,
    safeArea: overrides.safeArea ?? defaults.safeArea,
    cropMarks: overrides.cropMarks ?? defaults.cropMarks,
    cutPath: overrides.cutPath ?? defaults.cutPath,
    imposition: overrides.imposition ?? defaults.imposition,
    background: overrides.background ?? defaults.background,
    metadata: { name: overrides.name, createdAt: options.now() },
  });
}
