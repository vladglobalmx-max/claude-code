import { describe, expect, it, vi } from "vitest";
import { clampZoom, computeFitZoom, mountZoomControl, MAX_ZOOM, MIN_ZOOM } from "./zoom.js";

function container(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

describe("clampZoom", () => {
  it("deja pasar valores dentro del rango", () => {
    expect(clampZoom(1)).toBe(1);
  });

  it("recorta por debajo de MIN_ZOOM", () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
  });

  it("recorta por encima de MAX_ZOOM", () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM);
  });
});

describe("computeFitZoom", () => {
  it("calcula el factor que hace caber el contenido, tomando el eje más restrictivo", () => {
    // viewport 500x500, padding 32 -> disponible 436x436. Contenido 200x100 -> min(2.18, 4.36) = 2.18 (clamp a MAX_ZOOM=4, no aplica)
    const zoom = computeFitZoom(500, 500, 200, 100);
    expect(zoom).toBeCloseTo(436 / 200, 5);
  });

  it("usa el padding dado", () => {
    const zoom = computeFitZoom(300, 300, 100, 100, 0);
    expect(zoom).toBeCloseTo(3, 5);
  });

  it("devuelve 1 si el contenido no tiene tamaño válido", () => {
    expect(computeFitZoom(500, 500, 0, 0)).toBe(1);
    expect(computeFitZoom(500, 500, -10, 100)).toBe(1);
  });

  it("recorta el resultado a MAX_ZOOM/MIN_ZOOM", () => {
    expect(computeFitZoom(10000, 10000, 10, 10)).toBe(MAX_ZOOM);
    expect(computeFitZoom(10, 10, 10000, 10000)).toBe(MIN_ZOOM);
  });
});

describe("mountZoomControl", () => {
  it("aplica el zoom inicial (por defecto 100%) como transform CSS sobre el target", () => {
    const div = container();
    const target = document.createElement("div");
    mountZoomControl(div, { viewport: div, target, getContentSize: () => ({ width: 100, height: 100 }) });

    expect(target.style.transform).toBe("scale(1)");
    expect(div.querySelector(".zoom-percentage")?.textContent).toBe("100%");
  });

  it("acepta un initialZoom explícito", () => {
    const div = container();
    const target = document.createElement("div");
    mountZoomControl(div, {
      viewport: div,
      target,
      getContentSize: () => ({ width: 100, height: 100 }),
      initialZoom: 0.5,
    });

    expect(target.style.transform).toBe("scale(0.5)");
  });

  it("los botones preset (25/50/100/200%) cambian el zoom", () => {
    const div = container();
    const target = document.createElement("div");
    mountZoomControl(div, { viewport: div, target, getContentSize: () => ({ width: 100, height: 100 }) });

    const buttons = Array.from(div.querySelectorAll(".zoom-preset")) as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent)).toEqual(["25%", "50%", "100%", "200%"]);

    buttons[1]!.click(); // 50%
    expect(target.style.transform).toBe("scale(0.5)");
    expect(div.querySelector(".zoom-percentage")?.textContent).toBe("50%");
  });

  it("'Ajustar a pantalla' usa el tamaño del viewport y del contenido", () => {
    const div = container();
    const target = document.createElement("div");
    Object.defineProperty(div, "clientWidth", { value: 300, configurable: true });
    Object.defineProperty(div, "clientHeight", { value: 300, configurable: true });
    const controller = mountZoomControl(div, {
      viewport: div,
      target,
      getContentSize: () => ({ width: 100, height: 100 }),
    });

    (div.querySelector(".zoom-fit") as HTMLButtonElement).click();

    expect(controller.getZoom()).toBeCloseTo(computeFitZoom(300, 300, 100, 100), 5);
  });

  it("setZoom() y getZoom() están en sincronía y recortan al rango válido", () => {
    const div = container();
    const target = document.createElement("div");
    const controller = mountZoomControl(div, { viewport: div, target, getContentSize: () => ({ width: 1, height: 1 }) });

    controller.setZoom(10);
    expect(controller.getZoom()).toBe(MAX_ZOOM);
  });

  it("rueda del mouse con Ctrl/Cmd hace zoom in/out; sin Ctrl/Cmd, no hace nada", () => {
    const div = container();
    const target = document.createElement("div");
    const controller = mountZoomControl(div, { viewport: div, target, getContentSize: () => ({ width: 1, height: 1 }) });

    div.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, ctrlKey: true, cancelable: true }));
    expect(controller.getZoom()).toBeGreaterThan(1);

    const afterZoomIn = controller.getZoom();
    div.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, metaKey: true, cancelable: true }));
    expect(controller.getZoom()).toBeLessThan(afterZoomIn);

    const beforePlainWheel = controller.getZoom();
    div.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, cancelable: true }));
    expect(controller.getZoom()).toBe(beforePlainWheel);
  });

  it("la rueda con Ctrl/Cmd llama a preventDefault (para no hacer scroll de la página)", () => {
    const div = container();
    const target = document.createElement("div");
    mountZoomControl(div, { viewport: div, target, getContentSize: () => ({ width: 1, height: 1 }) });

    const event = new WheelEvent("wheel", { deltaY: -100, ctrlKey: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    div.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("destroy() remueve la barra del DOM y deja de escuchar wheel", () => {
    const div = container();
    const target = document.createElement("div");
    const controller = mountZoomControl(div, { viewport: div, target, getContentSize: () => ({ width: 1, height: 1 }) });

    controller.destroy();
    expect(div.querySelector(".zoom-control")).toBeNull();

    div.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, ctrlKey: true, cancelable: true }));
    expect(controller.getZoom()).toBe(1); // sin cambios: el listener ya no está activo
  });
});
