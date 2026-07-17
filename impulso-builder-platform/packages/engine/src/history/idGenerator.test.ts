import { describe, expect, it } from "vitest";
import { createIncrementingIdGenerator } from "./idGenerator.js";

describe("createIncrementingIdGenerator", () => {
  it("genera IDs secuenciales con el prefijo dado", () => {
    const generate = createIncrementingIdGenerator("history");
    expect(generate()).toBe("history_1");
    expect(generate()).toBe("history_2");
    expect(generate()).toBe("history_3");
  });

  it("cada generador tiene su propio contador independiente", () => {
    const a = createIncrementingIdGenerator("a");
    const b = createIncrementingIdGenerator("b");
    expect(a()).toBe("a_1");
    expect(b()).toBe("b_1");
    expect(a()).toBe("a_2");
  });
});
