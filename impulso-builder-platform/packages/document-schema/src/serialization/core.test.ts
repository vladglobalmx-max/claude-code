import { describe, expect, it } from "vitest";
import {
  validateWithSchema,
  serializeWithSchema,
  deserializeWithSchema,
  cloneWithSchema,
} from "./core.js";
import { StyleSchema } from "../style/style.js";

describe("funciones genéricas validate/serialize/deserialize/clone", () => {
  it("funcionan sobre CUALQUIER esquema del paquete, no solo Document/Project", () => {
    const style = validateWithSchema(StyleSchema, { fill: "#00ff00", opacity: 0.5 });
    const json = serializeWithSchema(StyleSchema, style);
    const roundTripped = deserializeWithSchema(StyleSchema, json);
    expect(roundTripped).toEqual(style);
  });

  it("clone produce un valor igual pero no la misma referencia", () => {
    const style = validateWithSchema(StyleSchema, { fill: "#00ff00" });
    const cloned = cloneWithSchema(StyleSchema, style);
    expect(cloned).toEqual(style);
    expect(cloned).not.toBe(style);
  });

  it("validate rechaza datos que no cumplen el esquema", () => {
    expect(() => validateWithSchema(StyleSchema, { opacity: 5 })).toThrow();
  });
});
