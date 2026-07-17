/**
 * jsdom implementa `HTMLCanvasElement` pero NO un contexto 2D real (requiere
 * el paquete nativo `canvas`, que necesita cairo/pango del sistema — no
 * disponible en todos los entornos de CI/sandbox). Este stub reemplaza
 * `getContext('2d')` con un objeto que implementa las operaciones que Konva
 * invoca al construir/dibujar su árbol de nodos, todas como no-ops.
 *
 * Esto NO produce píxeles reales — no es su propósito. Sirve para probar
 * que el Renderer Adapter construye la ESTRUCTURA correcta del árbol Konva
 * (tipos de nodo, atributos, jerarquía) y que los eventos (`dragend`, etc.)
 * se traducen correctamente en llamadas al Engine, sin depender de una
 * librería nativa ni de un navegador real.
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

/** Instala el stub sobre `HTMLCanvasElement.prototype.getContext` de un `window` de jsdom. */
export function installFakeCanvas(target: Window & typeof globalThis): void {
  target.HTMLCanvasElement.prototype.getContext = ((type: string) =>
    type === "2d" ? createFake2dContext() : null) as typeof target.HTMLCanvasElement.prototype.getContext;
}
