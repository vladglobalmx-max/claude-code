import { describe } from "vitest";
import { createMemoryTemplateStore } from "./memoryTemplateStore.js";
import { testTemplateStoreContract } from "./templateStore.contract.js";

describe("createMemoryTemplateStore", () => {
  testTemplateStoreContract("memory", () => createMemoryTemplateStore());
});
