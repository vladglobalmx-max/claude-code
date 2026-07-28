/**
 * Infraestructura de producción de templates del catálogo THÖREN —
 * extraída del Template Piloto Oficial (Serum Facial Premium) una vez
 * aprobado como estándar de producción. Ver
 * `docs/product/THOREN_PRODUCTION_INFRASTRUCTURE.md` para qué problema
 * resuelve cada pieza y qué automatiza.
 */
export { createIdFactory, type CatalogIdFactory } from "./ids.js";
export { buildElementMetadata, type BuildElementMetadataOptions } from "./metadata.js";
export {
  createTextObject,
  createSplitAccentLine,
  type CreateTextObjectOptions,
  type SplitAccentLineSide,
  type CreateSplitAccentLineOptions,
} from "./textObjects.js";
export {
  createRectangle,
  createEllipse,
  createDividerLine,
  type CreateRectangleOptions,
  type CreateEllipseOptions,
  type CreateDividerLineOptions,
} from "./graphicElements.js";
export { createDieLineObjects, type DieLineShape, type CreateDieLineObjectsOptions } from "./dieLine.js";
export { arrangeRingText, type RingTextFragment, type ArrangeRingTextOptions } from "./ringText.js";
export { stackVertically, textLineHeight, type StackItem, type StackedPosition, type VerticalStackResult } from "./layout.js";
export {
  type VisualFamily,
  type TypographyRole,
  type CharacterTypographyRole,
  type SupportTypographyRole,
  type TemplatePalette,
  type TemplateTypography,
  type TemplateTypographyChoice,
  type TemplateStyle,
  FAMILY_SAFE_MARGIN_MM,
  getFamilySafeMarginMm,
} from "./styleSystem.js";
export { createCatalogProject, type CreateCatalogProjectOptions, type CatalogProjectBuildContext } from "./projectFactory.js";
export { buildCatalogTemplateDescriptor, type BuildCatalogTemplateDescriptorOptions } from "./descriptorFactory.js";
export type { CatalogTemplateSeed } from "./types.js";
export { validateCatalogProject, validateTemplateStyle, type CatalogValidationIssue } from "./validators.js";
