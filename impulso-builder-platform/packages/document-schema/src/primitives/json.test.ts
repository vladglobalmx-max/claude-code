import { describe, expect, it } from "vitest";
import { JsonValueSchema } from "./json.js";

describe("JsonValueSchema", () => {
  it("acepta primitivos, arrays y objetos anidados arbitrariamente", () => {
    const value = {
      a: 1,
      b: "texto",
      c: true,
      d: null,
      e: [1, "dos", { f: [null, { g: 3 }] }],
    };
    expect(JsonValueSchema.parse(value)).toEqual(value);
  });

  it("rechaza valores no serializables como undefined", () => {
    expect(() => JsonValueSchema.parse(undefined)).toThrow();
  });

  it("rechaza funciones", () => {
    expect(() => JsonValueSchema.parse(() => {})).toThrow();
  });
});
