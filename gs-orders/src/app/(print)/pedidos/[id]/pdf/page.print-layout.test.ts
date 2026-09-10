import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THÖREN — BUG REAL POST-DEPLOY (PDF de Pedido en 3 páginas, KST-20261009-010):
 * el <footer> tenía `break-inside-avoid` sin scoping de print, así que
 * cuando el contenido de arriba llegaba casi al final de la página 2, el
 * bloque completo del footer no cabía y el navegador lo empujaba entero a
 * una página 3 casi vacía. Pruebas de inspección de fuente — la única
 * forma confiable de garantizar que esa regla no vuelva a aparecer (un
 * test de layout renderizado no es viable en este repo, ver page.tsx: no
 * hay infraestructura de captura de páginas impresas).
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function readPageSource(): string {
  return stripComments(readFileSync(join(__dirname, "page.tsx"), "utf-8"));
}

describe("footer del PDF de Pedido nunca fuerza una pagina final casi vacia", () => {
  it("el <footer> no tiene break-inside-avoid (la regla que empujaba la 3ra pagina)", () => {
    const source = readPageSource();
    const footerMatch = source.match(/<footer\b[^>]*>/);
    expect(footerMatch).not.toBeNull();
    expect(footerMatch![0]).not.toMatch(/break-inside-avoid/);
  });

  it("el documento no fuerza un salto de pagina al final (sin break-after/page-break-after)", () => {
    const source = readPageSource();
    expect(source).not.toMatch(/break-after-page/);
    expect(source).not.toMatch(/page-break-after/);
  });

  it("existe una version compacta de una sola linea del footer para impresion", () => {
    const source = readPageSource();
    expect(source).toMatch(/hidden print:block/);
  });
});

describe("bloques grandes ya no fuerzan break-inside-avoid sobre todo su contenido", () => {
  it("la seccion completa de Productos ya no envuelve todas las partidas en break-inside-avoid", () => {
    const source = readPageSource();
    const sectionMatch = source.match(/<section>\s*\n\s*<p[^>]*>\{providerLabel\("products"/);
    expect(sectionMatch).not.toBeNull();
  });

  it("la seccion completa de Fotografias ya no envuelve todo el grid en break-inside-avoid", () => {
    const source = readPageSource();
    const sectionMatch = source.match(/<section className="mt-6 print:mt-2">/);
    expect(sectionMatch).not.toBeNull();
  });

  it("cada partida individual y cada fotografia individual siguen protegidas (unidades pequenas)", () => {
    const source = readPageSource();
    expect(source).toMatch(/className="break-inside-avoid rounded-lg border border-border p-2\.5/);
    expect(source).toMatch(/<figure key=\{img\.id\} className="break-inside-avoid/);
  });
});

describe("espaciado compacto solo en impresion (sin afectar la vista en pantalla)", () => {
  it("header/metadata/partidas/footer tienen clases print: mas ajustadas", () => {
    const source = readPageSource();
    expect(source).toMatch(/print:mb-3 print:pb-3/); // header
    expect(source).toMatch(/print:space-y-1\.5/); // separacion entre partidas
    expect(source).toMatch(/print:mt-2\b/); // margen antes de Fotografias/footer
  });

  it("no se redujo agresivamente el tamano de fuente (no aparecen utilidades text-[9px] o menores)", () => {
    const source = readPageSource();
    expect(source).not.toMatch(/text-\[[0-8]px\]/);
  });
});
