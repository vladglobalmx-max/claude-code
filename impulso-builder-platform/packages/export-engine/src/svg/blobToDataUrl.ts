/**
 * `Blob -> data URL` (`data:{mimeType};base64,...`) vía `FileReader`, no
 * vía `blob.arrayBuffer()`/`.text()` — jsdom (usado en los tests de este
 * paquete) no implementa esos dos métodos en su `Blob`, pero sí un
 * `FileReader` funcional sobre ese mismo Blob (mismo workaround ya
 * probado en `@impulso/asset-library`, ver ADR-0011/ADR-0012).
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se pudo leer el binario del asset."));
    reader.readAsDataURL(blob);
  });
}
