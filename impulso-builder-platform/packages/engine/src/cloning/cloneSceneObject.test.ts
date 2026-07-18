import { describe, expect, it } from "vitest";
import { ObjectIdSchema } from "@impulso/document-schema";
import { cloneSceneObjectWithNewIds } from "./cloneSceneObject.js";
import { buildRectangle, buildGroup, NOW } from "../testUtils/fixtures.js";

function idGeneratorFrom(ids: string[]): () => ReturnType<typeof ObjectIdSchema.parse> {
  let index = 0;
  return () => ObjectIdSchema.parse(ids[index++]!);
}

const LATER = "2026-08-01T00:00:00.000Z";

describe("cloneSceneObjectWithNewIds", () => {
  it("asigna un id nuevo, nunca reutiliza el original", () => {
    const original = buildRectangle("rect_1");
    const clone = cloneSceneObjectWithNewIds(original, idGeneratorFrom(["rect_1_copy"]), LATER);

    expect(clone.id).toBe("rect_1_copy");
    expect(clone.id).not.toBe(original.id);
  });

  it("actualiza createdAt/updatedAt de la metadata al momento del clonado", () => {
    const original = buildRectangle("rect_1");
    const clone = cloneSceneObjectWithNewIds(original, idGeneratorFrom(["rect_1_copy"]), LATER);

    expect(clone.metadata.createdAt).toBe(LATER);
    expect(clone.metadata.updatedAt).toBe(LATER);
    expect(original.metadata.createdAt).toBe(NOW); // el original no se muta
  });

  it("sin offset, el transform queda idéntico al original", () => {
    const original = buildRectangle("rect_1", { transform: { x: 5, y: 10, rotation: 30, scaleX: 2, scaleY: 2 } });
    const clone = cloneSceneObjectWithNewIds(original, idGeneratorFrom(["rect_1_copy"]), LATER);

    expect(clone.transform).toEqual(original.transform);
  });

  it("con offset, desplaza x/y del object de nivel superior", () => {
    const original = buildRectangle("rect_1", { transform: { x: 5, y: 10, rotation: 0, scaleX: 1, scaleY: 1 } });
    const clone = cloneSceneObjectWithNewIds(original, idGeneratorFrom(["rect_1_copy"]), LATER, {
      offset: { x: 10, y: 10 },
    });

    expect(clone.transform).toEqual({ x: 15, y: 20, rotation: 0, scaleX: 1, scaleY: 1 });
  });

  it("no muta el object original", () => {
    const original = buildRectangle("rect_1", { transform: { x: 5, y: 10, rotation: 0, scaleX: 1, scaleY: 1 } });
    const originalTransform = { ...original.transform };
    const originalMetadata = { ...original.metadata };
    cloneSceneObjectWithNewIds(original, idGeneratorFrom(["rect_1_copy"]), LATER, { offset: { x: 10, y: 10 } });

    expect(original.id).toBe("rect_1");
    expect(original.transform).toEqual(originalTransform);
    expect(original.metadata).toEqual(originalMetadata);
  });

  it("para un group, clona recursivamente y asigna un id nuevo a CADA hijo", () => {
    const group = buildGroup("group_1", [buildRectangle("child_a"), buildRectangle("child_b")]);
    const generateId = idGeneratorFrom(["group_1_copy", "child_a_copy", "child_b_copy"]);

    const clone = cloneSceneObjectWithNewIds(group, generateId, LATER);

    expect(clone.id).toBe("group_1_copy");
    expect(clone.type).toBe("group");
    if (clone.type === "group") {
      expect(clone.children.map((c) => c.id)).toEqual(["child_a_copy", "child_b_copy"]);
    }
  });

  it("el offset del group NO se propaga a sus hijos (su posición ya es relativa al group)", () => {
    const child = buildRectangle("child_a", { transform: { x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1 } });
    const group = buildGroup("group_1", [child], { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } });
    const generateId = idGeneratorFrom(["group_1_copy", "child_a_copy"]);

    const clone = cloneSceneObjectWithNewIds(group, generateId, LATER, { offset: { x: 50, y: 50 } });

    expect(clone.transform).toEqual({ x: 50, y: 50, rotation: 0, scaleX: 1, scaleY: 1 });
    if (clone.type === "group") {
      expect(clone.children[0]?.transform).toEqual(child.transform); // sin cambios
    }
  });

  it("clona grupos anidados a cualquier profundidad, con ids frescos en todos los niveles", () => {
    const innerGroup = buildGroup("inner", [buildRectangle("deep_child")]);
    const outerGroup = buildGroup("outer", [innerGroup]);
    const generateId = idGeneratorFrom(["outer_copy", "inner_copy", "deep_child_copy"]);

    const clone = cloneSceneObjectWithNewIds(outerGroup, generateId, LATER);

    expect(clone.id).toBe("outer_copy");
    if (clone.type === "group") {
      const innerClone = clone.children[0];
      expect(innerClone?.id).toBe("inner_copy");
      if (innerClone?.type === "group") {
        expect(innerClone.children[0]?.id).toBe("deep_child_copy");
      }
    }
  });
});
