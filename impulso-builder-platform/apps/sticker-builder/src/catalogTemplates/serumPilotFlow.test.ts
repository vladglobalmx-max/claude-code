import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ProjectSchema, type Project } from "@impulso/document-schema";
import { createMemoryTemplateStore, type TemplateStore } from "@impulso/template-library";
import { buildSvgDocument, type ExportAssetResolver } from "@impulso/export-engine";
import { mountNewProjectDialog } from "../newProjectDialog.js";
import { seedCatalogTemplates } from "./index.js";

/**
 * Verificación de flujo de punta a punta (a nivel unitario/jsdom) del
 * template piloto — pasos 3-9 del recorrido de 11 pasos acordado para el
 * piloto (ver `THOREN_PILOT_TEMPLATE_STANDARD.md`): integrar en la
 * Template Library, mostrarlo en la galería, crear un proyecto desde él,
 * y exportarlo a SVG realmente (sin mocks — `buildSvgDocument` es puro,
 * no depende de Konva/canvas). La rasterización PNG real y el recorrido
 * completo en un navegador real se prueban en el spec de Playwright
 * (`e2e/template-catalog-pilot.spec.ts`), no aquí — jsdom no tiene un
 * Canvas 2D real para validar píxeles.
 */

const NOW = "2026-07-19T00:00:00.000Z";
const noopResolver: ExportAssetResolver = { resolve: async () => undefined };

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

async function seedPilotStore(): Promise<TemplateStore> {
  const store = createMemoryTemplateStore();
  await seedCatalogTemplates(store, {
    now: NOW,
    generateThumbnail: async () => new Blob(["png"], { type: "image/png" }),
  });
  return store;
}

describe("Piloto Serum Facial Premium — flujo completo (gallery -> crear -> exportar SVG)", () => {
  let templateStore: TemplateStore;

  beforeEach(async () => {
    templateStore = await seedPilotStore();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("paso 4 — aparece en la galería de 'Nuevo proyecto' junto a los 3 built-in en blanco", async () => {
    const div = container();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate: vi.fn(), now: () => NOW });
    await dialog.open();

    const names = Array.from(div.querySelectorAll(".new-project-card-name")).map((n) => n.textContent);
    expect(names).toContain("Serum Facial Premium");
    // Al ser builtIn: true, no tiene botón de eliminar — mismo criterio
    // que los 3 tamaños en blanco.
    const serumCard = Array.from(div.querySelectorAll(".new-project-card")).find((c) => c.textContent?.includes("Serum Facial Premium"))!;
    expect(serumCard.querySelector(".new-project-card-delete")).toBeNull();
  });

  it("paso 5 — crear un proyecto desde él produce un Project válido con ids frescos", async () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate, now: () => NOW });
    await dialog.open();

    const serumCard = Array.from(div.querySelectorAll(".new-project-card")).find((c) => c.textContent?.includes("Serum Facial Premium"))!;
    (serumCard as HTMLElement).click();
    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(onCreate).toHaveBeenCalledOnce();
    const project: Project = onCreate.mock.calls[0]![0];
    expect(() => ProjectSchema.parse(project)).not.toThrow();

    const original = await templateStore.getContent("catalog_serum-facial-premium");
    expect(project.id).not.toBe(original!.project.id);
    expect(project.document.id).not.toBe(original!.project.document.id);

    // El contenido de diseño se preserva (mismo texto/roles), solo cambian
    // los ids — confirma que `instantiateTemplate` no alteró el diseño.
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual([
      "die-line",
      "wordmark",
      "product-name",
      "divider",
      "active-percentage",
      "volume",
    ]);
  });

  it("paso 6 — el proyecto instanciado se puede editar como cualquier otro (el texto es un TextObject mutable normal)", async () => {
    const div = container();
    const onCreate = vi.fn();
    const dialog = mountNewProjectDialog(div, { templateStore, moduleId: "sticker-builder", onCreate, now: () => NOW });
    await dialog.open();

    const serumCard = Array.from(div.querySelectorAll(".new-project-card")).find((c) => c.textContent?.includes("Serum Facial Premium"))!;
    (serumCard as HTMLElement).click();
    (div.querySelector(".new-project-dialog-create") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    const project: Project = onCreate.mock.calls[0]![0];
    const wordmark = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "wordmark");
    expect(wordmark?.type).toBe("text");
    // No hay nada especial en el objeto que impida editarlo con el mismo
    // mecanismo que cualquier TextObject de un proyecto no-template (ej.
    // `updateTextStyle`/edición inline de `@impulso/engine` — no se
    // reimplementa aquí, ya está probado exhaustivamente en Fase 7.1).
    if (wordmark?.type === "text") {
      const edited = { ...wordmark, content: "Mi Marca Real" };
      expect(edited.content).toBe("Mi Marca Real");
      expect(() => ProjectSchema.parse({ ...project, document: { ...project.document, pages: [{ ...project.document.pages[0]!, layers: [{ ...project.document.pages[0]!.layers[0]!, objects: [edited] }] }] } })).not.toThrow();
    }
  });

  it("paso 9 — exporta a SVG real (buildSvgDocument, sin mocks) sin excepciones ni warnings inesperados", async () => {
    const content = await templateStore.getContent("catalog_serum-facial-premium");
    const result = await buildSvgDocument(content!.project, noopResolver);

    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("Serum Vitamina C");
    expect(result.svg).toContain("15%");
    expect(result.svg).toContain("30ml");
    expect(result.warnings).toEqual([]);
  });
});
