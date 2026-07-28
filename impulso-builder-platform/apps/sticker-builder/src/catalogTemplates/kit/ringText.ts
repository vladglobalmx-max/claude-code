import type { TextObject } from "@impulso/document-schema";
import { createTextObject } from "./textObjects.js";
import type { CatalogIdFactory } from "./ids.js";

export interface RingTextFragment {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  fill: string;
  role: string;
  name: string;
  /** Ancho de la caja de este fragmento — no hay métrica real de fuente
   * disponible en tiempo de construcción del Project (el editor la mide
   * en tiempo de render), así que se estima de forma generosa
   * (`content.length * fontSize`) si no se especifica: `Konva.Text` hace
   * word-wrap dentro de su caja por defecto, y una estimación insuficiente
   * produce una segunda línea invisible (recortada visualmente, aunque el
   * `content` completo siga presente en el `TextObject` — confirmado
   * durante `THOREN_VISUAL_ACCEPTANCE.md` sobre 3.1 Sello de Cita: "SALÓN"
   * se recortaba a "SALÓ" con el estimado anterior de `* 0.65`). Sigue
   * siendo preferible pasar un `width` explícito medido en el editor para
   * producción real; el estimado es solo un fallback seguro. */
  width?: number;
}

export interface ArrangeRingTextOptions {
  ids: CatalogIdFactory;
  now: string;
  centerX: number;
  centerY: number;
  /** Radio (px) donde se ubica el borde superior de cada fragmento —
   * cada fragmento se extiende desde este radio HACIA el centro (nunca
   * hacia afuera, para no invadir el área segura/sangrado). */
  radius: number;
  /** Ángulo (grados) del primer fragmento, convención estándar de canvas
   * (0° = 3 en punto, sentido horario, y +90 = 6 en punto) — default -90
   * (12 en punto / arriba), el punto de partida convencional de un sello
   * circular. */
  startAngleDeg?: number;
  fragments: readonly RingTextFragment[];
}

/**
 * Aproxima un anillo de texto perimetral (`THOREN_CATALOG_PRODUCTION_PLAN_v1.md`,
 * Lote 3) distribuyendo `fragments` en ángulos igualmente espaciados
 * alrededor de un círculo, cada uno como un `TextObject` recto rotado para
 * quedar tangente al círculo en su posición — **no es texto curvado letra
 * por letra** (`@impulso/document-schema` no lo soporta, un `TextObject`
 * es siempre una caja recta); es la misma clase de aproximación
 * documentada ya usada para la partición de color del piloto (ver
 * `THOREN_DECISION_LOG.md`).
 *
 * Convención de "sello/moneda": los fragmentos se leen en sentido horario
 * alrededor del anillo — el fragmento en la posición inferior del círculo
 * aparece rotado ~180° respecto a una lectura normal de página (igual que
 * el texto en la parte inferior de una moneda o un sello de cera real);
 * esto es correcto y esperado para este patrón de diseño, no un defecto.
 *
 * Derivación geométrica (pivote de rotación de Konva = `transform.x,y`,
 * es decir, la esquina superior-izquierda de la caja de texto, no su
 * centro): para que el punto superior-centro de la caja (que coincide con
 * el punto visible del texto gracias a `textAlign: "center"`) caiga
 * exactamente sobre el círculo en el ángulo φ, con la caja rotada φ+90°
 * (tangente, sentido horario), se despeja:
 *   x = centerX + radius·cos(φ) + (width/2)·sin(φ)
 *   y = centerY + radius·sin(φ) − (width/2)·cos(φ)
 * Verificado manualmente para φ=-90° (arriba: x=centerX-width/2,
 * y=centerY-radius, rotación 0° — exactamente una caja horizontal normal
 * centrada arriba del círculo) y φ=0° (derecha: x=centerX+radius,
 * y=centerY-width/2, rotación 90°).
 */
export function arrangeRingText(options: ArrangeRingTextOptions): TextObject[] {
  const { ids, now, centerX, centerY, radius, fragments } = options;
  const startAngleDeg = options.startAngleDeg ?? -90;
  const stepDeg = 360 / fragments.length;

  return fragments.map((fragment, index) => {
    const phiDeg = startAngleDeg + index * stepDeg;
    const phiRad = (phiDeg * Math.PI) / 180;
    const width = fragment.width ?? fragment.content.length * fragment.fontSize;
    const height = fragment.fontSize * 1.2;
    const rotation = phiDeg + 90;

    const x = centerX + radius * Math.cos(phiRad) + (width / 2) * Math.sin(phiRad);
    const y = centerY + radius * Math.sin(phiRad) - (width / 2) * Math.cos(phiRad);

    return createTextObject({
      ids,
      now,
      content: fragment.content,
      fontFamily: fragment.fontFamily,
      fontSize: fragment.fontSize,
      fontWeight: fragment.fontWeight,
      textAlign: "center",
      fill: fragment.fill,
      role: fragment.role,
      name: fragment.name,
      x,
      y,
      width,
      height,
      rotation,
    });
  });
}
