import { validateProject, type Project } from "@impulso/document-schema";
import type { TemplateStyle } from "./styleSystem.js";

export interface CatalogValidationIssue {
  code: string;
  message: string;
}

/**
 * Validación automática de un `Project` de catálogo — más allá de "¿es
 * estructuralmente válido según el schema?" (eso ya lo hace
 * `validateProject`), comprueba las trampas concretas que el piloto
 * encontró o podría haber encontrado:
 *
 * - `text-without-box`: un `TextObject` sin `size` no hace wrap ni se
 *   centra (limitación real de `@impulso/document-schema`, ver
 *   `THOREN_PILOT_TEMPLATE_STANDARD.md` §6).
 * - `object-without-role`: sin `metadata.role`, un objeto es invisible
 *   para el panel de Capas con nombre semántico, para los tests
 *   estructurales (`objects.find(o => o.metadata.role === ...)`) y para
 *   los selectores e2e — todo el patrón de verificación usado en el
 *   piloto depende de que cada objeto de contenido tenga un `role`.
 * - `multiple-die-lines`: como mucho un objeto puede representar la línea
 *   de corte (mismo criterio que `createDieLineObjects`).
 *
 * No revalida reglas ya garantizadas por el tipo (`Style.fill` un color
 * por objeto, por ejemplo) — solo lo que el schema permite pero puede
 * seguir siendo un error de producción real.
 */
export function validateCatalogProject(project: Project): CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];

  try {
    validateProject(project);
  } catch (error) {
    issues.push({ code: "schema-invalid", message: error instanceof Error ? error.message : String(error) });
    return issues;
  }

  const objects = project.document.pages.flatMap((page) => page.layers.flatMap((layer) => layer.objects));

  for (const object of objects) {
    const label = object.metadata.name ?? object.id;

    if (object.type === "text" && !object.size) {
      issues.push({
        code: "text-without-box",
        message: `TextObject "${label}" no tiene 'size' — no hará wrap ni se centrará correctamente.`,
      });
    }

    if (!object.metadata.role) {
      issues.push({
        code: "object-without-role",
        message: `El objeto "${label}" no tiene metadata.role — dificulta identificarlo en Capas, tests y selectores e2e.`,
      });
    }
  }

  const dieLines = objects.filter((object) => object.metadata.role === "die-line");
  if (dieLines.length > 1) {
    issues.push({
      code: "multiple-die-lines",
      message: `Se encontraron ${dieLines.length} objetos con metadata.role "die-line" — debe haber como máximo uno.`,
    });
  }

  return issues;
}

/**
 * Validación automática de un `TemplateStyle` contra las reglas de
 * `THOREN_DESIGN_LANGUAGE_GUIDE.md` que son mecánicamente verificables:
 * §2.2 (máximo 1 tipografía "de carácter" + 1 "de apoyo" — ya lo impone el
 * tipo `TemplateTypography`, pero un `display`/`support` con el mismo
 * `fontFamily` sigue siendo un error de captura) y §3.1 (3 colores base
 * deben ser 3 colores realmente distintos, no un color repetido con
 * distinto nombre de rol).
 */
export function validateTemplateStyle(style: TemplateStyle): CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  const { background, text, accent } = style.palette;

  if (background === text || background === accent || text === accent) {
    issues.push({
      code: "duplicate-palette-colors",
      message: "background/text/accent deben ser 3 colores distintos entre sí (THOREN_DESIGN_LANGUAGE_GUIDE.md §3.1).",
    });
  }

  if (style.palette.variableAccents?.length === 0) {
    issues.push({
      code: "empty-variable-accents",
      message: "variableAccents está declarado pero vacío — omite el campo si el template no tiene acento variable.",
    });
  }

  if (style.typography.display && style.typography.support && style.typography.display.fontFamily === style.typography.support.fontFamily) {
    issues.push({
      code: "duplicate-typography-family",
      message: "display y support usan la misma fontFamily — revisa si en realidad se quiso una sola tipografía (THOREN_DESIGN_LANGUAGE_GUIDE.md §2.2).",
    });
  }

  return issues;
}
