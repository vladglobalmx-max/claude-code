import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { DocumentPdf } from "./document-pdf";
import type { PdfDocumentSpec } from "./types";

/** Render server-side puro (sin navegador) — @react-pdf/renderer produce el binario PDF directo en Node. */
export async function renderDocumentPdf(spec: PdfDocumentSpec): Promise<Buffer> {
  return renderToBuffer(<DocumentPdf spec={spec} />);
}
