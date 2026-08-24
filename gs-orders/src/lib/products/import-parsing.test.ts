import { describe, expect, it } from "vitest";
import {
  ALL_BUSINESS_UNITS_KEYWORD,
  canonicalize,
  classifyProductRows,
  formatBusinessUnitCell,
  normalizeSku,
  parseProductImportRow,
  resolveByName,
  type ExistingProductRow,
  type ParsedProductRow,
} from "./import-parsing";

describe("canonicalize", () => {
  it("normaliza acentos, mayúsculas y espacios múltiples de forma consistente", () => {
    expect(canonicalize("  Proyector / GOBO  ")).toBe("proyector / gobo");
    expect(canonicalize("Iluminación")).toBe("iluminacion");
    expect(canonicalize("ILUMINACIÓN")).toBe("iluminacion");
    expect(canonicalize("Thunder   LED    Lights")).toBe("thunder led lights");
  });

  it("dos variantes con distinto acento/mayúscula/espacio producen la misma clave", () => {
    expect(canonicalize("Camión")).toBe(canonicalize("CAMION"));
    expect(canonicalize(" Camión ")).toBe(canonicalize("camión"));
  });
});

describe("resolveByName", () => {
  const candidates = [
    { id: "1", name: "Thunder LED Lights" },
    { id: "2", name: "Got Fresh Breath Mexico" },
  ];

  it("resuelve por nombre exacto tras normalizar (case/acentos/espacios)", () => {
    expect(resolveByName("thunder led lights", candidates)?.id).toBe("1");
    expect(resolveByName("  THUNDER   LED LIGHTS  ", candidates)?.id).toBe("1");
  });

  it("NO resuelve nombres parecidos pero distintos (sin matching aproximado)", () => {
    expect(resolveByName("Thunder LED Light", candidates)).toBeNull();
    expect(resolveByName("Thunder LED Lightss", candidates)).toBeNull();
  });

  it("nombre inexistente devuelve null", () => {
    expect(resolveByName("No existe", candidates)).toBeNull();
  });
});

describe("parseProductImportRow", () => {
  function row(overrides: Partial<Record<string, unknown>> = {}) {
    const base = {
      sku: "TP-001",
      name: "Producto de prueba",
      description: "desc",
      businessUnit: "Thunder LED Lights",
      productType: "Proyector / GOBO",
      brand: "ACME",
      model: "X1",
      unit: "pza",
      currency: "MXN",
      price: "100.50",
      active: "SI",
    };
    const merged = { ...base, ...overrides };
    return [
      merged.sku,
      merged.name,
      merged.description,
      merged.businessUnit,
      merged.productType,
      merged.brand,
      merged.model,
      merged.unit,
      merged.currency,
      merged.price,
      merged.active,
    ];
  }

  it("parsea una fila válida completa", () => {
    const { row: parsed, error } = parseProductImportRow(1, row());
    expect(error).toBeNull();
    expect(parsed).toMatchObject({
      sku: "TP-001",
      name: "Producto de prueba",
      businessUnitNames: ["Thunder LED Lights"],
      productTypeName: "Proyector / GOBO",
      currency: "MXN",
      basePrice: 100.5,
      active: true,
    });
  });

  it("SKU vacío es error", () => {
    const { row: parsed, error } = parseProductImportRow(2, row({ sku: "" }));
    expect(parsed).toBeNull();
    expect(error?.message).toContain("SKU");
  });

  it("Nombre vacío es error", () => {
    const { error } = parseProductImportRow(3, row({ name: "" }));
    expect(error?.message).toContain("Nombre");
  });

  it("Business Unit vacía es error", () => {
    const { error } = parseProductImportRow(4, row({ businessUnit: "" }));
    expect(error?.message).toContain("Business Unit");
  });

  it("Tipo de producto vacío es error", () => {
    const { error } = parseProductImportRow(5, row({ productType: "" }));
    expect(error?.message).toContain("Tipo de producto");
  });

  it("Moneda vacía es error", () => {
    const { error } = parseProductImportRow(6, row({ currency: "" }));
    expect(error?.message).toContain("Moneda");
  });

  it("Moneda inválida (ni MXN ni USD) es error", () => {
    const { error } = parseProductImportRow(7, row({ currency: "EUR" }));
    expect(error?.message).toContain("Moneda");
  });

  it("Moneda es case-insensitive (mxn/usd minúsculas también válidas)", () => {
    const { row: parsed, error } = parseProductImportRow(8, row({ currency: "usd" }));
    expect(error).toBeNull();
    expect(parsed?.currency).toBe("USD");
  });

  it("Precio no numérico es error", () => {
    const { error } = parseProductImportRow(9, row({ price: "abc" }));
    expect(error?.message).toContain("Precio base");
  });

  it("Precio negativo es error", () => {
    const { error } = parseProductImportRow(10, row({ price: "-5" }));
    expect(error?.message).toContain("Precio base");
  });

  it("Precio vacío es válido (opcional, queda null)", () => {
    const { row: parsed, error } = parseProductImportRow(11, row({ price: "" }));
    expect(error).toBeNull();
    expect(parsed?.basePrice).toBeNull();
  });

  it("Activo vacío default es true", () => {
    const { row: parsed } = parseProductImportRow(12, row({ active: "" }));
    expect(parsed?.active).toBe(true);
  });

  it('Activo="NO" se interpreta como false', () => {
    const { row: parsed } = parseProductImportRow(13, row({ active: "NO" }));
    expect(parsed?.active).toBe(false);
  });

  it('Activo="Inactivo" (case-insensitive) se interpreta como false', () => {
    const { row: parsed } = parseProductImportRow(14, row({ active: "inactivo" }));
    expect(parsed?.active).toBe(false);
  });

  it("espacios extremos en SKU/Nombre se recortan", () => {
    const { row: parsed } = parseProductImportRow(15, row({ sku: "  TP-002  ", name: "  Nombre con espacios  " }));
    expect(parsed?.sku).toBe("TP-002");
    expect(parsed?.name).toBe("Nombre con espacios");
  });

  it('Business Unit "TODAS" se parsea como sentinela null (compartido con todas)', () => {
    const { row: parsed, error } = parseProductImportRow(16, row({ businessUnit: "TODAS" }));
    expect(error).toBeNull();
    expect(parsed?.businessUnitNames).toBeNull();
  });

  it('Business Unit "TODAS" es case/acento/espacio-insensitive', () => {
    const { row: parsed, error } = parseProductImportRow(17, row({ businessUnit: "  todas  " }));
    expect(error).toBeNull();
    expect(parsed?.businessUnitNames).toBeNull();
  });

  it("Business Unit con 2 unidades separadas por | se parsea como lista de 2", () => {
    const { row: parsed, error } = parseProductImportRow(18, row({ businessUnit: "Thunder LED Lights | Thunder Safety Solutions" }));
    expect(error).toBeNull();
    expect(parsed?.businessUnitNames).toEqual(["Thunder LED Lights", "Thunder Safety Solutions"]);
  });

  it("Business Unit con 3 unidades separadas por | se parsea como lista de 3", () => {
    const { row: parsed, error } = parseProductImportRow(
      19,
      row({ businessUnit: "Thunder LED Lights | Thunder Safety Solutions | Juno Promotional" })
    );
    expect(error).toBeNull();
    expect(parsed?.businessUnitNames).toEqual(["Thunder LED Lights", "Thunder Safety Solutions", "Juno Promotional"]);
  });

  it("espacios variables alrededor de | se recortan (sin espacio, con espacio, mixto)", () => {
    const { row: parsed, error } = parseProductImportRow(20, row({ businessUnit: "Thunder LED Lights|Thunder Safety Solutions" }));
    expect(error).toBeNull();
    expect(parsed?.businessUnitNames).toEqual(["Thunder LED Lights", "Thunder Safety Solutions"]);
  });

  it("Business Unit repetida dentro de la misma celda (con distinto acento/mayúscula) se colapsa a una sola entrada", () => {
    const { row: parsed, error } = parseProductImportRow(21, row({ businessUnit: "Thunder LED Lights | THUNDER   LED lights | thunder led lights" }));
    expect(error).toBeNull();
    expect(parsed?.businessUnitNames).toHaveLength(1);
  });

  it('"TODAS" combinada con Business Units específicas es error', () => {
    const { error } = parseProductImportRow(22, row({ businessUnit: "TODAS | Thunder LED Lights" }));
    expect(error?.message).toContain("TODAS");
  });

  it("segmentos vacíos por | sobrante (doble pipe) se ignoran, no son error", () => {
    const { row: parsed, error } = parseProductImportRow(23, row({ businessUnit: "Thunder LED Lights || Juno Promotional" }));
    expect(error).toBeNull();
    expect(parsed?.businessUnitNames).toEqual(["Thunder LED Lights", "Juno Promotional"]);
  });
});

describe("normalizeSku", () => {
  it("normaliza a mayúsculas sin espacios extremos", () => {
    expect(normalizeSku("  tp-001  ")).toBe("TP-001");
  });
});

describe("formatBusinessUnitCell", () => {
  it("[] formatea a TODAS", () => {
    expect(formatBusinessUnitCell([])).toBe(ALL_BUSINESS_UNITS_KEYWORD);
  });

  it("1 nombre formatea al nombre tal cual", () => {
    expect(formatBusinessUnitCell(["Thunder LED Lights"])).toBe("Thunder LED Lights");
  });

  it("2+ nombres formatean unidos por ' | ', ordenados de forma determinística", () => {
    expect(formatBusinessUnitCell(["Thunder Safety Solutions", "Thunder LED Lights"])).toBe(
      "Thunder LED Lights | Thunder Safety Solutions"
    );
    // El orden de entrada no debe importar — mismo resultado sin importar cómo llegaron.
    expect(formatBusinessUnitCell(["Thunder LED Lights", "Thunder Safety Solutions"])).toBe(
      "Thunder LED Lights | Thunder Safety Solutions"
    );
  });

  it("round-trip exportar → reimportar produce el mismo texto (orden estable)", () => {
    const names = ["Juno Promotional", "Thunder LED Lights", "GTX Systems"];
    const formatted = formatBusinessUnitCell(names);
    const { row: parsed } = parseProductImportRow(1, [
      "SKU",
      "Nombre",
      "",
      formatted,
      "Tipo",
      "",
      "",
      "",
      "MXN",
      "",
      "SI",
    ]);
    // Reformatear los nombres ya parseados debe dar EXACTAMENTE el mismo texto.
    expect(formatBusinessUnitCell(parsed!.businessUnitNames!)).toBe(formatted);
  });
});

describe("classifyProductRows", () => {
  const businessUnits = [
    { id: "bu-1", name: "Thunder LED Lights" },
    { id: "bu-2", name: "Thunder Safety Solutions" },
    { id: "bu-3", name: "Juno Promotional" },
  ];
  const productTypes = [{ id: "pt-1", name: "Proyector / GOBO" }];

  function parsedRow(overrides: Partial<ParsedProductRow> = {}): ParsedProductRow {
    return {
      rowNumber: 1,
      sku: "TP-001",
      name: "Producto",
      description: "desc",
      businessUnitNames: ["Thunder LED Lights"],
      productTypeName: "Proyector / GOBO",
      brand: "ACME",
      model: "X1",
      unit: "pza",
      currency: "MXN",
      basePrice: 100,
      active: true,
      ...overrides,
    };
  }

  function existingRow(overrides: Partial<ExistingProductRow> = {}): ExistingProductRow {
    return {
      id: "existing-1",
      sku: "TP-001",
      name: "Producto",
      description: "desc",
      productTypeId: "pt-1",
      brand: "ACME",
      model: "X1",
      unit: "pza",
      currency: "MXN",
      basePrice: 100,
      active: true,
      businessUnitIds: ["bu-1"],
      ...overrides,
    };
  }

  it("SKU nuevo (no existe en DB) se clasifica NUEVO", () => {
    const { classified, errors } = classifyProductRows([parsedRow()], businessUnits, productTypes, []);
    expect(errors).toHaveLength(0);
    expect(classified[0]!.classification).toBe("new");
  });

  it("SKU existente idéntico en todos los campos se clasifica SIN CAMBIOS", () => {
    const { classified } = classifyProductRows([parsedRow()], businessUnits, productTypes, [existingRow()]);
    expect(classified[0]!.classification).toBe("unchanged");
    expect(classified[0]!.changedFields).toHaveLength(0);
  });

  it("SKU existente con un campo distinto se clasifica ACTUALIZAR y lista el campo cambiado", () => {
    const { classified } = classifyProductRows(
      [parsedRow({ name: "Producto renombrado" })],
      businessUnits,
      productTypes,
      [existingRow()]
    );
    expect(classified[0]!.classification).toBe("update");
    expect(classified[0]!.changedFields).toContain("Nombre");
  });

  it("comparación de SKU es case-insensitive (match aunque cambie mayúsculas)", () => {
    const { classified } = classifyProductRows([parsedRow({ sku: "tp-001" })], businessUnits, productTypes, [
      existingRow({ sku: "TP-001" }),
    ]);
    expect(classified[0]!.classification).toBe("unchanged");
  });

  it("Business Unit inexistente es ERROR", () => {
    const { classified, errors } = classifyProductRows(
      [parsedRow({ businessUnitNames: ["No existe"] })],
      businessUnits,
      productTypes,
      []
    );
    expect(classified).toHaveLength(0);
    expect(errors[0]!.message).toContain("Business Unit");
  });

  it("Business Unit inexistente DENTRO de una lista de varias también es ERROR (toda la fila)", () => {
    const { classified, errors } = classifyProductRows(
      [parsedRow({ businessUnitNames: ["Thunder LED Lights", "No existe", "Juno Promotional"] })],
      businessUnits,
      productTypes,
      []
    );
    expect(classified).toHaveLength(0);
    expect(errors[0]!.message).toContain("No existe");
  });

  it("Tipo de producto inexistente es ERROR", () => {
    const { classified, errors } = classifyProductRows(
      [parsedRow({ productTypeName: "No existe" })],
      businessUnits,
      productTypes,
      []
    );
    expect(classified).toHaveLength(0);
    expect(errors[0]!.message).toContain("Tipo de producto");
  });

  it("SKU duplicado DENTRO del mismo archivo es ERROR (bloquea, no se omite en silencio)", () => {
    const { classified, errors } = classifyProductRows(
      [parsedRow({ rowNumber: 1 }), parsedRow({ rowNumber: 2 })],
      businessUnits,
      productTypes,
      []
    );
    expect(classified).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain("duplicado");
    expect(errors[0]!.rowNumber).toBe(2);
  });

  it("cambio de moneda se detecta como campo cambiado", () => {
    const { classified } = classifyProductRows([parsedRow({ currency: "USD" })], businessUnits, productTypes, [
      existingRow({ currency: "MXN" }),
    ]);
    expect(classified[0]!.classification).toBe("update");
    expect(classified[0]!.changedFields).toContain("Moneda");
  });

  it("resolución de Business Unit/Tipo es robusta a acentos/mayúsculas/espacios", () => {
    const { classified, errors } = classifyProductRows(
      [parsedRow({ businessUnitNames: ["  thunder   led lights  "], productTypeName: "PROYECTOR / GOBO" })],
      businessUnits,
      productTypes,
      []
    );
    expect(errors).toHaveLength(0);
    expect(classified[0]!.businessUnitIds).toEqual(["bu-1"]);
    expect(classified[0]!.productTypeId).toBe("pt-1");
  });

  it("segunda importación del mismo Excel sin cambios: 0 nuevos, 0 actualizados, N sin cambios", () => {
    const rows = [parsedRow({ sku: "TP-001" }), parsedRow({ sku: "TP-002", rowNumber: 2 })];
    const existing = [existingRow({ sku: "TP-001" }), existingRow({ id: "existing-2", sku: "TP-002" })];
    const { classified, errors } = classifyProductRows(rows, businessUnits, productTypes, existing);
    expect(errors).toHaveLength(0);
    expect(classified.filter((r) => r.classification === "new")).toHaveLength(0);
    expect(classified.filter((r) => r.classification === "update")).toHaveLength(0);
    expect(classified.filter((r) => r.classification === "unchanged")).toHaveLength(2);
  });

  // ==== Casos multi-Business-Unit (ajuste posterior a la aprobación conceptual) ====

  it('TODAS (0 asociaciones) contra un producto existente también con 0 se clasifica SIN CAMBIOS', () => {
    const { classified } = classifyProductRows(
      [parsedRow({ businessUnitNames: null })],
      businessUnits,
      productTypes,
      [existingRow({ businessUnitIds: [] })]
    );
    expect(classified[0]!.classification).toBe("unchanged");
    expect(classified[0]!.businessUnitIds).toEqual([]);
  });

  it("1 Business Unit se resuelve a 1 id", () => {
    const { classified, errors } = classifyProductRows(
      [parsedRow({ businessUnitNames: ["Thunder LED Lights"] })],
      businessUnits,
      productTypes,
      []
    );
    expect(errors).toHaveLength(0);
    expect(classified[0]!.businessUnitIds).toEqual(["bu-1"]);
  });

  it("2 Business Units se resuelven a 2 ids", () => {
    const { classified, errors } = classifyProductRows(
      [parsedRow({ businessUnitNames: ["Thunder LED Lights", "Thunder Safety Solutions"] })],
      businessUnits,
      productTypes,
      []
    );
    expect(errors).toHaveLength(0);
    expect(classified[0]!.businessUnitIds.sort()).toEqual(["bu-1", "bu-2"].sort());
  });

  it("3 Business Units se resuelven a 3 ids", () => {
    const { classified, errors } = classifyProductRows(
      [parsedRow({ businessUnitNames: ["Thunder LED Lights", "Thunder Safety Solutions", "Juno Promotional"] })],
      businessUnits,
      productTypes,
      []
    );
    expect(errors).toHaveLength(0);
    expect(classified[0]!.businessUnitIds).toHaveLength(3);
  });

  it("pasar de TODAS (existente) a 2 Business Units específicas se detecta como ACTUALIZAR", () => {
    const { classified } = classifyProductRows(
      [parsedRow({ businessUnitNames: ["Thunder LED Lights", "Thunder Safety Solutions"] })],
      businessUnits,
      productTypes,
      [existingRow({ businessUnitIds: [] })]
    );
    expect(classified[0]!.classification).toBe("update");
    expect(classified[0]!.changedFields).toContain("Business Unit");
  });

  it("pasar de 2 Business Units (existente) a TODAS se detecta como ACTUALIZAR", () => {
    const { classified } = classifyProductRows(
      [parsedRow({ businessUnitNames: null })],
      businessUnits,
      productTypes,
      [existingRow({ businessUnitIds: ["bu-1", "bu-2"] })]
    );
    expect(classified[0]!.classification).toBe("update");
    expect(classified[0]!.changedFields).toContain("Business Unit");
  });

  it("pasar de 2 Business Units (existente) a 1 se detecta como ACTUALIZAR — ejemplo del pedido: Thunder LED Lights | Juno Promotional → Thunder LED Lights", () => {
    const { classified } = classifyProductRows(
      [parsedRow({ businessUnitNames: ["Thunder LED Lights"] })],
      businessUnits,
      productTypes,
      [existingRow({ businessUnitIds: ["bu-1", "bu-3"] })] // Thunder LED Lights + Juno Promotional
    );
    expect(classified[0]!.classification).toBe("update");
    expect(classified[0]!.changedFields).toContain("Business Unit");
  });

  it("mismo conjunto de 2+ Business Units en distinto orden se clasifica SIN CAMBIOS (comparación de conjunto, no de orden)", () => {
    const { classified } = classifyProductRows(
      [parsedRow({ businessUnitNames: ["Thunder Safety Solutions", "Thunder LED Lights"] })],
      businessUnits,
      productTypes,
      [existingRow({ businessUnitIds: ["bu-1", "bu-2"] })]
    );
    expect(classified[0]!.classification).toBe("unchanged");
  });
});
