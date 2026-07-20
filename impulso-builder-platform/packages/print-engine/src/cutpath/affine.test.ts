import { describe, expect, it } from "vitest";
import {
  IDENTITY_AFFINE,
  applyAffine,
  affineFromTransform,
  composeAffine,
  composeAncestorChain,
  decomposeSimilarity,
  isSimilarityTransform,
  pivotOf,
} from "./affine.js";

describe("applyAffine", () => {
  it("la identidad no cambia el punto", () => {
    expect(applyAffine(IDENTITY_AFFINE, { x: 3, y: 7 })).toEqual({ x: 3, y: 7 });
  });

  it("una traslación pura desplaza el punto", () => {
    const a = { ...IDENTITY_AFFINE, tx: 10, ty: -5 };
    expect(applyAffine(a, { x: 1, y: 1 })).toEqual({ x: 11, y: -4 });
  });
});

describe("affineFromTransform", () => {
  it("sin rotación ni escala, es una traslación pura al pivote", () => {
    const a = affineFromTransform({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, { x: 8, y: 8 });
    expect(applyAffine(a, { x: 10, y: 10 })).toEqual({ x: 18, y: 18 });
  });

  it("escala 2 con offset (8,8): un punto local (10,10) cae en (28,28) — mismo caso que renderer-konva contentScale", () => {
    const a = affineFromTransform({ x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 2 }, { x: 8, y: 8 });
    const result = applyAffine(a, { x: 10, y: 10 });
    expect(result.x).toBeCloseTo(28, 9);
    expect(result.y).toBeCloseTo(28, 9);
  });

  it("rotación de 90° sobre un punto local (1,0) desde el origen produce (0,1)", () => {
    const a = affineFromTransform({ x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 }, { x: 0, y: 0 });
    const result = applyAffine(a, { x: 1, y: 0 });
    expect(result.x).toBeCloseTo(0, 9);
    expect(result.y).toBeCloseTo(1, 9);
  });
});

describe("pivotOf", () => {
  it("rectangle/path/group/text/image: el pivote es transform.x/y (esquina superior izquierda)", () => {
    const object = { type: "rectangle", transform: { x: 5, y: 9, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 10, height: 10 } } as const;
    expect(pivotOf(object as never)).toEqual({ x: 5, y: 9 });
  });

  it("ellipse: el pivote es el CENTRO de la caja, no la esquina", () => {
    const object = { type: "ellipse", transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 20, height: 10 } } as const;
    expect(pivotOf(object as never)).toEqual({ x: 10, y: 5 });
  });
});

describe("composeAncestorChain", () => {
  it("cadena vacía es la identidad", () => {
    expect(composeAncestorChain([])).toEqual(IDENTITY_AFFINE);
  });

  it("un solo eslabón (el object sin ancestros) es ese mismo afín", () => {
    const own = affineFromTransform({ x: 3, y: 4, rotation: 0, scaleX: 1, scaleY: 1 }, { x: 3, y: 4 });
    expect(composeAncestorChain([own])).toEqual(own);
  });

  it("group padre trasladado (10,10) + object hijo trasladado (5,5) local -> punto global (15,15)", () => {
    const group = affineFromTransform({ x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 }, { x: 10, y: 10 });
    const object = affineFromTransform({ x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 }, { x: 5, y: 5 });
    const global = composeAncestorChain([group, object]);
    expect(applyAffine(global, { x: 0, y: 0 })).toEqual({ x: 15, y: 15 });
  });

  it("group rotado 90° alrededor del origen + object hijo en (1,0) local -> cae en (0,1) global", () => {
    const group = affineFromTransform({ x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 }, { x: 0, y: 0 });
    const object = affineFromTransform({ x: 1, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, { x: 1, y: 0 });
    const global = composeAncestorChain([group, object]);
    const result = applyAffine(global, { x: 0, y: 0 });
    expect(result.x).toBeCloseTo(0, 9);
    expect(result.y).toBeCloseTo(1, 9);
  });

  it("group escalado 2x + object hijo escalado 3x: la escala compuesta es 6x", () => {
    const group = affineFromTransform({ x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 2 }, { x: 0, y: 0 });
    const object = affineFromTransform({ x: 0, y: 0, rotation: 0, scaleX: 3, scaleY: 3 }, { x: 0, y: 0 });
    const global = composeAncestorChain([group, object]);
    expect(isSimilarityTransform(global)).toBe(true);
    expect(decomposeSimilarity(global).scale).toBeCloseTo(6, 9);
  });
});

describe("isSimilarityTransform / decomposeSimilarity", () => {
  it("rotación + escala uniforme + traslación: es una similitud", () => {
    const a = affineFromTransform({ x: 3, y: 4, rotation: 37, scaleX: 2, scaleY: 2 }, { x: 3, y: 4 });
    expect(isSimilarityTransform(a)).toBe(true);
    const { scale, rotationDegrees } = decomposeSimilarity(a);
    expect(scale).toBeCloseTo(2, 9);
    expect(rotationDegrees).toBeCloseTo(37, 6);
  });

  it("escala no-uniforme sin rotación (scaleX != scaleY): NO es una similitud", () => {
    const a = affineFromTransform({ x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 5 }, { x: 0, y: 0 });
    expect(isSimilarityTransform(a)).toBe(false);
  });

  it("escala no-uniforme de un ancestro combinada con rotación de OTRO nivel: produce shear real (no-similitud)", () => {
    // Rotar 45° y LUEGO aplicar una escala no-uniforme en un nivel distinto
    // introduce shear — a diferencia de escala no-uniforme + rotación en el
    // MISMO nivel (que sigue siendo, en sí, una transformación lineal única,
    // pero ya no una similitud tampoco). Aquí encadenamos dos niveles para
    // confirmar el caso explícito de la sección 13 (group con escala
    // no-uniforme + object rotado dentro de él).
    const group = affineFromTransform({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 4 }, { x: 0, y: 0 });
    const object = affineFromTransform({ x: 0, y: 0, rotation: 45, scaleX: 1, scaleY: 1 }, { x: 0, y: 0 });
    const global = composeAncestorChain([group, object]);
    expect(isSimilarityTransform(global)).toBe(false);
  });

  it("reflexión (escala negativa) combinada con rotación uniforme: sigue siendo una similitud", () => {
    const a = affineFromTransform({ x: 0, y: 0, rotation: 30, scaleX: -1, scaleY: 1 }, { x: 0, y: 0 });
    expect(isSimilarityTransform(a)).toBe(true);
  });
});

describe("composeAffine", () => {
  it("compone en el orden correcto: outer aplicado DESPUÉS de inner", () => {
    const inner = affineFromTransform({ x: 1, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, { x: 1, y: 0 }); // traslada +1 en x
    const outer = affineFromTransform({ x: 0, y: 1, rotation: 0, scaleX: 1, scaleY: 1 }, { x: 0, y: 1 }); // traslada +1 en y
    const composed = composeAffine(outer, inner);
    expect(applyAffine(composed, { x: 0, y: 0 })).toEqual({ x: 1, y: 1 });
  });
});
