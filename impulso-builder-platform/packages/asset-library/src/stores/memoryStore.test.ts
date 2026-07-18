import { describe } from "vitest";
import { createMemoryAssetStore } from "./memoryStore.js";
import { testAssetBinaryStoreContract } from "./assetBinaryStore.contract.js";

describe("createMemoryAssetStore", () => {
  testAssetBinaryStoreContract("memoryStore", () => createMemoryAssetStore());
});
