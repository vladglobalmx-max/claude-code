import { describe, expect, it } from "vitest";
import { parseHexColor } from "./color.js";

describe("parseHexColor", () => {
  it("hex de 6 dígitos", () => {
    expect(parseHexColor("#ff0000")).toEqual({ r: 1, g: 0, b: 0 });
    expect(parseHexColor("#00ff00")).toEqual({ r: 0, g: 1, b: 0 });
    expect(parseHexColor("#0000ff")).toEqual({ r: 0, g: 0, b: 1 });
  });

  it("hex de 3 dígitos se expande", () => {
    expect(parseHexColor("#f00")).toEqual({ r: 1, g: 0, b: 0 });
  });

  it("mayúsculas/minúsculas y espacios alrededor", () => {
    expect(parseHexColor("  #FF00FF  ")).toEqual({ r: 1, g: 0, b: 1 });
  });

  it("string no-hex (nombre CSS, rgb(), vacío): undefined", () => {
    expect(parseHexColor("red")).toBeUndefined();
    expect(parseHexColor("rgb(255,0,0)")).toBeUndefined();
    expect(parseHexColor("")).toBeUndefined();
  });
});
