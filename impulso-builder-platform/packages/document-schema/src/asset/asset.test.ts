import { describe, expect, it } from "vitest";
import { AssetSchema } from "./asset.js";
import { AssetIdSchema } from "../primitives/identifiers.js";

const NOW = "2026-07-17T00:00:00.000Z";
const baseMetadata = { createdAt: NOW, updatedAt: NOW };

describe("AssetSchema", () => {
  it("valida un asset de imagen con width/height", () => {
    const asset = AssetSchema.parse({
      id: AssetIdSchema.parse("asset_1"),
      type: "image",
      name: "logo.png",
      mimeType: "image/png",
      width: 512,
      height: 512,
      metadata: baseMetadata,
    });
    expect(asset.type === "image" && asset.width).toBe(512);
  });

  it("rechaza un asset de imagen sin width/height", () => {
    expect(() =>
      AssetSchema.parse({
        id: AssetIdSchema.parse("asset_1"),
        type: "image",
        name: "logo.png",
        mimeType: "image/png",
        metadata: baseMetadata,
      }),
    ).toThrow(/width/);
  });

  it("valida un asset de fuente con fontFamily", () => {
    const asset = AssetSchema.parse({
      id: AssetIdSchema.parse("asset_2"),
      type: "font",
      name: "Inter Bold",
      mimeType: "font/ttf",
      fontFamily: "Inter",
      metadata: baseMetadata,
    });
    expect(asset.type === "font" && asset.fontFamily).toBe("Inter");
  });

  it("rechaza un asset de fuente sin fontFamily", () => {
    expect(() =>
      AssetSchema.parse({
        id: AssetIdSchema.parse("asset_2"),
        type: "font",
        name: "Inter Bold",
        mimeType: "font/ttf",
        metadata: baseMetadata,
      }),
    ).toThrow(/fontFamily/);
  });

  it("rechaza un type desconocido, no declarado como ninguna variante de la unión", () => {
    expect(() =>
      AssetSchema.parse({
        id: AssetIdSchema.parse("asset_3"),
        type: "template",
        name: "Plantilla",
        mimeType: "application/json",
        metadata: baseMetadata,
      }),
    ).toThrow();
  });

  it("pluginData/customProperties tienen default (mismo patrón que SceneObjectBase)", () => {
    const asset = AssetSchema.parse({
      id: AssetIdSchema.parse("asset_4"),
      type: "image",
      name: "logo.png",
      mimeType: "image/png",
      width: 10,
      height: 10,
      metadata: baseMetadata,
    });
    expect(asset.pluginData).toEqual({});
    expect(asset.customProperties).toEqual({});
  });
});
