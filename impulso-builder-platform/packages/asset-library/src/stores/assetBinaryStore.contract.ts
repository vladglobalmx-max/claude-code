import { expect, it } from "vitest";
import { AssetIdSchema } from "@impulso/document-schema";
import type { AssetBinaryStore } from "../types.js";

/** jsdom implementa `Blob` sin `.text()`/`.arrayBuffer()` (solo
 * `slice`/`size`/`type`) — se lee el contenido vía `FileReader` en ese
 * caso; el entorno "node" (usado por `indexedDbStore.test.ts`, ver
 * comentario ahí) sí tiene `Blob.text()` nativo. */
export function blobToText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") {
    return blob.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el Blob."));
    reader.readAsText(blob);
  });
}

/**
 * Suite de contrato compartida entre `memoryStore` e `indexedDbStore`: las
 * dos implementaciones de `AssetBinaryStore` deben comportarse
 * idénticamente desde la perspectiva de quien las usa (Asset Library es
 * intercambiable con cualquier backend que cumpla la interfaz) — esto es
 * lo que efectivamente prueba esa intercambiabilidad, en vez de solo
 * testear cada una por separado y confiar en que "se parecen".
 */
export function testAssetBinaryStoreContract(name: string, createStore: () => AssetBinaryStore | Promise<AssetBinaryStore>) {
  it(`${name}: get() de un assetId nunca guardado devuelve undefined`, async () => {
    const store = await createStore();
    const result = await store.get(AssetIdSchema.parse("asset_x"));
    expect(result).toBeUndefined();
  });

  it(`${name}: set() + get() devuelve el mismo Blob guardado`, async () => {
    const store = await createStore();
    const blob = new Blob(["contenido"], { type: "image/png" });
    const assetId = AssetIdSchema.parse("asset_x");

    await store.set(assetId, blob);
    const resolved = await store.get(assetId);

    expect(resolved).toBeDefined();
    expect(resolved?.type).toBe("image/png");
    expect(await blobToText(resolved!)).toBe("contenido");
  });

  it(`${name}: set() sobre un id existente reemplaza el Blob anterior`, async () => {
    const store = await createStore();
    const assetId = AssetIdSchema.parse("asset_x");
    await store.set(assetId, new Blob(["viejo"]));
    await store.set(assetId, new Blob(["nuevo"]));

    const resolved = await store.get(assetId);
    expect(await blobToText(resolved!)).toBe("nuevo");
  });

  it(`${name}: delete() de un id existente lo remueve`, async () => {
    const store = await createStore();
    const assetId = AssetIdSchema.parse("asset_x");
    await store.set(assetId, new Blob(["contenido"]));

    await store.delete(assetId);

    expect(await store.get(assetId)).toBeUndefined();
  });

  it(`${name}: delete() de un id inexistente no lanza`, async () => {
    const store = await createStore();
    await expect(store.delete(AssetIdSchema.parse("no_existe"))).resolves.not.toThrow();
  });

  it(`${name}: clear() vacía todos los assets guardados`, async () => {
    const store = await createStore();
    await store.set(AssetIdSchema.parse("asset_1"), new Blob(["a"]));
    await store.set(AssetIdSchema.parse("asset_2"), new Blob(["b"]));

    await store.clear();

    expect(await store.get(AssetIdSchema.parse("asset_1"))).toBeUndefined();
    expect(await store.get(AssetIdSchema.parse("asset_2"))).toBeUndefined();
  });

  it(`${name}: dos assets distintos no se pisan entre sí`, async () => {
    const store = await createStore();
    await store.set(AssetIdSchema.parse("asset_1"), new Blob(["uno"]));
    await store.set(AssetIdSchema.parse("asset_2"), new Blob(["dos"]));

    expect(await blobToText((await store.get(AssetIdSchema.parse("asset_1")))!)).toBe("uno");
    expect(await blobToText((await store.get(AssetIdSchema.parse("asset_2")))!)).toBe("dos");
  });
}
