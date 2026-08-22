import { describe, expect, it } from "vitest";
import {
  classifyProductRows,
  normalizeSku,
  parseProductImportRow,
  resolveBusinessUnit,
  type BusinessUnitCandidate,
  type ParsedProductRow,
} from "./import-parsing";

const BUS: BusinessUnitCandidate[] = [
  { id: "bu-1", name: "Thunder LED Lights" },
  { id: "bu-2", name: "The Fire Spot" },
];

describe("parseProductImportRow", () => {
  it("parsea una fila válida completa", () => {
    const { row, error } = parseProductImportRow(1, [
      "Thunder LED Lights",
      "Luminarias",
      "XRL1335I",
      "Luz LED Roja",
      "Descripción de prueba",
      "1500.50",
      "85",
      "Sí",
    ]);
    expect(error).toBeNull();
    expect(row).toEqual({
      rowNumber: 1,
      businessUnitName: "Thunder LED Lights",
      category: "Luminarias",
      sku: "XRL1335I",
      name: "Luz LED Roja",
      description: "Descripción de prueba",
      priceMxn: 1500.5,
      priceUsd: 85,
      active: true,
    });
  });

  it("acepta campos opcionales vacíos (descripción, precios) — Activo default true", () => {
    const { row, error } = parseProductImportRow(2, ["Thunder LED Lights", "Luminarias", "SKU2", "Nombre 2", "", "", "", ""]);
    expect(error).toBeNull();
    expect(row?.description).toBeNull();
    expect(row?.priceMxn).toBeNull();
    expect(row?.priceUsd).toBeNull();
    expect(row?.active).toBe(true);
  });

  it("rechaza Business Unit vacío", () => {
    const { row, error } = parseProductImportRow(3, ["", "Luminarias", "SKU3", "Nombre", "", "", "", ""]);
    expect(row).toBeNull();
    expect(error?.message).toContain("Business Unit");
  });

  it("rechaza Categoría vacía", () => {
    const { row, error } = parseProductImportRow(4, ["Thunder LED Lights", "", "SKU4", "Nombre", "", "", "", ""]);
    expect(row).toBeNull();
    expect(error?.message).toContain("Categoría");
  });

  it("rechaza Modelo/SKU vacío", () => {
    const { row, error } = parseProductImportRow(5, ["Thunder LED Lights", "Luminarias", "", "Nombre", "", "", "", ""]);
    expect(row).toBeNull();
    expect(error?.message).toContain("Modelo / SKU");
  });

  it("rechaza Nombre vacío", () => {
    const { row, error } = parseProductImportRow(6, ["Thunder LED Lights", "Luminarias", "SKU6", "", "", "", "", ""]);
    expect(row).toBeNull();
    expect(error?.message).toContain("Nombre");
  });

  it("rechaza Precio MXN negativo o no numérico", () => {
    expect(parseProductImportRow(7, ["Thunder LED Lights", "Luminarias", "SKU7", "N", "", "-5", "", ""]).error?.message).toContain(
      "Precio MXN"
    );
    expect(parseProductImportRow(8, ["Thunder LED Lights", "Luminarias", "SKU8", "N", "", "abc", "", ""]).error?.message).toContain(
      "Precio MXN"
    );
  });

  it("rechaza Precio USD negativo o no numérico", () => {
    expect(parseProductImportRow(9, ["Thunder LED Lights", "Luminarias", "SKU9", "N", "", "", "-1", ""]).error?.message).toContain(
      "Precio USD"
    );
  });

  it('interpreta "No"/"Inactivo"/"false"/"0" como active=false', () => {
    for (const value of ["No", "Inactivo", "false", "0"]) {
      const { row } = parseProductImportRow(10, ["Thunder LED Lights", "Luminarias", "SKUX", "N", "", "", "", value]);
      expect(row?.active).toBe(false);
    }
  });
});

describe("resolveBusinessUnit", () => {
  it("resuelve por nombre exacto case-insensitive", () => {
    expect(resolveBusinessUnit("thunder led lights", BUS)?.id).toBe("bu-1");
    expect(resolveBusinessUnit("The Fire Spot", BUS)?.id).toBe("bu-2");
  });

  it("devuelve null si no existe", () => {
    expect(resolveBusinessUnit("ABC", BUS)).toBeNull();
  });
});

describe("normalizeSku", () => {
  it("normaliza a mayúsculas sin espacios extremos", () => {
    expect(normalizeSku("  xrl1335i  ")).toBe("XRL1335I");
  });
});

function makeRow(overrides: Partial<ParsedProductRow>): ParsedProductRow {
  return {
    rowNumber: 1,
    businessUnitName: "Thunder LED Lights",
    category: "Luminarias",
    sku: "SKU-A",
    name: "Producto A",
    description: null,
    priceMxn: null,
    priceUsd: null,
    active: true,
    ...overrides,
  };
}

describe("classifyProductRows", () => {
  it("clasifica una fila válida sin duplicados ni errores", () => {
    const result = classifyProductRows([makeRow({})], BUS, []);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]!.businessUnitId).toBe("bu-1");
    expect(result.duplicates).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("marca error si la Business Unit no existe", () => {
    const result = classifyProductRows([makeRow({ businessUnitName: "ABC" })], BUS, []);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0]!.message).toContain('Business Unit "ABC" no existe');
  });

  it("marca posible duplicado contra un SKU ya existente en la base (case-insensitive)", () => {
    const result = classifyProductRows([makeRow({ sku: "xrl1335i" })], BUS, ["XRL1335I"]);
    expect(result.valid).toHaveLength(0);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]!.reason).toBe("existing");
  });

  it("marca posible duplicado si el mismo SKU se repite dentro del mismo archivo", () => {
    const rows = [makeRow({ rowNumber: 1, sku: "DUP1" }), makeRow({ rowNumber: 2, sku: "dup1" })];
    const result = classifyProductRows(rows, BUS, []);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]!.rowNumber).toBe(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]!.rowNumber).toBe(2);
    expect(result.duplicates[0]!.reason).toBe("in_file");
  });

  it("archivo mixto: importa solo las filas válidas, separa duplicados y errores", () => {
    const rows = [
      makeRow({ rowNumber: 1, sku: "OK1" }),
      makeRow({ rowNumber: 2, sku: "OK1" }), // duplicado en archivo
      makeRow({ rowNumber: 3, businessUnitName: "No existe" }), // error
      makeRow({ rowNumber: 4, sku: "OK2" }),
    ];
    const result = classifyProductRows(rows, BUS, ["EXIST-1"]);
    expect(result.valid.map((r) => r.rowNumber)).toEqual([1, 4]);
    expect(result.duplicates.map((r) => r.rowNumber)).toEqual([2]);
    expect(result.errors.map((r) => r.rowNumber)).toEqual([3]);
  });
});
