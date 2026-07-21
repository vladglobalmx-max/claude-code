import type { ImpositionLayout } from "./impositionLayout.js";

export interface LayoutGeometryIssue {
  code: "piece_outside_sheet" | "footprints_overlap";
  sheetIndex: number;
  copyIndex: number;
}

const EPS = 1e-6;

/**
 * Red de seguridad real sobre un `ImpositionLayout` ya calculado (Fase
 * 9.4, sección 18: `cut_paths_overlap`/`crop_marks_overlap`/
 * `piece_outside_sheet`) — nunca debería producir issues en la práctica,
 * porque `computeImpositionLayout` ya garantiza que los footprints (que
 * YA incluyen el espacio de marcas cuando `marksMode === "per-piece"`,
 * sección 8) caben dentro del área útil sin solaparse. Verifica esa
 * garantía en vez de asumirla — si alguna vez regresiona, esto lo
 * detecta antes de llegar a producción (mismo patrón que
 * `checkCropMarksGeometry` de Fase 9.3).
 *
 * Un solo chequeo de solapamiento de FOOTPRINTS cubre honestamente tanto
 * `cut_paths_overlap` como `crop_marks_overlap`: el cut path de una pieza
 * y sus marcas (si `marksMode === "per-piece"`) viven siempre DENTRO de
 * su propio footprint — si los footprints no se solapan entre sí, ninguno
 * de esos dos elementos puede solaparse tampoco (Preflight, sección 18,
 * mapea este único resultado a ambos códigos según lo que aplique).
 */
export function validateImpositionLayoutGeometry(layout: ImpositionLayout): LayoutGeometryIssue[] {
  const issues: LayoutGeometryIssue[] = [];

  for (const sheet of layout.sheets) {
    for (const piece of sheet.pieces) {
      const { x, y } = piece.footprintPosition;
      if (x < -EPS || y < -EPS || x + layout.footprint.width > layout.sheet.width + EPS || y + layout.footprint.height > layout.sheet.height + EPS) {
        issues.push({ code: "piece_outside_sheet", sheetIndex: piece.sheetIndex, copyIndex: piece.copyIndex });
      }
    }

    for (let i = 0; i < sheet.pieces.length; i++) {
      for (let j = i + 1; j < sheet.pieces.length; j++) {
        if (footprintsOverlap(sheet.pieces[i]!.footprintPosition, sheet.pieces[j]!.footprintPosition, layout.footprint.width, layout.footprint.height)) {
          issues.push({ code: "footprints_overlap", sheetIndex: sheet.sheetIndex, copyIndex: sheet.pieces[j]!.copyIndex });
        }
      }
    }
  }

  return issues;
}

function footprintsOverlap(a: { x: number; y: number }, b: { x: number; y: number }, width: number, height: number): boolean {
  return a.x < b.x + width - EPS && b.x < a.x + width - EPS && a.y < b.y + height - EPS && b.y < a.y + height - EPS;
}
