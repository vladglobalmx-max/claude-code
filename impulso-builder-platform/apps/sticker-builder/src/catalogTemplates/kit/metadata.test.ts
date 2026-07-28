import { describe, expect, it } from "vitest";
import { buildElementMetadata } from "./metadata.js";

const NOW = "2026-07-28T00:00:00.000Z";

describe("buildElementMetadata", () => {
  it("produce los defaults compartidos (tags vacío, visible/locked, createdAt/updatedAt = now)", () => {
    const metadata = buildElementMetadata({ now: NOW });
    expect(metadata).toEqual({ tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW });
  });

  it("omite role/name del objeto cuando no se pasan (no los deja como undefined explícito)", () => {
    const metadata = buildElementMetadata({ now: NOW });
    expect("role" in metadata).toBe(false);
    expect("name" in metadata).toBe(false);
  });

  it("incluye role/name cuando se pasan", () => {
    const metadata = buildElementMetadata({ now: NOW, role: "die-line", name: "Línea de corte" });
    expect(metadata.role).toBe("die-line");
    expect(metadata.name).toBe("Línea de corte");
  });
});
