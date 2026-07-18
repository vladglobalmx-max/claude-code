import { describe, expect, it } from "vitest";
import { textMarkup } from "./textMarkup.js";
import { buildText } from "../testUtils/fixtures.js";

describe("textMarkup", () => {
  it("una sola línea produce un único tspan con y=fontSize*0.8", () => {
    const object = buildText("t1", { content: "Hola", fontSize: 20 });
    const markup = textMarkup(object);
    expect(markup).toContain('y="16"');
    expect(markup).toContain(">Hola</tspan>");
  });

  it("múltiples líneas (saltos explícitos) producen un tspan por línea con dy=lineHeight*fontSize", () => {
    const object = buildText("t2", { content: "Uno\nDos", fontSize: 10, lineHeight: 1.5 });
    const markup = textMarkup(object);
    expect(markup).toContain(">Uno</tspan>");
    expect(markup).toContain('dy="15"');
    expect(markup).toContain(">Dos</tspan>");
  });

  it("sin size, no hay text-anchor especial (start, x=0)", () => {
    const object = buildText("t3", { textAlign: "center" });
    const markup = textMarkup(object);
    expect(markup).toContain('text-anchor="start"');
  });

  it("con size y textAlign=center, usa text-anchor=middle y x=width/2", () => {
    const object = buildText("t4", { textAlign: "center", size: { width: 100, height: 50 } });
    const markup = textMarkup(object);
    expect(markup).toContain('text-anchor="middle"');
    expect(markup).toContain('x="50"');
  });

  it("con size y textAlign=right, usa text-anchor=end y x=width", () => {
    const object = buildText("t5", { textAlign: "right", size: { width: 100, height: 50 } });
    const markup = textMarkup(object);
    expect(markup).toContain('text-anchor="end"');
    expect(markup).toContain('x="100"');
  });

  it("escapa caracteres especiales del contenido", () => {
    const object = buildText("t6", { content: "<script>&\"</script>" });
    const markup = textMarkup(object);
    expect(markup).not.toContain("<script>");
    expect(markup).toContain("&lt;script&gt;&amp;");
  });

  it("fontWeight numérico se usa directamente (sin traducción bold/normal)", () => {
    const object = buildText("t7", { fontWeight: 700 });
    expect(textMarkup(object)).toContain('font-weight="700"');
  });
});
