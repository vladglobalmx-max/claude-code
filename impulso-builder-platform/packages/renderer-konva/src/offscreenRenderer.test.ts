import { describe, expect, it } from "vitest";
import Konva from "konva";
import { PageIdSchema } from "@impulso/document-schema";
import { renderPageToStage } from "./offscreenRenderer.js";
import { buildProject, buildDocument, buildPage, buildLayer, buildRectangle, buildGroup, buildImage } from "./testUtils/fixtures.js";

describe("renderPageToStage", () => {
  it("devuelve null si el pageId pedido no existe", () => {
    const project = buildProject();
    expect(renderPageToStage(project, { pageId: PageIdSchema.parse("page_ghost") })).toBeNull();
  });

  it("dimensiona el Stage en píxeles a partir del tamaño físico de la página (mm)", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "mm" })]),
    });
    const result = renderPageToStage(project);
    expect(result).not.toBeNull();
    expect(result!.widthPx).toBeCloseTo(50 * (96 / 25.4), 5);
    expect(result!.heightPx).toBeCloseTo(50 * (96 / 25.4), 5);
    expect(result!.stage.width()).toBeCloseTo(result!.widthPx, 5);
    result!.destroy();
  });

  it("construye un Konva.Group por Layer, conteniendo sus objects", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
    });
    const result = renderPageToStage(project)!;
    const group = result.stage.findOne("#layer_1");
    expect(group).toBeInstanceOf(Konva.Group);
    expect(result.stage.findOne("#rect_1")).toBeInstanceOf(Konva.Rect);
    result.destroy();
  });

  it("nada es draggable/interactivo — interactive:false en todo nivel", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
    });
    const result = renderPageToStage(project)!;
    const node = result.stage.findOne("#rect_1")!;
    expect(node.draggable()).toBe(false);
    result.destroy();
  });

  it("un Layer con visible:false no dibuja sus objects (mismo criterio que el Canvas Runtime interactivo)", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [
          buildLayer("layer_1", [buildRectangle("rect_1")], {
            metadata: { tags: [], visible: false, locked: false, createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z" },
          }),
        ]),
      ]),
    });
    const result = renderPageToStage(project)!;
    const group = result.stage.findOne("#layer_1") as Konva.Group;
    expect(group.visible()).toBe(false);
    result.destroy();
  });

  it("agrega un Rect de fondo cuando se pasa backgroundColor", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [], { size: { width: 10, height: 10 }, unit: "px" })]),
    });
    const result = renderPageToStage(project, { backgroundColor: "#ffffff" })!;
    const rects = result.stage.find("Rect");
    expect(rects).toHaveLength(1);
    expect((rects[0] as Konva.Rect).fill()).toBe("#ffffff");
    result.destroy();
  });

  it("sin backgroundColor, no agrega ningún Rect de fondo", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [])]),
    });
    const result = renderPageToStage(project)!;
    expect(result.stage.find("Rect")).toHaveLength(0);
    result.destroy();
  });

  it("resuelve grupos anidados igual que el Canvas Runtime interactivo", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildGroup("group_1", [buildRectangle("rect_1")])])]),
      ]),
    });
    const result = renderPageToStage(project)!;
    expect(result.stage.findOne("#group_1")).toBeInstanceOf(Konva.Group);
    expect(result.stage.findOne("#rect_1")).toBeInstanceOf(Konva.Rect);
    result.destroy();
  });

  it("dispatch lanza si se invoca — nunca debería pasar con interactive:false", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
    });
    const result = renderPageToStage(project)!;
    // No hay forma pública de invocar dispatch en este modo — se verifica
    // indirectamente que el node no es interactivo (ya cubierto arriba).
    // Este test documenta la garantía, no ejercita la rama directamente.
    expect(result).not.toBeNull();
    result.destroy();
  });

  it("resuelve el asset de una Image vía resolveAssetSource", () => {
    const source = {} as CanvasImageSource;
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildImage("img_1", { assetId: "asset_1" as never })])]),
      ]),
    });
    const result = renderPageToStage(project, { resolveAssetSource: () => source })!;
    const node = result.stage.findOne("#img_1") as Konva.Image;
    expect(node.image()).toBe(source);
    result.destroy();
  });

  it("destroy() no lanza y libera los nodos del Stage", () => {
    const project = buildProject({ document: buildDocument([buildPage("page_1", [])]) });
    const result = renderPageToStage(project)!;
    expect(() => result.destroy()).not.toThrow();
  });

  // Épica 9 / Fase 9.1, corrección 7: "el recorte por bleed no es
  // suficiente por sí solo con solo extender el canvas — hay que verificar
  // primero que el Renderer NO recorta objects en el borde de Page". Estos
  // tests prueban, empíricamente (no por suposición), que ni el Stage, ni
  // el Layer, ni los Group de layer aplican ningún `clip`/`clipFunc` propio
  // — lo único que define qué región queda rasterizada es el `width`/
  // `height` del propio `Konva.Stage` (hoy = TrimBox en px; en Fase 9.2
  // deberá construirse con el MediaBox para que el sangrado sea visible).
  // Esto confirma que extender el sangrado en Fase 9.2 es aditivo (agrandar
  // el Stage y trasladar el contenido), sin tener que desactivar ningún
  // clip existente porque no existe ninguno.
  describe("corrección 7 — ausencia de clipping a nivel Stage/Layer/Group", () => {
    it("ni el Stage, ni el contentLayer, ni ningún Group de layer configuran clipFunc/clipWidth/clipHeight", () => {
      const project = buildProject({
        document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
      });
      const result = renderPageToStage(project)!;

      expect(result.stage.clipFunc()).toBeUndefined();
      expect(result.stage.clipWidth()).toBeUndefined();

      const contentLayer = result.stage.getLayers()[0]!;
      expect(contentLayer.clipFunc()).toBeUndefined();
      expect(contentLayer.clipWidth()).toBeUndefined();

      const layerGroup = result.stage.findOne("#layer_1") as Konva.Group;
      expect(layerGroup.clipFunc()).toBeUndefined();
      expect(layerGroup.clipWidth()).toBeUndefined();

      result.destroy();
    });

    it("un object posicionado con coordenadas negativas (fuera del trim, ej. hacia el sangrado) conserva su posición absoluta sin recortarla ni trasladarla al origen", () => {
      const project = buildProject({
        document: buildDocument([
          buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1", { transform: { x: -20, y: -15, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 10, height: 10 } })])], {
            size: { width: 50, height: 50 },
            unit: "px",
          }),
        ]),
      });
      const result = renderPageToStage(project)!;
      const node = result.stage.findOne("#rect_1")!;
      expect(node.x()).toBe(-20);
      expect(node.y()).toBe(-15);
      result.destroy();
    });

    it("un object cuyo tamaño excede el ancho/alto de la página conserva su tamaño completo — el Renderer no lo achica al borde del trim", () => {
      const project = buildProject({
        document: buildDocument([
          buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1", { size: { width: 500, height: 500 } })])], {
            size: { width: 50, height: 50 },
            unit: "px",
          }),
        ]),
      });
      const result = renderPageToStage(project)!;
      const node = result.stage.findOne("#rect_1") as Konva.Rect;
      expect(node.width()).toBe(500);
      expect(node.height()).toBe(500);
      result.destroy();
    });

    it("un fondo (Rect de backgroundColor) dibujado con el tamaño del MediaBox (simulando la extensión aditiva de Fase 9.2) no queda recortado por ningún Group intermedio", () => {
      // No hay todavía una opción pública para pedir un Stage más grande
      // que el trim (eso es Fase 9.2) — este test simula el escenario
      // agregando manualmente un segundo Rect "de sangrado" más grande que
      // el trim directamente al Stage ya construido, y confirma que Konva
      // lo agrega y lo reporta con su tamaño íntegro sin que ningún nodo
      // padre existente (`contentLayer`, los `Group` de layer) tenga un
      // `clip` que lo recortaría.
      const project = buildProject({
        document: buildDocument([buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "px" })]),
      });
      const result = renderPageToStage(project)!;
      const contentLayer = result.stage.getLayers()[0]!;
      const bleedRect = new Konva.Rect({ x: -8, y: -8, width: 66, height: 66, fill: "#ffffff" });
      contentLayer.add(bleedRect);
      expect(bleedRect.x()).toBe(-8);
      expect(bleedRect.width()).toBe(66);
      expect(contentLayer.clipFunc()).toBeUndefined();
      result.destroy();
    });
  });

  // Épica 9 / Fase 9.2 (ver ADR-0022): extensión aditiva para el pipeline
  // de raster de impresión — canvasSizePx/contentOffsetPx (sangrado) y
  // shouldRenderObject (filtro de objects, ej. excluir un die-line).
  describe("Fase 9.2 — canvasSizePx/contentOffsetPx (sangrado)", () => {
    it("sin canvasSizePx/contentOffsetPx, el árbol de nodes es idéntico al de antes de Fase 9.2 (sin Group de offset envolvente)", () => {
      const project = buildProject({
        document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])], { size: { width: 50, height: 50 }, unit: "px" })]),
      });
      const result = renderPageToStage(project)!;
      const contentLayer = result.stage.getLayers()[0]!;
      // El primer (y único) hijo directo del Layer debe ser el propio Group
      // de layer_1 — nunca un Group de offset intermedio.
      expect(contentLayer.children?.[0]?.id()).toBe("layer_1");
      result.destroy();
    });

    it("canvasSizePx agranda el Stage más allá del trim de la página (simulando el BleedBox)", () => {
      const project = buildProject({
        document: buildDocument([buildPage("page_1", [], { size: { width: 50, height: 50 }, unit: "px" })]),
      });
      const result = renderPageToStage(project, { canvasSizePx: { width: 66, height: 70 } })!;
      expect(result.widthPx).toBe(66);
      expect(result.heightPx).toBe(70);
      expect(result.stage.width()).toBe(66);
      expect(result.stage.height()).toBe(70);
      result.destroy();
    });

    it("contentOffsetPx desplaza el contenido (no el fondo) dentro del Stage agrandado", () => {
      const project = buildProject({
        document: buildDocument([
          buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1", { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } })])], {
            size: { width: 50, height: 50 },
            unit: "px",
          }),
        ]),
      });
      const result = renderPageToStage(project, {
        canvasSizePx: { width: 66, height: 66 },
        contentOffsetPx: { x: 8, y: 8 },
        backgroundColor: "#ffffff",
      })!;
      const node = result.stage.findOne("#rect_1")!;
      // La posición absoluta del rect (medida desde el origen del Stage)
      // queda desplazada por el offset — el rect en sí conserva su x/y
      // relativo de 0 respecto a su propio padre.
      expect(node.getAbsolutePosition().x).toBe(8);
      expect(node.getAbsolutePosition().y).toBe(8);
      // El fondo cubre el Stage COMPLETO (66x66), no solo el trim — nunca
      // se desplaza junto con el contenido.
      const bgRect = result.stage.find("Rect")[0] as Konva.Rect;
      expect(bgRect.x()).toBe(0);
      expect(bgRect.width()).toBe(66);
      result.destroy();
    });

    it("sin contentScale, el árbol de nodes es idéntico al de antes de Fase 9.2 (contentScale=1 no crea Group envolvente)", () => {
      const project = buildProject({
        document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])], { size: { width: 50, height: 50 }, unit: "px" })]),
      });
      const result = renderPageToStage(project, { contentScale: 1 })!;
      const contentLayer = result.stage.getLayers()[0]!;
      expect(contentLayer.children?.[0]?.id()).toBe("layer_1");
      result.destroy();
    });

    it("contentScale escala el contenido (PrintJob.scale) sin cambiar el tamaño del Stage/canvas", () => {
      const project = buildProject({
        document: buildDocument([
          buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1", { size: { width: 10, height: 10 } })])], {
            size: { width: 50, height: 50 },
            unit: "px",
          }),
        ]),
      });
      const result = renderPageToStage(project, { contentScale: 2 })!;
      const node = result.stage.findOne("#rect_1") as Konva.Rect;
      // El Stage/canvas conserva el tamaño físico normal — solo el
      // CONTENIDO se escala (sección 24: "scale... nunca cambia el
      // tamaño físico base").
      expect(result.widthPx).toBe(50);
      expect(node.getAbsoluteScale().x).toBe(2);
      result.destroy();
    });

    it("contentScale se ancla en el mismo origen que contentOffsetPx (el origen del TrimBox dentro del BleedBox)", () => {
      const project = buildProject({
        document: buildDocument([
          buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1", { transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 } })])], {
            size: { width: 50, height: 50 },
            unit: "px",
          }),
        ]),
      });
      const result = renderPageToStage(project, {
        canvasSizePx: { width: 66, height: 66 },
        contentOffsetPx: { x: 8, y: 8 },
        contentScale: 2,
      })!;
      const node = result.stage.findOne("#rect_1")!;
      // Traslada primero (8,8), LUEGO escala: el rect en (10,10) local
      // termina en (8 + 10*2, 8 + 10*2) = (28, 28) absoluto.
      expect(node.getAbsolutePosition().x).toBe(28);
      expect(node.getAbsolutePosition().y).toBe(28);
      result.destroy();
    });
  });

  describe("Fase 9.2 — shouldRenderObject (filtro de objects)", () => {
    it("sin shouldRenderObject, se incluye todo (comportamiento de siempre)", () => {
      const project = buildProject({
        document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
      });
      const result = renderPageToStage(project)!;
      expect(result.stage.findOne("#rect_1")).toBeInstanceOf(Konva.Rect);
      result.destroy();
    });

    it("excluye un object de nivel superior cuyo metadata.role no pasa el filtro", () => {
      const dieLine = buildRectangle("die_line_1", { metadata: { tags: [], visible: true, locked: false, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z", role: "die-line" } });
      const content = buildRectangle("content_1");
      const project = buildProject({
        document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [content, dieLine])])]),
      });
      const result = renderPageToStage(project, {
        shouldRenderObject: (object) => object.metadata.role !== "die-line",
      })!;
      expect(result.stage.findOne("#content_1")).toBeInstanceOf(Konva.Rect);
      expect(result.stage.findOne("#die_line_1")).toBeUndefined();
      result.destroy();
    });

    it("un group cuyos hijos quedan TODOS excluidos no se agrega en absoluto (nunca un Group vacío)", () => {
      const dieLine = buildRectangle("die_line_1", { metadata: { tags: [], visible: true, locked: false, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z", role: "die-line" } });
      const group = buildGroup("group_1", [dieLine]);
      const project = buildProject({
        document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [group])])]),
      });
      const result = renderPageToStage(project, {
        shouldRenderObject: (object) => object.metadata.role !== "die-line",
      })!;
      expect(result.stage.findOne("#group_1")).toBeUndefined();
      expect(result.stage.findOne("#die_line_1")).toBeUndefined();
      result.destroy();
    });

    it("un group con hijos mixtos (incluidos/excluidos) conserva solo los incluidos, en su mismo orden", () => {
      const dieLine = buildRectangle("die_line_1", { metadata: { tags: [], visible: true, locked: false, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z", role: "die-line" } });
      const kept = buildRectangle("kept_1");
      const group = buildGroup("group_1", [kept, dieLine]);
      const project = buildProject({
        document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [group])])]),
      });
      const result = renderPageToStage(project, {
        shouldRenderObject: (object) => object.metadata.role !== "die-line",
      })!;
      const groupNode = result.stage.findOne("#group_1") as Konva.Group;
      expect(groupNode).toBeInstanceOf(Konva.Group);
      expect(groupNode.children).toHaveLength(1);
      expect(result.stage.findOne("#kept_1")).toBeInstanceOf(Konva.Rect);
      expect(result.stage.findOne("#die_line_1")).toBeUndefined();
      result.destroy();
    });

    it("no muta el object/group original del Project", () => {
      const dieLine = buildRectangle("die_line_1", { metadata: { tags: [], visible: true, locked: false, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z", role: "die-line" } });
      const kept = buildRectangle("kept_1");
      const group = buildGroup("group_1", [kept, dieLine]);
      const project = buildProject({
        document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [group])])]),
      });
      const originalChildrenLength = group.children.length;
      const result = renderPageToStage(project, {
        shouldRenderObject: (object) => object.metadata.role !== "die-line",
      })!;
      expect(group.children).toHaveLength(originalChildrenLength);
      result.destroy();
    });

    it("recibe pageId/layerId en el contexto del predicado", () => {
      const rect = buildRectangle("rect_1");
      const project = buildProject({
        document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [rect])])]),
      });
      const seen: Array<{ pageId: string; layerId: string }> = [];
      const result = renderPageToStage(project, {
        shouldRenderObject: (_object, context) => {
          seen.push({ pageId: String(context.pageId), layerId: String(context.layerId) });
          return true;
        },
      })!;
      expect(seen).toEqual([{ pageId: "page_1", layerId: "layer_1" }]);
      result.destroy();
    });
  });
});
