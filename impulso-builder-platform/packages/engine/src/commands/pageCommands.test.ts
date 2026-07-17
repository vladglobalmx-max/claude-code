import { describe, expect, it } from "vitest";
import { PageIdSchema } from "@impulso/document-schema";
import { addPage, removePage, reorderPages } from "./pageCommands.js";
import { buildProject, buildDocument, buildPage } from "../testUtils/fixtures.js";

function twoPageProject() {
  return buildProject({ document: buildDocument([buildPage("page_1"), buildPage("page_2")]) });
}

describe("addPage", () => {
  it("agrega una página al final por defecto", () => {
    const project = buildProject();
    const result = addPage(project, { type: "addPage", page: buildPage("page_2") });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages.map((p) => p.id)).toEqual(["page_1", "page_2"]);
    }
  });

  it("agrega una página en el índice dado", () => {
    const project = buildProject();
    const result = addPage(project, { type: "addPage", page: buildPage("page_0"), index: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages.map((p) => p.id)).toEqual(["page_0", "page_1"]);
    }
  });

  it("rechaza un pageId duplicado", () => {
    const project = buildProject();
    const result = addPage(project, { type: "addPage", page: buildPage("page_1") });
    expect(result.ok).toBe(false);
  });
});

describe("removePage", () => {
  it("elimina una página existente cuando hay más de una", () => {
    const result = removePage(twoPageProject(), { type: "removePage", pageId: PageIdSchema.parse("page_2") });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages).toHaveLength(1);
      expect(result.value.document.pages[0]?.id).toBe("page_1");
    }
  });

  it("rechaza eliminar la última página", () => {
    const project = buildProject();
    const result = removePage(project, { type: "removePage", pageId: PageIdSchema.parse("page_1") });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("cannot_remove_last_page");
    }
  });

  it("rechaza un pageId inexistente", () => {
    const project = buildProject();
    const result = removePage(project, { type: "removePage", pageId: PageIdSchema.parse("no_existe") });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("page_not_found");
    }
  });
});

describe("reorderPages", () => {
  it("reordena páginas dado el mismo conjunto en otro orden", () => {
    const result = reorderPages(twoPageProject(), {
      type: "reorderPages",
      pageIds: [PageIdSchema.parse("page_2"), PageIdSchema.parse("page_1")],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.pages.map((p) => p.id)).toEqual(["page_2", "page_1"]);
    }
  });

  it("rechaza un conjunto que no coincide", () => {
    const project = buildProject();
    const result = reorderPages(project, {
      type: "reorderPages",
      pageIds: [PageIdSchema.parse("otra_pagina")],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_reorder");
    }
  });
});
