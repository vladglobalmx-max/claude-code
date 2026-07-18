import { describe, expect, it } from "vitest";
import { AssetIdSchema } from "@impulso/document-schema";
import { addAsset, removeAsset, renameAsset } from "./assetCommands.js";
import { buildProject, buildImageAsset } from "../testUtils/fixtures.js";

describe("addAsset", () => {
  it("agrega un asset al registro del documento", () => {
    const project = buildProject();
    const asset = buildImageAsset("asset_1");
    const result = addAsset(project, { type: "addAsset", asset });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.assets).toEqual([asset]);
    }
  });

  it("rechaza un id de asset duplicado", () => {
    const project = buildProject({
      document: { ...buildProject().document, assets: [buildImageAsset("asset_1")] },
    });
    const result = addAsset(project, { type: "addAsset", asset: buildImageAsset("asset_1") });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("duplicate_asset_id");
    }
  });
});

describe("removeAsset", () => {
  it("elimina un asset existente", () => {
    const project = buildProject({
      document: { ...buildProject().document, assets: [buildImageAsset("asset_1"), buildImageAsset("asset_2")] },
    });
    const result = removeAsset(project, { type: "removeAsset", assetId: AssetIdSchema.parse("asset_1") });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.assets.map((a) => a.id)).toEqual(["asset_2"]);
    }
  });

  it("rechaza un assetId inexistente", () => {
    const project = buildProject();
    const result = removeAsset(project, { type: "removeAsset", assetId: AssetIdSchema.parse("no_existe") });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("asset_not_found");
    }
  });
});

describe("renameAsset", () => {
  it("cambia el name de un asset existente", () => {
    const project = buildProject({
      document: { ...buildProject().document, assets: [buildImageAsset("asset_1", { name: "viejo.png" })] },
    });
    const result = renameAsset(project, {
      type: "renameAsset",
      assetId: AssetIdSchema.parse("asset_1"),
      name: "nuevo.png",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document.assets[0]?.name).toBe("nuevo.png");
    }
  });

  it("rechaza un assetId inexistente", () => {
    const project = buildProject();
    const result = renameAsset(project, {
      type: "renameAsset",
      assetId: AssetIdSchema.parse("no_existe"),
      name: "x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("asset_not_found");
    }
  });
});
