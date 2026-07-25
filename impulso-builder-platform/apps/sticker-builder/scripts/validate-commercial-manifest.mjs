#!/usr/bin/env node
// Validación OBLIGATORIA en build-time del manifest comercial (Fase 4.2,
// ver docs/platform/COMMERCIAL_BUILD_GUIDE.md, sección "Política de fallo
// del manifest"). Un manifest inválido debe FALLAR el proceso de
// empaquetado con un error claro — nunca degradar en silencio ni habilitar
// funciones de forma ambigua. El fallback permisivo (ver
// src/commercialManifest.ts) solo existe para desarrollo local, nunca para
// el build comercial.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { safeParseProductManifest } from "@impulso/commercial-schema";

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(here, "..", "commercial-product.json");

async function main() {
  let raw;
  try {
    raw = await readFile(manifestPath, "utf-8");
  } catch (error) {
    console.error(`[validate:manifest] No se pudo leer ${manifestPath}`);
    console.error(String(error));
    process.exit(1);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    console.error(`[validate:manifest] ${manifestPath} no es JSON válido.`);
    console.error(String(error));
    process.exit(1);
  }

  const result = safeParseProductManifest(json);
  if (!result.success) {
    console.error(`[validate:manifest] commercial-product.json es inválido contra el schema de @impulso/commercial-schema:`);
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join(".") || "(raíz)"}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(
    `[validate:manifest] OK — ${result.data.productId} v${result.data.productVersion} (${result.data.edition}, canal: ${result.data.channel})`,
  );
}

main();
