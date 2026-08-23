// THÖREN — Sube los 55 PDFs históricos de CotizIA a Storage y vincula
// quotes.historical_pdf_path. Se ejecuta LOCALMENTE, con TUS credenciales
// (nunca las pega en un chat). Uso:
//
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   COTIZIA_PDF_DIR=/ruta/a/los/61/pdfs \
//   node scripts/upload-cotizia-pdfs.mjs
//
// Requiere el rol de SERVICIO (service_role key, nunca la anon key) porque
// hace INSERT/UPDATE en `quotes` y sube a un bucket privado — el mismo
// contexto ya usado para aplicar 0028 y para el import de datos.
//
// QUÉ HACE:
//   1) Lee de Cloud las 55 Quotes con source='cotizia' (id, folio,
//      original_folio, organization_id, historical_pdf_path actual).
//   2) Para cada una, localiza el PDF local por NOMBRE DE ARCHIVO = folio
//      corregido (`<folio>.pdf`) — los 61 PDFs del ZIP están nombrados así,
//      NO por original_folio (verificado directamente sobre el ZIP: no
//      existe, por ejemplo, KSJ-20260811-003.pdf, solo KST-20260811-003.pdf).
//      original_folio se usa como control cruzado de integridad, nunca
//      como nombre de archivo a buscar.
//   3) Sube el archivo a quote-archive/{organization_id}/{quote_id}/original.pdf
//      con upsert:true (reintentable sin duplicar ni fallar en una segunda
//      corrida).
//   4) Hace UPDATE de quotes.historical_pdf_path con ese path.
//   5) Al final corre la verificación completa y genera UNA signed URL real
//      de ejemplo para que la abras y confirmes que el PDF se ve.
//
// QUÉ NO HACE (por diseño, respetando el alcance autorizado):
//   No crea Quotes. No crea Customers. No toca quote_items. No toca Orders.
//   No toca salesperson_quote_sequences. No modifica folios. Los 6 folios
//   excluidos (DOJ-20260814-004, DOJ-20260814-005, VVJ-20260820-007,
//   EGJ-20260813-004, EGJ-20260608-001, EGJ-20260308-002) nunca aparecen en
//   la consulta a `quotes` (nunca se importaron como Quote), así que jamás
//   se suben ni se tocan aquí.

import { createClient } from '@supabase/supabase-js';
import { readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PDF_DIR = process.env.COTIZIA_PDF_DIR;

if (!SUPABASE_URL || !SERVICE_KEY || !PDF_DIR) {
  console.error(
    'Faltan variables de entorno. Requeridas: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COTIZIA_PDF_DIR.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const BUCKET = 'quote-archive';

async function main() {
  console.log('=== THÖREN — Subida de PDFs históricos CotizIA ===\n');

  const { data: quotes, error: quotesErr } = await supabase
    .from('quotes')
    .select('id, folio, original_folio, organization_id, historical_pdf_path')
    .eq('source', 'cotizia')
    .order('folio', { ascending: true });

  if (quotesErr) {
    console.error('ERROR leyendo quotes:', quotesErr.message);
    process.exit(1);
  }

  console.log(`cotizia_quotes (leídas de Cloud) = ${quotes.length}`);
  if (quotes.length !== 55) {
    console.warn(
      `AVISO: se esperaban 55 Quotes con source='cotizia' y se encontraron ${quotes.length}. Revisa antes de continuar.`
    );
  }

  const dirFiles = new Set(await readdir(PDF_DIR));

  const results = {
    uploaded: [],
    updated: [],
    missingLocalFile: [],
    uploadErrors: [],
    updateErrors: [],
  };

  for (const q of quotes) {
    const fileName = `${q.folio}.pdf`;
    const localPath = path.join(PDF_DIR, fileName);

    if (!dirFiles.has(fileName)) {
      results.missingLocalFile.push({ folio: q.folio, original_folio: q.original_folio, expected: fileName });
      continue;
    }

    let fileBuffer;
    try {
      fileBuffer = await readFile(localPath);
    } catch (e) {
      results.missingLocalFile.push({ folio: q.folio, original_folio: q.original_folio, expected: fileName, error: e.message });
      continue;
    }

    const storagePath = `${q.organization_id}/${q.id}/original.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadErr) {
      results.uploadErrors.push({ folio: q.folio, original_folio: q.original_folio, storagePath, error: uploadErr.message });
      continue;
    }
    results.uploaded.push({ folio: q.folio, original_folio: q.original_folio, storagePath });

    if (q.historical_pdf_path === storagePath) {
      results.updated.push({ folio: q.folio, note: 'ya estaba vinculado, sin cambios' });
      continue;
    }

    const { error: updateErr } = await supabase
      .from('quotes')
      .update({ historical_pdf_path: storagePath })
      .eq('id', q.id);

    if (updateErr) {
      results.updateErrors.push({ folio: q.folio, original_folio: q.original_folio, error: updateErr.message });
      continue;
    }
    results.updated.push({ folio: q.folio, storagePath });
  }

  console.log(`\nPDFs subidos exitosamente: ${results.uploaded.length}`);
  console.log(`Quotes actualizadas (historical_pdf_path): ${results.updated.length}`);

  if (results.missingLocalFile.length) {
    console.log(`\nARCHIVOS LOCALES NO ENCONTRADOS (${results.missingLocalFile.length}):`);
    for (const m of results.missingLocalFile) console.log(`  - folio=${m.folio} original_folio=${m.original_folio} esperado=${m.expected}`);
  }
  if (results.uploadErrors.length) {
    console.log(`\nERRORES DE SUBIDA (${results.uploadErrors.length}):`);
    for (const e of results.uploadErrors) console.log(`  - folio=${e.folio}: ${e.error}`);
  }
  if (results.updateErrors.length) {
    console.log(`\nERRORES DE UPDATE (${results.updateErrors.length}):`);
    for (const e of results.updateErrors) console.log(`  - folio=${e.folio}: ${e.error}`);
  }

  // =========================================================================
  // Verificación final
  // =========================================================================
  console.log('\n=== VERIFICACIÓN FINAL ===');

  const { data: postQuotes, error: postErr } = await supabase
    .from('quotes')
    .select('id, folio, historical_pdf_path')
    .eq('source', 'cotizia');

  if (postErr) {
    console.error('ERROR releyendo quotes para verificación:', postErr.message);
    process.exit(1);
  }

  const cotizia_quotes = postQuotes.length;
  const quotes_with_historical_pdf_path = postQuotes.filter((q) => q.historical_pdf_path).length;
  const quotes_without_pdf = postQuotes.filter((q) => !q.historical_pdf_path).length;

  const pathCounts = new Map();
  for (const q of postQuotes) {
    if (!q.historical_pdf_path) continue;
    pathCounts.set(q.historical_pdf_path, (pathCounts.get(q.historical_pdf_path) || 0) + 1);
  }
  const duplicate_pdf_assignments = [...pathCounts.values()].filter((c) => c > 1).length;

  // Listar objetos reales en el bucket, por organization_id, para calcular
  // pdfs_uploaded real y orphan_pdfs (archivos en el bucket sin ninguna
  // Quote que apunte a ellos).
  const orgIds = [...new Set(quotes.map((q) => q.organization_id))];
  let allObjectPaths = [];
  for (const orgId of orgIds) {
    const { data: quoteFolders, error: listErr } = await supabase.storage.from(BUCKET).list(orgId, { limit: 1000 });
    if (listErr) {
      console.error(`ERROR listando bucket para org ${orgId}:`, listErr.message);
      continue;
    }
    for (const folder of quoteFolders || []) {
      const { data: files, error: innerErr } = await supabase.storage.from(BUCKET).list(`${orgId}/${folder.name}`, { limit: 10 });
      if (innerErr) continue;
      for (const f of files || []) {
        allObjectPaths.push(`${orgId}/${folder.name}/${f.name}`);
      }
    }
  }

  const pdfs_uploaded = allObjectPaths.filter((p) => p.endsWith('/original.pdf')).length;
  const linkedPaths = new Set(postQuotes.map((q) => q.historical_pdf_path).filter(Boolean));
  const orphan_pdfs = allObjectPaths.filter((p) => p.endsWith('/original.pdf') && !linkedPaths.has(p)).length;

  console.log(`cotizia_quotes = ${cotizia_quotes}`);
  console.log(`pdfs_uploaded = ${pdfs_uploaded}`);
  console.log(`quotes_with_historical_pdf_path = ${quotes_with_historical_pdf_path}`);
  console.log(`quotes_without_pdf = ${quotes_without_pdf}`);
  console.log(`orphan_pdfs = ${orphan_pdfs}`);
  console.log(`duplicate_pdf_assignments = ${duplicate_pdf_assignments}`);

  const verification_ok =
    cotizia_quotes === 55 &&
    pdfs_uploaded === 55 &&
    quotes_with_historical_pdf_path === 55 &&
    quotes_without_pdf === 0 &&
    orphan_pdfs === 0 &&
    duplicate_pdf_assignments === 0;

  console.log(`verification_ok = ${verification_ok}`);

  // =========================================================================
  // Prueba real de signed URL sobre una Quote al azar (la primera con
  // historical_pdf_path) — confírmala abriéndola en el navegador.
  // =========================================================================
  const sample = postQuotes.find((q) => q.historical_pdf_path);
  if (sample) {
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(sample.historical_pdf_path, 300);
    if (signErr) {
      console.log(`\nERROR generando signed URL de prueba (folio ${sample.folio}): ${signErr.message}`);
    } else {
      console.log(`\nSigned URL de prueba (folio ${sample.folio}, válida 5 minutos):`);
      console.log(signed.signedUrl);
    }
  }

  console.log('\n=== FIN ===');
}

main().catch((e) => {
  console.error('ERROR FATAL:', e);
  process.exit(1);
});
