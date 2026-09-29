import { sanitizeRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils/cn";

/**
 * THÖREN 0086 — renderiza HTML enriquecido (hoy solo customer_requirements)
 * de forma segura: re-sanitiza (defensa en profundidad, ver
 * src/lib/rich-text.ts) antes de dangerouslySetInnerHTML. Las utilidades
 * `[&_x]:` reponen exactamente lo que el preflight de Tailwind resetea
 * (list-style, márgenes de párrafo) — sin esto, listas con viñetas/
 * numeradas del editor se verían sin ningún marcador. `white-space:
 * pre-line` es compatibilidad con texto plano legacy (capturado antes de
 * 0086, sin ninguna etiqueta HTML) — un salto de línea suelto en ese texto
 * viejo sigue respetándose visualmente; el HTML nuevo ya trae sus propios
 * saltos vía <p>/<br>, así que esto no le afecta.
 */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(
        "whitespace-pre-line [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-1 [&_p]:m-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
    />
  );
}
