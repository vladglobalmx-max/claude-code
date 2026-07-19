# @impulso/storage-kit

> Andamiaje genérico de IndexedDB, extraído en la épica Project Library / Workspace (Epic 5) tras aparecer duplicado casi línea por línea en tres pilares de plataforma reales: Asset Library, Template Library y Project Library. Ver [ADR-0014](../../docs/adr/0014-project-library-workspace.md).

**Estado:** primera versión. Sin ninguna noción de qué se guarda — un object store puede contener binarios, descriptores, Projects completos o cualquier otra cosa.

---

## 1. Qué es y qué no es

- **Sí hace:** abrir una base de datos IndexedDB con sus object stores (`openIndexedDb`), memoizar esa conexión (`createLazyIndexedDbConnection`), envolver un `IDBRequest` en una Promise (`promisifyRequest`), y correr una transacción sobre uno o más object stores (`runInTransaction`).
- **No hace:** no sabe nada de Assets, Templates o Projects — cero lógica de dominio. No es un ORM ni una capa de queries; cada consumidor sigue escribiendo sus propias operaciones `get`/`put`/`delete`/`getAll` directamente sobre el `IDBObjectStore` que `runInTransaction` le entrega.

## 2. Por qué existe recién ahora

Con dos consumidores (Asset Library, Template Library) la duplicación podía ser coincidencia. Con un tercero real (Project Library) confirmándola, extraerla deja de ser especulativo — mismo criterio de "no generalizar antes de tiempo" ya aplicado en todo el proyecto (ver `docs/product/02-Product-Principles.md`).

## 3. Uso

```ts
import { createLazyIndexedDbConnection, runInTransaction, promisifyRequest } from "@impulso/storage-kit";

const connection = createLazyIndexedDbConnection({
  databaseName: "mi-dominio",
  onUpgrade: (db) => db.createObjectStore("miStore"),
});

async function get(id: string) {
  const db = await connection.getDb();
  return runInTransaction(db, "miStore", "readonly", (tx) => promisifyRequest(tx.objectStore("miStore").get(id)));
}
```

## 4. Desarrollo

```bash
pnpm --filter @impulso/storage-kit build
pnpm --filter @impulso/storage-kit test
pnpm --filter @impulso/storage-kit typecheck
```
