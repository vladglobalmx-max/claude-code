import sanitizeHtml from "sanitize-html";

/**
 * THÖREN 0086 — único sanitizador de HTML enriquecido del proyecto
 * (quote_items.customer_requirements, editor Tiptap). Allowlist cerrado:
 * solo las marcas/estructuras que el editor puede producir realmente
 * (negrita, cursiva, subrayado, listas, párrafos, saltos de línea,
 * alineación vía `style="text-align: ..."`). Nada de imágenes, links,
 * tablas, scripts, ni atributos de evento — esto NO es un editor
 * genérico, es específicamente el de "Requisitos del cliente".
 *
 * Se llama en dos puntos de la app (defensa en profundidad): al escribir
 * (zod transform en src/lib/validations/quote.ts, antes de llegar a
 * cualquier RPC) y al leer (RichTextView, antes de cada
 * dangerouslySetInnerHTML) — así un dato histórico sin sanitizar, si alguna
 * vez existiera, tampoco se renderiza sin pasar por aquí. Un tercer punto,
 * a nivel SQL (fn_check_rich_text_safety en 0086_quote_item_rich_text_
 * requirements.sql), rechaza con excepción cualquier HTML peligroso dentro
 * de las RPC de Quotes mismas — así el zod transform de aquí NO es la única
 * barrera contra un caller que invoque esas RPC directamente vía
 * supabase-js/PostgREST, bypasseando la app. Texto plano legacy (sin
 * ninguna etiqueta, capturado antes de 0086) pasa intacto: sanitize-html no
 * toca texto que ya es texto.
 */
const ALLOWED_TAGS = ["p", "strong", "b", "em", "i", "u", "ul", "ol", "li", "br"];

const ALLOWED_STYLES = {
  "*": {
    "text-align": [/^left$/, /^center$/, /^right$/],
  },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": ["style"],
    },
    allowedStyles: ALLOWED_STYLES,
  });
}
