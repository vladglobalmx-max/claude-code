import { describe, expect, it } from "vitest";

import { detectDuplicateCustomers, parseCustomerImportRows } from "@/lib/imports/customers";

function validRecord(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    businessUnitCode: "GFB",
    legalName: "Cliente de Prueba S.A. de C.V.",
    tradeName: "",
    taxId: "",
    industry: "",
    segment: "",
    notes: "",
    ...overrides,
  };
}

describe("parseCustomerImportRows (Módulo 14)", () => {
  it("accepts a fully valid row and normalizes blanks to null", () => {
    const [result] = parseCustomerImportRows([validRecord()]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.legalName).toBe("Cliente de Prueba S.A. de C.V.");
      expect(result.data.taxId).toBeNull();
    }
  });

  it("rejects a legal name shorter than 3 characters", () => {
    const [result] = parseCustomerImportRows([validRecord({ legalName: "AB" })]);
    expect(result.ok).toBe(false);
  });

  it("rejects a missing business unit code", () => {
    const [result] = parseCustomerImportRows([validRecord({ businessUnitCode: "" })]);
    expect(result.ok).toBe(false);
  });

  it("numbers rows starting at 2", () => {
    const results = parseCustomerImportRows([validRecord(), validRecord()]);
    expect(results.map((r) => r.rowNumber)).toEqual([2, 3]);
  });
});

describe("detectDuplicateCustomers", () => {
  const noExisting = { taxIds: new Set<string>(), legalNames: new Set<string>() };

  it("flags a row whose tax id already exists, even if the legal name differs", () => {
    const duplicates = detectDuplicateCustomers(
      [{ rowNumber: 2, businessUnitCode: "GFB", legalName: "Nuevo Nombre", taxId: "abc123" }],
      { taxIds: new Set(["ABC123"]), legalNames: new Set() },
    );
    expect(duplicates).toEqual([{ rowNumber: 2 }]);
  });

  it("flags a row whose legal name already exists, even without a tax id on either side", () => {
    const duplicates = detectDuplicateCustomers(
      [{ rowNumber: 2, businessUnitCode: "GFB", legalName: "Cliente Repetido", taxId: null }],
      { taxIds: new Set(), legalNames: new Set(["CLIENTE REPETIDO"]) },
    );
    expect(duplicates).toEqual([{ rowNumber: 2 }]);
  });

  it("flags a row whose legal name matches an existing customer that does have a tax id on file", () => {
    // Un cliente ya capturado con RFC debe detectarse por nombre aunque el
    // archivo nuevo no traiga RFC — no hay una sola clave combinada.
    const duplicates = detectDuplicateCustomers(
      [{ rowNumber: 2, businessUnitCode: "GFB", legalName: "Distribuidora Higiene del Norte", taxId: null }],
      { taxIds: new Set(["DHN890512AB1"]), legalNames: new Set(["DISTRIBUIDORA HIGIENE DEL NORTE"]) },
    );
    expect(duplicates).toEqual([{ rowNumber: 2 }]);
  });

  it("flags the second occurrence within the same file, not the first", () => {
    const row = { businessUnitCode: "GFB", legalName: "Duplicado S.A.", taxId: null };
    const duplicates = detectDuplicateCustomers(
      [
        { rowNumber: 2, ...row },
        { rowNumber: 3, ...row },
      ],
      noExisting,
    );
    expect(duplicates.map((d) => d.rowNumber)).toEqual([3]);
  });

  it("does not flag a genuinely new customer", () => {
    const duplicates = detectDuplicateCustomers(
      [{ rowNumber: 2, businessUnitCode: "GFB", legalName: "Cliente Nuevo", taxId: null }],
      noExisting,
    );
    expect(duplicates).toEqual([]);
  });
});
