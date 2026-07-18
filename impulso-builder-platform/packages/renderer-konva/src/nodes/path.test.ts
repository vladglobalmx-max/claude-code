import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { createPathNode } from "./path.js";
import { buildPath } from "../testUtils/fixtures.js";
import type { NodeContext } from "../types.js";

const context: NodeContext = { dispatch: vi.fn().mockReturnValue({ ok: true, value: {} }) as never };

// `segmentsToSvgPathData` ahora vive en `@impulso/document-schema`
// (`object/pathData.test.ts`) — aquí solo se testea la traducción a
// `Konva.Path`, que sí es específica de este paquete.
describe("createPathNode", () => {
  it("crea un Konva.Path con el data traducido", () => {
    const object = buildPath("p1", {
      segments: [
        { type: "moveTo", point: { x: 0, y: 0 } },
        { type: "lineTo", point: { x: 5, y: 5 } },
      ],
      closed: false,
    });
    const node = createPathNode(object, context);

    expect(node).toBeInstanceOf(Konva.Path);
    expect(node.data()).toBe("M 0 0 L 5 5");
  });
});
