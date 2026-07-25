#!/usr/bin/env node
// Build comercial reproducible (Fase 4.2, secciones 6/7/23/24/25/26 de la
// autorización) — ver docs/platform/COMMERCIAL_BUILD_GUIDE.md. Produce:
//   dist-commercial/impulso-sticker-builder-v<version>/   (paquete sin comprimir)
//   dist-commercial/impulso-sticker-builder-v<version>.zip
//   dist-commercial/CHECKSUMS.sha256
//
// Pasos, en orden: (1) validar el manifest — build-time, obligatorio, ver
// ADR-0027; (2) compilar SOLO index.html con vite.commercial.config.ts
// (excluye por construcción los harnesses de Epic 9, sección 26); (3)
// armar la carpeta del paquete con la app + launchers + docs + legal; (4)
// comprimir a .zip; (5) checksums SHA-256 del .zip para verificar
// integridad de la descarga.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(APP_ROOT, "commercial-product.json");
const COMMERCIAL_ASSETS_DIR = path.join(APP_ROOT, "commercial-assets");
const RAW_BUILD_DIR = path.join(APP_ROOT, "dist-commercial-raw");
const OUT_DIR = path.join(APP_ROOT, "dist-commercial");

// Rutas que nunca deben aparecer dentro del paquete final — chequeo de
// higiene mínimo (sección 25: "escaneo de seguridad del paquete excluyendo
// secretos/archivos de desarrollo"). No sustituye una auditoría completa
// (ver task 197 / Commercial Security Checklist), pero falla el build ante
// el descuido más obvio.
const FORBIDDEN_BASENAMES = new Set([".env", ".git", "node_modules", ".DS_Store"]);

function log(message) {
  console.log(`[build:commercial] ${message}`);
}

function fail(message) {
  console.error(`[build:commercial] ERROR: ${message}`);
  process.exit(1);
}

function run(command) {
  execSync(command, { cwd: APP_ROOT, stdio: "inherit" });
}

function scanForbidden(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (FORBIDDEN_BASENAMES.has(entry.name)) {
      fail(`archivo/carpeta no permitido encontrado en el paquete: ${path.join(dir, entry.name)}`);
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scanForbidden(full);
  }
}

function sha256OfFile(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

function main() {
  log("Validando commercial-product.json (política de fallo build-time — ver ADR-0027)...");
  run("node scripts/validate-commercial-manifest.mjs");

  const originalManifestRaw = readFileSync(MANIFEST_PATH, "utf-8");
  const manifest = JSON.parse(originalManifestRaw);

  // IMPORTANTE para la reproducibilidad (sección 24): el manifest se
  // compila TAL CUAL está en el repo (con buildMetadata en null) — nunca se
  // estampa antes de `vite build`. `commercialManifest.ts` lo importa como
  // JSON estático, así que cualquier valor que cambie entre corridas
  // (builtAt, commit) terminaría embebido en el bundle de JS y volvería
  // sus bytes distintos en cada build, aun para el mismo commit. Al dejar
  // el manifest compilado siempre igual, el bundle de JS es reproducible
  // byte a byte para un mismo commit — verificado corriendo el build dos
  // veces y comparando (ver Commercial Security Checklist). El buildId /
  // commit / builtAt reales solo se agregan DESPUÉS del build, en los
  // archivos `commercial-product.json`/`version.json` sueltos que van en
  // la raíz del paquete (no en el bundle) — son metadata de referencia
  // para soporte, nunca leídos por la app en tiempo de ejecución.
  log("Compilando el build comercial (solo index.html, sin harnesses de Epic 9)...");
  rmSync(RAW_BUILD_DIR, { recursive: true, force: true });
  run("npx vite build --config vite.commercial.config.ts");

  if (!existsSync(path.join(RAW_BUILD_DIR, "index.html"))) {
    fail(`el build no generó ${path.join(RAW_BUILD_DIR, "index.html")}`);
  }

  // Metadata de build: SOLO derivada del commit real de git y de la
  // versión del manifest — nada aleatorio (uuid, contador local) — para
  // que el mismo commit siempre produzca el mismo buildId. `builtAt` sí
  // varía entre corridas por diseño (es un timestamp real, no un
  // identificador), y por eso vive únicamente en los archivos sueltos
  // mencionados arriba, nunca en el bundle.
  let commit = null;
  try {
    commit = execSync("git rev-parse HEAD", { cwd: APP_ROOT }).toString().trim();
  } catch {
    log("Advertencia: no se pudo leer el commit de git — commit quedará null en el manifest empaquetado.");
  }
  const builtAt = new Date().toISOString();
  const buildId = commit ? `${manifest.productVersion}+${commit.slice(0, 12)}` : `${manifest.productVersion}+nogit`;

  const stampedManifest = {
    ...manifest,
    buildMetadata: { builtAt, commit, buildId },
    releaseMetadata: {
      ...manifest.releaseMetadata,
      releaseDate: manifest.releaseMetadata.releaseDate ?? builtAt.slice(0, 10),
    },
  };

  const packageName = `impulso-sticker-builder-v${manifest.productVersion}`;
  const packageDir = path.join(OUT_DIR, packageName);

  log(`Armando el paquete en ${packageDir}...`);
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(packageDir, { recursive: true });

  // App compilada (index.html + assets/).
  cpSync(RAW_BUILD_DIR, packageDir, { recursive: true });

  // Launchers en la raíz del paquete — deben ser lo primero que el
  // comprador ve y puede hacer doble clic, ver docs/01-como-empezar.md.
  cpSync(
    path.join(COMMERCIAL_ASSETS_DIR, "launchers", "ABRIR-IMPULSO-WINDOWS.bat"),
    path.join(packageDir, "ABRIR-IMPULSO-WINDOWS.bat"),
  );
  cpSync(
    path.join(COMMERCIAL_ASSETS_DIR, "launchers", "ABRIR-IMPULSO-MAC-LINUX.command"),
    path.join(packageDir, "ABRIR-IMPULSO-MAC-LINUX.command"),
  );

  cpSync(path.join(COMMERCIAL_ASSETS_DIR, "LEEME-PRIMERO.md"), path.join(packageDir, "LEEME-PRIMERO.md"));
  cpSync(path.join(COMMERCIAL_ASSETS_DIR, "docs"), path.join(packageDir, "docs"), { recursive: true });
  cpSync(path.join(COMMERCIAL_ASSETS_DIR, "legal"), path.join(packageDir, "legal"), { recursive: true });

  writeFileSync(
    path.join(packageDir, "commercial-product.json"),
    `${JSON.stringify(stampedManifest, null, 2)}\n`,
    "utf-8",
  );
  writeFileSync(
    path.join(packageDir, "version.json"),
    `${JSON.stringify({ productVersion: manifest.productVersion, buildId, builtAt, commit }, null, 2)}\n`,
    "utf-8",
  );

  log("Escaneando el paquete en busca de archivos no permitidos...");
  scanForbidden(packageDir);

  log("Comprimiendo el paquete...");
  const zipName = `${packageName}.zip`;
  // -X: sin metadata extra de filesystem (uid/gid/timestamps de extra
  // fields) que variaría entre máquinas — más cerca de un zip reproducible
  // sin depender de flags de zip no disponibles en todas las plataformas.
  execSync(`zip -rqX "${zipName}" "${packageName}"`, { cwd: OUT_DIR, stdio: "inherit" });

  const zipPath = path.join(OUT_DIR, zipName);
  const zipSizeMb = (statSync(zipPath).size / (1024 * 1024)).toFixed(2);
  const checksum = sha256OfFile(zipPath);
  writeFileSync(path.join(OUT_DIR, "CHECKSUMS.sha256"), `${checksum}  ${zipName}\n`, "utf-8");

  log("Listo.");
  log(`  Paquete:   ${packageDir}`);
  log(`  ZIP:       ${zipPath} (${zipSizeMb} MB)`);
  log(`  SHA-256:   ${checksum}`);
  log(`  buildId:   ${buildId}`);
}

main();
