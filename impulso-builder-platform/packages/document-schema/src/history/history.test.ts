import { describe, expect, it } from "vitest";
import { HistoryEntrySchema, DocumentHistorySchema } from "./history.js";

const NOW = "2026-07-17T00:00:00.000Z";

describe("HistoryEntrySchema", () => {
  it("acepta una entrada válida con patch opaco", () => {
    const entry = HistoryEntrySchema.parse({
      id: "entry_1",
      createdAt: NOW,
      description: "Mover rectángulo",
      documentVersionBefore: 1,
      documentVersionAfter: 2,
      patch: { op: "move", objectId: "obj_1", to: { x: 10, y: 20 } },
    });
    expect(entry.documentVersionAfter).toBe(2);
  });

  it("acepta una entrada sin patch (slot opcional)", () => {
    const entry = HistoryEntrySchema.parse({
      id: "entry_2",
      createdAt: NOW,
      documentVersionBefore: 1,
      documentVersionAfter: 2,
    });
    expect(entry.patch).toBeUndefined();
  });

  it("rechaza documentVersionAfter <= documentVersionBefore", () => {
    expect(() =>
      HistoryEntrySchema.parse({
        id: "entry_3",
        createdAt: NOW,
        documentVersionBefore: 3,
        documentVersionAfter: 3,
      }),
    ).toThrow(/documentVersionAfter/);

    expect(() =>
      HistoryEntrySchema.parse({
        id: "entry_4",
        createdAt: NOW,
        documentVersionBefore: 3,
        documentVersionAfter: 2,
      }),
    ).toThrow(/documentVersionAfter/);
  });
});

describe("DocumentHistorySchema", () => {
  it("por defecto no tiene entradas", () => {
    expect(DocumentHistorySchema.parse({})).toEqual({ entries: [] });
  });

  it("acumula múltiples entradas en orden", () => {
    const history = DocumentHistorySchema.parse({
      entries: [
        { id: "e1", createdAt: NOW, documentVersionBefore: 1, documentVersionAfter: 2 },
        { id: "e2", createdAt: NOW, documentVersionBefore: 2, documentVersionAfter: 3 },
      ],
    });
    expect(history.entries).toHaveLength(2);
  });
});
