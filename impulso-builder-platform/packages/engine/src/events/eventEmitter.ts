/**
 * Pub-sub mínimo, sin dependencias. Deliberadamente NO se usa el
 * `EventEmitter` de `node:events`: el Engine debe poder correr tanto en
 * Node (tests, un futuro export headless) como en el navegador (donde el
 * módulo aterrizará, embebido en el Renderer), y `node:events` no existe en
 * el navegador. Tampoco se usa `EventTarget`/`CustomEvent` del DOM por la
 * misma razón, a la inversa.
 */
export type Unsubscribe = () => void;

export interface EventEmitter<TEvent> {
  emit(event: TEvent): void;
  subscribe(listener: (event: TEvent) => void): Unsubscribe;
}

export function createEventEmitter<TEvent>(): EventEmitter<TEvent> {
  const listeners = new Set<(event: TEvent) => void>();

  return {
    emit(event) {
      for (const listener of listeners) {
        listener(event);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
