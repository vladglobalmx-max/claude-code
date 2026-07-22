import { describe, expect, it } from "vitest";
import {
  capabilityCheckResultSchema,
  parseCapabilityId,
  safeParseCapabilityId,
} from "./capability.js";

describe("capabilityIdSchema", () => {
  it("acepta un CapabilityId de namespace punteado", () => {
    expect(parseCapabilityId("print.professional")).toBe("print.professional");
  });

  it("acepta cualquier string no vacío (namespace abierto, no un enum cerrado)", () => {
    expect(parseCapabilityId("una-feature-futura-no-anticipada")).toBe(
      "una-feature-futura-no-anticipada",
    );
  });

  it("rechaza un string vacío", () => {
    const result = safeParseCapabilityId("");
    expect(result.success).toBe(false);
  });

  it("rechaza un valor no-string", () => {
    const result = safeParseCapabilityId(42);
    expect(result.success).toBe(false);
  });
});

describe("capabilityCheckResultSchema", () => {
  it("acepta un resultado concedido", () => {
    const result = capabilityCheckResultSchema.parse({
      granted: true,
      reason: "included",
    });
    expect(result).toEqual({ granted: true, reason: "included" });
  });

  it("acepta cada motivo válido de la enumeración", () => {
    for (const reason of ["included", "not-entitled", "expired", "unknown"] as const) {
      expect(
        capabilityCheckResultSchema.safeParse({ granted: false, reason }).success,
      ).toBe(true);
    }
  });

  it("rechaza un motivo fuera de la enumeración", () => {
    const result = capabilityCheckResultSchema.safeParse({
      granted: true,
      reason: "made-up-reason",
    });
    expect(result.success).toBe(false);
  });
});
