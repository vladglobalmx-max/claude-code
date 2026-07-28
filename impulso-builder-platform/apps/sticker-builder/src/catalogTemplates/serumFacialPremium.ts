import {
  ProjectIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  toPixels,
  type Project,
} from "@impulso/document-schema";

const DIAMETER_MM = 40;
const FONT_FAMILY = "Poppins";
/**
 * Paleta real del template (`TEMPLATE_BATCH_02.md`, Template 7 — Serum
 * Facial Premium): carbón para texto de alto contraste, hueso para el
 * fondo del mockup (no usado dentro del Project en sí, el troquel es
 * transparente/blanco como cualquier otro sticker), cobre como único
 * acento — usado exclusivamente en el % de activo, nunca en un bloque
 * grande (ver Dirección de Arte del batch).
 */
const COLOR_CARBON = "#23282B";
const COLOR_COBRE = "#9C4E27";

export interface CreateSerumFacialPremiumProjectOptions {
  now: string;
  /** Inyectable para tests determinísticos; por defecto `crypto.randomUUID()`. */
  generateId?: () => string;
}

/**
 * Construye el `Project` real del template piloto "Serum Facial Premium"
 * (catálogo 2.1, `TEMPLATE_BATCH_02.md`) — primer template del catálogo de
 * 63 traducido de especificación en prosa a un `Project` funcional de
 * `@impulso/document-schema`. Ver `THOREN_PILOT_TEMPLATE_STANDARD.md` §5
 * para el proceso exacto de traducción y las decisiones tomadas.
 *
 * Deliberadamente sin ilustración (la propia sección 5 del batch dice
 * "Ninguno") — el diseño es enteramente tipográfico + una línea divisoria,
 * por eso el piloto no toca `@impulso/asset-library` en absoluto.
 */
export function createSerumFacialPremiumProject(options: CreateSerumFacialPremiumProjectOptions): Project {
  const { now } = options;
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const metadata = { tags: [], visible: true, locked: false, createdAt: now, updatedAt: now };

  const diameterPx = toPixels(DIAMETER_MM, "mm");
  const centerPx = diameterPx / 2;

  // Retícula vertical: cada elemento apila su altura (fontSize * lineHeight
  // 1.2, salvo la línea divisoria) más un espacio fijo entre elementos: el
  // bloque completo se centra verticalmente en la página. Ver
  // THOREN_PILOT_TEMPLATE_STANDARD.md §5 para por qué se calcula así (y por
  // qué NO se extrajo un helper genérico de "apilado vertical" todavía —
  // una sola instancia de este patrón no lo justifica, ver §9).
  const wordmarkHeight = 15 * 1.2;
  const productNameHeight = 10 * 1.2;
  const dividerHeight = 0.8;
  const dataLineHeight = 8 * 1.2;
  const gapAfterWordmark = 4;
  const gapAfterProductName = 8;
  const gapAfterDivider = 8;
  const totalBlockHeight =
    wordmarkHeight + gapAfterWordmark + productNameHeight + gapAfterProductName + dividerHeight + gapAfterDivider + dataLineHeight;
  const blockTop = centerPx - totalBlockHeight / 2;

  const wordmarkY = blockTop;
  const productNameY = wordmarkY + wordmarkHeight + gapAfterWordmark;
  const dividerY = productNameY + productNameHeight + gapAfterProductName;
  const dataLineY = dividerY + dividerHeight + gapAfterDivider;

  // Ancho de caja de texto conservador (90px) — ver §5.4 de
  // THOREN_PILOT_TEMPLATE_STANDARD.md: 90px deja margen real frente al
  // ancho seguro real del círculo incluso en el punto más alejado del
  // centro vertical que usa este layout, sin necesitar trigonometría por
  // línea (que sería sobre-ingeniería para un solo template).
  const textBoxWidth = 90;
  const textBoxX = centerPx - textBoxWidth / 2;

  return {
    id: ProjectIdSchema.parse(`project_${generateId()}`),
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse(`document_${generateId()}`),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [
        {
          id: PageIdSchema.parse(`page_${generateId()}`),
          size: { width: DIAMETER_MM, height: DIAMETER_MM },
          unit: "mm",
          grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
          layers: [
            {
              id: LayerIdSchema.parse(`layer_${generateId()}`),
              objects: [
                // Línea de corte — mismo patrón que `createProjectFromSize`
                // (`shape: "circle"`), ver projectPresets.ts.
                {
                  id: ObjectIdSchema.parse(`object_${generateId()}`),
                  type: "ellipse",
                  transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                  size: { width: diameterPx, height: diameterPx },
                  style: { fill: "#ffffff", strokeWidth: 0.5, stroke: "#cccccc", opacity: 1, blendMode: "normal" },
                  metadata: { ...metadata, role: "die-line", name: "Línea de corte" },
                  pluginData: {},
                  customProperties: {},
                },
                // Wordmark / nombre de marca — dominante, único elemento
                // en peso 300 (Dirección de Arte del batch).
                {
                  id: ObjectIdSchema.parse(`object_${generateId()}`),
                  type: "text",
                  content: "TU MARCA",
                  fontFamily: FONT_FAMILY,
                  fontSize: 15,
                  fontWeight: 300,
                  textAlign: "center",
                  lineHeight: 1.2,
                  size: { width: textBoxWidth, height: wordmarkHeight },
                  transform: { x: textBoxX, y: wordmarkY, rotation: 0, scaleX: 1, scaleY: 1 },
                  style: { fill: COLOR_CARBON, strokeWidth: 0, opacity: 1, blendMode: "normal" },
                  metadata: { ...metadata, role: "wordmark", name: "Wordmark" },
                  pluginData: {},
                  customProperties: {},
                },
                // Nombre del producto — ejemplo tomado literalmente del
                // batch ("Serum Vitamina C").
                {
                  id: ObjectIdSchema.parse(`object_${generateId()}`),
                  type: "text",
                  content: "Serum Vitamina C",
                  fontFamily: FONT_FAMILY,
                  fontSize: 10,
                  fontWeight: 400,
                  textAlign: "center",
                  lineHeight: 1.2,
                  size: { width: textBoxWidth, height: productNameHeight },
                  transform: { x: textBoxX, y: productNameY, rotation: 0, scaleX: 1, scaleY: 1 },
                  style: { fill: COLOR_CARBON, strokeWidth: 0, opacity: 1, blendMode: "normal" },
                  metadata: { ...metadata, role: "product-name", name: "Nombre del producto" },
                  pluginData: {},
                  customProperties: {},
                },
                // Línea divisoria fina — máx. 40% del ancho del círculo
                // (Layout del batch); aquí 45px de 151.18px ≈ 30%.
                {
                  id: ObjectIdSchema.parse(`object_${generateId()}`),
                  type: "rectangle",
                  size: { width: 45, height: dividerHeight },
                  cornerRadius: 0,
                  transform: { x: centerPx - 22.5, y: dividerY, rotation: 0, scaleX: 1, scaleY: 1 },
                  style: { fill: COLOR_CARBON, strokeWidth: 0, opacity: 0.35, blendMode: "normal" },
                  metadata: { ...metadata, role: "divider", name: "Línea divisoria" },
                  pluginData: {},
                  customProperties: {},
                },
                // % de activo — el único uso del acento cobre, en un
                // elemento pequeño, nunca en un bloque grande (Dirección
                // de Arte del batch). Compuesto como un TextObject
                // independiente de "30ml" (ver nota de decisión técnica en
                // THOREN_PILOT_TEMPLATE_STANDARD.md §6 — Style.fill es un
                // solo color por objeto, no admite color parcial dentro de
                // un mismo string).
                {
                  id: ObjectIdSchema.parse(`object_${generateId()}`),
                  type: "text",
                  content: "15%",
                  fontFamily: FONT_FAMILY,
                  fontSize: 8,
                  fontWeight: 400,
                  textAlign: "right",
                  lineHeight: 1.2,
                  size: { width: 34, height: dataLineHeight },
                  transform: { x: centerPx - 36, y: dataLineY, rotation: 0, scaleX: 1, scaleY: 1 },
                  style: { fill: COLOR_COBRE, strokeWidth: 0, opacity: 1, blendMode: "normal" },
                  metadata: { ...metadata, role: "active-percentage", name: "% de activo" },
                  pluginData: {},
                  customProperties: {},
                },
                // Volumen.
                {
                  id: ObjectIdSchema.parse(`object_${generateId()}`),
                  type: "text",
                  content: "30ml",
                  fontFamily: FONT_FAMILY,
                  fontSize: 8,
                  fontWeight: 400,
                  textAlign: "left",
                  lineHeight: 1.2,
                  size: { width: 34, height: dataLineHeight },
                  transform: { x: centerPx + 2, y: dataLineY, rotation: 0, scaleX: 1, scaleY: 1 },
                  style: { fill: COLOR_CARBON, strokeWidth: 0, opacity: 1, blendMode: "normal" },
                  metadata: { ...metadata, role: "volume", name: "Volumen" },
                  pluginData: {},
                  customProperties: {},
                },
              ],
              metadata,
              pluginData: {},
              customProperties: {},
            },
          ],
          metadata,
          pluginData: {},
          customProperties: {},
        },
      ],
      assets: [],
      metadata,
      history: { entries: [] },
      pluginData: {},
      customProperties: {},
    },
    metadata: { ...metadata, name: "Serum Facial Premium" },
    pluginData: {},
    customProperties: {},
  };
}
