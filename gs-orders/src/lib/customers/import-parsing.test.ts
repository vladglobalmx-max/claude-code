import { describe, it, expect } from "vitest";
import {
  parseImportRow,
  groupImportRows,
  findCustomerDuplicate,
  findContactDuplicateSignal,
  normalizeTaxId,
  normalizeName,
} from "./import-parsing";

describe("parseImportRow", () => {
  it("requiere Nombre Cliente", () => {
    const { row, error } = parseImportRow(1, ["", "", "", "", "", ""]);
    expect(row).toBeNull();
    expect(error?.message).toContain("obligatorio");
  });

  it("acepta una fila mínima con solo el nombre", () => {
    const { row, error } = parseImportRow(1, ["CEMEX", "", "", "", "", ""]);
    expect(error).toBeNull();
    expect(row).toMatchObject({ name: "CEMEX", contactName: null, groupKeyType: "name" });
  });

  it("rechaza un email inválido", () => {
    const { row, error } = parseImportRow(2, ["CEMEX", "Juan", "no-es-email", "", "", ""]);
    expect(row).toBeNull();
    expect(error?.message).toContain("no es válido");
  });

  it("agrupa por RFC cuando existe", () => {
    const { row } = parseImportRow(1, ["CEMEX", "", "", "", "", "cmx-010101-ab1"]);
    expect(row?.groupKeyType).toBe("tax_id");
    expect(row?.groupKey).toBe(normalizeTaxId("cmx-010101-ab1"));
  });

  it("agrupa por nombre cuando no hay RFC", () => {
    const { row } = parseImportRow(1, ["Constructora Norte", "", "", "", "", ""]);
    expect(row?.groupKeyType).toBe("name");
    expect(row?.groupKey).toBe(normalizeName("Constructora Norte"));
  });
});

describe("groupImportRows", () => {
  it("agrupa varias filas del mismo RFC en un solo grupo con varios contactos", () => {
    const rows = [
      parseImportRow(1, ["CEMEX", "Juan Pérez", "juan@cemex.com", "8110000001", "", "CMX010101AB1"]).row!,
      parseImportRow(2, ["CEMEX", "María López", "maria@cemex.com", "8110000002", "", "CMX010101AB1"]).row!,
    ];
    const groups = groupImportRows(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.contacts).toHaveLength(2);
    expect(groups[0]!.contacts.map((c) => c.name)).toEqual(["Juan Pérez", "María López"]);
  });

  it("NO fusiona mismo nombre con RFC distinto", () => {
    const rows = [
      parseImportRow(1, ["Constructora Norte", "", "", "", "", "CNO010101AB1"]).row!,
      parseImportRow(2, ["Constructora Norte", "", "", "", "", "CNO020202CD2"]).row!,
    ];
    const groups = groupImportRows(rows);
    expect(groups).toHaveLength(2);
  });

  it("filas sin Contacto aportan email/phone al Customer, no crean contacto", () => {
    const rows = [parseImportRow(1, ["Constructora Norte", "", "info@norte.mx", "8110000000", "", ""]).row!];
    const groups = groupImportRows(rows);
    expect(groups[0]!.customerEmail).toBe("info@norte.mx");
    expect(groups[0]!.customerPhone).toBe("8110000000");
    expect(groups[0]!.contacts).toHaveLength(0);
  });

  it("filas con Contacto aportan email/phone al contacto, no al Customer", () => {
    const rows = [parseImportRow(1, ["Constructora Norte", "Ana Ruiz", "ana@norte.mx", "8110000000", "", ""]).row!];
    const groups = groupImportRows(rows);
    expect(groups[0]!.customerEmail).toBeNull();
    expect(groups[0]!.customerPhone).toBeNull();
    expect(groups[0]!.contacts).toEqual([{ rowNumber: 1, name: "Ana Ruiz", email: "ana@norte.mx", phone: "8110000000" }]);
  });

  it("el primer valor no vacío de Razón Social dentro del grupo gana (mismo RFC en ambas filas)", () => {
    const rows = [
      parseImportRow(1, ["CEMEX", "Juan", "", "", "", "CMX010101AB1"]).row!,
      parseImportRow(2, ["CEMEX", "María", "", "", "Cemex SA de CV", "CMX010101AB1"]).row!,
    ];
    const groups = groupImportRows(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.taxId).toBe("CMX010101AB1");
    expect(groups[0]!.legalName).toBe("Cemex SA de CV");
  });
});

describe("findCustomerDuplicate", () => {
  const candidates = [
    { id: "c1", name: "CEMEX", tax_id: "CMX010101AB1", active: true },
    { id: "c2", name: "Constructora Norte", tax_id: null, active: true },
  ];

  it("detecta duplicado por RFC exacto normalizado", () => {
    const group = groupImportRows([parseImportRow(1, ["Cemex Grupo", "", "", "", "", "cmx-010101-ab1"]).row!])[0]!;
    const match = findCustomerDuplicate(group, candidates);
    expect(match).toEqual({ customer: candidates[0], matchType: "tax_id" });
  });

  it("detecta duplicado por nombre exacto normalizado cuando no hay RFC", () => {
    const group = groupImportRows([parseImportRow(1, ["constructora norte", "", "", "", "", ""]).row!])[0]!;
    const match = findCustomerDuplicate(group, candidates);
    expect(match).toEqual({ customer: candidates[1], matchType: "name" });
  });

  it("no marca duplicado si no coincide nada", () => {
    const group = groupImportRows([parseImportRow(1, ["Cliente Nuevo", "", "", "", "", ""]).row!])[0]!;
    expect(findCustomerDuplicate(group, candidates)).toBeNull();
  });
});

describe("findContactDuplicateSignal", () => {
  const existing = [
    { id: "k1", customer_id: "c1", name: "Juan Pérez", email: "juan@cemex.com", phone: "8110000001", active: true },
  ];

  it("mismo email normalizado = strong", () => {
    expect(findContactDuplicateSignal({ name: "Juan P.", email: "JUAN@cemex.com", phone: null }, existing)).toBe(
      "strong"
    );
  });

  it("mismo teléfono normalizado = possible", () => {
    expect(
      findContactDuplicateSignal({ name: "Otro Nombre", email: null, phone: "811-000-0001" }, existing)
    ).toBe("possible");
  });

  it("mismo nombre solamente = warning, nunca bloqueo", () => {
    expect(findContactDuplicateSignal({ name: "Juan Pérez", email: null, phone: null }, existing)).toBe("warning");
  });

  it("sin coincidencia = null", () => {
    expect(findContactDuplicateSignal({ name: "Nadie", email: "nadie@x.com", phone: null }, existing)).toBeNull();
  });
});
