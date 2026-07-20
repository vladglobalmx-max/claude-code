import { describe, expect, it } from "vitest";
import { checkCutPathForPage } from "./cutPathChecks.js";
import {
  NOW,
  buildDocument,
  buildEllipse,
  buildGroup,
  buildLayer,
  buildPage,
  buildPath,
  buildPrintJobFor,
  buildProject,
  buildRectangle,
  buildText,
} from "../testUtils/fixtures.js";
import type { CutPathSpec } from "../types.js";

const DIE_LINE_METADATA = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW, role: "die-line" as const };

function cutPathSpec(overrides: Partial<CutPathSpec> = {}): CutPathSpec {
  return {
    mode: "die-cut",
    source: { type: "auto" },
    offset: 0,
    unit: "mm",
    stroke: 0.25,
    color: "#ff00ff",
    logicalLayerName: "DieCut",
    ...overrides,
  };
}

describe("checkCutPathForPage", () => {
  it("mode 'none': sin issues sin importar el contenido de la página", () => {
    const rect = buildRectangle("rect_1", { metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { cutPath: cutPathSpec({ mode: "none" }) });
    expect(checkCutPathForPage(page, page.id, job)).toEqual([]);
  });

  it("sin ningún object marcado como die-line: cut_path_missing", () => {
    const rect = buildRectangle("rect_1");
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { cutPath: cutPathSpec() });
    const issues = checkCutPathForPage(page, page.id, job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "cut_path_missing", severity: "error", pageId: page.id });
  });

  it("dos objects marcados como die-line: cut_path_multiple_candidates, nunca elige el primero", () => {
    const rect = buildRectangle("rect_1", { metadata: DIE_LINE_METADATA });
    const ellipse = buildEllipse("ellipse_1", { metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect, ellipse])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { cutPath: cutPathSpec() });
    const issues = checkCutPathForPage(page, page.id, job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "cut_path_multiple_candidates", severity: "error", pageId: page.id });
    expect(issues[0]!.data).toEqual({ objectIds: ["rect_1", "ellipse_1"] });
  });

  it("die-line sobre un tipo no soportado (Text): cut_path_unsupported_object", () => {
    const text = buildText("text_1", { metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [text])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { cutPath: cutPathSpec() });
    const issues = checkCutPathForPage(page, page.id, job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "cut_path_unsupported_object", severity: "error", pageId: page.id, objectId: "text_1" });
  });

  it("die-line Path abierto (closed: false): cut_path_open", () => {
    const path = buildPath("path_1", { closed: false, metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [path])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { cutPath: cutPathSpec() });
    const issues = checkCutPathForPage(page, page.id, job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "cut_path_open", severity: "error", pageId: page.id, objectId: "path_1" });
  });

  it("die-line bajo shear real (group con escala no-uniforme + rotación en otro nivel): cut_path_transform_unsupported", () => {
    const ellipse = buildEllipse("ellipse_1", {
      transform: { x: 0, y: 0, rotation: 20, scaleX: 1, scaleY: 1 },
      size: { width: 20, height: 10 },
      metadata: DIE_LINE_METADATA,
    });
    const group = buildGroup("group_1", [ellipse], { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 5 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [group])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { cutPath: cutPathSpec() });
    const issues = checkCutPathForPage(page, page.id, job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "cut_path_transform_unsupported", severity: "error", pageId: page.id, objectId: "ellipse_1" });
  });

  it("die-line con tamaño nulo (width 0): cut_path_invalid_geometry", () => {
    const rect = buildRectangle("rect_1", { size: { width: 0, height: 10 }, metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { cutPath: cutPathSpec() });
    const issues = checkCutPathForPage(page, page.id, job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "cut_path_invalid_geometry", severity: "error", pageId: page.id, objectId: "rect_1" });
  });

  it("die-line con radio nulo (Ellipse height 0): cut_path_invalid_geometry", () => {
    const ellipse = buildEllipse("ellipse_1", { size: { width: 20, height: 0 }, metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [ellipse])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { cutPath: cutPathSpec() });
    const issues = checkCutPathForPage(page, page.id, job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "cut_path_invalid_geometry", severity: "error", pageId: page.id, objectId: "ellipse_1" });
  });

  it("offset del cut path colapsa la geometría del rectangle: cut_path_collapsed", () => {
    const rect = buildRectangle("rect_1", { size: { width: 10, height: 10 }, metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { cutPath: cutPathSpec({ offset: -100, unit: "mm" }) });
    const issues = checkCutPathForPage(page, page.id, job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "cut_path_collapsed", severity: "error", pageId: page.id, objectId: "rect_1" });
  });

  it("offset != 0 sobre un Path cerrado, política 'warn': cut_path_offset_unsupported como warning, sigue evaluando", () => {
    const path = buildPath("path_1", { metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [path])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", {
      cutPath: cutPathSpec({ offset: 3 }),
      offsetUnsupportedPolicy: "warn",
    });
    const issues = checkCutPathForPage(page, page.id, job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "cut_path_offset_unsupported", severity: "warning", pageId: page.id, objectId: "path_1" });
  });

  it("offset != 0 sobre un Path cerrado, política 'use-original': cut_path_offset_unsupported como warning (no bloquea)", () => {
    const path = buildPath("path_1", { metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [path])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", {
      cutPath: cutPathSpec({ offset: 3 }),
      offsetUnsupportedPolicy: "use-original",
    });
    const issues = checkCutPathForPage(page, page.id, job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "cut_path_offset_unsupported", severity: "warning" });
  });

  it("offset != 0 sobre un Path cerrado, política 'block': cut_path_offset_unsupported como error, y no continúa al chequeo de MediaBox", () => {
    const path = buildPath("path_1", { metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [path])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", {
      cutPath: cutPathSpec({ offset: 3 }),
      offsetUnsupportedPolicy: "block",
    });
    const issues = checkCutPathForPage(page, page.id, job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "cut_path_offset_unsupported", severity: "error", pageId: page.id, objectId: "path_1" });
  });

  it("die-line muy lejos del área de la página (aun con offset 0): cut_path_outside_media_box (warning)", () => {
    const rect = buildRectangle("rect_1", {
      transform: { x: -10000, y: -10000, rotation: 0, scaleX: 1, scaleY: 1 },
      metadata: DIE_LINE_METADATA,
    });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { cutPath: cutPathSpec() });
    const issues = checkCutPathForPage(page, page.id, job);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "cut_path_outside_media_box", severity: "warning", pageId: page.id, objectId: "rect_1" });
  });

  it("die-line válido, bien dentro del área imprimible, sin offset: sin issues", () => {
    const rect = buildRectangle("rect_1", {
      transform: { x: 20, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
      size: { width: 10, height: 10 },
      metadata: DIE_LINE_METADATA,
    });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", { cutPath: cutPathSpec() });
    expect(checkCutPathForPage(page, page.id, job)).toEqual([]);
  });

  it("selección manual por objectId: usa ese object directamente, incluso si otro está marcado como die-line", () => {
    const rect = buildRectangle("rect_1", {
      transform: { x: 20, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
      size: { width: 10, height: 10 },
    });
    const ellipse = buildEllipse("ellipse_1", { metadata: DIE_LINE_METADATA });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect, ellipse])], { size: { width: 50, height: 50 }, unit: "mm" });
    const project = buildProject({ document: buildDocument([page]) });
    const job = buildPrintJobFor(project, "print-pdf", {
      cutPath: cutPathSpec({ source: { type: "object", objectId: "rect_1" } }),
    });
    expect(checkCutPathForPage(page, page.id, job)).toEqual([]);
  });
});
