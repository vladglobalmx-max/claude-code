import { describe, expect, it } from "vitest";
import { evaluateNumericExpression } from "./numericExpression.js";

describe("evaluateNumericExpression", () => {
  it("acepta un valor absoluto entero", () => {
    expect(evaluateNumericExpression(10, "120")).toBe(120);
  });

  it("acepta un valor absoluto negativo y decimal", () => {
    expect(evaluateNumericExpression(10, "-4.5")).toBe(-4.5);
  });

  it("+n suma al valor actual", () => {
    expect(evaluateNumericExpression(10, "+5")).toBe(15);
  });

  it("un valor negativo absoluto tiene prioridad sobre la resta relativa (-5 fija el valor, no lo resta)", () => {
    expect(evaluateNumericExpression(10, "-5")).toBe(-5);
  });

  it("-n resta del valor actual cuando el operando está separado por un espacio (forma inequívoca)", () => {
    expect(evaluateNumericExpression(10, "- 5")).toBe(5);
  });

  it("*n multiplica el valor actual", () => {
    expect(evaluateNumericExpression(10, "*2")).toBe(20);
  });

  it("/n divide el valor actual", () => {
    expect(evaluateNumericExpression(10, "/2")).toBe(5);
  });

  it("tolera espacios entre el operador y el operando", () => {
    expect(evaluateNumericExpression(10, "+ 5")).toBe(15);
  });

  it("rechaza la división por cero (undefined, no Infinity/NaN)", () => {
    expect(evaluateNumericExpression(10, "/0")).toBeUndefined();
  });

  it("rechaza una expresión vacía", () => {
    expect(evaluateNumericExpression(10, "")).toBeUndefined();
    expect(evaluateNumericExpression(10, "   ")).toBeUndefined();
  });

  it("rechaza texto que no es ni un número ni una expresión soportada", () => {
    expect(evaluateNumericExpression(10, "abc")).toBeUndefined();
  });

  it("rechaza un operador no soportado (%, ^)", () => {
    expect(evaluateNumericExpression(10, "%5")).toBeUndefined();
    expect(evaluateNumericExpression(10, "^2")).toBeUndefined();
  });

  it("rechaza más de un operador (no es un lenguaje de expresiones completo)", () => {
    expect(evaluateNumericExpression(10, "+5+5")).toBeUndefined();
  });

  it("nunca usa eval — una cadena con código JS se rechaza como no numérica", () => {
    expect(evaluateNumericExpression(10, "alert(1)")).toBeUndefined();
  });
});
