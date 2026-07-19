// jsdom no implementa IndexedDB — `fake-indexeddb/auto` la polyfillea
// globalmente para poder testear directamente `openIndexedDb`/`runInTransaction`.
import "fake-indexeddb/auto";
