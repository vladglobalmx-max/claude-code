import { describe } from "vitest";
import { createMemoryProjectStore } from "./memoryProjectStore.js";
import { testProjectStoreContract } from "./projectStore.contract.js";

describe("createMemoryProjectStore", () => {
  testProjectStoreContract("memoryProjectStore", () => createMemoryProjectStore());
});
