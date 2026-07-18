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
