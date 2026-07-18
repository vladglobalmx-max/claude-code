import { ExportError } from "../errors.js";

/**
 * Dispara la descarga de un `Blob` con el nombre dado — un `<a download>`
 * temporal, nunca agregado permanentemente al DOM. Vive separado del
 * núcleo (`svg/`, `png/`) porque es DOM-only y genuinamente reutilizable
 * por cualquier módulo futuro (Planner Builder, Coloring Book Builder...)
 * que también necesite "descargar este Blob ya generado" — no hay razón
 * para que cada uno lo reimplemente (ver ADR-0012).
 */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  let url: string;
  try {
    url = URL.createObjectURL(blob);
  } catch (error) {
    throw new ExportError("download_failed", `No se pudo iniciar la descarga: ${(error as Error).message}`);
  }

  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw new ExportError("download_failed", `No se pudo iniciar la descarga: ${(error as Error).message}`);
  }

  // Se revoca en el siguiente tick: algunos navegadores necesitan que la
  // URL siga siendo válida mientras procesan el click síncrono de descarga.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
