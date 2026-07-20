/**
 * Stub mínimo de `CanvasRenderingContext2D` para tests — jsdom no
 * implementa un contexto 2D real (mismo gap ya documentado en
 * `@impulso/renderer-konva`'s ADR-0004 para Konva). Registra cada llamada
 * en `calls` para que los tests puedan verificar QUÉ se dibujó (tipo de
 * operación + argumentos), sin producir píxeles reales — la verificación
 * de píxeles reales vive en Chromium real (harness E2E de esta fase).
 */
export type FakeCanvasCall = { method: string; args: unknown[] };

export interface FakeCanvasContext2D extends Partial<CanvasRenderingContext2D> {
  calls: FakeCanvasCall[];
  strokeStyle: string;
  lineWidth: number;
}

export function createFakeCanvasContext2D(): FakeCanvasContext2D {
  const calls: FakeCanvasCall[] = [];
  const record = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
  };

  return {
    calls,
    strokeStyle: "#000000",
    lineWidth: 1,
    save: record("save"),
    restore: record("restore"),
    beginPath: record("beginPath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    quadraticCurveTo: record("quadraticCurveTo"),
    bezierCurveTo: record("bezierCurveTo"),
    closePath: record("closePath"),
    stroke: record("stroke"),
    drawImage: record("drawImage"),
  } as FakeCanvasContext2D;
}
