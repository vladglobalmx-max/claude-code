import { DocumentSchema } from "@impulso/document-schema";
import { describe, expect, it } from "vitest";
import { buildBackgroundFill, buildDocumentDraft, buildTextObject } from "../archetypes/helpers.js";
import type { RecipePalette } from "../recipe.js";
import { validarComposicion } from "./filtroCalidad.js";

const NOW = "2026-07-30T00:00:00.000Z";
const PAGE_SIZE = 200;
const PALETTE: RecipePalette = { background: "#f2ede4", ink: "#1c1917", accent: "#6b5228" };

function documentWith(objects: ReturnType<typeof buildTextObject>[]) {
  const background = buildBackgroundFill(PAGE_SIZE, PALETTE.background, NOW);
  return DocumentSchema.parse(buildDocumentDraft(PAGE_SIZE, [background, ...objects], NOW));
}

describe("validarComposicion", () => {
  it("aprueba una composición sin problemas estructurales", async () => {
    const text = buildTextObject({
      content: "Marcela & Andrés",
      fontFamily: "Georgia",
      fontWeight: 600,
      fontSize: 20,
      fill: PALETTE.ink,
      x: 10,
      y: 90,
      width: 180,
      height: 24,
      role: "nombre",
      now: NOW,
    });
    const validacion = await validarComposicion(documentWith([text]), PALETTE, ["Marcela", "Andrés"]);
    expect(validacion.aprobada).toBe(true);
    expect(validacion.fallas).toEqual([]);
  });

  it("rechaza texto desbordado (caja demasiado angosta para el contenido)", async () => {
    const text = buildTextObject({
      content: "Un nombre mucho más largo de lo que la caja permite",
      fontFamily: "Georgia",
      fontWeight: 600,
      fontSize: 30,
      fill: PALETTE.ink,
      x: 10,
      y: 90,
      width: 20,
      height: 24,
      role: "nombre",
      now: NOW,
    });
    const validacion = await validarComposicion(documentWith([text]), PALETTE, ["Un nombre"]);
    expect(validacion.aprobada).toBe(false);
    expect(validacion.fallas.some((f) => f.includes("desbordado"))).toBe(true);
  });

  it("rechaza contraste insuficiente entre el texto y el fondo", async () => {
    const text = buildTextObject({
      content: "Apenas visible",
      fontFamily: "Arial",
      fontWeight: 400,
      fontSize: 14,
      fill: "#efe9de", // casi idéntico al fondo #f2ede4
      x: 10,
      y: 90,
      width: 180,
      height: 20,
      role: "nombre",
      now: NOW,
    });
    const validacion = await validarComposicion(documentWith([text]), PALETTE, ["Apenas visible"]);
    expect(validacion.aprobada).toBe(false);
    expect(validacion.fallas.some((f) => f.includes("Contraste insuficiente"))).toBe(true);
  });

  it("rechaza dos objetos de contenido que se superponen", async () => {
    const a = buildTextObject({
      content: "Uno",
      fontFamily: "Arial",
      fontWeight: 400,
      fontSize: 14,
      fill: PALETTE.ink,
      x: 10,
      y: 10,
      width: 50,
      height: 20,
      role: "a",
      now: NOW,
    });
    const b = buildTextObject({
      content: "Dos",
      fontFamily: "Arial",
      fontWeight: 400,
      fontSize: 14,
      fill: PALETTE.ink,
      x: 20,
      y: 15,
      width: 50,
      height: 20,
      role: "b",
      now: NOW,
    });
    const validacion = await validarComposicion(documentWith([a, b]), PALETTE, ["Uno", "Dos"]);
    expect(validacion.aprobada).toBe(false);
    expect(validacion.fallas.some((f) => f.includes("Colisión"))).toBe(true);
  });

  it("rechaza cuando el contenido real del usuario no sobrevive al SVG exportado", async () => {
    const text = buildTextObject({
      content: "Marcela & Andrés",
      fontFamily: "Georgia",
      fontWeight: 600,
      fontSize: 20,
      fill: PALETTE.ink,
      x: 10,
      y: 90,
      width: 180,
      height: 24,
      role: "nombre",
      now: NOW,
    });
    const validacion = await validarComposicion(documentWith([text]), PALETTE, ["Un Nombre Que Nunca Aparece"]);
    expect(validacion.aprobada).toBe(false);
    expect(validacion.fallas.some((f) => f.includes("Fidelidad de contenido"))).toBe(true);
  });

  it("la fidelidad de contenido no distingue mayúsculas/minúsculas", async () => {
    const text = buildTextObject({
      content: "MARCELA",
      fontFamily: "Arial",
      fontWeight: 400,
      fontSize: 14,
      fill: PALETTE.ink,
      x: 10,
      y: 90,
      width: 180,
      height: 20,
      role: "nombre",
      now: NOW,
    });
    const validacion = await validarComposicion(documentWith([text]), PALETTE, ["Marcela"]);
    expect(validacion.aprobada).toBe(true);
  });
});
