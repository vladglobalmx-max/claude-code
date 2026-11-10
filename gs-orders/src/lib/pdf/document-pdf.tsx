import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { PdfDocumentSpec } from "./types";

/**
 * THÖREN 0078 — el ÚNICO layout de PDF para los 7 tipos de documento
 * operativo. Ningún adapter (src/lib/pdf/documents/*.ts) contiene JSX ni
 * estilos propios — todos alimentan este mismo componente con un
 * PdfDocumentSpec. Nueva sección/campo visual => se agrega aquí una sola
 * vez, nunca 7 veces.
 *
 * THÖREN | PDF — CORRECCIÓN FINAL DE DISEÑO (post "PDF PREMIUM FASE 01",
 * rechazada). Referencia visual obligatoria: cotización de Cotizia para
 * Got Fresh Breath (VVG-20261106-122) — fondo blanco, franja superior
 * delgada de color, logo a la izquierda / tipo de documento + folio grande
 * a la derecha, "Página X de Y" en la esquina superior (NO en el pie,
 * nunca visto así en la referencia), paneles con fondo tintado suave (no
 * bordes negros duros), encabezado de tabla con color sólido, totales
 * agrupados en su propio panel, pie discreto con SOLO datos que ya existen
 * (nunca un "responsable" inventado). Mismo contrato de datos de siempre
 * (PdfDocumentSpec sin cambios) — los 7 adapters no necesitan tocarse.
 *
 * GAP DE DATOS, documentado explícitamente (no resuelto aquí, "no
 * modificar bases de datos" es requisito explícito de este ticket):
 * `business_units` solo tiene `logo_path` (0024_business_unit_branding.sql)
 * — NO existe ninguna columna de color corporativo por Business Unit. La
 * referencia usa el color de marca de Got Fresh Breath (teal); aquí se usa
 * el color corporativo ÚNICO de THÖREN (Ember, --gso-accent en
 * globals.css, el mismo de toda la app) para los 7 documentos, NO un color
 * por-BU — eso requeriría una columna nueva, fuera de alcance.
 *
 * SIN iniciales decorativas: cuando no hay logo, el fallback es SIEMPRE
 * texto plano (nombre de BU/organización) — nunca un avatar con inicial
 * (ese elemento del prototipo rechazado se elimina por completo).
 *
 * SIN imagen de producto en esta corrección: la referencia sí la trae,
 * pero agregarla requeriría extender el contrato de datos Y resolver/firmar
 * una URL de imagen en cada uno de los 7 adapters — más que una
 * "corrección visual al generador existente". Queda fuera de este ticket a
 * propósito (ver reporte de cambios).
 *
 * SIN QR "ver en línea": requeriría una vista pública nueva (infraestructura
 * que hoy no existe) — fuera de alcance.
 *
 * SIN "representante comercial"/firma: la referencia trae un nombre real de
 * firmante que THÖREN no modela como concepto propio (solo existe
 * "Vendedor", que ya se muestra dentro del panel de datos relacionados
 * cuando el adapter lo incluye) — requisito explícito "sin inventar
 * responsables": no se agrega ninguna sección nueva de firma.
 */
const ACCENT = "#9C4E27"; // THÖREN Ember — color corporativo único, ver DECISIÓN arriba.
const ACCENT_INK = "#FFFFFF";
const ACCENT_TINT = "#F3E9E2"; // mismo matiz que ACCENT, muy diluido — paneles/filas alternas.
const INK = "#23282B";
const INK_SOFT = "#6B7280";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  // THÖREN | PDF — CORRECCIÓN "pie de página": el padding vive en <Page>,
  // NO en un <View> interno envolviendo el contenido. Es el mecanismo real
  // de @react-pdf/renderer para reservar un margen fijo EN CADA página de
  // un documento multi-página (lo que ya usaba la versión original/
  // probada de este archivo) — un padding puesto en un View interno solo
  // se aplica UNA vez, al final de todo el contenido fluido, no como
  // margen repetido por página, así que páginas intermedias podían quedar
  // sin ningún margen inferior reservado y una fila podía terminar
  // pegada o encimada al pie fijo. topBar/pageNumber/footer siguen
  // `position: "absolute"` + `fixed`, que en react-pdf se posicionan
  // relativos a la página completa (ignoran el padding de <Page>) — por
  // eso la franja superior sigue a todo lo ancho pese a que <Page> ahora
  // sí tiene padding.
  page: { paddingHorizontal: 32, paddingTop: 20, paddingBottom: 56, fontSize: 9, fontFamily: "Helvetica", color: INK },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: ACCENT },

  pageNumber: { position: "absolute", top: 14, right: 32, fontSize: 7.5, color: INK_SOFT },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  logo: { width: 130, height: 42, objectFit: "contain" },
  orgName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: INK },
  buName: { fontSize: 9, color: INK_SOFT, marginTop: 1 },
  docTitleBlock: { alignItems: "flex-end" },
  docType: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.2, color: ACCENT },
  folio: { fontSize: 18, marginTop: 4, fontFamily: "Helvetica-Bold", color: INK },

  headerDivider: { borderBottomWidth: 1.5, borderBottomColor: ACCENT, marginBottom: 16 },

  panel: {
    borderWidth: 0.75,
    borderColor: BORDER,
    borderRadius: 6,
    backgroundColor: ACCENT_TINT,
    padding: 10,
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: ACCENT,
    marginBottom: 7,
  },
  relatedGrid: { flexDirection: "row", flexWrap: "wrap" },
  relatedItem: { width: "50%", marginBottom: 6, paddingRight: 10 },
  relatedLabel: { fontSize: 7, textTransform: "uppercase", color: INK_SOFT, letterSpacing: 0.3 },
  relatedValue: { fontSize: 9.5, marginTop: 1.5, color: INK },

  tableWrap: { borderWidth: 0.75, borderColor: BORDER, borderRadius: 6, overflow: "hidden", marginBottom: 4 },
  tableSectionLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: ACCENT,
    marginBottom: 6,
  },
  tableRowHeader: { flexDirection: "row", backgroundColor: ACCENT, paddingVertical: 6, paddingHorizontal: 8 },
  cellHeader: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: ACCENT_INK, letterSpacing: 0.3 },
  tableRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: BORDER },
  tableRowAlt: { backgroundColor: "#FAF8F5" },
  cell: { fontSize: 9, color: INK },

  totalsSection: { alignItems: "flex-end", marginTop: 12, marginBottom: 14 },
  totalsBlock: { width: 230, borderWidth: 0.75, borderColor: BORDER, borderRadius: 6, backgroundColor: ACCENT_TINT, padding: 10 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsLabel: { fontSize: 9, color: INK_SOFT },
  totalsValue: { fontSize: 9, color: INK },
  totalsDivider: { borderTopWidth: 1, borderTopColor: ACCENT, marginVertical: 5 },
  totalsEmphasisLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: INK },
  totalsEmphasisValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: ACCENT },

  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 5, color: ACCENT, letterSpacing: 0.5 },
  notes: { fontSize: 9, lineHeight: 1.4, color: INK },
  disclaimer: { fontSize: 8, color: INK_SOFT, marginTop: 4, fontStyle: "italic" },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: INK_SOFT },

  watermarkContainer: { position: "absolute", top: "38%", left: 0, right: 0, alignItems: "center" },
  watermarkText: { fontSize: 26, color: "#B91C1C", opacity: 0.32, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
});

export function DocumentPdf({ spec }: { spec: PdfDocumentSpec }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} fixed />
        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />

        {spec.isTest ? (
          <View style={styles.watermarkContainer} fixed>
            <Text style={styles.watermarkText}>PRUEBA — DOCUMENTO NO OFICIAL</Text>
          </View>
        ) : null}

        <View>
          <View style={styles.headerRow}>
            <View>
              {spec.branding.logoUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image no acepta alt (no es HTML).
                <Image src={spec.branding.logoUrl} style={styles.logo} />
              ) : (
                <>
                  <Text style={styles.orgName}>{spec.branding.businessUnitName ?? spec.branding.organizationName}</Text>
                  {spec.branding.businessUnitName ? <Text style={styles.buName}>{spec.branding.organizationName}</Text> : null}
                </>
              )}
            </View>
            <View style={styles.docTitleBlock}>
              <Text style={styles.docType}>{spec.documentTypeLabel}</Text>
              <Text style={styles.folio}>{spec.folio}</Text>
            </View>
          </View>

          <View style={styles.headerDivider} />

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{spec.relatedDataSectionLabel ?? "Datos relacionados"}</Text>
            <View style={styles.relatedGrid}>
              <View style={styles.relatedItem}>
                <Text style={styles.relatedLabel}>Estado</Text>
                <Text style={styles.relatedValue}>{spec.statusLabel}</Text>
              </View>
              <View style={styles.relatedItem}>
                <Text style={styles.relatedLabel}>Fecha</Text>
                <Text style={styles.relatedValue}>{spec.dateLabel}</Text>
              </View>
              {spec.relatedData.map((row, index) => (
                <View key={`${row.label}-${index}`} style={styles.relatedItem}>
                  <Text style={styles.relatedLabel}>{row.label}</Text>
                  <Text style={styles.relatedValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {spec.columns.length > 0 ? (
            <View>
              <Text style={styles.tableSectionLabel}>Líneas</Text>
              <View style={styles.tableWrap}>
                <View style={styles.tableRowHeader}>
                  {spec.columns.map((column) => (
                    <Text key={column.key} style={[styles.cellHeader, { flex: 1, textAlign: column.align ?? "left" }]}>
                      {column.label}
                    </Text>
                  ))}
                </View>
                {spec.rows.map((row, rowIndex) => (
                  <View key={rowIndex} style={[styles.tableRow, rowIndex % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                    {spec.columns.map((column) => (
                      <Text key={column.key} style={[styles.cell, { flex: 1, textAlign: column.align ?? "left" }]}>
                        {row[column.key] ?? ""}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {spec.totals && spec.totals.length > 0 ? (
            <View style={styles.totalsSection} wrap={false}>
              <View style={styles.totalsBlock}>
                {spec.totals.map((total, index) => (
                  <View key={`${total.label}-${index}`}>
                    {total.emphasis ? <View style={styles.totalsDivider} /> : null}
                    <View style={styles.totalsRow}>
                      <Text style={total.emphasis ? styles.totalsEmphasisLabel : styles.totalsLabel}>{total.label}</Text>
                      <Text style={total.emphasis ? styles.totalsEmphasisValue : styles.totalsValue}>{total.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {spec.notes ? (
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>{spec.notesSectionLabel ?? "Notas"}</Text>
              <Text style={styles.notes}>{spec.notes}</Text>
            </View>
          ) : null}

          {spec.disclaimer ? <Text style={styles.disclaimer}>{spec.disclaimer}</Text> : null}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{spec.branding.organizationName}</Text>
          <Text style={styles.footerText}>
            {spec.generatedAtPrefixLabel ?? "Generado el"} {spec.generatedAtLabel}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
