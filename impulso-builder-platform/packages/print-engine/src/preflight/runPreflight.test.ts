import { describe, expect, it, vi } from "vitest";
import { ObjectIdSchema, AssetIdSchema } from "@impulso/document-schema";
import { runPreflight } from "./runPreflight.js";
import type { FontChecker } from "./fonts.js";
import type { ImageDimensionsProbe } from "./imageProbe.js";
import { buildDocument, buildEllipse, buildImage, buildImageAsset, buildLayer, buildPage, buildPrintJobFor, buildProject, buildRectangle, buildText, NOW as FIXTURE_NOW } from "../testUtils/fixtures.js";

function noopResolver(blobs: Record<string, Blob | undefined> = {}) {
  return { resolve: async (assetId: string) => blobs[assetId] };
}

const NEVER_CHECK: FontChecker = { check: async () => "available" };
const NO_PROBE: ImageDimensionsProbe = { measure: async () => undefined };

describe("runPreflight — document_not_normalized", () => {
  it("un Project que no pasa ProjectSchema produce un único error bloqueante y no sigue evaluando", async () => {
    const project = buildProject({ moduleId: "" }); // moduleId vacío es inválido
    const printJob = buildPrintJobFor(project);
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.hasBlockingErrors).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe("document_not_normalized");
  });
});

describe("runPreflight — invalid_dimensions", () => {
  it.each([0, -10, NaN, Infinity])("dimensions.width=%s produce un error", async (width) => {
    const project = buildProject();
    const printJob = buildPrintJobFor(project, "print-pdf", {});
    printJob.dimensions.width = width;
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.issues.some((i) => i.code === "invalid_dimensions" && i.severity === "error")).toBe(true);
    expect(result.hasBlockingErrors).toBe(true);
  });

  it("dimensiones válidas no producen ningún issue de invalid_dimensions", async () => {
    const project = buildProject();
    const printJob = buildPrintJobFor(project);
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.issues.some((i) => i.code === "invalid_dimensions")).toBe(false);
  });
});

describe("runPreflight — invalid_bleed", () => {
  it("un valor de bleed negativo produce un error por ese lado", async () => {
    const project = buildProject();
    const printJob = buildPrintJobFor(project);
    printJob.bleed.left = -3;
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.issues.some((i) => i.code === "invalid_bleed" && i.message.includes("left"))).toBe(true);
  });

  it("NaN/Infinity en cualquier lado también produce un error", async () => {
    const project = buildProject();
    const printJob = buildPrintJobFor(project);
    printJob.bleed.top = NaN;
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.issues.some((i) => i.code === "invalid_bleed")).toBe(true);
  });

  it("bleed en 0 (válido) no produce ningún issue", async () => {
    const project = buildProject();
    const printJob = buildPrintJobFor(project, "digital-png");
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.issues.some((i) => i.code === "invalid_bleed")).toBe(false);
  });
});

describe("runPreflight — extreme_scale", () => {
  it("scale <= 0 o no finito es un error", async () => {
    const project = buildProject();
    const printJob = buildPrintJobFor(project, "print-pdf", { scale: 0 });
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.issues.some((i) => i.code === "extreme_scale" && i.severity === "error")).toBe(true);
  });

  it("scale fuera de [0.01, 100] pero positivo/finito es solo advertencia, no bloquea", async () => {
    const project = buildProject();
    const printJob = buildPrintJobFor(project, "print-pdf", { scale: 500 });
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    const issue = result.issues.find((i) => i.code === "extreme_scale");
    expect(issue?.severity).toBe("warning");
    expect(result.hasBlockingErrors).toBe(false);
  });

  it("scale=1 (normal) no produce ningún issue", async () => {
    const project = buildProject();
    const printJob = buildPrintJobFor(project);
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.issues.some((i) => i.code === "extreme_scale")).toBe(false);
  });
});

describe("runPreflight — page_not_found", () => {
  it("un pageId que no existe en el Document produce un error y esa página se salta", async () => {
    const project = buildProject();
    const printJob = buildPrintJobFor(project);
    printJob.pageIds = [...printJob.pageIds, "page_no_existe" as never];
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.issues.some((i) => i.code === "page_not_found" && i.pageId === "page_no_existe")).toBe(true);
  });
});

describe("runPreflight — empty_page", () => {
  it("una página sin objects produce una advertencia (no bloquea)", async () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [])])]) });
    const printJob = buildPrintJobFor(project);
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    const issue = result.issues.find((i) => i.code === "empty_page");
    expect(issue?.severity).toBe("warning");
    expect(result.hasBlockingErrors).toBe(false);
  });

  it("una página con al menos un object visible no produce empty_page", async () => {
    const image = buildImage("obj_1");
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [image])])], { assets: [buildImageAsset("asset_1")] }),
    });
    const printJob = buildPrintJobFor(project);
    const result = await runPreflight(project, printJob, {
      resolver: noopResolver({ asset_1: new Blob(["png"], { type: "image/png" }) }),
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
    });
    expect(result.issues.some((i) => i.code === "empty_page")).toBe(false);
  });

  it("un object invisible no cuenta para 'página vacía'", async () => {
    const image = buildImage("obj_1", { metadata: { tags: [], visible: false, locked: false, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z" } });
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [image])])], { assets: [buildImageAsset("asset_1")] }),
    });
    const printJob = buildPrintJobFor(project);
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.issues.some((i) => i.code === "empty_page")).toBe(true);
  });
});

describe("runPreflight — assets faltantes", () => {
  it("un ImageObject referenciando un assetId inexistente en document.assets produce asset_reference_missing (error)", async () => {
    const image = buildImage("obj_1", { assetId: AssetIdSchema.parse("asset_fantasma") });
    const project = buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [image])])]) });
    const printJob = buildPrintJobFor(project);
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    const issue = result.issues.find((i) => i.code === "asset_reference_missing");
    expect(issue?.severity).toBe("error");
    expect(issue?.objectId).toBe(ObjectIdSchema.parse("obj_1"));
    expect(result.hasBlockingErrors).toBe(true);
  });

  it("un Asset referenciado que existe pero cuyo binario no resuelve produce asset_binary_missing (error)", async () => {
    const image = buildImage("obj_1");
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [image])])], { assets: [buildImageAsset("asset_1")] }),
    });
    const printJob = buildPrintJobFor(project);
    const result = await runPreflight(project, printJob, { resolver: noopResolver({}), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    const issue = result.issues.find((i) => i.code === "asset_binary_missing");
    expect(issue?.severity).toBe("error");
    expect(result.hasBlockingErrors).toBe(true);
  });

  it("un Asset que resuelve correctamente no produce ningún issue de asset faltante", async () => {
    const image = buildImage("obj_1");
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [image])])], { assets: [buildImageAsset("asset_1")] }),
    });
    const printJob = buildPrintJobFor(project);
    const result = await runPreflight(project, printJob, {
      resolver: noopResolver({ asset_1: new Blob(["png"], { type: "image/png" }) }),
      fontChecker: NEVER_CHECK,
      imageProbe: NO_PROBE,
    });
    expect(result.issues.some((i) => i.code === "asset_reference_missing" || i.code === "asset_binary_missing")).toBe(false);
  });

  it("un resolver que RECHAZA (no solo devuelve undefined) produce el mismo asset_binary_missing, en vez de propagar un rechazo crudo — regresión Fase 9.5 (error injection)", async () => {
    const image = buildImage("obj_1");
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [image])])], { assets: [buildImageAsset("asset_1")] }),
    });
    const printJob = buildPrintJobFor(project);
    const failingResolver = { resolve: async (): Promise<Blob | undefined> => Promise.reject(new Error("network down")) };
    const result = await runPreflight(project, printJob, { resolver: failingResolver, fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    const issue = result.issues.find((i) => i.code === "asset_binary_missing");
    expect(issue?.severity).toBe("error");
    expect(result.hasBlockingErrors).toBe(true);
  });
});

describe("runPreflight — cancelación cooperativa", () => {
  it("un signal ya abortado antes de la primera página detiene Preflight de inmediato (regresión Fase 9.5 — antes no existía NINGÚN punto de cancelación dentro de runPreflight)", async () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildImage("obj_1")])])], { assets: [buildImageAsset("asset_1")] }) });
    const printJob = buildPrintJobFor(project);
    const controller = new AbortController();
    controller.abort();
    await expect(
      runPreflight(project, printJob, { resolver: noopResolver({ asset_1: new Blob(["x"]) }), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, signal: controller.signal }),
    ).rejects.toMatchObject({ code: "aborted" });
  });

  it("abortar DESPUÉS de que la primera página termine detiene Preflight antes de procesar la segunda página", async () => {
    const controller = new AbortController();
    const image = buildImage("obj_1");
    const page1 = buildPage("page_1", [buildLayer("layer_1", [image])]);
    const page2 = buildPage("page_2", [buildLayer("layer_2", [buildImage("obj_2")])]);
    const project = buildProject({ document: buildDocument([page1, page2], { assets: [buildImageAsset("asset_1")] }) });
    const printJob = buildPrintJobFor(project);
    printJob.pageIds = [page1.id, page2.id];
    const resolverThatAbortsAfterFirstCall = {
      resolve: async (assetId: string): Promise<Blob | undefined> => {
        controller.abort(); // simula el usuario cancelando justo mientras Preflight trabaja
        return assetId === "asset_1" ? new Blob(["x"]) : undefined;
      },
    };
    await expect(
      runPreflight(project, printJob, { resolver: resolverThatAbortsAfterFirstCall, fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, signal: controller.signal }),
    ).rejects.toMatchObject({ code: "aborted" });
  });
});

describe("runPreflight — resolución efectiva", () => {
  function projectWithImage(sizeWidthPx: number) {
    const image = buildImage("obj_1", { size: { width: sizeWidthPx, height: sizeWidthPx } });
    return buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [image])])], { assets: [buildImageAsset("asset_1")] }),
    });
  }

  it("una imagen con suficiente resolución (>= umbral) no produce ningún issue de resolución", async () => {
    // object.size.width = 96 canonical-px = 1 pulgada renderizada; una
    // imagen de 300px de ancho ahí da 300 PPI efectivos == targetPpi.
    const project = projectWithImage(96);
    const printJob = buildPrintJobFor(project, "print-pdf"); // targetPpi 300
    const probe: ImageDimensionsProbe = { measure: async () => ({ width: 300, height: 300 }) };
    const result = await runPreflight(project, printJob, { resolver: noopResolver({ asset_1: new Blob(["x"]) }), fontChecker: NEVER_CHECK, imageProbe: probe });
    expect(result.issues.some((i) => i.code === "resolution_insufficient" || i.code === "resolution_borderline")).toBe(false);
  });

  it("una imagen claramente por debajo del umbral produce resolution_insufficient (warning, no bloquea)", async () => {
    const project = projectWithImage(96); // 1 pulgada renderizada
    const printJob = buildPrintJobFor(project, "print-pdf"); // targetPpi 300, warnBelowPpi = 200
    const probe: ImageDimensionsProbe = { measure: async () => ({ width: 72, height: 72 }) }; // 72 PPI, muy por debajo
    const result = await runPreflight(project, printJob, { resolver: noopResolver({ asset_1: new Blob(["x"]) }), fontChecker: NEVER_CHECK, imageProbe: probe });
    const issue = result.issues.find((i) => i.code === "resolution_insufficient");
    expect(issue?.severity).toBe("warning");
    expect(result.hasBlockingErrors).toBe(false);
  });

  it("una imagen apenas por debajo del umbral produce resolution_borderline (info, más suave)", async () => {
    const project = projectWithImage(96);
    const printJob = buildPrintJobFor(project, "print-pdf"); // warnBelowPpi = 200
    const probe: ImageDimensionsProbe = { measure: async () => ({ width: 190, height: 190 }) }; // justo debajo de 200, no crítico
    const result = await runPreflight(project, printJob, { resolver: noopResolver({ asset_1: new Blob(["x"]) }), fontChecker: NEVER_CHECK, imageProbe: probe });
    const issue = result.issues.find((i) => i.code === "resolution_borderline");
    expect(issue?.severity).toBe("info");
  });

  it("nunca es un error — la sección 14 prohíbe bloquear por resolución insuficiente", async () => {
    const project = projectWithImage(96);
    const printJob = buildPrintJobFor(project, "print-pdf");
    const probe: ImageDimensionsProbe = { measure: async () => ({ width: 1, height: 1 }) }; // pésima resolución
    const result = await runPreflight(project, printJob, { resolver: noopResolver({ asset_1: new Blob(["x"]) }), fontChecker: NEVER_CHECK, imageProbe: probe });
    expect(result.hasBlockingErrors).toBe(false);
  });

  it("si el probe de imagen no puede medir (undefined), no se produce ningún issue de resolución (degradación honesta)", async () => {
    const project = projectWithImage(96);
    const printJob = buildPrintJobFor(project, "print-pdf");
    const result = await runPreflight(project, printJob, { resolver: noopResolver({ asset_1: new Blob(["x"]) }), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.issues.some((i) => i.code === "resolution_insufficient" || i.code === "resolution_borderline")).toBe(false);
  });
});

describe("runPreflight — fuentes (corrección 6: señal, no garantía)", () => {
  function projectWithText() {
    const text = buildText("obj_1");
    return buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [text])])]) });
  }

  it("fuente disponible ('available') no produce ningún issue", async () => {
    const project = projectWithText();
    const printJob = buildPrintJobFor(project);
    const checker: FontChecker = { check: async () => "available" };
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: checker, imageProbe: NO_PROBE });
    expect(result.issues.some((i) => i.code === "font_unavailable" || i.code === "font_verification_uncertain")).toBe(false);
  });

  it("fuente confirmada ausente ('unavailable') produce font_unavailable — warning, NUNCA error (permite cancelar, no bloquea)", async () => {
    const project = projectWithText();
    const printJob = buildPrintJobFor(project);
    const checker: FontChecker = { check: async () => "unavailable" };
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: checker, imageProbe: NO_PROBE });
    const issue = result.issues.find((i) => i.code === "font_unavailable");
    expect(issue?.severity).toBe("warning");
    expect(result.hasBlockingErrors).toBe(false);
  });

  it("detección incierta ('verification-uncertain') produce font_verification_uncertain — info, tono no absoluto", async () => {
    const project = projectWithText();
    const printJob = buildPrintJobFor(project);
    const checker: FontChecker = { check: async () => "verification-uncertain" };
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: checker, imageProbe: NO_PROBE });
    const issue = result.issues.find((i) => i.code === "font_verification_uncertain");
    expect(issue?.severity).toBe("info");
  });

  it("browserFontChecker real degrada a 'verification-uncertain' si document.fonts no existe (nunca finge 'available')", async () => {
    const { browserFontChecker } = await import("./fonts.js");
    const original = (document as { fonts?: unknown }).fonts;
    // @ts-expect-error -- simula un entorno sin la API de Font Loading
    delete document.fonts;
    try {
      expect(await browserFontChecker.check("Arial")).toBe("verification-uncertain");
    } finally {
      (document as { fonts?: unknown }).fonts = original;
    }
  });
});

describe("runPreflight — raster_too_large (presupuesto de memoria)", () => {
  it("un canvas final estimado dentro del presupuesto no produce ningún issue", async () => {
    const project = buildProject();
    const printJob = buildPrintJobFor(project, "print-pdf"); // 50x50mm a 300ppi, chico
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.issues.some((i) => i.code === "raster_too_large")).toBe(false);
  });

  it("un PrintJob que excede el presupuesto de memoria produce un error bloqueante", async () => {
    const project = buildProject();
    const printJob = buildPrintJobFor(project, "print-pdf", { resolution: { targetPpi: 300 } });
    // Fuerza un tamaño físico enorme para disparar el presupuesto.
    printJob.dimensions = { width: 3000, height: 3000, unit: "mm" };
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    const issue = result.issues.find((i) => i.code === "raster_too_large");
    expect(issue?.severity).toBe("error");
    expect(result.hasBlockingErrors).toBe(true);
  });

  it("acepta un memoryBudgetBytes custom más estricto", async () => {
    const project = buildProject();
    const printJob = buildPrintJobFor(project);
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE, memoryBudgetBytes: 100 });
    expect(result.issues.some((i) => i.code === "raster_too_large")).toBe(true);
  });
});

describe("runPreflight — orden determinista", () => {
  it("el mismo input produce exactamente la misma lista de issues, en el mismo orden, en corridas repetidas", async () => {
    const image1 = buildImage("obj_1", { assetId: AssetIdSchema.parse("asset_fantasma_1") });
    const image2 = buildImage("obj_2", { assetId: AssetIdSchema.parse("asset_fantasma_2") });
    const project = buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [image1, image2])])]) });
    // Safe area desactivado deliberadamente — este test verifica el orden
    // determinista de `asset_reference_missing`, no la interacción con el
    // chequeo de safe area de Fase 9.3 (que también evaluaría estos mismos
    // objects, dado que el perfil "print-pdf" lo activa por defecto).
    const printJob = buildPrintJobFor(project, "print-pdf", { safeArea: { enabled: false, margin: 0, unit: "mm" } });

    const resultA = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    const resultB = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });

    expect(resultA.issues.map((i) => `${i.code}:${i.objectId}`)).toEqual(resultB.issues.map((i) => `${i.code}:${i.objectId}`));
    expect(resultA.issues.map((i) => i.objectId)).toEqual([ObjectIdSchema.parse("obj_1"), ObjectIdSchema.parse("obj_2")]);
  });
});

describe("runPreflight — múltiples páginas", () => {
  it("evalúa cada página del PrintJob y asocia cada issue a su propio pageId", async () => {
    const imageA = buildImage("obj_a", { assetId: AssetIdSchema.parse("asset_fantasma") });
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [imageA])]),
        buildPage("page_2", [buildLayer("layer_2", [])]),
      ]),
    });
    const printJob = buildPrintJobFor(project);
    printJob.pageIds = [project.document.pages[0]!.id, project.document.pages[1]!.id];

    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });

    expect(result.issues.some((i) => i.code === "asset_reference_missing" && i.pageId === project.document.pages[0]!.id)).toBe(true);
    expect(result.issues.some((i) => i.code === "empty_page" && i.pageId === project.document.pages[1]!.id)).toBe(true);
  });
});

describe("runPreflight — hasBlockingErrors", () => {
  it("es false cuando solo hay warnings/info", async () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [])])]) });
    const printJob = buildPrintJobFor(project);
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.hasBlockingErrors).toBe(false);
  });

  it("es true si existe AL MENOS un error entre varios warnings", async () => {
    const image = buildImage("obj_1", { assetId: AssetIdSchema.parse("asset_fantasma") });
    const project = buildProject({ document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [image])])]) });
    const printJob = buildPrintJobFor(project, "print-pdf", { scale: 500 }); // warning de escala + error de asset
    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });
    expect(result.issues.some((i) => i.severity === "warning")).toBe(true);
    expect(result.issues.some((i) => i.severity === "error")).toBe(true);
    expect(result.hasBlockingErrors).toBe(true);
  });
});

describe("runPreflight — integración de marks/safe-area/cut-path (Fase 9.3)", () => {
  const DIE_LINE_METADATA = { tags: [], visible: true, locked: false, createdAt: FIXTURE_NOW, updatedAt: FIXTURE_NOW, role: "die-line" as const };

  it("issues job-level (crop marks) aparecen ANTES que issues de página (safe area) — orden documentado en runPreflight.ts", async () => {
    // Rect plano (sin metadata.role) que invade el safe area — separado
    // del die-line, porque un die-line está excluido del chequeo de safe
    // area (sección 9) y no debe confundirse con "el object que invade".
    const invader = buildRectangle("rect_1", { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 500, height: 500 } });
    const dieLine = buildRectangle("die_1", { transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 40, height: 40 }, metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [invader, dieLine])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet", {
      cropMarks: { enabled: true, length: -1, offset: 3, strokeWidth: 0.25, unit: "mm", color: "#000000" }, // length inválido: crop_marks_invalid
    });

    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });

    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("crop_marks_invalid");
    expect(codes).toContain("object_crosses_safe_area");
    expect(codes.indexOf("crop_marks_invalid")).toBeLessThan(codes.indexOf("object_crosses_safe_area"));
  });

  it("multipágina: cada página resuelve su propio safe-area/cut-path, con el pageId correcto — nunca reutiliza el de la página 1", async () => {
    const invaderPage1 = buildRectangle("rect_1", { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 500, height: 500 } });
    const dieLinePage1 = buildRectangle("die_1", { transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 40, height: 40 }, metadata: DIE_LINE_METADATA });
    const dieLinePage2a = buildRectangle("die_2a", { metadata: DIE_LINE_METADATA });
    const dieLinePage2b = buildEllipse("die_2b", { metadata: DIE_LINE_METADATA }); // 2 candidatos: multiple_candidates SOLO en página 2

    const page1 = buildPage("page_1", [buildLayer("layer_1", [invaderPage1, dieLinePage1])], { size: { width: 50, height: 50 }, unit: "mm" });
    const page2 = buildPage("page_2", [buildLayer("layer_1", [dieLinePage2a, dieLinePage2b])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page1, page2]) });
    const printJob = buildPrintJobFor(project, "sticker-sheet");
    printJob.pageIds = [page1.id, page2.id];

    const result = await runPreflight(project, printJob, { resolver: noopResolver(), fontChecker: NEVER_CHECK, imageProbe: NO_PROBE });

    expect(result.issues.some((i) => i.code === "object_crosses_safe_area" && i.pageId === page1.id)).toBe(true);
    expect(result.issues.some((i) => i.code === "object_crosses_safe_area" && i.pageId === page2.id)).toBe(false);
    expect(result.issues.some((i) => i.code === "cut_path_multiple_candidates" && i.pageId === page2.id)).toBe(true);
    expect(result.issues.some((i) => i.code === "cut_path_multiple_candidates" && i.pageId === page1.id)).toBe(false);
  });
});

// Usado solo para que `vi` no quede importado sin uso si algún test arriba se elimina en el futuro.
void vi;
