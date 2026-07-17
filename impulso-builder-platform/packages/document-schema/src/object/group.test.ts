import { describe, expect, it } from "vitest";
import { GroupObjectSchema } from "./group.js";
import { ObjectIdSchema } from "../primitives/identifiers.js";

const NOW = "2026-07-17T00:00:00.000Z";

describe("GroupObjectSchema (re-exportado desde group.ts)", () => {
  it("valida un group vacío", () => {
    const group = GroupObjectSchema.parse({
      id: ObjectIdSchema.parse("group_1"),
      type: "group",
      transform: { x: 0, y: 0 },
      style: {},
      metadata: { createdAt: NOW, updatedAt: NOW },
      pluginData: {},
      customProperties: {},
      children: [],
    });
    expect(group.children).toEqual([]);
  });
});
