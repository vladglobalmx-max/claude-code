import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { PdfDocumentSpec } from "./types";

/**
 * THÖREN 0078 — el ÚNICO layout de PDF para los 7 tipos de documento
 * operativo. Ningún adapter (src/lib/pdf/documents/*.ts) contiene JSX ni
 * estilos propios — todos alimentan este mismo componente con un
 * PdfDocumentSpec. Nueva sección/campo visual => se agrega aquí una sola
 * vez, nunca 7 veces.
 */
const styles = StyleSheet.create({
  page: { padding: 32, paddingBottom: 56, fontSize: 9, fontFamily: "Helvetica", color: "#23282B" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  logo: { width: 130, height: 44, objectFit: "contain" },
  orgName: { fontSize: 13, fontWeight: 700 },
  docTitleBlock: { alignItems: "flex-end" },
  docType: { fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 },
  folio: { fontSize: 11, marginTop: 3, fontFamily: "Helvetica-Bold" },
  statusRow: { flexDirection: "row", marginTop: 5, alignItems: "center" },
  badge: {
    fontSize: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    color: "#23282B",
    marginRight: 8,
  },
  dateText: { fontSize: 8.5, color: "#6B7280" },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", marginBottom: 5, color: "#6B7280", letterSpacing: 0.5 },
  relatedGrid: { flexDirection: "row", flexWrap: "wrap" },
  relatedItem: { width: "50%", marginBottom: 6, paddingRight: 8 },
  relatedLabel: { fontSize: 7.5, color: "#6B7280" },
  relatedValue: { fontSize: 9.5, marginTop: 1 },
  tableRowHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#23282B", paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB", paddingVertical: 4 },
  cellHeader: { fontSize: 7.5, fontWeight: 700, textTransform: "uppercase" },
  cell: { fontSize: 9 },
  totalsBlock: { marginTop: 10, alignSelf: "flex-end", width: 220 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsLabel: { fontSize: 9 },
  totalsValue: { fontSize: 9 },
  totalsEmphasisLabel: { fontSize: 11, fontWeight: 700 },
  totalsEmphasisValue: { fontSize: 11, fontWeight: 700 },
  notes: { fontSize: 9, lineHeight: 1.4 },
  disclaimer: { fontSize: 8, color: "#6B7280", marginTop: 10, fontStyle: "italic" },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 32,
    right: 32,
    fontSize: 7,
    color: "#9CA3AF",
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    paddingTop: 6,
  },
  watermarkContainer: {
    position: "absolute",
    top: "38%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  watermarkText: {
    fontSize: 26,
    color: "#B91C1C",
    opacity: 0.32,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
});

export function DocumentPdf({ spec }: { spec: PdfDocumentSpec }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {spec.isTest ? (
          <View style={styles.watermarkContainer} fixed>
            <Text style={styles.watermarkText}>PRUEBA — DOCUMENTO NO OFICIAL</Text>
          </View>
        ) : null}

        <View style={styles.headerRow}>
          <View>
            {spec.branding.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image no acepta alt (no es HTML).
              <Image src={spec.branding.logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.orgName}>{spec.branding.businessUnitName ?? spec.branding.organizationName}</Text>
            )}
          </View>
          <View style={styles.docTitleBlock}>
            <Text style={styles.docType}>{spec.documentTypeLabel}</Text>
            <Text style={styles.folio}>{spec.folio}</Text>
            <View style={styles.statusRow}>
              <Text style={styles.badge}>{spec.statusLabel}</Text>
              <Text style={styles.dateText}>{spec.dateLabel}</Text>
            </View>
          </View>
        </View>

        {spec.relatedData.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Datos relacionados</Text>
            <View style={styles.relatedGrid}>
              {spec.relatedData.map((row, index) => (
                <View key={`${row.label}-${index}`} style={styles.relatedItem}>
                  <Text style={styles.relatedLabel}>{row.label}</Text>
                  <Text style={styles.relatedValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {spec.columns.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.tableRowHeader}>
              {spec.columns.map((column) => (
                <Text key={column.key} style={[styles.cellHeader, { flex: 1, textAlign: column.align ?? "left" }]}>
                  {column.label}
                </Text>
              ))}
            </View>
            {spec.rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.tableRow} wrap={false}>
                {spec.columns.map((column) => (
                  <Text key={column.key} style={[styles.cell, { flex: 1, textAlign: column.align ?? "left" }]}>
                    {row[column.key] ?? ""}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {spec.totals && spec.totals.length > 0 ? (
          <View style={styles.totalsBlock}>
            {spec.totals.map((total, index) => (
              <View key={`${total.label}-${index}`} style={styles.totalsRow}>
                <Text style={total.emphasis ? styles.totalsEmphasisLabel : styles.totalsLabel}>{total.label}</Text>
                <Text style={total.emphasis ? styles.totalsEmphasisValue : styles.totalsValue}>{total.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {spec.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notas</Text>
            <Text style={styles.notes}>{spec.notes}</Text>
          </View>
        ) : null}

        {spec.disclaimer ? <Text style={styles.disclaimer}>{spec.disclaimer}</Text> : null}

        <Text style={styles.footer} fixed>
          {spec.branding.organizationName} · Generado el {spec.generatedAtLabel}
        </Text>
      </Page>
    </Document>
  );
}
