import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

/**
 * Plantilla de PDF de cotización (docs/ARCHITECTURE.md §9/§10, Módulo 9).
 * El encabezado de marca y el de columnas de la tabla van `fixed` — se
 * repiten en cada página igual que el pie con "Página X de Y", así que una
 * cotización con muchas partidas pagina sin perder el contexto de a qué
 * línea/folio pertenece cada página (§10, criterio de prueba del módulo).
 *
 * "Versión N" siempre es 1 en este alcance: el versionado real tras el
 * envío es el Módulo 8, todavía no construido — `currentVersion` ya existe
 * en el modelo de datos (default 1) para no romper el formato de folio
 * (`-V{n}`) cuando ese módulo se construya.
 */

const HEADER_HEIGHT = 78;
const TABLE_HEADER_TOP = HEADER_HEIGHT;
const TABLE_HEADER_HEIGHT = 20;
const CONTENT_TOP = TABLE_HEADER_TOP + TABLE_HEADER_HEIGHT + 6;
const FOOTER_HEIGHT = 46;

const styles = StyleSheet.create({
  page: {
    paddingTop: CONTENT_TOP,
    paddingBottom: FOOTER_HEIGHT + 12,
    paddingHorizontal: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#18181b",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    paddingHorizontal: 32,
    paddingTop: 18,
    paddingBottom: 10,
  },
  headerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  businessUnitName: {
    fontSize: 14,
    fontWeight: 700,
  },
  businessUnitMeta: {
    fontSize: 8,
    color: "#52525b",
    marginTop: 2,
    maxWidth: 320,
  },
  folioBlock: {
    alignItems: "flex-end",
  },
  folioText: {
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "Courier-Bold",
  },
  folioMeta: {
    fontSize: 8,
    color: "#52525b",
    marginTop: 2,
  },
  tableHeader: {
    position: "absolute",
    top: TABLE_HEADER_TOP,
    left: 0,
    right: 0,
    height: TABLE_HEADER_HEIGHT,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d8",
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#71717a",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: FOOTER_HEIGHT,
    paddingHorizontal: 32,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
  },
  footerText: {
    fontSize: 7,
    color: "#71717a",
  },
  qrImage: {
    width: 32,
    height: 32,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#71717a",
    marginBottom: 3,
  },
  partiesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  partyBlock: {
    width: "48%",
  },
  bodyText: {
    fontSize: 9,
  },
  mutedText: {
    fontSize: 8,
    color: "#52525b",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  col_sku: { width: "16%" },
  col_desc: { width: "38%" },
  col_qty: { width: "10%", textAlign: "right" },
  col_price: { width: "14%", textAlign: "right" },
  col_discount: { width: "10%", textAlign: "right" },
  col_total: { width: "12%", textAlign: "right" },
  totalsBlock: {
    marginTop: 10,
    alignSelf: "flex-end",
    width: "40%",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsLabel: {
    color: "#52525b",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: "#d4d4d8",
  },
  grandTotalLabel: {
    fontSize: 10,
    fontWeight: 700,
  },
  grandTotalValue: {
    fontSize: 10,
    fontWeight: 700,
  },
  notes: {
    marginTop: 14,
    fontSize: 8,
    color: "#52525b",
  },
});

export type QuotationPdfItem = {
  sku: string;
  description: string;
  qty: number;
  unitPrice: string;
  discountPct: string;
  lineTotal: string;
};

export type QuotationPdfData = {
  folio: string;
  version: number;
  status: string;
  statusLabel: string;
  currency: string;
  createdAt: Date;
  validUntil: Date | null;
  notes: string | null;
  businessUnit: {
    name: string;
    legalName: string | null;
    taxId: string | null;
    address: string | null;
    colorPrimary: string | null;
  };
  customer: {
    legalName: string;
    tradeName: string | null;
    taxId: string | null;
  };
  seller: {
    fullName: string;
    email: string;
  };
  items: QuotationPdfItem[];
  subtotal: string;
  discountTotal: string;
  total: string;
  qrDataUrl: string;
};

const currency = (value: string, code: string) =>
  Number(value).toLocaleString("es-MX", { style: "currency", currency: code });

const dateEs = (date: Date) =>
  date.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });

export function QuotationDocument({ data }: { data: QuotationPdfData }) {
  const brandColor = data.businessUnit.colorPrimary ?? "#18181b";

  return (
    <Document title={`${data.folio} — ${data.businessUnit.name}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View style={[styles.headerBar, { backgroundColor: brandColor }]} />
          <View style={styles.headerRow}>
            <View style={{ maxWidth: 320 }}>
              <Text style={styles.businessUnitName}>{data.businessUnit.name}</Text>
              {data.businessUnit.legalName ? (
                <Text style={styles.businessUnitMeta}>
                  {data.businessUnit.legalName}
                  {data.businessUnit.taxId ? ` · RFC ${data.businessUnit.taxId}` : ""}
                </Text>
              ) : null}
              {data.businessUnit.address ? (
                <Text style={styles.businessUnitMeta}>{data.businessUnit.address}</Text>
              ) : null}
            </View>
            <View style={styles.folioBlock}>
              <Text style={styles.folioText}>{data.folio}</Text>
              <Text style={styles.folioMeta}>Versión {data.version}</Text>
              <Text style={styles.folioMeta}>{data.statusLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tableHeader} fixed>
          <Text style={styles.col_sku}>SKU</Text>
          <Text style={styles.col_desc}>Producto</Text>
          <Text style={styles.col_qty}>Cant.</Text>
          <Text style={styles.col_price}>P. Unit.</Text>
          <Text style={styles.col_discount}>Desc.</Text>
          <Text style={styles.col_total}>Importe</Text>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.partyBlock}>
            <Text style={styles.sectionTitle}>Cliente</Text>
            <Text style={styles.bodyText}>{data.customer.legalName}</Text>
            {data.customer.tradeName ? (
              <Text style={styles.mutedText}>{data.customer.tradeName}</Text>
            ) : null}
            {data.customer.taxId ? (
              <Text style={styles.mutedText}>RFC {data.customer.taxId}</Text>
            ) : null}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.sectionTitle}>Vendedor</Text>
            <Text style={styles.bodyText}>{data.seller.fullName}</Text>
            <Text style={styles.mutedText}>{data.seller.email}</Text>
            <Text style={[styles.mutedText, { marginTop: 4 }]}>
              Emitida el {dateEs(data.createdAt)}
              {data.validUntil ? ` · Vigente hasta el ${dateEs(data.validUntil)}` : ""}
            </Text>
          </View>
        </View>

        {data.items.map((item, index) => (
          <View key={index} style={styles.row} wrap={false}>
            <Text style={styles.col_sku}>{item.sku}</Text>
            <Text style={styles.col_desc}>{item.description}</Text>
            <Text style={styles.col_qty}>{item.qty}</Text>
            <Text style={styles.col_price}>{currency(item.unitPrice, data.currency)}</Text>
            <Text style={styles.col_discount}>{item.discountPct}%</Text>
            <Text style={styles.col_total}>{currency(item.lineTotal, data.currency)}</Text>
          </View>
        ))}

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text>{currency(data.subtotal, data.currency)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Descuento</Text>
            <Text>{currency(data.discountTotal, data.currency)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total ({data.currency})</Text>
            <Text style={styles.grandTotalValue}>{currency(data.total, data.currency)}</Text>
          </View>
        </View>

        {data.notes ? (
          <View style={styles.notes}>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            <Text>{data.notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image no es un <img> de HTML, no acepta alt. */}
          <Image src={data.qrDataUrl} style={styles.qrImage} />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.footerText}>
              GLOBAL QUOTE · Global Supplier MTY S.A. de C.V. · Documento generado electrónicamente
            </Text>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
