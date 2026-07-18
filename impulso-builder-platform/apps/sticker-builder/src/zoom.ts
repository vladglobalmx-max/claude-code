export const ZOOM_PRESETS = [0.25, 0.5, 1, 2] as const;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Calcula el zoom que hace caber `contentWidth`x`contentHeight` dentro de
 * `viewportWidth`x`viewportHeight` con un margen (`padding`, en px a cada
 * lado). Función pura, sin DOM, para poder testearla sin simular layout
 * real de jsdom (que no calcula tamaños). */
export function computeFitZoom(
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number,
  padding = 32,
): number {
  if (contentWidth <= 0 || contentHeight <= 0) return 1;
  const availableWidth = Math.max(viewportWidth - padding * 2, 1);
  const availableHeight = Math.max(viewportHeight - padding * 2, 1);
  return clampZoom(Math.min(availableWidth / contentWidth, availableHeight / contentHeight));
}

export interface ZoomController {
  getZoom(): number;
  setZoom(zoom: number): void;
  fitToScreen(): void;
  destroy(): void;
}

export interface MountZoomOptions {
  /** Contenedor visible/con scroll ("viewport"): se mide para "Ajustar a
   * pantalla" y escucha `wheel` con Ctrl/Cmd. */
  viewport: HTMLElement;
  /** Elemento al que se le aplica `transform: scale(...)` — normalmente el
   * propio contenedor del Stage de Konva. El zoom es puramente visual/CSS:
   * nunca toca el Engine, el Renderer ni el Stage de Konva (ver ADR-0010)
   * — el Document Schema sigue midiéndose en sus unidades reales (mm/px)
   * sin que el zoom las altere. */
  target: HTMLElement;
  getContentSize: () => { width: number; height: number };
  initialZoom?: number;
}

/** Barra de zoom (parte de la Barra superior): presets 25/50/100/200%,
 * "Ajustar a pantalla", y rueda del mouse + Ctrl/Cmd sobre el viewport. */
export function mountZoomControl(container: HTMLElement, options: MountZoomOptions): ZoomController {
  const { viewport, target, getContentSize } = options;
  let zoom = clampZoom(options.initialZoom ?? 1);

  const bar = document.createElement("div");
  bar.className = "zoom-control";

  const percentageLabel = document.createElement("span");
  percentageLabel.className = "zoom-percentage";

  function apply(): void {
    target.style.transform = `scale(${zoom})`;
    target.style.transformOrigin = "top left";
    percentageLabel.textContent = `${Math.round(zoom * 100)}%`;
  }

  function setZoom(next: number): void {
    zoom = clampZoom(next);
    apply();
  }

  function fitToScreen(): void {
    const { width, height } = getContentSize();
    setZoom(computeFitZoom(viewport.clientWidth, viewport.clientHeight, width, height));
  }

  for (const preset of ZOOM_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "zoom-preset";
    button.textContent = `${Math.round(preset * 100)}%`;
    button.addEventListener("click", () => setZoom(preset));
    bar.appendChild(button);
  }

  const fitButton = document.createElement("button");
  fitButton.type = "button";
  fitButton.className = "zoom-fit";
  fitButton.textContent = "Ajustar a pantalla";
  fitButton.addEventListener("click", fitToScreen);
  bar.appendChild(fitButton);
  bar.appendChild(percentageLabel);
  container.appendChild(bar);

  function onWheel(evt: WheelEvent): void {
    if (!evt.ctrlKey && !evt.metaKey) return;
    evt.preventDefault();
    setZoom(zoom * (evt.deltaY < 0 ? 1.1 : 1 / 1.1));
  }
  viewport.addEventListener("wheel", onWheel, { passive: false });

  apply();

  return {
    getZoom: () => zoom,
    setZoom,
    fitToScreen,
    destroy: () => {
      viewport.removeEventListener("wheel", onWheel);
      bar.remove();
    },
  };
}
