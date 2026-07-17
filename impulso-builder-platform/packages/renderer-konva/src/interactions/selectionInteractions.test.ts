import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { attachSelectionInteractions } from "./selectionInteractions.js";
import { buildRectangle } from "../testUtils/fixtures.js";
import type { NodeContext } from "../types.js";

function contextWithDispatch() {
  const dispatch = vi.fn().mockReturnValue({ ok: true, value: {} });
  const context: NodeContext = { dispatch: dispatch as never };
  return { context, dispatch };
}

describe("attachSelectionInteractions", () => {
  it("click sin Shift reemplaza la selección (setSelection) y detiene la propagación", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const { context, dispatch } = contextWithDispatch();
    attachSelectionInteractions(node, object, context);

    const evt = { evt: { shiftKey: false }, cancelBubble: false };
    node.fire("click", evt);

    expect(dispatch).toHaveBeenCalledWith({ type: "setSelection", objectIds: ["rect_1"] });
    expect(evt.cancelBubble).toBe(true);
  });

  it("click con Shift alterna la selección (toggleObjectSelection) en vez de reemplazarla", () => {
    const object = buildRectangle("rect_1");
    const node = new Konva.Rect();
    const { context, dispatch } = contextWithDispatch();
    attachSelectionInteractions(node, object, context);

    node.fire("click", { evt: { shiftKey: true }, cancelBubble: false });

    expect(dispatch).toHaveBeenCalledWith({ type: "toggleObjectSelection", objectId: "rect_1" });
  });
});
