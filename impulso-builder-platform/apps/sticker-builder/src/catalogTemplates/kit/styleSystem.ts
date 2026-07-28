/**
 * Modela, en tipos, las reglas ya formalizadas en
 * `THOREN_DESIGN_LANGUAGE_GUIDE.md` — no inventa un lenguaje visual nuevo,
 * lo hace verificable en código. No fija paletas/tipografías concretas por
 * template (esas siguen viniendo de cada batch, ver
 * `TEMPLATE_BATCH_XX.md`): fija la ESTRUCTURA que cualquier `TemplateStyle`
 * debe respetar (3 colores fijos + acento variable opcional, máximo 1
 * tipografía "de carácter" + 1 de apoyo), para que `validateTemplateStyle`
 * (`validators.ts`) pueda comprobarla automáticamente.
 */

/** Las 6 familias de lenguaje visual — `THOREN_DESIGN_LANGUAGE_GUIDE.md` §1. */
export type VisualFamily =
  | "artesanal-calido"
  | "lujo-silencioso"
  | "audaz-grafico"
  | "tecnico-funcional"
  | "elegante-personal"
  | "impacto-comercial";

/** Los 4 roles tipográficos — `THOREN_DESIGN_LANGUAGE_GUIDE.md` §2.1.
 * "Script/Manuscrita" y "Display de Impacto" cuentan, junto con "Display
 * Editorial", como tipografías "de carácter" (máximo 1 por template);
 * "Sans Body/Utilitaria" y "Técnica/Monoespaciada" son "de apoyo". */
export type CharacterTypographyRole = "display-editorial" | "display-impacto" | "script";
export type SupportTypographyRole = "sans-body" | "tecnica-mono";
export type TypographyRole = CharacterTypographyRole | SupportTypographyRole;

/** Margen de aire (mm) respecto al área segura recomendado por familia —
 * `THOREN_DESIGN_LANGUAGE_GUIDE.md` §5.3. Lujo Silencioso es el máximo del
 * sistema (6-8mm, aquí el punto medio 7); Audaz/Técnico/Impacto Comercial
 * usan el mínimo funcional (el área segura de 3mm y poco más). */
export const FAMILY_SAFE_MARGIN_MM: Record<VisualFamily, number> = {
  "lujo-silencioso": 7,
  "artesanal-calido": 4.5,
  "elegante-personal": 4.5,
  "audaz-grafico": 3,
  "tecnico-funcional": 3,
  "impacto-comercial": 3,
};

export function getFamilySafeMarginMm(family: VisualFamily): number {
  return FAMILY_SAFE_MARGIN_MM[family];
}

/**
 * "3 colores base + 1 acento intercambiable opcional" —
 * `THOREN_DESIGN_LANGUAGE_GUIDE.md` §3.1/§3.3. `variableAccents`, cuando
 * existe, es el color que cambia por variante de producto (proceso de
 * café, sabor de mermelada), nunca una forma de agregar un 4º color fijo.
 */
export interface TemplatePalette {
  background: string;
  text: string;
  accent: string;
  variableAccents?: string[];
}

export interface TemplateTypographyChoice<TRole extends TypographyRole = TypographyRole> {
  role: TRole;
  fontFamily: string;
}

/** Máximo 1 tipografía "de carácter" + 1 "de apoyo" —
 * `THOREN_DESIGN_LANGUAGE_GUIDE.md` §2.2 ("nunca 2 display simultáneos"). */
export interface TemplateTypography {
  display?: TemplateTypographyChoice<CharacterTypographyRole>;
  support?: TemplateTypographyChoice<SupportTypographyRole>;
}

export interface TemplateStyle {
  family: VisualFamily;
  palette: TemplatePalette;
  typography: TemplateTypography;
}
