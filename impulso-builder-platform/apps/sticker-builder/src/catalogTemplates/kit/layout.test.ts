import { describe, expect, it } from "vitest";
import { stackVertically, textLineHeight } from "./layout.js";

describe("textLineHeight", () => {
  it("calcula fontSize * lineHeight, con lineHeight por defecto 1.2", () => {
    expect(textLineHeight(15)).toBeCloseTo(18, 6);
    expect(textLineHeight(10, 1.5)).toBeCloseTo(15, 6);
  });
});

describe("stackVertically", () => {
  it("apila los elementos en orden, cada uno después del anterior + su gapAfter", () => {
    const { positions } = stackVertically(
      [
        { key: "a", height: 18, gapAfter: 4 },
        { key: "b", height: 12, gapAfter: 8 },
        { key: "c", height: 9.6 },
      ] as const,
      100,
    );

    expect(positions.map((p) => p.key)).toEqual(["a", "b", "c"]);
    expect(positions[1]!.y - positions[0]!.y).toBeCloseTo(18 + 4, 6);
    expect(positions[2]!.y - positions[1]!.y).toBeCloseTo(12 + 8, 6);
  });

  it("centra el bloque completo alrededor de centerY (reproduce el cálculo original de Serum)", () => {
    const items = [
      { key: "wordmark", height: 18, gapAfter: 4 },
      { key: "product-name", height: 12, gapAfter: 8 },
      { key: "divider", height: 0.8, gapAfter: 8 },
      { key: "data-line", height: 9.6 },
    ] as const;
    const centerY = 75.59;
    const { positions, totalHeight } = stackVertically(items, centerY);

    const expectedTotal = 18 + 4 + 12 + 8 + 0.8 + 8 + 9.6;
    expect(totalHeight).toBeCloseTo(expectedTotal, 6);
    expect(positions[0]!.y).toBeCloseTo(centerY - expectedTotal / 2, 6);
    // El bloque termina exactamente en centerY + mitad — última posición +
    // su propia altura debe llegar al borde inferior del bloque centrado.
    const last = positions[positions.length - 1]!;
    expect(last.y + last.height).toBeCloseTo(centerY + expectedTotal / 2, 6);
  });

  it("un solo elemento sin gapAfter se centra exactamente sobre centerY", () => {
    const { positions } = stackVertically([{ key: "only", height: 20 }] as const, 50);
    expect(positions[0]!.y).toBeCloseTo(40, 6);
  });

  it("arreglo vacío produce totalHeight 0 y ninguna posición", () => {
    const { positions, totalHeight } = stackVertically([], 50);
    expect(positions).toEqual([]);
    expect(totalHeight).toBe(0);
  });
});
