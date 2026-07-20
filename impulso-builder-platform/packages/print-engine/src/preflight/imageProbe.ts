export interface ImageDimensionsProbe {
  measure(blob: Blob): Promise<{ width: number; height: number } | undefined>;
}

/**
 * `createImageBitmap` no está implementado en jsdom (mismo gap ya conocido
 * de `HTMLCanvasElement.toBlob`, ver `fakeCanvasContext.ts`) — se degrada a
 * `undefined` (resolución efectiva no verificable) en vez de lanzar.
 * Inyectable (`RunPreflightOptions.imageProbe`) para que los tests no
 * dependan de decodificación real de imágenes.
 */
export const browserImageDimensionsProbe: ImageDimensionsProbe = {
  async measure(blob) {
    if (typeof createImageBitmap !== "function") return undefined;
    try {
      const bitmap = await createImageBitmap(blob);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    } catch {
      return undefined;
    }
  },
};
