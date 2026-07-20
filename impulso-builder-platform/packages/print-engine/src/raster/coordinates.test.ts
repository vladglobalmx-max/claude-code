import { describe, expect, it } from "vitest";
import { computeCanonicalPageGeometry } from "./coordinates.js";
import { buildPrintJobFor, buildDocument, buildPage, buildProject } from "../testUtils/fixtures.js";

function jobFor(pageOverrides: Parameters<typeof buildPage>[2], profile: Parameters<typeof buildPrintJobFor>[1] = "print-pdf") {
  const project = buildProject({ document: buildDocument([buildPage("page_1", [], pageOverrides)]) });
  return buildPrintJobFor(project, profile);
}

describe("computeCanonicalPageGeometry", () => {
  it("100mm a 300 PPI (perfil sin bleed) produce exactamente 1181px de raster — identidad de la Fase 9.1", () => {
    const job = jobFor({ size: { width: 100, height: 100 }, unit: "mm" }, "digital-png");
    job.resolution = { targetPpi: 300 };
    const geometry = computeCanonicalPageGeometry(job);
    expect(geometry.trimRasterWidth).toBe(1181);
    expect(geometry.trimRasterHeight).toBe(1181);
  });

  it("página A4 (210x297mm) a 300 PPI produce el raster correcto", () => {
    const job = jobFor({ size: { width: 210, height: 297 }, unit: "mm" }, "digital-png");
    job.resolution = { targetPpi: 300 };
    const geometry = computeCanonicalPageGeometry(job);
    expect(geometry.trimRasterWidth).toBeCloseTo(2480, 0);
    expect(geometry.trimRasterHeight).toBeCloseTo(3508, 0);
  });

  it("sin bleed, canvasCanonical == trimCanonical y el offset es (0,0)", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "digital-png");
    const geometry = computeCanonicalPageGeometry(job);
    expect(geometry.canvasCanonicalWidth).toBeCloseTo(geometry.trimCanonicalWidth, 8);
    expect(geometry.canvasCanonicalHeight).toBeCloseTo(geometry.trimCanonicalHeight, 8);
    expect(geometry.offsetCanonicalX).toBe(0);
    expect(geometry.offsetCanonicalY).toBe(0);
  });

  it("con bleed estándar (3mm por lado), el canvas canónico crece exactamente 6mm por eje y el offset es el bleed izquierdo/superior", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    const geometry = computeCanonicalPageGeometry(job);
    const bleedCanonical3mm = geometry.bleedCanonicalLeft; // 3mm en px canónico
    expect(geometry.canvasCanonicalWidth).toBeCloseTo(geometry.trimCanonicalWidth + 2 * bleedCanonical3mm, 8);
    expect(geometry.offsetCanonicalX).toBeCloseTo(bleedCanonical3mm, 8);
    expect(geometry.offsetCanonicalY).toBeCloseTo(bleedCanonical3mm, 8);
  });

  it("bleed asimétrico produce offsets/canvas distintos por lado", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    job.bleed = { top: 2, right: 4, bottom: 6, left: 8, unit: "mm" };
    const geometry = computeCanonicalPageGeometry(job);
    expect(geometry.bleedCanonicalLeft).toBeGreaterThan(geometry.bleedCanonicalRight);
    expect(geometry.bleedCanonicalBottom).toBeGreaterThan(geometry.bleedCanonicalTop);
    expect(geometry.offsetCanonicalX).toBeCloseTo(geometry.bleedCanonicalLeft, 8);
    expect(geometry.offsetCanonicalY).toBeCloseTo(geometry.bleedCanonicalTop, 8);
  });

  it("bleed en una unidad distinta a page.unit se convierte correctamente sin encadenar conversiones", () => {
    const job = jobFor({ size: { width: 100, height: 100 }, unit: "mm" }, "print-pdf");
    job.bleed = { top: 0.125, right: 0.125, bottom: 0.125, left: 0.125, unit: "in" }; // 0.125in = 3.175mm
    const geometry = computeCanonicalPageGeometry(job);
    // 0.125in en px canónico == 0.125 * 96 = 12px exactos.
    expect(geometry.bleedCanonicalLeft).toBeCloseTo(12, 8);
  });

  it("bleed cero es válido y no produce NaN/errores", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "print-pdf");
    job.bleed = { top: 0, right: 0, bottom: 0, left: 0, unit: "mm" };
    const geometry = computeCanonicalPageGeometry(job);
    expect(geometry.canvasCanonicalWidth).toBeCloseTo(geometry.trimCanonicalWidth, 8);
    expect(Number.isFinite(geometry.canvasRasterWidth)).toBe(true);
  });

  it("canonicalScale es 1 a targetPpi=96 (sin escalado adicional respecto al Stage canónico)", () => {
    const job = jobFor({ size: { width: 50, height: 50 }, unit: "mm" }, "digital-png");
    const geometry = computeCanonicalPageGeometry(job);
    expect(geometry.canonicalScale).toBe(1);
  });

  it("página en pulgadas (in) a 300 PPI produce el raster correcto (1in -> 300px)", () => {
    const job = jobFor({ size: { width: 4, height: 6 }, unit: "in" }, "digital-png");
    job.resolution = { targetPpi: 300 };
    const geometry = computeCanonicalPageGeometry(job);
    expect(geometry.trimRasterWidth).toBe(1200);
    expect(geometry.trimRasterHeight).toBe(1800);
  });

  // Sección 24 del enunciado de Fase 9.2 — política explícita para
  // page.unit === "px": los px canónicos equivalen a 96 px por pulgada
  // (el mismo estándar CSS de siempre, ver ADR-0021); `targetPpi` decide
  // CUÁNTOS píxeles de raster se generan, nunca cambia el tamaño físico
  // base. Verificado con el ejemplo exacto del enunciado.
  describe("política Page.unit = 'px' (sección 24)", () => {
    it("960px de página equivalen a 10in físicas — a 300 PPI produce exactamente 3000px de raster", () => {
      const job = jobFor({ size: { width: 960, height: 960 }, unit: "px" }, "digital-png");
      job.resolution = { targetPpi: 300 };
      const geometry = computeCanonicalPageGeometry(job);
      // 960px canónico == 960/96 == 10 pulgadas físicas (identidad base).
      expect(geometry.trimCanonicalWidth).toBe(960);
      // A 300 PPI: 10in * 300 == 3000px de raster — exactamente el
      // ejemplo del enunciado.
      expect(geometry.trimRasterWidth).toBe(3000);
      expect(geometry.trimRasterHeight).toBe(3000);
    });

    it("targetPpi controla el raster, NUNCA el tamaño físico base de una página en px", () => {
      const jobLowPpi = jobFor({ size: { width: 960, height: 960 }, unit: "px" }, "digital-png");
      jobLowPpi.resolution = { targetPpi: 96 };
      const jobHighPpi = jobFor({ size: { width: 960, height: 960 }, unit: "px" }, "digital-png");
      jobHighPpi.resolution = { targetPpi: 600 };
      // El tamaño físico base (px canónico) es el MISMO sin importar targetPpi.
      expect(computeCanonicalPageGeometry(jobLowPpi).trimCanonicalWidth).toBe(
        computeCanonicalPageGeometry(jobHighPpi).trimCanonicalWidth,
      );
      // Solo el raster final cambia.
      expect(computeCanonicalPageGeometry(jobLowPpi).trimRasterWidth).toBe(960);
      expect(computeCanonicalPageGeometry(jobHighPpi).trimRasterWidth).toBe(6000);
    });

    it("PrintJob.scale modifica explícitamente cuánto contenido cabe en el trim, sin cambiar canvasRasterWidth/Height", () => {
      const project = buildProject({ document: buildDocument([buildPage("page_1", [], { size: { width: 960, height: 960 }, unit: "px" })]) });
      const jobScale1 = buildPrintJobFor(project, "digital-png", { resolution: { targetPpi: 300 } });
      const jobScale2 = buildPrintJobFor(project, "digital-png", { resolution: { targetPpi: 300 }, scale: 2 });
      const geometryScale1 = computeCanonicalPageGeometry(jobScale1);
      const geometryScale2 = computeCanonicalPageGeometry(jobScale2);
      // El tamaño del canvas/raster (la página física) es IDÉNTICO — scale
      // afecta el CONTENIDO (aplicado en renderPrintPage vía contentScale
      // de renderer-konva), nunca el tamaño de la página en sí.
      expect(geometryScale2.canvasRasterWidth).toBe(geometryScale1.canvasRasterWidth);
      expect(geometryScale2.canvasRasterHeight).toBe(geometryScale1.canvasRasterHeight);
    });
  });
});
