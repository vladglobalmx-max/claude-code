// jsdom no implementa IndexedDB — `fake-indexeddb/auto` la polyfillea
// globalmente para que `indexedDbStore.ts` (el adaptador real) se pueda
// testear directamente, en vez de solo su alternativa en memoria.
import "fake-indexeddb/auto";
