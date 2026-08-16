import { describe, expect, it } from "vitest";
import { createQuoteSequenceSchema, updateQuoteSequenceSchema } from "./quote-sequence";

const VALID_UUID_1 = "11111111-1111-1111-1111-111111111111";
const VALID_UUID_2 = "22222222-2222-2222-2222-222222222222";

describe("createQuoteSequenceSchema — quote_prefix", () => {
  it("convierte el prefijo a MAYÚSCULAS", () => {
    const result = createQuoteSequenceSchema.safeParse({
      salesperson_id: VALID_UUID_1,
      business_unit_id: VALID_UUID_2,
      quote_prefix: "kst-q",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.quote_prefix).toBe("KST-Q");
  });

  it("elimina espacios del prefijo", () => {
    const result = createQuoteSequenceSchema.safeParse({
      salesperson_id: VALID_UUID_1,
      business_unit_id: VALID_UUID_2,
      quote_prefix: " k s t ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.quote_prefix).toBe("KST");
  });

  it("rechaza un prefijo vacío", () => {
    const result = createQuoteSequenceSchema.safeParse({
      salesperson_id: VALID_UUID_1,
      business_unit_id: VALID_UUID_2,
      quote_prefix: "",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un prefijo de más de 20 caracteres", () => {
    const result = createQuoteSequenceSchema.safeParse({
      salesperson_id: VALID_UUID_1,
      business_unit_id: VALID_UUID_2,
      quote_prefix: "ABCDEFGHIJKLMNOPQRSTU",
    });
    expect(result.success).toBe(false);
  });

  it("acepta hasta 20 caracteres", () => {
    const result = createQuoteSequenceSchema.safeParse({
      salesperson_id: VALID_UUID_1,
      business_unit_id: VALID_UUID_2,
      quote_prefix: "ABCDEFGHIJKLMNOPQRST",
    });
    expect(result.success).toBe(true);
  });

  it("acepta guiones (a diferencia del prefijo de Orders)", () => {
    const result = createQuoteSequenceSchema.safeParse({
      salesperson_id: VALID_UUID_1,
      business_unit_id: VALID_UUID_2,
      quote_prefix: "VLAD-T",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza caracteres fuera de A-Z, 0-9 y guion", () => {
    const result = createQuoteSequenceSchema.safeParse({
      salesperson_id: VALID_UUID_1,
      business_unit_id: VALID_UUID_2,
      quote_prefix: "VP_T",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un salesperson_id que no es UUID", () => {
    const result = createQuoteSequenceSchema.safeParse({
      salesperson_id: "no-es-uuid",
      business_unit_id: VALID_UUID_2,
      quote_prefix: "VPT",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateQuoteSequenceSchema", () => {
  it("no expone sequence_current — solo prefijo y activo", () => {
    const result = updateQuoteSequenceSchema.safeParse({ quote_prefix: "VPT", active: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).sort()).toEqual(["active", "quote_prefix"]);
    }
  });
});
