import { describe, expect, it } from "vitest";
import { isBusinessUnitAllowedForPerson } from "./business-unit-assignment";

describe("isBusinessUnitAllowedForPerson", () => {
  it("transición segura: sin ninguna asignación, cualquier Business Unit pasa", () => {
    expect(isBusinessUnitAllowedForPerson("bu-1", [])).toBe(true);
    expect(isBusinessUnitAllowedForPerson("bu-anything", [])).toBe(true);
  });

  it("con asignaciones, solo las asignadas pasan", () => {
    expect(isBusinessUnitAllowedForPerson("bu-1", ["bu-1", "bu-2"])).toBe(true);
    expect(isBusinessUnitAllowedForPerson("bu-2", ["bu-1", "bu-2"])).toBe(true);
    expect(isBusinessUnitAllowedForPerson("bu-3", ["bu-1", "bu-2"])).toBe(false);
  });

  it("con una sola asignación, solo esa pasa", () => {
    expect(isBusinessUnitAllowedForPerson("bu-1", ["bu-1"])).toBe(true);
    expect(isBusinessUnitAllowedForPerson("bu-2", ["bu-1"])).toBe(false);
  });
});
