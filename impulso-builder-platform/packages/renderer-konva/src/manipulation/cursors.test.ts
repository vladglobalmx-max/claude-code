import { describe, expect, it } from "vitest";
import { RESIZE_HANDLES } from "@impulso/engine";
import { cursorForHandle, ROTATE_CURSOR, DEFAULT_CURSOR } from "./cursors.js";

describe("cursorForHandle", () => {
  it.each([
    ["top-left", "nwse-resize"],
    ["bottom-right", "nwse-resize"],
    ["top-right", "nesw-resize"],
    ["bottom-left", "nesw-resize"],
    ["top", "ns-resize"],
    ["bottom", "ns-resize"],
    ["left", "ew-resize"],
    ["right", "ew-resize"],
  ] as const)("%s -> %s", (handle, expected) => {
    expect(cursorForHandle(handle)).toBe(expected);
  });

  it("cubre los 8 handles sin excepción", () => {
    for (const handle of RESIZE_HANDLES) {
      expect(typeof cursorForHandle(handle)).toBe("string");
    }
  });
});

describe("constantes de cursor", () => {
  it("ROTATE_CURSOR y DEFAULT_CURSOR son valores CSS válidos distintos entre sí", () => {
    expect(ROTATE_CURSOR).toBe("grab");
    expect(DEFAULT_CURSOR).toBe("default");
    expect(ROTATE_CURSOR).not.toBe(DEFAULT_CURSOR);
  });
});
