import { describe, expect, it } from "vitest";
import { DocumentIdSchema, PageIdSchema } from "@impulso/document-schema";
import { createPrintJob } from "./printJob.js";
import { PRINT_PROFILES } from "./profiles.js";
import { PRINT_JOB_SCHEMA_VERSION } from "./types.js";

const NOW = "2026-07-20T00:00:00.000Z";
const documentId = DocumentIdSchema.parse("document_1");
const pageIds = [PageIdSchema.parse("page_1")];
const dimensions = { width: 50, height: 50, unit: "mm" as const };

describe("createPrintJob — defaults por perfil", () => {
  it("cada uno de los 4 perfiles base produce un PrintJob completo, sin campos undefined salvo metadata.name", () => {
    for (const profileId of Object.keys(PRINT_PROFILES) as (keyof typeof PRINT_PROFILES)[]) {
      const job = createPrintJob({ documentId, pageIds, dimensions, profile: profileId, now: () => NOW });
      expect(job.schemaVersion).toBe(PRINT_JOB_SCHEMA_VERSION);
      expect(job.documentId).toBe(documentId);
      expect(job.pageIds).toEqual(pageIds);
      expect(job.profile).toBe(profileId);
      expect(job.dimensions).toEqual(dimensions);
      expect(job.scale).toBe(1);
      expect(job.output).toBe(PRINT_PROFILES[profileId].output);
      expect(job.resolution).toEqual(PRINT_PROFILES[profileId].resolution);
      expect(job.bleed).toEqual(PRINT_PROFILES[profileId].bleed);
      expect(job.metadata.createdAt).toBe(NOW);
      expect(job.metadata.name).toBeUndefined();
    }
  });

  it("'digital-png' es PNG, sin bleed ni crop marks, transparente", () => {
    const job = createPrintJob({ documentId, pageIds, dimensions, profile: "digital-png", now: () => NOW });
    expect(job.output).toBe("png");
    expect(job.bleed).toEqual({ top: 0, right: 0, bottom: 0, left: 0, unit: "mm" });
    expect(job.cropMarks.enabled).toBe(false);
    expect(job.background).toEqual({ type: "transparent" });
  });

  it("'print-pdf' es PDF a 300 PPI con bleed y crop marks estándar", () => {
    const job = createPrintJob({ documentId, pageIds, dimensions, profile: "print-pdf", now: () => NOW });
    expect(job.output).toBe("pdf");
    expect(job.resolution.targetPpi).toBe(300);
    expect(job.bleed).toEqual({ top: 3, right: 3, bottom: 3, left: 3, unit: "mm" });
    expect(job.cropMarks.enabled).toBe(true);
  });

  it("'sticker-sheet' es PDF con imposición habilitada y cutPath die-cut automático", () => {
    const job = createPrintJob({ documentId, pageIds, dimensions, profile: "sticker-sheet", now: () => NOW });
    expect(job.imposition.enabled).toBe(true);
    expect(job.cutPath).toEqual({
      mode: "die-cut",
      source: { type: "auto" },
      offset: 0,
      unit: "mm",
      stroke: 0.25,
      color: "#ff00ff",
      logicalLayerName: "DieCut",
    });
  });

  it("'web-preview' es PNG a 72 PPI con fondo sólido blanco", () => {
    const job = createPrintJob({ documentId, pageIds, dimensions, profile: "web-preview", now: () => NOW });
    expect(job.output).toBe("png");
    expect(job.resolution.targetPpi).toBe(72);
    expect(job.background).toEqual({ type: "solid", color: "#ffffff" });
  });
});

describe("createPrintJob — overrides", () => {
  it("un override reemplaza el valor del perfil sin afectar el resto", () => {
    const job = createPrintJob({
      documentId,
      pageIds,
      dimensions,
      profile: "print-pdf",
      now: () => NOW,
      overrides: { resolution: { targetPpi: 600 }, name: "Mi sticker" },
    });
    expect(job.resolution.targetPpi).toBe(600);
    expect(job.metadata.name).toBe("Mi sticker");
    expect(job.bleed).toEqual(PRINT_PROFILES["print-pdf"].bleed); // resto del perfil intacto
  });

  it("sin overrides, el resultado es idéntico a los defaults del perfil (nunca oculta un valor crítico)", () => {
    const job = createPrintJob({ documentId, pageIds, dimensions, profile: "sticker-sheet", now: () => NOW });
    expect(job.bleed).toEqual(PRINT_PROFILES["sticker-sheet"].bleed);
    expect(job.safeArea).toEqual(PRINT_PROFILES["sticker-sheet"].safeArea);
    expect(job.cropMarks).toEqual(PRINT_PROFILES["sticker-sheet"].cropMarks);
    expect(job.imposition).toEqual(PRINT_PROFILES["sticker-sheet"].imposition);
  });
});

describe("createPrintJob — serialización", () => {
  it("el resultado sobrevive un ciclo JSON.stringify/parse sin pérdida (serializable de verdad)", () => {
    const job = createPrintJob({ documentId, pageIds, dimensions, profile: "print-pdf", now: () => NOW, overrides: { name: "Test" } });
    const roundTripped = JSON.parse(JSON.stringify(job));
    expect(roundTripped).toEqual(JSON.parse(JSON.stringify(job)));
    expect(roundTripped.schemaVersion).toBe(PRINT_JOB_SCHEMA_VERSION);
  });

  it("createPrintJob es determinista: mismos inputs producen el mismo PrintJob", () => {
    const jobA = createPrintJob({ documentId, pageIds, dimensions, profile: "print-pdf", now: () => NOW });
    const jobB = createPrintJob({ documentId, pageIds, dimensions, profile: "print-pdf", now: () => NOW });
    expect(jobA).toEqual(jobB);
  });
});

describe("versionado", () => {
  it("PRINT_JOB_SCHEMA_VERSION es 1 — todavía no existe ninguna migración registrada (correcto: es la primera versión)", () => {
    expect(PRINT_JOB_SCHEMA_VERSION).toBe(1);
  });
});
