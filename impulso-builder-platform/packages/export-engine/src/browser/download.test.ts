import { describe, expect, it, vi, afterEach } from "vitest";
import { triggerBrowserDownload } from "./download.js";
import { ExportError } from "../errors.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("triggerBrowserDownload", () => {
  it("crea un <a download> temporal, hace click, lo remueve, y revoca la URL", async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:generated"), revokeObjectURL });
    // jsdom no implementa navegación real (ni siquiera para blob:) — se
    // stubea `.click()` para no disparar ese camino no soportado; lo que
    // este test verifica es que SE INVOCA click, no la navegación en sí.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const blob = new Blob(["contenido"], { type: "image/png" });

    triggerBrowserDownload(blob, "sticker.png");

    expect(appendSpy).toHaveBeenCalled();
    const anchor = appendSpy.mock.calls[0]![0] as HTMLAnchorElement;
    expect(anchor.download).toBe("sticker.png");
    expect(anchor.href).toContain("blob:generated");
    expect(document.body.contains(anchor)).toBe(false);
    expect(clickSpy).toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:generated");
  });

  it("acepta un filename con Unicode/acentos/emoji sin alterarlo (no es responsabilidad de esta función sanitizarlo)", async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:generated"), revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, "appendChild");

    triggerBrowserDownload(new Blob(["x"]), "Piñata 🎉.png");

    const anchor = appendSpy.mock.calls[0]![0] as HTMLAnchorElement;
    expect(anchor.download).toBe("Piñata 🎉.png");
    // Drena el `setTimeout(() => revokeObjectURL(url), 0)` pendiente antes
    // de que `afterEach` restaure los globals — si quedara pendiente,
    // dispararía más tarde contra el stub del SIGUIENTE test (el mismo
    // `URL.revokeObjectURL` se resuelve en el momento de disparar, no se
    // captura por closure), inflando su conteo de llamadas.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("dos descargas seguidas (mismo patrón que el paso 'results' del wizard, un botón por hoja/página) no comparten ni pisan la object URL una de la otra", async () => {
    let counter = 0;
    const createObjectURL = vi.fn(() => `blob:generated-${++counter}`);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, "appendChild");

    triggerBrowserDownload(new Blob(["x"]), "hoja-01.png");
    triggerBrowserDownload(new Blob(["x"]), "hoja-02.png");

    expect(appendSpy).toHaveBeenCalledTimes(2);
    const [firstAnchor, secondAnchor] = appendSpy.mock.calls.map((call) => call[0] as HTMLAnchorElement);
    expect(firstAnchor!.download).toBe("hoja-01.png");
    expect(firstAnchor!.href).toContain("blob:generated-1");
    expect(secondAnchor!.download).toBe("hoja-02.png");
    expect(secondAnchor!.href).toContain("blob:generated-2");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:generated-1");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:generated-2");
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("llamar la función dos veces con el MISMO blob/filename (repetir la misma descarga) crea dos anchors/URLs independientes, ninguna interferencia", async () => {
    let counter = 0;
    const createObjectURL = vi.fn(() => `blob:generated-${++counter}`);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const blob = new Blob(["x"]);

    triggerBrowserDownload(blob, "sticker.png");
    triggerBrowserDownload(blob, "sticker.png");

    expect(createObjectURL).toHaveBeenCalledTimes(2);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("lanza download_failed si URL.createObjectURL falla", () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => {
        throw new Error("sin memoria");
      },
      revokeObjectURL: vi.fn(),
    });
    expect(() => triggerBrowserDownload(new Blob(["x"]), "a.png")).toThrow(ExportError);
  });

  it("lanza download_failed y revoca la URL si el click falla", () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL });
    vi.spyOn(document.body, "appendChild").mockImplementation(() => {
      throw new Error("DOM roto");
    });
    expect(() => triggerBrowserDownload(new Blob(["x"]), "a.png")).toThrow(ExportError);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:x");
  });
});
