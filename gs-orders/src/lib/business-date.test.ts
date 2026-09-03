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

// THÖREN 7C — organizations.timezone (0053): una organización en otra zona
// horaria (Org B) debe generar su fecha de negocio con SU hora local, no la
// de Monterrey (Org A, el default). Asia/Tokyo (UTC+9, sin horario de
// verano) se usa como Org B por ser claramente distinta de Monterrey
// (UTC-6) y no tener ambigüedad de DST que complique el caso de prueba.
describe("getBusinessToday con timezone explícito (THÖREN 7C — multi-tenant)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Org A (America/Monterrey) y Org B (Asia/Tokyo) ven días distintos en el mismo instante", () => {
    vi.useFakeTimers();
    // 2026-08-13T06:01:00Z -> Monterrey (UTC-6): 2026-08-13 00:01 -> "2026-08-13"
    //                       -> Tokyo (UTC+9): 2026-08-13 15:01 -> "2026-08-13" (mismo día, no útil)
    // Se usa un instante donde SÍ difieren: 2026-08-13T16:00:00Z
    //   Monterrey (UTC-6): 2026-08-13 10:00 -> "2026-08-13"
    //   Tokyo (UTC+9):     2026-08-14 01:00 -> "2026-08-14"
    vi.setSystemTime(new Date("2026-08-13T16:00:00Z"));
    expect(getBusinessToday("America/Monterrey")).toBe("2026-08-13");
    expect(getBusinessToday("Asia/Tokyo")).toBe("2026-08-14");
  });

  it("cambio de día en frontera UTC para Org B (Asia/Tokyo) — nunca se adelanta/atrasa por error", () => {
    vi.useFakeTimers();
    // 2026-08-13 23:59 Tokyo = 2026-08-13T14:59:00Z
    vi.setSystemTime(new Date("2026-08-13T14:59:00Z"));
    expect(getBusinessToday("Asia/Tokyo")).toBe("2026-08-13");

    // 2026-08-14 00:01 Tokyo = 2026-08-13T15:01:00Z
    vi.setSystemTime(new Date("2026-08-13T15:01:00Z"));
    expect(getBusinessToday("Asia/Tokyo")).toBe("2026-08-14");
  });

  it("sin argumento, sigue usando DEFAULT_BUSINESS_TIMEZONE (America/Monterrey) — compatibilidad con llamadas existentes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T16:00:00Z"));
    expect(getBusinessToday()).toBe(getBusinessToday("America/Monterrey"));
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

  it("CASO F (THÖREN 7C): Org B (Asia/Tokyo) ya cruzó a septiembre cuando Org A (Monterrey) sigue en agosto", () => {
    vi.useFakeTimers();
    // 2026-08-31T16:00:00Z -> Monterrey (UTC-6): 2026-08-31 10:00 (agosto)
    //                       -> Tokyo (UTC+9):    2026-09-01 01:00 (ya septiembre)
    vi.setSystemTime(new Date("2026-08-31T16:00:00Z"));
    expect(getBusinessMonthRange(0, "America/Monterrey")).toEqual({ start: "2026-08-01", end: "2026-09-01" });
    expect(getBusinessMonthRange(0, "Asia/Tokyo")).toEqual({ start: "2026-09-01", end: "2026-10-01" });
  });
});
