import { describe, expect, it } from "vitest";
import { createCatalogProject } from "./projectFactory.js";
import { createTextObject } from "./textObjects.js";
import { createEllipse } from "./graphicElements.js";
import { createSerumFacialPremiumProject } from "../serumFacialPremium.js";
import { validateCatalogProject, validateTemplateStyle } from "./validators.js";
import type { TemplateStyle } from "./styleSystem.js";

const NOW = "2026-07-28T00:00:00.000Z";

describe("validateCatalogProject", () => {
  it("no reporta ningún issue para el template piloto real (Serum Facial Premium)", () => {
    const project = createSerumFacialPremiumProject({ now: NOW, generateId: (() => { let n = 0; return () => `id${++n}`; })() });
    expect(validateCatalogProject(project)).toEqual([]);
  });

  it("reporta schema-invalid y detiene el resto de checks cuando el Project no valida", () => {
    const invalid = { id: "not-a-real-project" } as unknown as Parameters<typeof validateCatalogProject>[0];
    const issues = validateCatalogProject(invalid);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("schema-invalid");
  });

  it("reporta text-without-box cuando un TextObject no tiene 'size'", () => {
    const project = createCatalogProject({
      moduleId: "sticker-builder",
      name: "n",
      widthMm: 40,
      heightMm: 40,
      now: NOW,
      buildObjects: ({ ids }) => {
        const withoutBox = createTextObject({ ids, now: NOW, content: "x", fontFamily: "Poppins", fontSize: 10, fill: "#000", role: "wordmark", name: "n", x: 0, y: 0, width: 10, height: 10 });
        const { size, ...rest } = withoutBox;
        void size;
        return [rest as typeof withoutBox];
      },
    });
    const issues = validateCatalogProject(project);
    expect(issues.some((i) => i.code === "text-without-box")).toBe(true);
  });

  it("reporta object-without-role cuando un objeto no tiene metadata.role", () => {
    const project = createCatalogProject({
      moduleId: "sticker-builder",
      name: "n",
      widthMm: 40,
      heightMm: 40,
      now: NOW,
      buildObjects: ({ ids }) => [createEllipse({ ids, now: NOW, x: 0, y: 0, width: 10, height: 10 })],
    });
    const issues = validateCatalogProject(project);
    expect(issues.some((i) => i.code === "object-without-role")).toBe(true);
  });

  it("reporta multiple-die-lines cuando hay más de un objeto con role 'die-line'", () => {
    const project = createCatalogProject({
      moduleId: "sticker-builder",
      name: "n",
      widthMm: 40,
      heightMm: 40,
      now: NOW,
      buildObjects: ({ ids }) => [
        createEllipse({ ids, now: NOW, x: 0, y: 0, width: 10, height: 10, role: "die-line", name: "a" }),
        createEllipse({ ids, now: NOW, x: 0, y: 0, width: 10, height: 10, role: "die-line", name: "b" }),
      ],
    });
    const issues = validateCatalogProject(project);
    expect(issues.some((i) => i.code === "multiple-die-lines")).toBe(true);
  });
});

describe("validateTemplateStyle", () => {
  const validStyle: TemplateStyle = {
    family: "lujo-silencioso",
    palette: { background: "#EDEAE2", text: "#23282B", accent: "#9C4E27" },
    typography: { support: { role: "sans-body", fontFamily: "Poppins" } },
  };

  it("no reporta issues para un estilo válido (paleta de Serum Facial Premium)", () => {
    expect(validateTemplateStyle(validStyle)).toEqual([]);
  });

  it("reporta duplicate-palette-colors cuando dos de los 3 colores coinciden", () => {
    const style: TemplateStyle = { ...validStyle, palette: { ...validStyle.palette, accent: validStyle.palette.text } };
    const issues = validateTemplateStyle(style);
    expect(issues.some((i) => i.code === "duplicate-palette-colors")).toBe(true);
  });

  it("reporta empty-variable-accents cuando el arreglo está declarado pero vacío", () => {
    const style: TemplateStyle = { ...validStyle, palette: { ...validStyle.palette, variableAccents: [] } };
    const issues = validateTemplateStyle(style);
    expect(issues.some((i) => i.code === "empty-variable-accents")).toBe(true);
  });

  it("reporta duplicate-typography-family cuando display y support usan la misma fontFamily", () => {
    const style: TemplateStyle = {
      ...validStyle,
      typography: {
        display: { role: "display-editorial", fontFamily: "Poppins" },
        support: { role: "sans-body", fontFamily: "Poppins" },
      },
    };
    const issues = validateTemplateStyle(style);
    expect(issues.some((i) => i.code === "duplicate-typography-family")).toBe(true);
  });
});
