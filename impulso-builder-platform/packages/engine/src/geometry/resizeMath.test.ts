import { describe, expect, it } from "vitest";
import { computeResizedTransform, MIN_RESIZE_SIZE } from "./resizeMath.js";
import type { Transform } from "@impulso/document-schema";

const baseTransform: Transform = { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 };
const intrinsicSize = { width: 100, height: 50 };

describe("computeResizedTransform — los 8 handles, sin rotación", () => {
  it("bottom-right: crece desde el anclaje top-left (x/y no cambian)", () => {
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize,
      handle: "bottom-right",
      pointerDelta: { x: 20, y: 10 },
    });
    expect(result).toEqual({ x: 10, y: 20, scaleX: 1.2, scaleY: 1.2 });
  });

  it("top-left: encoge y desplaza el anclaje (el bottom-right no se mueve)", () => {
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize,
      handle: "top-left",
      pointerDelta: { x: 20, y: 10 },
    });
    expect(result).toEqual({ x: 30, y: 30, scaleX: 0.8, scaleY: 0.8 });
  });

  it("top-right: ancho crece a la derecha, alto encoge desde arriba", () => {
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize,
      handle: "top-right",
      pointerDelta: { x: 20, y: 10 },
    });
    // width: 100+20=120 -> scaleX 1.2; height: 50-10=40 -> scaleY 0.8; y sube 10, x no cambia.
    expect(result).toEqual({ x: 10, y: 30, scaleX: 1.2, scaleY: 0.8 });
  });

  it("bottom-left: ancho encoge desde la izquierda, alto crece hacia abajo", () => {
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize,
      handle: "bottom-left",
      pointerDelta: { x: 20, y: 10 },
    });
    expect(result).toEqual({ x: 30, y: 20, scaleX: 0.8, scaleY: 1.2 });
  });

  it("right: solo afecta el ancho, el alto y la posición no cambian", () => {
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize,
      handle: "right",
      pointerDelta: { x: 15, y: 999 }, // el componente y se ignora para un handle de borde puro
    });
    expect(result).toEqual({ x: 10, y: 20, scaleX: 1.15, scaleY: 1 });
  });

  it("left: solo afecta el ancho, desplazando x", () => {
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize,
      handle: "left",
      pointerDelta: { x: 15, y: 999 },
    });
    // width: 100-15=85 -> scaleX 0.85; x se desplaza +15.
    expect(result).toEqual({ x: 25, y: 20, scaleX: 0.85, scaleY: 1 });
  });

  it("top: solo afecta el alto, desplazando y", () => {
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize,
      handle: "top",
      pointerDelta: { x: 999, y: 10 },
    });
    expect(result).toEqual({ x: 10, y: 30, scaleX: 1, scaleY: 0.8 });
  });

  it("bottom: solo afecta el alto, sin desplazar y", () => {
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize,
      handle: "bottom",
      pointerDelta: { x: 999, y: 10 },
    });
    expect(result).toEqual({ x: 10, y: 20, scaleX: 1, scaleY: 1.2 });
  });
});

describe("computeResizedTransform — restricción de tamaño mínimo", () => {
  it("no permite que el ancho/alto bajen de MIN_RESIZE_SIZE", () => {
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize: { width: 10, height: 10 },
      handle: "bottom-right",
      pointerDelta: { x: -20, y: -20 },
    });
    expect(result.scaleX).toBeCloseTo(MIN_RESIZE_SIZE / 10, 10);
    expect(result.scaleY).toBeCloseTo(MIN_RESIZE_SIZE / 10, 10);
  });

  it("el anclaje se mantiene EXACTO incluso cuando el tamaño se clampa (top-left)", () => {
    const transform: Transform = { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 };
    const size = { width: 10, height: 10 };
    const result = computeResizedTransform({
      transform,
      intrinsicSize: size,
      handle: "top-left",
      pointerDelta: { x: 20, y: 20 }, // arrastra mucho más allá del anclaje
    });
    // La esquina bottom-right original está en (x+width, y+height) = (20, 30).
    // Tras clampar a MIN_RESIZE_SIZE, la nueva bottom-right debe coincidir EXACTO.
    const newWidth = (result.scaleX ?? 0) * size.width;
    const newHeight = (result.scaleY ?? 0) * size.height;
    expect((result.x ?? 0) + newWidth).toBeCloseTo(20, 10);
    expect((result.y ?? 0) + newHeight).toBeCloseTo(30, 10);
  });
});

describe("computeResizedTransform — restricción de proporción (maintainAspectRatio)", () => {
  it("un handle de esquina con solo cambio de ancho ajusta el alto proporcionalmente", () => {
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize,
      handle: "bottom-right",
      pointerDelta: { x: 20, y: 0 },
      maintainAspectRatio: true,
    });
    // aspectRatio = 100/50 = 2; newWidth=120 -> newHeight=120/2=60.
    expect(result.scaleX).toBeCloseTo(1.2, 10);
    expect(result.scaleY).toBeCloseTo(1.2, 10);
  });

  it("un handle de borde (right) también ajusta el eje cruzado", () => {
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize,
      handle: "right",
      pointerDelta: { x: 20, y: 0 },
      maintainAspectRatio: true,
    });
    expect(result.scaleX).toBeCloseTo(1.2, 10);
    expect(result.scaleY).toBeCloseTo(1.2, 10); // sin aspect ratio hubiera quedado en 1
  });

  it("con cambios similares en ambos ejes, domina el de mayor cambio relativo", () => {
    // width 100->140 (+40%), height 50->55 (+10%) — el ancho domina.
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize,
      handle: "bottom-right",
      pointerDelta: { x: 40, y: 5 },
      maintainAspectRatio: true,
    });
    expect(result.scaleX).toBeCloseTo(1.4, 10);
    expect(result.scaleY).toBeCloseTo(1.4, 10); // 140/2 = 70 -> scaleY 70/50=1.4
  });

  it("cuando el alto cambia proporcionalmente más que el ancho, domina el alto", () => {
    // width 100->105 (+5%), height 50->75 (+50%) — el alto domina.
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize,
      handle: "bottom-right",
      pointerDelta: { x: 5, y: 25 },
      maintainAspectRatio: true,
    });
    expect(result.scaleY).toBeCloseTo(1.5, 10);
    expect(result.scaleX).toBeCloseTo(1.5, 10); // newWidth = newHeight(75) * aspectRatio(2) = 150 -> scaleX 1.5
  });

  it("un handle de borde vertical (bottom) también ajusta el eje cruzado (ancho)", () => {
    const result = computeResizedTransform({
      transform: baseTransform,
      intrinsicSize,
      handle: "bottom",
      pointerDelta: { x: 999, y: 10 },
      maintainAspectRatio: true,
    });
    // height: 50+10=60 -> scaleY 1.2; width se recalcula: 60*aspectRatio(2)=120 -> scaleX 1.2.
    expect(result.scaleY).toBeCloseTo(1.2, 10);
    expect(result.scaleX).toBeCloseTo(1.2, 10);
  });
});

describe("computeResizedTransform — consciente de la rotación", () => {
  it("con rotation=90°, un delta en el eje Y del padre se traduce al eje X local", () => {
    const transform: Transform = { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 };
    const result = computeResizedTransform({
      transform,
      intrinsicSize,
      handle: "right",
      pointerDelta: { x: 0, y: 10 },
    });
    expect(result.scaleX).toBeCloseTo(1.1, 10);
    expect(result.scaleY).toBeCloseTo(1, 10);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBeCloseTo(0, 10);
  });

  it("con rotation=90°, el desplazamiento del anclaje también se rota de vuelta al espacio del padre", () => {
    const transform: Transform = { x: 10, y: 20, rotation: 90, scaleX: 1, scaleY: 1 };
    const result = computeResizedTransform({
      transform,
      intrinsicSize: { width: 10, height: 10 },
      handle: "top-left",
      pointerDelta: { x: 0, y: 5 },
    });
    // local: rad=-90°, localDx = 0*cos(-90)-5*sin(-90) = 0 - 5*(-1) = 5; localDy = 0*sin(-90)+5*cos(-90) = 0.
    // top-left: widthDelta=-5, heightDelta=0 -> newWidth=5, newHeight=10.
    // xShift = -(-5) = 5 (left side); yShift = -0 = 0 (top side, heightDelta=0).
    // forward rad=90°: parentDx = 5*cos(90)-0*sin(90) = 0; parentDy = 5*sin(90)+0*cos(90) = 5.
    expect(result.x).toBeCloseTo(10 + 0, 10);
    expect(result.y).toBeCloseTo(20 + 5, 10);
    expect(result.scaleX).toBeCloseTo(0.5, 10);
    expect(result.scaleY).toBeCloseTo(1, 10);
  });
});
