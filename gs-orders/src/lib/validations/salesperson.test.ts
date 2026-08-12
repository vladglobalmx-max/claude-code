import { describe, expect, it } from "vitest";
import { salespersonSchema } from "./salesperson";

describe("salespersonSchema — prefix", () => {
  it("convierte el prefijo a MAYÚSCULAS", () => {
    const result = salespersonSchema.safeParse({ name: "Vladimir Peña", prefix: "vpt" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.prefix).toBe("VPT");
  });

  it("elimina espacios del prefijo", () => {
    const result = salespersonSchema.safeParse({ name: "Vladimir Peña", prefix: " v p t " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.prefix).toBe("VPT");
  });

  it("rechaza un prefijo vacío", () => {
    const result = salespersonSchema.safeParse({ name: "Vladimir Peña", prefix: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza un prefijo de más de 5 caracteres", () => {
    const result = salespersonSchema.safeParse({ name: "Vladimir Peña", prefix: "ABCDEF" });
    expect(result.success).toBe(false);
  });

  it("acepta hasta 5 caracteres", () => {
    const result = salespersonSchema.safeParse({ name: "Vladimir Peña", prefix: "ABCDE" });
    expect(result.success).toBe(true);
  });

  it("rechaza caracteres que no sean letras o números", () => {
    const result = salespersonSchema.safeParse({ name: "Vladimir Peña", prefix: "VP-T" });
    expect(result.success).toBe(false);
  });
});
