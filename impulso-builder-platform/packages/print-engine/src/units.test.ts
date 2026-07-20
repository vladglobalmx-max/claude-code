import { describe, expect, it } from "vitest";
import { toPixels } from "@impulso/document-schema";
import {
  unitToPoints,
  pointsToUnit,
  physicalToPixels,
  pixelsToPhysical,
  pixelRatioForPpi,
  mmToIn,
  inToMm,
  mmToPt,
  ptToMm,
  inToPt,
  ptToIn,
} from "./units.js";

describe("conversiones mm <-> in <-> pt", () => {
  it("mmToIn/inToMm son inversas exactas", () => {
    expect(mmToIn(25.4)).toBe(1);
    expect(inToMm(1)).toBe(25.4);
    expect(inToMm(mmToIn(100))).toBeCloseTo(100, 10);
  });

  it("mmToPt/ptToMm son inversas exactas — 1 pulgada = 72pt = 25.4mm", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 10);
    expect(ptToMm(72)).toBeCloseTo(25.4, 10);
    expect(ptToMm(mmToPt(210))).toBeCloseTo(210, 10);
  });

  it("inToPt/ptToIn son inversas exactas", () => {
    expect(inToPt(1)).toBe(72);
    expect(ptToIn(72)).toBe(1);
  });

  it("valores extremos (0, muy grande) no producen NaN/Infinity", () => {
    expect(mmToPt(0)).toBe(0);
    expect(Number.isFinite(mmToPt(1_000_000))).toBe(true);
    expect(Number.isFinite(ptToMm(1_000_000))).toBe(true);
  });

  it("valores inválidos (NaN) se propagan como NaN, nunca se ocultan silenciosamente", () => {
    expect(Number.isNaN(mmToPt(NaN))).toBe(true);
    expect(Number.isNaN(ptToMm(Infinity))).toBe(false); // Infinity/72*25.4 = Infinity, no NaN
    expect(ptToMm(Infinity)).toBe(Infinity);
  });
});

describe("unitToPoints/pointsToUnit — para MediaBox/TrimBox/BleedBox de PDF", () => {
  it("210mm (A4) -> puntos PDF, valor exacto conocido (~595.28pt)", () => {
    expect(unitToPoints(210, "mm")).toBeCloseTo(595.2755905511812, 6);
  });

  it("297mm (A4) -> puntos PDF (~841.89pt)", () => {
    expect(unitToPoints(297, "mm")).toBeCloseTo(841.8897637795275, 6);
  });

  it("1 in -> 72pt exactos", () => {
    expect(unitToPoints(1, "in")).toBe(72);
  });

  it("96 px (unidad de referencia CSS) -> 72pt exactos (1 pulgada)", () => {
    expect(unitToPoints(96, "px")).toBeCloseTo(72, 10);
  });

  it("pointsToUnit es la inversa exacta de unitToPoints para las 3 unidades", () => {
    for (const unit of ["mm", "in", "px"] as const) {
      const original = 123.456;
      expect(pointsToUnit(unitToPoints(original, unit), unit)).toBeCloseTo(original, 8);
    }
  });
});

describe("physicalToPixels/pixelsToPhysical — resolución de impresión real, NUNCA 96 fijo", () => {
  it("una página A4 (210x297mm) a 300 PPI produce la cantidad correcta de píxeles", () => {
    // 210mm = 8.267716535433071in; a 300ppi = 2480.31... px
    expect(physicalToPixels(210, "mm", 300)).toBeCloseTo(2480.3149606299213, 6);
    expect(physicalToPixels(297, "mm", 300)).toBeCloseTo(3507.8740157480315, 6);
  });

  it("un PNG de 100mm a 300 PPI produce ~1181px (no 96 fijo)", () => {
    const px = physicalToPixels(100, "mm", 300);
    expect(px).toBeCloseTo(1181.1023622047244, 6);
    // Math.round documentado como el redondeo estándar para tamaño de canvas final:
    expect(Math.round(px)).toBe(1181);
  });

  it("100mm a 300 PPI es MUY distinto de toPixels(100,'mm') (96 fijo, resolución de pantalla)", () => {
    const printPx = physicalToPixels(100, "mm", 300);
    const screenPx = toPixels(100, "mm");
    expect(printPx).not.toBeCloseTo(screenPx, 0);
    expect(printPx / screenPx).toBeCloseTo(300 / 96, 6);
  });

  it("pixelsToPhysical es la inversa exacta de physicalToPixels", () => {
    for (const unit of ["mm", "in", "px"] as const) {
      for (const ppi of [72, 96, 150, 300, 600]) {
        const original = 50;
        expect(pixelsToPhysical(physicalToPixels(original, unit, ppi), unit, ppi)).toBeCloseTo(original, 8);
      }
    }
  });

  it("valores extremos (PPI muy alto, tamaño muy grande) siguen siendo finitos", () => {
    expect(Number.isFinite(physicalToPixels(1000, "mm", 2400))).toBe(true);
  });

  it("PPI=0 produce 0 px (caso límite, Preflight debe rechazarlo aparte — no responsabilidad de esta función pura)", () => {
    expect(physicalToPixels(100, "mm", 0)).toBe(0);
  });
});

describe("pixelRatioForPpi — identidad con physicalToPixels (base del pipeline de raster, Fase 9.2)", () => {
  it("targetPpi=96 produce pixelRatio=1 (sin cambio respecto al Stage ya construido en px canónico)", () => {
    expect(pixelRatioForPpi(96)).toBe(1);
  });

  it("targetPpi=300 produce pixelRatio=300/96=3.125", () => {
    expect(pixelRatioForPpi(300)).toBeCloseTo(3.125, 10);
  });

  it("identidad: physicalToPixels(v,unit,targetPpi) === toPixels(v,unit) * pixelRatioForPpi(targetPpi), para mm/in/px", () => {
    for (const unit of ["mm", "in", "px"] as const) {
      for (const targetPpi of [72, 150, 300, 600]) {
        const value = 210;
        const direct = physicalToPixels(value, unit, targetPpi);
        const viaPixelRatio = toPixels(value, unit) * pixelRatioForPpi(targetPpi);
        expect(viaPixelRatio).toBeCloseTo(direct, 6);
      }
    }
  });
});
