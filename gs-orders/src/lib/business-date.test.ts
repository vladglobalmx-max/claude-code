import { afterEach, describe, expect, it, vi } from "vitest";
import { getBusinessToday } from "./business-date";

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
