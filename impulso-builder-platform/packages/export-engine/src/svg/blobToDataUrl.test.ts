import { describe, expect, it, vi, afterEach } from "vitest";
import { blobToDataUrl } from "./blobToDataUrl.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("blobToDataUrl", () => {
  it("resuelve con el data URL leído (result de FileReader)", async () => {
    const blob = new Blob(["contenido"], { type: "image/png" });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("rechaza si FileReader dispara onerror", async () => {
    class FailingFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result: string | null = null;
      readAsDataURL(): void {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal("FileReader", FailingFileReader);
    await expect(blobToDataUrl(new Blob(["x"]))).rejects.toThrow("No se pudo leer el binario del asset.");
  });
});
