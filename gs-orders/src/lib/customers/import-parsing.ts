/**
 * Parseo/agrupación/matching de la importación Excel de Clientes — puro,
 * sin acceso a red ni a Supabase, para poder probarse con Vitest sin
 * Postgres real. La escritura a DB (0021) vive en
 * app/(app)/clientes/importar/actions.ts.
 *
 * Columnas esperadas de la plantilla (public/plantillas/clientes.xlsx):
 * Nombre Cliente * | Contacto | Email | Teléfono | Razón Social | RFC
 */

export const IMPORT_HEADERS = ["Nombre Cliente *", "Contacto", "Email", "Teléfono", "Razón Social", "RFC"] as const;

export interface ParsedImportRow {
  rowNumber: number; // 1-based, excluye el encabezado (fila 1 del archivo = primer dato)
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  legalName: string | null;
  taxId: string | null;
  groupKey: string;
  groupKeyType: "tax_id" | "name";
}

export interface ImportRowError {
  rowNumber: number;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function normalizeTaxId(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function toTrimmedOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

/**
 * Parsea una fila cruda del sheet (ya sin el encabezado) contra la
 * plantilla aprobada. rowNumber es 1-based sobre las filas de datos (la
 * primera fila con datos, justo debajo del encabezado, es la 1) — así los
 * mensajes de error coinciden con lo que un usuario cuenta a simple vista
 * en Excel (fila 2 del archivo = fila 1 de datos).
 */
export function parseImportRow(rowNumber: number, cells: unknown[]): { row: ParsedImportRow | null; error: ImportRowError | null } {
  const [nameRaw, contactRaw, emailRaw, phoneRaw, legalRaw, taxRaw] = cells;
  const name = toTrimmedOrNull(nameRaw);

  if (!name) {
    return { row: null, error: { rowNumber, message: `Fila ${rowNumber}: "Nombre Cliente" es obligatorio.` } };
  }

  const contactName = toTrimmedOrNull(contactRaw);
  const email = toTrimmedOrNull(emailRaw);
  const phone = toTrimmedOrNull(phoneRaw);
  const legalName = toTrimmedOrNull(legalRaw);
  const taxId = toTrimmedOrNull(taxRaw);

  if (email && !EMAIL_RE.test(email)) {
    return { row: null, error: { rowNumber, message: `Fila ${rowNumber}: el email "${email}" no es válido.` } };
  }

  const groupKeyType: "tax_id" | "name" = taxId ? "tax_id" : "name";
  const groupKey = taxId ? normalizeTaxId(taxId) : normalizeName(name);

  return {
    row: { rowNumber, name, contactName, email, phone, legalName, taxId, groupKey, groupKeyType },
    error: null,
  };
}

export interface ImportGroup {
  groupKey: string;
  groupKeyType: "tax_id" | "name";
  customerName: string;
  legalName: string | null;
  taxId: string | null;
  /** email/phone del Customer (solo de filas SIN Contacto — ver semántica aprobada). */
  customerEmail: string | null;
  customerPhone: string | null;
  /** Una entrada por cada fila CON Contacto de este grupo. */
  contacts: { rowNumber: number; name: string; email: string | null; phone: string | null }[];
  rows: ParsedImportRow[];
}

/**
 * Agrupa por RFC normalizado cuando existe; si no, por nombre normalizado
 * — nunca fusiona un mismo nombre con RFC distintos (claves distintas por
 * construcción, ver parseImportRow). Dentro de cada grupo: filas SIN
 * Contacto aportan email/phone al Customer (primer valor no vacío gana);
 * filas CON Contacto se vuelven un customer_contact cada una.
 */
export function groupImportRows(rows: ParsedImportRow[]): ImportGroup[] {
  const order: string[] = [];
  const map = new Map<string, ImportGroup>();

  for (const row of rows) {
    const key = `${row.groupKeyType}:${row.groupKey}`;
    let group = map.get(key);
    if (!group) {
      group = {
        groupKey: row.groupKey,
        groupKeyType: row.groupKeyType,
        customerName: row.name,
        legalName: row.legalName,
        taxId: row.taxId,
        customerEmail: null,
        customerPhone: null,
        contacts: [],
        rows: [],
      };
      map.set(key, group);
      order.push(key);
    }

    if (!group.legalName && row.legalName) group.legalName = row.legalName;
    if (!group.taxId && row.taxId) group.taxId = row.taxId;

    if (row.contactName) {
      group.contacts.push({ rowNumber: row.rowNumber, name: row.contactName, email: row.email, phone: row.phone });
    } else {
      if (!group.customerEmail && row.email) group.customerEmail = row.email;
      if (!group.customerPhone && row.phone) group.customerPhone = row.phone;
    }

    group.rows.push(row);
  }

  return order.map((key) => map.get(key)!);
}

export interface CustomerCandidate {
  id: string;
  name: string;
  tax_id: string | null;
  active: boolean;
}

export interface ContactCandidate {
  id: string;
  customer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
}

export type CustomerDuplicateMatchType = "tax_id" | "name";

export interface CustomerDuplicateMatch {
  customer: CustomerCandidate;
  matchType: CustomerDuplicateMatchType;
}

/**
 * Posible duplicado de Customer: RFC exacto normalizado, o nombre exacto
 * normalizado (§I) — sin fuzzy matching. RFC tiene prioridad si ambos
 * coinciden con candidatos distintos (un RFC igual es una señal más fuerte
 * que un nombre igual).
 */
export function findCustomerDuplicate(group: ImportGroup, candidates: CustomerCandidate[]): CustomerDuplicateMatch | null {
  if (group.taxId) {
    const normalizedTaxId = normalizeTaxId(group.taxId);
    const byTaxId = candidates.find((c) => c.tax_id && normalizeTaxId(c.tax_id) === normalizedTaxId);
    if (byTaxId) return { customer: byTaxId, matchType: "tax_id" };
  }
  const normalizedName = normalizeName(group.customerName);
  const byName = candidates.find((c) => normalizeName(c.name) === normalizedName);
  if (byName) return { customer: byName, matchType: "name" };
  return null;
}

export type ContactDuplicateSignal = "strong" | "possible" | "warning" | null;

/**
 * Duplicado de contacto (§I): mismo email normalizado = señal fuerte;
 * mismo teléfono normalizado = posible; mismo nombre solamente = warning
 * (nunca bloquea). Nunca fusiona automáticamente — es solo una señal para
 * que el usuario decida en el preview.
 */
export function findContactDuplicateSignal(
  contact: { name: string; email: string | null; phone: string | null },
  existingContacts: ContactCandidate[]
): ContactDuplicateSignal {
  if (contact.email) {
    const normalizedEmail = normalizeEmail(contact.email);
    if (existingContacts.some((c) => c.email && normalizeEmail(c.email) === normalizedEmail)) return "strong";
  }
  if (contact.phone) {
    const normalizedPhone = normalizePhone(contact.phone);
    if (normalizedPhone && existingContacts.some((c) => c.phone && normalizePhone(c.phone) === normalizedPhone)) {
      return "possible";
    }
  }
  const normalizedName = normalizeName(contact.name);
  if (existingContacts.some((c) => normalizeName(c.name) === normalizedName)) return "warning";
  return null;
}
