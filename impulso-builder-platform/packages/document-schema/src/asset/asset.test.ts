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
    expect(asset.width).toBe(512);
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
    expect(asset.fontFamily).toBe("Inter");
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
});
