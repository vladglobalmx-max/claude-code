import { describe, expect, it } from "vitest";
import { toPixels } from "./unit.js";

// La lógica de conversión ahora vive en `@impulso/document-schema`
// (`page/unitConversion.test.ts`) — este test solo confirma que el
// re-export desde este paquete sigue funcionando.
describe("toPixels (re-export)", () => {
  it("sigue funcionando desde @impulso/renderer-konva", () => {
    expect(toPixels(1, "in")).toBe(96);
  });
});
