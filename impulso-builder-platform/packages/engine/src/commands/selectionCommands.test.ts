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
