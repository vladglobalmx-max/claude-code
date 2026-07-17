import { describe, expect, it } from "vitest";
import { engineError, ok, err } from "./engineError.js";

describe("engineError", () => {
  it("construye un error con code y message", () => {
    expect(engineError("object_not_found", "no existe")).toEqual({
      code: "object_not_found",
      message: "no existe",
    });
  });
});

describe("ok/err", () => {
  it("ok envuelve un valor exitoso", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it("err envuelve un error", () => {
    const error = engineError("invalid_command", "malformado");
    expect(err(error)).toEqual({ ok: false, error });
  });
});
