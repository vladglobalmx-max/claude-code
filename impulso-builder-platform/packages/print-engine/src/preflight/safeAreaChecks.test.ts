import { describe, expect, it } from "vitest";
import { checkSafeAreaConfig, checkSafeAreaForPage } from "./safeAreaChecks.js";
import { buildDocument, buildLayer, buildPage, buildPrintJobFor, buildProject, buildRectangle } from "../testUtils/fixtures.js";

describe("checkSafeAreaConfig", () => {
  it("deshabilitado: sin issues sin importar el margen", () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1")]) });
    const job = buildPrintJobFor(project, "print-pdf", { safeArea: { enabled: false, margin: -5, unit: "mm" } });
    expect(checkSafeAreaConfig(job)).toEqual([]);
  });

  it("margen negativo: safe_area_invalid", () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1")]) });
    const job = buildPrintJobFor(project, "print-pdf", { safeArea: { enabled: true, margin: -5, unit: "mm" } });
    const issues = checkSafeAreaConfig(job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "safe_area_invalid", severity: "error" });
  });

  it("margen válido: sin issues", () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1")]) });
    const job = buildPrintJobFor(project, "print-pdf", { safeArea: { enabled: true, margin: 3, unit: "mm" } });
    expect(checkSafeAreaConfig(job)).toEqual([]);
  });
});

describe("checkSafeAreaForPage", () => {
  it("deshabilitado: sin issues sin importar el contenido", () => {
    const rect = buildRectangle("rect_1", { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 500, height: 500 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { safeArea: { enabled: false, margin: 3, unit: "mm" } });
    expect(checkSafeAreaForPage(page, page.id, job)).toEqual([]);
  });

  it("object que invade el safe area: object_crosses_safe_area (warning)", () => {
    // Página de 50mm ~ 189px canónico; margen 3mm ~ 11.3px; un rect en (0,0)
    // de 500x500 excede ampliamente el trim y el safe area.
    const rect = buildRectangle("rect_1", { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 500, height: 500 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { safeArea: { enabled: true, margin: 3, unit: "mm" } });

    const issues = checkSafeAreaForPage(page, page.id, job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "object_crosses_safe_area", severity: "warning", pageId: page.id, objectId: rect.id });
  });

  it("object bien adentro del safe area: sin issues", () => {
    const rect = buildRectangle("rect_1", { transform: { x: 60, y: 60, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 10, height: 10 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { safeArea: { enabled: true, margin: 3, unit: "mm" } });

    expect(checkSafeAreaForPage(page, page.id, job)).toEqual([]);
  });
});
