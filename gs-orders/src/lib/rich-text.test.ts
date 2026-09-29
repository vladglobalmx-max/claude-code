import { describe, expect, it } from "vitest";
import { sanitizeRichText } from "./rich-text";

describe("sanitizeRichText (THÖREN 0086)", () => {
  it("conserva las marcas que el editor puede producir", () => {
    const html =
      "<p>Color: <strong>Azul</strong></p><p><em>Grabado</em> <u>Láser</u></p><ul><li>Un logo</li><li>Un lado</li></ul><ol><li>Patty</li><li>Omar</li></ol>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("conserva alineación vía style=text-align (left/center/right)", () => {
    const html = '<p style="text-align: center">Centrado</p>';
    expect(sanitizeRichText(html)).toContain('style="text-align:center"');
  });

  it("elimina <script> por completo, incluido su contenido", () => {
    const html = "<p>Hola</p><script>alert('xss')</script>";
    const out = sanitizeRichText(html);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>Hola</p>");
  });

  it("elimina atributos de evento (onerror, onclick…)", () => {
    const html = '<p onclick="alert(1)">Hola</p>';
    const out = sanitizeRichText(html);
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("alert");
  });

  it("elimina etiquetas fuera del allowlist (img, a, table, h1…)", () => {
    const html = '<h1>Título</h1><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">click</a>';
    const out = sanitizeRichText(html);
    expect(out).not.toContain("<h1");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("javascript:");
  });

  it("elimina style con propiedades fuera del allowlist (solo permite text-align)", () => {
    const html = '<p style="text-align: center; background: url(javascript:alert(1))">Hola</p>';
    const out = sanitizeRichText(html);
    expect(out).not.toContain("background");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("text-align:center");
  });

  it("rechaza un valor de text-align fuera del allowlist (justify)", () => {
    const html = '<p style="text-align: justify">Hola</p>';
    expect(sanitizeRichText(html)).not.toContain("text-align");
  });

  it("texto plano legacy (sin ninguna etiqueta) pasa intacto", () => {
    const text = "Color: Azul\nGrabado: Láser\nPosición: Un lado";
    expect(sanitizeRichText(text)).toBe(text);
  });

  it("escapa correctamente texto plano con caracteres especiales (& < >)", () => {
    const text = "Rojo & Azul <importante>";
    const out = sanitizeRichText(text);
    expect(out).not.toContain("<importante>");
    expect(out).toContain("&amp;");
  });
});
