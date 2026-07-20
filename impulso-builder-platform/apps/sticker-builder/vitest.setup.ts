// Epic 8 — Autosave, Recovery & Project Safety: sin esto, `indexedDB` es
// `undefined` en jsdom, y cualquier test que no inyecte su propio
// `projectStore` (memoria) pero SÍ ensucie el `ProjectSaveCoordinator` deja
// un timer real (autosave/recovery) que, al disparar más tarde, intenta
// abrir una IndexedDB inexistente. El propio coordinator atrapa y registra
// ese error, pero el proceso de Node podía terminar justo en medio de esa
// escritura — detectado como una corrida ocasionalmente inestable de
// `pnpm -r test`. `fake-indexeddb` hace que ese camino simplemente
// funcione (en memoria) en vez de fallar, mismo patrón ya usado en
// `packages/project-library`/`asset-library`/`template-library`.
import "fake-indexeddb/auto";
import { installFakeCanvas } from "./src/testing/fakeCanvasContext.js";

installFakeCanvas(window);
