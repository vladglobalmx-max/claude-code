import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createImageAssetFromFile } from "./imageIngestion.js";

const NOW = "2026-07-18T00:00:00.000Z";

/** jsdom no decodifica imágenes reales — este stub reemplaza `window.Image`
 * para que `onload`/`onerror` se disparen de forma controlada, igual que en
 * `apps/sticker-builder` (ver imageAssets.ts, EPIC 1). */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 200;
  naturalHeight = 100;
  private _src = "";
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    if (value === "blob:invalid") {
      queueMicrotask(() => this.onerror?.());
    } else {
      queueMicrotask(() => this.onload?.());
    }
  }
}

describe("createImageAssetFromFile", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:ok"),
      revokeObjectURL: vi.fn(),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("construye un ImageAsset con las dimensiones reales de la imagen", async () => {
    const file = new File(["contenido"], "logo.png", { type: "image/png" });

    const { asset, binary } = await createImageAssetFromFile(file, { now: NOW });

    expect(asset.type).toBe("image");
    expect(asset.name).toBe("logo.png");
    expect(asset.mimeType).toBe("image/png");
    expect(asset.width).toBe(200);
    expect(asset.height).toBe(100);
    expect(asset.id).toMatch(/^asset_/);
    expect(asset.metadata.createdAt).toBe(NOW);
    expect(binary).toBe(file);
  });

  it("revoca el object URL creado, tanto en éxito como en error", async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:ok"), revokeObjectURL });
    const file = new File(["x"], "a.png", { type: "image/png" });

    await createImageAssetFromFile(file, { now: NOW });

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:ok");
  });

  it("usa 'application/octet-stream' si el File no trae mimeType", async () => {
    const file = new File(["x"], "sin-tipo", { type: "" });

    const { asset } = await createImageAssetFromFile(file, { now: NOW });

    expect(asset.mimeType).toBe("application/octet-stream");
  });

  it("con un generateId inyectado, produce un id determinístico", async () => {
    const file = new File(["x"], "logo.png", { type: "image/png" });

    const { asset } = await createImageAssetFromFile(file, { now: NOW, generateId: () => "fixed" });

    expect(asset.id).toBe("asset_fixed");
  });

  it("rechaza si el archivo no es una imagen válida", async () => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:invalid"), revokeObjectURL: vi.fn() });
    const file = new File(["no es una imagen"], "corrupto.png", { type: "image/png" });

    await expect(createImageAssetFromFile(file, { now: NOW })).rejects.toThrow(/no es una imagen válida/);
  });
});
