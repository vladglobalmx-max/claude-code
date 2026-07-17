import { describe, expect, it } from "vitest";
import { isPermutationOf } from "./permutation.js";

describe("isPermutationOf", () => {
  it("acepta el mismo conjunto en otro orden", () => {
    expect(isPermutationOf(["b", "a", "c"], ["a", "b", "c"])).toBe(true);
  });

  it("acepta el mismo orden (permutación identidad)", () => {
    expect(isPermutationOf(["a", "b", "c"], ["a", "b", "c"])).toBe(true);
  });

  it("rechaza longitudes distintas", () => {
    expect(isPermutationOf(["a", "b"], ["a", "b", "c"])).toBe(false);
  });

  it("rechaza duplicados en el candidato", () => {
    expect(isPermutationOf(["a", "a", "c"], ["a", "b", "c"])).toBe(false);
  });

  it("rechaza un id que no pertenece al conjunto de referencia", () => {
    expect(isPermutationOf(["a", "b", "x"], ["a", "b", "c"])).toBe(false);
  });

  it("acepta listas vacías", () => {
    expect(isPermutationOf([], [])).toBe(true);
  });

  it("rechaza cuando la referencia tiene duplicados y por tanto menos elementos distintos", () => {
    // candidate: 2 elementos únicos, misma longitud que reference (2), pero
    // reference solo tiene 1 elemento distinto ("a" repetido) — el
    // conjunto de referencia no puede ser una permutación válida.
    expect(isPermutationOf(["a", "b"], ["a", "a"])).toBe(false);
  });
});
