import { describe, expect, it } from "vitest";
import { ObjectIdSchema } from "@impulso/document-schema";
import { applySelectionCommand, pruneSelection } from "./selectionCommands.js";

describe("applySelectionCommand", () => {
  it("setSelection reemplaza la selección completa", () => {
    const next = applySelectionCommand([], {
      type: "setSelection",
      objectIds: [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")],
    });
    expect(next).toEqual(["a", "b"]);
  });

  it("clearSelection vacía la selección", () => {
    const next = applySelectionCommand([ObjectIdSchema.parse("a")], { type: "clearSelection" });
    expect(next).toEqual([]);
  });

  it("toggleObjectSelection agrega el id si no estaba seleccionado", () => {
    const next = applySelectionCommand([ObjectIdSchema.parse("a")], {
      type: "toggleObjectSelection",
      objectId: ObjectIdSchema.parse("b"),
    });
    expect(next).toEqual(["a", "b"]);
  });

  it("toggleObjectSelection quita el id si ya estaba seleccionado", () => {
    const next = applySelectionCommand([ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")], {
      type: "toggleObjectSelection",
      objectId: ObjectIdSchema.parse("a"),
    });
    expect(next).toEqual(["b"]);
  });

  it("toggleObjectSelection sobre una selección vacía agrega el primer id", () => {
    const next = applySelectionCommand([], {
      type: "toggleObjectSelection",
      objectId: ObjectIdSchema.parse("a"),
    });
    expect(next).toEqual(["a"]);
  });
});

describe("pruneSelection", () => {
  it("quita ids que ya no existen", () => {
    const selection = [ObjectIdSchema.parse("a"), ObjectIdSchema.parse("b")];
    const pruned = pruneSelection(selection, (id) => id === "a");
    expect(pruned).toEqual(["a"]);
  });

  it("devuelve la MISMA referencia si nada cambió (optimización de igualdad)", () => {
    const selection = [ObjectIdSchema.parse("a")];
    const pruned = pruneSelection(selection, () => true);
    expect(pruned).toBe(selection);
  });
});
