/**
 * THÖREN 0078 — PDFs operativos. Contrato genérico que CUALQUIER documento
 * (Sales Order, Requisición, Purchase Order, Recepción, Surtido, Factura,
 * Comisión) debe producir para alimentar el único layout compartido
 * (document-pdf.tsx). Los adapters (src/lib/pdf/documents/*.ts) SOLO
 * construyen este objeto a partir de datos ya obtenidos vía el cliente
 * Supabase con sesión (RLS) — nunca contienen JSX ni saben nada de
 * @react-pdf/renderer.
 */

export interface PdfKeyValueRow {
  label: string;
  value: string;
}

export interface PdfTableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

export type PdfTableRow = Record<string, string>;

export interface PdfTotalsRow {
  label: string;
  value: string;
  /** Fila destacada (ej. Total) — tipografía más grande/negrita. */
  emphasis?: boolean;
}

export interface PdfBranding {
  /** URL firmada (1h) del logo de la Business Unit, o null si no aplica/no existe — nunca rompe la generación. */
  logoUrl: string | null;
  organizationName: string;
  /** null cuando el documento no tiene Business Unit resoluble (los 7 tipos de 0078 no tienen ese concepto) — el layout cae al nombre de organización. */
  businessUnitName: string | null;
}

/**
 * `isTest` SIEMPRE se calcula server-side, en el adapter, a partir del
 * JOIN real hacia sales_orders.is_test (o su snapshot, según el tipo de
 * documento) — nunca se acepta como parámetro externo. El layout renderiza
 * la marca "PRUEBA — DOCUMENTO NO OFICIAL" de forma incondicional cuando
 * este campo es true, sin ninguna vía para omitirla.
 */
export interface PdfDocumentSpec {
  documentTypeLabel: string;
  folio: string;
  statusLabel: string;
  dateLabel: string;
  relatedData: PdfKeyValueRow[];
  columns: PdfTableColumn[];
  rows: PdfTableRow[];
  /** null cuando el documento no tiene totales aplicables (ej. Recepción, Surtido). */
  totals: PdfTotalsRow[] | null;
  notes: string | null;
  isTest: boolean;
  /** Leyenda legal/aclaratoria fija del tipo de documento (ej. factura: "no es CFDI"). null si no aplica. */
  disclaimer: string | null;
  branding: PdfBranding;
  /** Fecha/hora de generación ya formateada — el footer nunca reformatea ni recalcula. */
  generatedAtLabel: string;
}
