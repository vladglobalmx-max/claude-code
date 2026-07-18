import { describe, expect, it } from "vitest";
import { ObjectIdSchema } from "@impulso/document-schema";
import { groupObjects, ungroupObject } from "./groupCommands.js";
import { buildProject, buildDocument, buildPage, buildLayer, buildRectangle, buildGroup, NOW } from "../testUtils/fixtures.js";

function baseGroupCommand(id: string) {
  return {
    id: ObjectIdSchema.parse(id),
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal" as const },
    metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
    pluginData: {},
    customProperties: {},
  };
}

describe("groupObjects", () => {
  it("agrupa 2+ objects hermanos en un nuevo Group, preservando su orden relativo", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [
          buildLayer("layer_1", [buildRectangle("a"), buildRectangle("b"), buildRectangle("c")]),
        ]),
      ]),
    });

    const result = groupObjects(project, {
      type: "groupObjects",
      objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("c")],
      group: baseGroupCommand("group_1"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const objects = result.value.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.id)).toEqual(["b", "group_1"]);
    const group = objects[1];
    expect(group?.type).toBe("group");
    if (group?.type === "group") {
      expect(group.children.map((c) => c.id)).toEqual(["a", "c"]);
    }
  });

  it("el Group nace con el transform/style/metadata provistos en el comando, sin inventarlos", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a"), buildRectangle("b")])]),
      ]),
    });

    const groupInput = baseGroupCommand("group_1");
    const result = groupObjects(project, {
      type: "groupObjects",
      objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")],
      group: groupInput,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const group = result.value.document.pages[0]!.layers[0]!.objects[0];
    expect(group).toMatchObject({
      id: "group_1",
      transform: groupInput.transform,
      style: groupInput.style,
      metadata: groupInput.metadata,
    });
  });

  it("inserta el Group en la posición del miembro más 'adelante' (mayor índice) entre los no agrupados", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [
          buildLayer("layer_1", [
            buildRectangle("a"),
            buildRectangle("b"),
            buildRectangle("c"),
            buildRectangle("d"),
          ]),
        ]),
      ]),
    });

    // Se agrupan "a" y "c" — el más adelante es "c" (índice 2). Entre los NO
    // agrupados hasta ese índice solo está "b" (índice 1) -> insertIndex=1.
    const result = groupObjects(project, {
      type: "groupObjects",
      objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("c")],
      group: baseGroupCommand("group_1"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.value.document.pages[0]!.layers[0]!.objects.map((o) => o.id);
    expect(ids).toEqual(["b", "group_1", "d"]);
  });

  it("rechaza menos de 2 objectIds (ya bloqueado por el schema, pero el reducer no depende de eso)", () => {
    // isEmpty/1-elemento se valida en EngineCommandSchema (.min(2)); este
    // reducer se prueba directamente, así que confirmamos que el propio
    // caso límite de "todos encontrados" con un solo id sigue funcionando
    // correctamente si algún día se relaja esa regla del schema.
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a")])])]),
    });
    const result = groupObjects(project, {
      type: "groupObjects",
      objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("a")],
      group: baseGroupCommand("group_1"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_group");
  });

  it("rechaza si el groupId ya existe en el documento", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a"), buildRectangle("b")])]),
      ]),
    });
    const result = groupObjects(project, {
      type: "groupObjects",
      objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")],
      group: baseGroupCommand("a"), // "a" ya existe
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_group");
  });

  it("rechaza si los objects no son todos hermanos de la misma layer", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [
          buildLayer("layer_1", [buildRectangle("a")]),
          buildLayer("layer_2", [buildRectangle("b")]),
        ]),
      ]),
    });
    const result = groupObjects(project, {
      type: "groupObjects",
      objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")],
      group: baseGroupCommand("group_1"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_group");
  });

  it("rechaza si alguno de los objects ya está anidado dentro de otro group", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [
          buildLayer("layer_1", [buildGroup("existing_group", [buildRectangle("nested")]), buildRectangle("b")]),
        ]),
      ]),
    });
    const result = groupObjects(project, {
      type: "groupObjects",
      objectIds: [ObjectIdSchema.parse("nested"), ObjectIdSchema.parse("b")],
      group: baseGroupCommand("group_1"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_group");
  });
});

describe("ungroupObject", () => {
  it("reemplaza el Group por sus hijos, en su misma posición", () => {
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [
          buildLayer("layer_1", [
            buildRectangle("before"),
            buildGroup("group_1", [buildRectangle("child_a"), buildRectangle("child_b")]),
            buildRectangle("after"),
          ]),
        ]),
      ]),
    });

    const result = ungroupObject(project, { type: "ungroupObject", objectId: ObjectIdSchema.parse("group_1") });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.value.document.pages[0]!.layers[0]!.objects.map((o) => o.id);
    expect(ids).toEqual(["before", "child_a", "child_b", "after"]);
  });

  it("con el Group en su transform identidad, los hijos conservan exactamente su transform original", () => {
    const child = buildRectangle("child_a", { transform: { x: 5, y: 7, rotation: 10, scaleX: 1.5, scaleY: 2 } });
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildGroup("group_1", [child])])])]),
    });

    const result = ungroupObject(project, { type: "ungroupObject", objectId: ObjectIdSchema.parse("group_1") });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const restored = result.value.document.pages[0]!.layers[0]!.objects[0];
    expect(restored?.transform).toEqual(child.transform);
  });

  it("con el Group movido/rotado/escalado, hornea ese transform en cada hijo", () => {
    const child = buildRectangle("child_a", { transform: { x: 5, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } });
    const group = buildGroup("group_1", [child], {
      transform: { x: 100, y: 200, rotation: 90, scaleX: 2, scaleY: 2 },
    });
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [group])])]),
    });

    const result = ungroupObject(project, { type: "ungroupObject", objectId: ObjectIdSchema.parse("group_1") });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const restored = result.value.document.pages[0]!.layers[0]!.objects[0];
    // child local (5,0) escalado x2 -> (10,0); rotado 90 -> (0,10); + pivote (100,200) -> (100,210).
    expect(restored?.transform.x).toBeCloseTo(100, 10);
    expect(restored?.transform.y).toBeCloseTo(210, 10);
    expect(restored?.transform.rotation).toBeCloseTo(90, 10);
    expect(restored?.transform.scaleX).toBeCloseTo(2, 10);
  });

  it("rechaza un objectId que no es un group", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a")])])]),
    });
    const result = ungroupObject(project, { type: "ungroupObject", objectId: ObjectIdSchema.parse("a") });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_group");
  });

  it("rechaza un group anidado dentro de otro group, con un mensaje que lo distingue de 'no existe'", () => {
    const nestedGroup = buildGroup("nested_group", [buildRectangle("x")]);
    const project = buildProject({
      document: buildDocument([
        buildPage("page_1", [buildLayer("layer_1", [buildGroup("outer_group", [nestedGroup])])]),
      ]),
    });
    const result = ungroupObject(project, { type: "ungroupObject", objectId: ObjectIdSchema.parse("nested_group") });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_group");
      expect(result.error.message).toContain("no es un hijo directo");
    }
  });

  it("rechaza un objectId que no existe en absoluto", () => {
    const project = buildProject({
      document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("a")])])]),
    });
    const result = ungroupObject(project, { type: "ungroupObject", objectId: ObjectIdSchema.parse("no_existe") });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("object_not_found");
  });
});
