import { afterEach, describe, expect, it, vi } from "vitest";
import { getBusinessToday, getBusinessMonthRange } from "./business-date";

// Monterrey es UTC-6 todo el año (México eliminó el horario de verano en
// la franja fronteriza/general relevante aquí desde 2022) — se fija con
// vi.setSystemTime() en vez de mockear Intl, para probar el comportamiento
// real de Intl.DateTimeFormat con el timezone America/Monterrey.
describe("getBusinessToday", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("CASO A: 12/08/2026 18:00 Monterrey (13/08/2026 00:00 UTC) -> 2026-08-12", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T00:00:00Z"));
    expect(getBusinessToday()).toBe("2026-08-12");
  });

  it("CASO B: 12/08/2026 23:59 Monterrey (13/08/2026 05:59 UTC) -> 2026-08-12, nunca 2026-08-13", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T05:59:00Z"));
    expect(getBusinessToday()).toBe("2026-08-12");
  });

  it("CASO C: 13/08/2026 00:01 Monterrey (13/08/2026 06:01 UTC) -> 2026-08-13", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T06:01:00Z"));
    expect(getBusinessToday()).toBe("2026-08-13");
  });

  it("mediodía UTC (sin ambigüedad de día) coincide en ambos timezones", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T18:00:00Z"));
    expect(getBusinessToday()).toBe("2026-08-12");
  });
});

describe("getBusinessMonthRange (THÖREN Experience 1B — KPIs de Dashboard)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("CASO A: mes actual (monthsAgo=0) -> [primer día del mes, primer día del siguiente)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T18:00:00Z")); // 2026-08-13 en Monterrey
    expect(getBusinessMonthRange(0)).toEqual({ start: "2026-08-01", end: "2026-09-01" });
  });

  it("CASO B: mes anterior (monthsAgo=1) dentro del mismo año", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T18:00:00Z"));
    expect(getBusinessMonthRange(1)).toEqual({ start: "2026-07-01", end: "2026-08-01" });
  });

  it("CASO C: mes anterior cruzando fin de año (enero -> diciembre del año previo)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-13T18:00:00Z"));
    expect(getBusinessMonthRange(1)).toEqual({ start: "2025-12-01", end: "2026-01-01" });
  });

  it("CASO D: diciembre -> el mes siguiente (end) cruza a enero del año próximo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-13T18:00:00Z"));
    expect(getBusinessMonthRange(0)).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });

  it("CASO E: fin de mes en Monterrey (23:59) no adelanta el rango un día por UTC", () => {
    vi.useFakeTimers();
    // 2026-08-31 23:59 Monterrey = 2026-09-01 05:59 UTC
    vi.setSystemTime(new Date("2026-09-01T05:59:00Z"));
    expect(getBusinessMonthRange(0)).toEqual({ start: "2026-08-01", end: "2026-09-01" });
  });
});
