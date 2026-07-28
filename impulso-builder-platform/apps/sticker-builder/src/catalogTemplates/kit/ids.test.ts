import { describe, expect, it } from "vitest";
import { createIdFactory } from "./ids.js";

describe("createIdFactory", () => {
  it("prefija cada tipo de id según su convención existente (project_/document_/page_/layer_/object_)", () => {
    let counter = 0;
    const ids = createIdFactory(() => `n${++counter}`);

    expect(ids.projectId()).toBe("project_n1");
    expect(ids.documentId()).toBe("document_n2");
    expect(ids.pageId()).toBe("page_n3");
    expect(ids.layerId()).toBe("layer_n4");
    expect(ids.objectId()).toBe("object_n5");
  });

  it("cada llamada consume exactamente una invocación de generateId (sin adelantar ni reutilizar)", () => {
    let calls = 0;
    const ids = createIdFactory(() => {
      calls += 1;
      return `x${calls}`;
    });

    ids.objectId();
    ids.objectId();
    expect(calls).toBe(2);
  });
});
