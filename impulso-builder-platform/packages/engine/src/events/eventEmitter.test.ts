import { describe, expect, it, vi } from "vitest";
import { createEventEmitter } from "./eventEmitter.js";

describe("createEventEmitter", () => {
  it("notifica a todos los suscriptores en el orden en que se suscribieron", () => {
    const emitter = createEventEmitter<string>();
    const calls: string[] = [];
    emitter.subscribe((event) => calls.push(`A:${event}`));
    emitter.subscribe((event) => calls.push(`B:${event}`));

    emitter.emit("hello");

    expect(calls).toEqual(["A:hello", "B:hello"]);
  });

  it("unsubscribe detiene notificaciones futuras a ese listener", () => {
    const emitter = createEventEmitter<string>();
    const listener = vi.fn();
    const unsubscribe = emitter.subscribe(listener);

    emitter.emit("first");
    unsubscribe();
    emitter.emit("second");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("first");
  });

  it("emitir sin suscriptores no lanza", () => {
    const emitter = createEventEmitter<string>();
    expect(() => emitter.emit("nadie escucha")).not.toThrow();
  });

  it("llamar unsubscribe dos veces es seguro (idempotente)", () => {
    const emitter = createEventEmitter<string>();
    const listener = vi.fn();
    const unsubscribe = emitter.subscribe(listener);
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
    emitter.emit("x");
    expect(listener).not.toHaveBeenCalled();
  });
});
