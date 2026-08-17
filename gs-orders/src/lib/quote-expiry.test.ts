import { describe, expect, it } from "vitest";
import { isQuoteExpired } from "./quote-expiry";

describe("isQuoteExpired", () => {
  it("enviada con vigencia pasada -> vencida", () => {
    expect(isQuoteExpired({ status: "enviada", valid_until: "2026-01-01" }, "2026-06-01")).toBe(true);
  });

  it("enviada con vigencia futura -> no vencida", () => {
    expect(isQuoteExpired({ status: "enviada", valid_until: "2026-12-01" }, "2026-06-01")).toBe(false);
  });

  it("enviada con vigencia == hoy -> no vencida (todavía vigente ese día)", () => {
    expect(isQuoteExpired({ status: "enviada", valid_until: "2026-06-01" }, "2026-06-01")).toBe(false);
  });

  it("borrador con vigencia pasada -> NO vencida (sigue en captura)", () => {
    expect(isQuoteExpired({ status: "borrador", valid_until: "2026-01-01" }, "2026-06-01")).toBe(false);
  });

  it("aceptada con vigencia pasada -> NO vencida (desenlace ya decidido)", () => {
    expect(isQuoteExpired({ status: "aceptada", valid_until: "2026-01-01" }, "2026-06-01")).toBe(false);
  });

  it("rechazada con vigencia pasada -> NO vencida", () => {
    expect(isQuoteExpired({ status: "rechazada", valid_until: "2026-01-01" }, "2026-06-01")).toBe(false);
  });

  it("cancelada con vigencia pasada -> NO vencida", () => {
    expect(isQuoteExpired({ status: "cancelada", valid_until: "2026-01-01" }, "2026-06-01")).toBe(false);
  });
});
