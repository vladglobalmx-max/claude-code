import { describe, expect, it } from "vitest";
import { createIdFactory } from "./ids.js";
import { createTextObject, createSplitAccentLine } from "./textObjects.js";

const NOW = "2026-07-28T00:00:00.000Z";
function ids() {
  let n = 0;
  return createIdFactory(() => `id${++n}`);
}

describe("createTextObject", () => {
  it("siempre incluye 'size' — nunca produce un TextObject sin caja de ajuste", () => {
    const obj = createTextObject({
      ids: ids(),
      now: NOW,
      content: "Hola",
      fontFamily: "Poppins",
      fontSize: 12,
      fill: "#000000",
      role: "wordmark",
      name: "Wordmark",
      x: 10,
      y: 20,
      width: 90,
      height: 14.4,
    });
    expect(obj.size).toEqual({ width: 90, height: 14.4 });
  });

  it("aplica los defaults del schema cuando no se pasan (fontWeight 400, textAlign left, lineHeight 1.2)", () => {
    const obj = createTextObject({
      ids: ids(),
      now: NOW,
      content: "Hola",
      fontFamily: "Poppins",
      fontSize: 12,
      fill: "#000000",
      role: "r",
      name: "n",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    expect(obj.fontWeight).toBe(400);
    expect(obj.textAlign).toBe("left");
    expect(obj.lineHeight).toBe(1.2);
  });

  it("respeta overrides explícitos de fontWeight/textAlign/lineHeight", () => {
    const obj = createTextObject({
      ids: ids(),
      now: NOW,
      content: "Hola",
      fontFamily: "Poppins",
      fontSize: 12,
      fontWeight: 300,
      textAlign: "center",
      lineHeight: 1.5,
      fill: "#000000",
      role: "r",
      name: "n",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    expect(obj.fontWeight).toBe(300);
    expect(obj.textAlign).toBe("center");
    expect(obj.lineHeight).toBe(1.5);
  });

  it("guarda role/name en metadata y el color en style.fill", () => {
    const obj = createTextObject({
      ids: ids(),
      now: NOW,
      content: "Hola",
      fontFamily: "Poppins",
      fontSize: 12,
      fill: "#9C4E27",
      role: "active-percentage",
      name: "% de activo",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    expect(obj.metadata.role).toBe("active-percentage");
    expect(obj.metadata.name).toBe("% de activo");
    expect(obj.style.fill).toBe("#9C4E27");
  });
});

describe("createSplitAccentLine", () => {
  it("reproduce exactamente la geometría del piloto (15%/30ml, gap 4, ancho 34, centrado en 75.59px)", () => {
    const centerX = 151.18 / 2; // diámetro real de 40mm en px, /2
    const [left, right] = createSplitAccentLine({
      ids: ids(),
      now: NOW,
      centerX,
      y: 100,
      height: 9.6,
      gap: 4,
      left: { content: "15%", fill: "#9C4E27", role: "active-percentage", name: "% de activo", fontFamily: "Poppins", fontSize: 8, width: 34 },
      right: { content: "30ml", fill: "#23282B", role: "volume", name: "Volumen", fontFamily: "Poppins", fontSize: 8, width: 34 },
    });

    expect(left.transform.x).toBeCloseTo(centerX - 36, 6);
    expect(right.transform.x).toBeCloseTo(centerX + 2, 6);
    expect(left.textAlign).toBe("right");
    expect(right.textAlign).toBe("left");
  });

  it("cada lado conserva su propio color, contenido y role — nunca se fusionan en un solo objeto", () => {
    const [left, right] = createSplitAccentLine({
      ids: ids(),
      now: NOW,
      centerX: 100,
      y: 0,
      height: 10,
      gap: 4,
      left: { content: "15%", fill: "#9C4E27", role: "active-percentage", name: "a", fontFamily: "Poppins", fontSize: 8, width: 34 },
      right: { content: "30ml", fill: "#23282B", role: "volume", name: "b", fontFamily: "Poppins", fontSize: 8, width: 34 },
    });

    expect(left.content).toBe("15%");
    expect(left.style.fill).toBe("#9C4E27");
    expect(left.metadata.role).toBe("active-percentage");
    expect(right.content).toBe("30ml");
    expect(right.style.fill).toBe("#23282B");
    expect(right.metadata.role).toBe("volume");
    expect(left.id).not.toBe(right.id);
  });
});
