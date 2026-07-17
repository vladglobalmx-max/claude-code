/**
 * Copia deliberada del stub de `@impulso/renderer-konva` (no importado
 * desde ahí: es utilidad de testing interna, no parte de su API pública —
 * ver ADR-0005, "Riesgos"). jsdom no implementa un contexto 2D real; este
 * stub reemplaza `getContext('2d')` con no-ops suficientes para que Konva
 * construya su árbol sin depender del paquete nativo `canvas`.
 */
export function createFake2dContext(): CanvasRenderingContext2D {
  const noop = (): void => {};
  const context: Record<string, unknown> = {
    save: noop,
    restore: noop,
    scale: noop,
    rotate: noop,
    translate: noop,
    transform: noop,
    setTransform: noop,
    resetTransform: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    bezierCurveTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    arcTo: noop,
    rect: noop,
    ellipse: noop,
    fill: noop,
    stroke: noop,
    clip: noop,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    drawImage: noop,
    createImageData: () => ({ data: [] }),
    getImageData: () => ({ data: [] }),
    putImageData: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    setLineDash: noop,
    getLineDash: () => [],
    measureText: () => ({ width: 0 }),
    fillText: noop,
    strokeText: noop,
    isPointInPath: () => false,
  };
  return context as unknown as CanvasRenderingContext2D;
}

export function installFakeCanvas(target: Window & typeof globalThis): void {
  target.HTMLCanvasElement.prototype.getContext = ((type: string) =>
    type === "2d" ? createFake2dContext() : null) as typeof target.HTMLCanvasElement.prototype.getContext;
}
