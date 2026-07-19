import { fromPixels, toPixels, PageIdSchema, type GridConfig, type Unit } from "@impulso/document-schema";
import type { Engine } from "@impulso/engine";

/** Redondeo a 2 decimales — mismo criterio que `inspector.ts` para mostrar
 * valores en `page.unit` sin ruido de punto flotante. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function activePage(engine: Engine) {
  return engine.getProject().document.pages[0];
}

function dispatchGridPatch(engine: Engine, patch: Partial<GridConfig>): void {
  const page = activePage(engine);
  if (!page) return;
  engine.dispatch({ type: "updatePageGrid", pageId: PageIdSchema.parse(page.id), grid: patch });
}

/** Usado por el atajo "G" (Fase 7.3, sección 11) — mismo dispatch que el
 * botón "Grid: on/off" de `mountGridSnapControls`, expuesto aparte porque
 * el atajo vive en `app.ts`, no dentro de los controles del toolbar. */
export function toggleGridVisible(engine: Engine): void {
  const grid = activePage(engine)?.grid;
  if (grid) dispatchGridPatch(engine, { visible: !grid.visible });
}

// ============================================================================
// Grid visual (CSS, no Konva) — Epic 7 / Fase 7.3, sección 7.
// ============================================================================

const MIN_GRID_STEP_SCREEN_PX = 4;

/** Duplica el intervalo VISUAL hasta alcanzar una separación mínima en
 * pantalla — el snap (Engine) sigue usando siempre `grid.size` real, sin
 * que este ajuste puramente visual lo toque (ver Fase 7.3, sección 7:
 * "puede adaptar visualmente el intervalo mostrado, siempre que el snap
 * conserve el tamaño configurado real"). */
function effectiveGridStep(size: number, zoom: number): number {
  let step = size;
  while (step * zoom < MIN_GRID_STEP_SCREEN_PX && step > 0) step *= 2;
  return step;
}

export interface GridOverlay {
  /** Se llama cuando cambia el zoom (Fase 7.3: el Grid visual "responde al
   * zoom sin volverse ilegible") — `zoom.ts` no conoce este módulo, así que
   * `app.ts` reenvía el cambio explícitamente. */
  onZoomChange(zoom: number): void;
  destroy(): void;
}

/**
 * Grid visual: un `background-image` CSS (líneas de 1px repetidas cada
 * `effectiveGridStep` px) en un div dedicado, insertado como PRIMER hijo de
 * `container` (el mismo contenedor que monta el Stage de Konva) — así
 * queda siempre detrás del canvas y de los objects (Fase 7.3, sección 7:
 * "debe renderizarse detrás de los objects"), y con `pointer-events: none`
 * nunca interfiere con selección/hit-testing. No son miles de nodos: es un
 * único patrón CSS repetido, así que "zoom muy alejado" nunca es un
 * problema de cantidad de elementos — solo de legibilidad, que
 * `effectiveGridStep` resuelve.
 */
export function mountGridOverlay(container: HTMLElement, engine: Engine, getZoom: () => number): GridOverlay {
  const overlay = document.createElement("div");
  overlay.className = "grid-overlay";
  overlay.setAttribute("aria-hidden", "true");
  container.insertBefore(overlay, container.firstChild);

  function render(): void {
    const page = activePage(engine);
    const grid = page?.grid;
    if (!page || !grid || !grid.visible) {
      overlay.style.display = "none";
      return;
    }
    const step = effectiveGridStep(grid.size, getZoom());
    overlay.style.display = "block";
    overlay.style.backgroundSize = `${step}px ${step}px`;
  }

  render();
  const unsubscribe = engine.subscribe((event) => {
    if (event.type === "projectChanged") render();
  });

  return {
    onZoomChange: render,
    destroy: () => {
      unsubscribe();
      overlay.remove();
    },
  };
}

// ============================================================================
// Rulers — Epic 7 / Fase 7.3, sección 8.
// ============================================================================

const RULER_THICKNESS = 20;
const RULER_BG = "#f5f5f4";
const RULER_TICK_MAJOR = "#78716c";
const RULER_TICK_MINOR = "#c9c5c2";
const RULER_LABEL = "#44403c";

/** Elige un intervalo "agradable" (1/2/5 × potencia de 10) en `page.unit`
 * tal que, multiplicado por zoom y por px-por-unidad, deje al menos
 * `minScreenPx` entre marcas mayores — mismo principio que
 * `effectiveGridStep`, pero en unidades del documento (mm/in/px), no en px
 * canónicos. */
function niceUnitStep(pxPerUnit: number, zoom: number, minScreenPx: number): number {
  const rawUnitsPerMinPx = minScreenPx / (pxPerUnit * zoom);
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(rawUnitsPerMinPx, 1e-9))));
  for (const factor of [1, 2, 5, 10]) {
    const candidate = magnitude * factor;
    if (candidate >= rawUnitsPerMinPx) return candidate;
  }
  return magnitude * 10;
}

export interface Rulers {
  refresh(): void;
  destroy(): void;
}

/**
 * Reglas horizontal/vertical alrededor del viewport (Fase 7.3, sección 8):
 * dos `<canvas>` DOM (no Konva, no SVG — nítidas en pantallas de alta
 * densidad vía `devicePixelRatio`, y nunca capturan eventos del canvas
 * porque son elementos hermanos, no superpuestos). Se redibujan en
 * `refresh()` — quien llama decide cuándo (scroll nativo del viewport,
 * cambio de zoom, `projectChanged`), nunca en cada `requestAnimationFrame`.
 */
export function mountRulers(
  horizontalCanvas: HTMLCanvasElement,
  verticalCanvas: HTMLCanvasElement,
  viewport: HTMLElement,
  canvasContainer: HTMLElement,
  engine: Engine,
  getZoom: () => number,
): Rulers {
  /** Posición en pantalla (relativa al viewport) del origen de la página
   * (canónico 0,0) — `getBoundingClientRect()` ya refleja el scroll/zoom
   * ACTUALES, así que no hace falta sumar/restar scroll por separado. */
  function originOffset(): { x: number; y: number } {
    const containerRect = canvasContainer.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    return {
      x: containerRect.left - viewportRect.left,
      y: containerRect.top - viewportRect.top,
    };
  }

  function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function drawRuler(axis: "x" | "y", unit: Unit): void {
    const canvas = axis === "x" ? horizontalCanvas : verticalCanvas;
    const length = axis === "x" ? viewport.clientWidth : viewport.clientHeight;
    const thickness = RULER_THICKNESS;
    const width = axis === "x" ? length : thickness;
    const height = axis === "x" ? thickness : length;
    const ctx = resizeCanvas(canvas, Math.max(width, 1), Math.max(height, 1));
    if (!ctx) return;

    ctx.fillStyle = RULER_BG;
    ctx.fillRect(0, 0, width, height);

    const zoom = getZoom();
    const pxPerUnit = toPixels(1, unit);
    const origin = originOffset();
    const originScreen = axis === "x" ? origin.x : origin.y;

    const step = niceUnitStep(pxPerUnit, zoom, 48);
    const minorStep = step / 5;

    // Rango visible en unidades del documento, con un margen de un `step` a cada lado.
    const visibleStartUnits = -originScreen / (pxPerUnit * zoom) - step;
    const visibleEndUnits = (length - originScreen) / (pxPerUnit * zoom) + step;

    ctx.strokeStyle = RULER_TICK_MINOR;
    ctx.fillStyle = RULER_LABEL;
    ctx.font = "9px sans-serif";
    ctx.textBaseline = "top";

    const firstMinor = Math.floor(visibleStartUnits / minorStep) * minorStep;
    for (let u = firstMinor; u <= visibleEndUnits; u += minorStep) {
      const screenPos = originScreen + u * pxPerUnit * zoom;
      const isMajor = Math.abs(Math.round(u / step) * step - u) < minorStep / 100;
      ctx.strokeStyle = isMajor ? RULER_TICK_MAJOR : RULER_TICK_MINOR;
      const tickLength = isMajor ? thickness * 0.6 : thickness * 0.3;
      ctx.beginPath();
      if (axis === "x") {
        ctx.moveTo(screenPos, thickness - tickLength);
        ctx.lineTo(screenPos, thickness);
      } else {
        ctx.moveTo(thickness - tickLength, screenPos);
        ctx.lineTo(thickness, screenPos);
      }
      ctx.stroke();

      if (isMajor) {
        const label = String(round2(u));
        if (axis === "x") {
          ctx.fillText(label, screenPos + 2, 2);
        } else {
          ctx.save();
          ctx.translate(2, screenPos + 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }
    }
    // Referencia visual: origen de la página (siempre útil, aunque quede fuera del rango de marcas).
    const zeroScreen = originScreen;
    ctx.strokeStyle = RULER_TICK_MAJOR;
    ctx.beginPath();
    if (axis === "x") {
      ctx.moveTo(zeroScreen, 0);
      ctx.lineTo(zeroScreen, thickness);
    } else {
      ctx.moveTo(0, zeroScreen);
      ctx.lineTo(thickness, zeroScreen);
    }
    ctx.stroke();
  }

  function refresh(): void {
    const page = activePage(engine);
    if (!page) return;
    drawRuler("x", page.unit);
    drawRuler("y", page.unit);
  }

  refresh();
  const unsubscribe = engine.subscribe((event) => {
    if (event.type === "projectChanged") refresh();
  });

  return { refresh, destroy: unsubscribe };
}

// ============================================================================
// Indicador de posición del puntero — Epic 7 / Fase 7.3, sección 9.
// ============================================================================

export interface PointerIndicator {
  destroy(): void;
}

/**
 * Muestra X/Y del puntero respecto de la página, en `page.unit` (Fase 7.3,
 * sección 9). `aria-hidden="true"`: el valor ya es accesible vía los campos
 * Transform del Inspector (Fase 7.1) cuando hay selección — duplicar esto
 * con `aria-live` inundaría lectores de pantalla en cada `pointermove`
 * (prohibido explícitamente por el enunciado). Throttled vía
 * `requestAnimationFrame`: como mucho una actualización de texto por frame,
 * nunca un render completo del editor.
 */
export function mountPointerIndicator(
  indicator: HTMLElement,
  viewport: HTMLElement,
  canvasContainer: HTMLElement,
  engine: Engine,
  getZoom: () => number,
): PointerIndicator {
  let rafHandle: number | undefined;
  let pending: { x: number; y: number } | null | undefined;

  function flush(): void {
    rafHandle = undefined;
    if (pending === undefined) return;
    if (pending === null) {
      indicator.textContent = "";
      indicator.style.display = "none";
      return;
    }
    const page = activePage(engine);
    if (!page) return;
    const x = round2(fromPixels(pending.x, page.unit));
    const y = round2(fromPixels(pending.y, page.unit));
    indicator.style.display = "";
    indicator.textContent = `X: ${x}${page.unit}  Y: ${y}${page.unit}`;
  }

  function schedule(next: { x: number; y: number } | null): void {
    pending = next;
    if (rafHandle !== undefined) return;
    rafHandle = requestAnimationFrame(flush);
  }

  function onPointerMove(evt: PointerEvent): void {
    const zoom = getZoom();
    const rect = canvasContainer.getBoundingClientRect();
    const localX = (evt.clientX - rect.left) / zoom;
    const localY = (evt.clientY - rect.top) / zoom;
    const page = activePage(engine);
    if (!page) return;
    const widthPx = toPixels(page.size.width, page.unit);
    const heightPx = toPixels(page.size.height, page.unit);
    if (localX < 0 || localY < 0 || localX > widthPx || localY > heightPx) {
      schedule(null);
      return;
    }
    schedule({ x: localX, y: localY });
  }

  function onPointerLeave(): void {
    schedule(null);
  }

  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerleave", onPointerLeave);
  indicator.style.display = "none";

  return {
    destroy: () => {
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerleave", onPointerLeave);
      if (rafHandle !== undefined) cancelAnimationFrame(rafHandle);
    },
  };
}

// ============================================================================
// Controles de Grid/Snap — Epic 7 / Fase 7.3, sección 7/10/11.
// ============================================================================

export interface GridSnapControls {
  destroy(): void;
}

/**
 * Controles de Grid/Snap, ubicados junto al zoom en `#tools-bar` (Fase
 * 7.3, sección 10): no dependen de la selección (a diferencia del
 * Inspector), y viven junto a los demás controles de viewport —
 * consistente con Figma/Canva/Kittl, donde Grid/Snap son controles de
 * VISTA, no de object.
 */
export function mountGridSnapControls(container: HTMLElement, engine: Engine): GridSnapControls {
  const wrapper = document.createElement("div");
  wrapper.className = "grid-snap-control";

  const gridButton = document.createElement("button");
  gridButton.type = "button";
  gridButton.className = "grid-snap-toggle";
  gridButton.setAttribute("aria-label", "Mostrar/ocultar Grid");

  const snapButton = document.createElement("button");
  snapButton.type = "button";
  snapButton.className = "grid-snap-toggle";
  snapButton.setAttribute("aria-label", "Activar/desactivar Snap to Grid");

  const sizeInput = document.createElement("input");
  sizeInput.type = "number";
  sizeInput.min = "1";
  sizeInput.step = "1";
  sizeInput.className = "grid-snap-size";
  sizeInput.setAttribute("aria-label", "Tamaño de Grid");

  wrapper.appendChild(gridButton);
  wrapper.appendChild(snapButton);
  wrapper.appendChild(sizeInput);
  container.appendChild(wrapper);

  function render(): void {
    const grid = activePage(engine)?.grid;
    if (!grid) return;
    gridButton.textContent = grid.visible ? "Grid: on" : "Grid: off";
    gridButton.classList.toggle("active", grid.visible);
    gridButton.title = `Mostrar/ocultar Grid (G) — actualmente ${grid.visible ? "visible" : "oculto"}`;

    snapButton.textContent = grid.snapEnabled ? "Snap: on" : "Snap: off";
    snapButton.classList.toggle("active", grid.snapEnabled);
    snapButton.title = `Snap to Grid — actualmente ${grid.snapEnabled ? "activado" : "desactivado"}. Mantén Ctrl/Cmd durante un arrastre para desactivar todo snapping temporalmente.`;

    if (document.activeElement !== sizeInput) sizeInput.value = String(grid.size);
    sizeInput.title = "Tamaño de Grid";
  }

  gridButton.addEventListener("click", () => toggleGridVisible(engine));
  snapButton.addEventListener("click", () => {
    const grid = activePage(engine)?.grid;
    if (grid) dispatchGridPatch(engine, { snapEnabled: !grid.snapEnabled });
  });
  sizeInput.addEventListener("change", () => {
    const value = Number(sizeInput.value);
    if (Number.isFinite(value) && value > 0) dispatchGridPatch(engine, { size: value });
  });

  render();
  const unsubscribe = engine.subscribe((event) => {
    if (event.type === "projectChanged") render();
  });

  return { destroy: () => { unsubscribe(); wrapper.remove(); } };
}
