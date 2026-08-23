-- GS Orders — Migración 0028: THÖREN Quotes Historical Import (CotizIA) — Esquema
--
-- Agrega el esquema mínimo necesario para importar 61 cotizaciones
-- históricas de CotizIA como Quotes de solo lectura comercial, distinguibles
-- de las Quotes reales de THÖREN, con su PDF original adjunto. Esta
-- migración es EXCLUSIVAMENTE esquema (columnas + índice + bucket + RLS +
-- ajuste de un trigger existente) — la carga real de las 61 filas es un
-- script de datos aparte (fuera de `migrations/`), no incluido aquí.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Agrega 7 columnas nullable a `quotes`: `source` (not null, default
--    'thoren' — ver DECISIÓN abajo), `original_folio`, `historical_pdf_path`,
--    `customer_contact_name`, `customer_email`, `customer_phone`, `warranty`.
--    Las 3 de contacto son exactamente la brecha que el propio Quote PDF ya
--    documentaba como pendiente ("MEJORA FUTURA — Quote Customer Contact
--    Snapshot", (print)/cotizaciones/[id]/pdf/page.tsx) — snapshot,
--    resuelto una sola vez, nunca se vuelve a consultar `customer_contacts`.
--    `warranty` (texto libre — "1 año por defectos de fabricación", "12
--    meses en equipos"…) es un campo real encontrado al auditar los 61 PDFs
--    de CotizIA (sección "Garantía" en casi todos) que hoy no existe en
--    ningún lado de `quotes` — se agrega ahora, en esta misma migración,
--    porque todavía no se ha aplicado en Cloud (decisión explícita del
--    usuario, evita una 0029 para un campo que ya se conocía antes de
--    desplegar).
-- 2) Agrega 2 columnas nullable a `quote_items`: `unit` (texto libre — "pza",
--    "Pieza", "Unidad de servicio"…, tal como aparece en el PDF histórico) y
--    `customer_requirements` (texto libre — la caja "Requisitos del
--    cliente" que aparece por línea en varios PDFs: técnica de impresión,
--    color, dimensiones, instalación, indicaciones particulares…).
--    Deliberadamente NO se dobla dentro de `description`/`customer_notes`
--    — son datos con función distinta (especificación técnica de esa línea
--    específica, no la descripción comercial del producto ni una nota
--    general de la Quote) y el usuario pidió explícitamente mantenerlos
--    separados. NUNCA se inventa ninguno de los dos: NULL cuando el PDF no
--    trae el dato.
-- 3) CHECK `quotes_source_original_folio_consistent`: obliga
--    `original_folio` a estar poblado si y solo si `source = 'cotizia'` —
--    hace estructuralmente imposible que una Quote real de THÖREN termine
--    con un `original_folio`, o que una histórica se quede sin él.
-- 4) Índice único parcial `quotes_cotizia_original_folio_unique` sobre
--    `(original_folio) where source = 'cotizia'` — la clave de idempotencia
--    real de la importación (ver DECISIÓN "original_folio" abajo). Ejecutar
--    el script de datos dos veces no duplica ninguna Quote histórica.
-- 5) Extiende `trg_prevent_quote_folio_change` (0020) para proteger también
--    `source`/`original_folio` — ver DECISIÓN abajo.
-- 6) Bucket privado `quote-archive` + 4 policies sobre `storage.objects`,
--    mismo patrón exacto que `business-unit-assets` (0024): ownership
--    completo verificado en cada operación vía join a la tabla dueña
--    (`quotes` en vez de `business_units`), SELECT para cualquier miembro
--    con visibilidad de esa Quote, INSERT/UPDATE/DELETE admin-only.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO inserta ninguna Quote histórica ni ningún PDF — cero DML de datos,
--   cero storage.objects, cero rpc_create_quote. Eso es el script de datos
--   aparte, todavía no autorizado para ejecutarse.
-- - NO toca `salesperson_quote_sequences`, `fn_next_quote_folio()`,
--   `rpc_create_quote`, `rpc_update_quote` — el motor de folios de Quotes
--   sigue exactamente igual, cero interacción.
-- - NO toca `orders`, `order_items`, `rpc_create_order_from_quote` —
--   bloquear "Convertir a Pedido" para Quotes históricas es una decisión de
--   UI (cotizaciones/[id]/page.tsx), no de esquema: el importador nunca
--   llama esa RPC, así que no hace falta ningún CHECK/trigger nuevo para
--   impedirlo a nivel de datos.
-- - NO toca `customers`, `customer_contacts`, `people`, `salespeople`,
--   `business_units`, `product_catalog` — el matching de clientes/
--   vendedores/Business Units de las 61 cotizaciones es responsabilidad del
--   script de datos, usando exclusivamente filas ya existentes.
-- - NO relaja ninguna policy existente de `quotes`/`quote_items` — las
--   Quotes históricas quedan sujetas a exactamente la misma RLS
--   (select/insert/update/delete) que cualquier otra Quote de su
--   organización real.
--
-- =========================================================================
-- DECISIÓN — `source` en vez de `source` + `imported` boolean:
-- =========================================================================
-- Un solo campo ya distingue todo (`source <> 'thoren'` ⇒ histórica) — un
-- boolean adicional sería puro estado redundante derivable de `source`,
-- mismo criterio que el proyecto ya aplica en todos lados (nunca duplicar
-- una verdad que ya vive en otra columna). `check (source in ('thoren',
-- 'cotizia'))` sigue exactamente el mismo patrón que `quotes.status`/
-- `quotes.currency` en esta misma tabla.
--
-- =========================================================================
-- DECISIÓN — `original_folio` conserva el folio CRUDO de CotizIA, nunca el
-- corregido:
-- =========================================================================
-- `folio` (columna ya existente) sigue siendo "lo que se ve/imprime" — para
-- una Quote histórica, el valor YA CORREGIDO (ej. "KST-20260821-006").
-- `original_folio` es la auditoría del error histórico real (ej.
-- "KSJ-20260821-006", el prefijo de vendedor equivocado tal como salió de
-- CotizIA) — decisión explícita del usuario para esta fase: sin esto se
-- perdería la trazabilidad de qué específicamente se corrigió y por qué.
-- Es además la clave de idempotencia (índice único parcial, punto 4) en
-- vez del propio `folio`: dos folios corregidos nunca deberían coincidir
-- por diseño, pero el folio crudo es la referencia inequívoca al documento
-- de origen, incluso si en el futuro un folio corregido tuviera que
-- ajustarse de nuevo por algún hallazgo posterior.
--
-- =========================================================================
-- DECISIÓN — extender `trg_prevent_quote_folio_change` (0020) para proteger
-- `source`/`original_folio`, en vez de dejarlas editables:
-- =========================================================================
-- Ese trigger ya es, por diseño del proyecto ("RLS decide QUIÉN, el trigger
-- decide QUÉ columnas nunca cambian" — comentario textual de 0024), el
-- lugar donde vive la inmutabilidad de identidad de una Quote (folio,
-- sequence_number, salesperson_id, business_unit_id, quote_date). `source`/
-- `original_folio` son exactamente ese mismo tipo de dato — la identidad
-- histórica de la fila — así que dejarlos editables vía un UPDATE directo
-- (la policy `quotes_update_own_or_admin` de 0020 no distingue columnas)
-- sería un hueco real en la garantía de auditoría que esta misma fase pide
-- explícitamente ("mantenemos auditoría completa del error histórico").
-- Esta extensión NO es parte del pedido original del usuario para esta
-- fase — se reporta explícitamente como decisión de diseño añadida, no
-- silenciosa, para que pueda revisarse/revertirse si no se quiere.
--
-- Como el resto del proyecto: idempotente (add column if not exists,
-- create or replace para funciones, drop/create policy) y corre completa en
-- una sola transacción (begin/commit).

begin;

-- =========================================================================
-- 1) quotes — 7 columnas nuevas, todas nullable salvo `source` (default
--    'thoren', así que todas las Quotes ya existentes quedan correctas sin
--    ningún UPDATE explícito).
-- =========================================================================
alter table quotes
  add column if not exists source text not null default 'thoren'
    check (source in ('thoren', 'cotizia')),
  add column if not exists original_folio text,
  add column if not exists historical_pdf_path text,
  add column if not exists customer_contact_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists warranty text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quotes_source_original_folio_consistent'
  ) then
    alter table quotes
      add constraint quotes_source_original_folio_consistent
      check (
        (source = 'cotizia' and original_folio is not null)
        or (source = 'thoren' and original_folio is null)
      );
  end if;
end $$;

create unique index if not exists quotes_cotizia_original_folio_unique
  on quotes (original_folio) where source = 'cotizia';

-- =========================================================================
-- 2) quote_items.unit / quote_items.customer_requirements — ambas nullable,
--    texto libre tal como aparece en el PDF, nunca inventadas.
-- =========================================================================
alter table quote_items
  add column if not exists unit text,
  add column if not exists customer_requirements text;

-- =========================================================================
-- 3) trg_prevent_quote_folio_change (0020) — extendida para proteger
--    también source/original_folio. NO se toca ninguna otra validación ya
--    existente en esta función.
-- =========================================================================
create or replace function trg_prevent_quote_folio_change()
returns trigger
language plpgsql
as $$
begin
  if new.folio is distinct from old.folio then
    raise exception 'El folio de una Quote no se puede modificar (%). Duplícala para generar una nueva.', old.folio;
  end if;
  if new.sequence_number is distinct from old.sequence_number then
    raise exception 'El consecutivo de una Quote no se puede modificar.';
  end if;
  if new.salesperson_id is distinct from old.salesperson_id then
    raise exception 'El vendedor de una Quote no se puede cambiar una vez generado el folio.';
  end if;
  if new.business_unit_id is distinct from old.business_unit_id then
    raise exception 'La Business Unit de una Quote no se puede cambiar una vez generado el folio.';
  end if;
  if new.quote_date is distinct from old.quote_date then
    raise exception 'La fecha de una Quote no se puede cambiar una vez generado el folio.';
  end if;
  if new.source is distinct from old.source then
    raise exception 'El origen (source) de una Quote no se puede modificar.';
  end if;
  if new.original_folio is distinct from old.original_folio then
    raise exception 'El folio original (original_folio) de una Quote histórica no se puede modificar.';
  end if;
  return new;
end;
$$;

-- =========================================================================
-- 4) Bucket privado quote-archive — mismo patrón exacto que
--    business-unit-assets (0024).
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('quote-archive', 'quote-archive', false)
on conflict (id) do nothing;

-- =========================================================================
-- 5) Storage policies — ownership completo verificado vía `quotes`. Path:
--    {organization_id}/{quote_id}/original.pdf — mismo patrón de 3
--    segmentos que business-unit-assets (0024, {organization_id}/
--    {business_unit_id}/logo.{ext}): storage.foldername devuelve TODO
--    menos el último segmento (el nombre de archivo), así que
--    [1]=organization_id, [2]=quote_id — el nombre de archivo fijo
--    ("original.pdf") permite reemplazar con upsert:true sin acumular
--    basura, igual que el logo de una Business Unit.
-- =========================================================================
drop policy if exists "quote_archive_select_member" on storage.objects;
create policy "quote_archive_select_member" on storage.objects
  for select using (
    bucket_id = 'quote-archive' and auth.role() = 'authenticated' and current_user_active()
    and exists (
      select 1 from quotes q
      where q.id::text = (storage.foldername(objects.name))[2]
        and q.organization_id::text = (storage.foldername(objects.name))[1]
        and (
          is_organization_admin(q.organization_id)
          or (is_organization_member(q.organization_id) and q.salesperson_id = current_user_salesperson_id())
        )
    )
  );

drop policy if exists "quote_archive_insert_admin" on storage.objects;
create policy "quote_archive_insert_admin" on storage.objects
  for insert with check (
    bucket_id = 'quote-archive' and auth.role() = 'authenticated' and current_user_active()
    and exists (
      select 1 from quotes q
      where q.id::text = (storage.foldername(objects.name))[2]
        and q.organization_id::text = (storage.foldername(objects.name))[1]
        and is_organization_admin(q.organization_id)
    )
  );

drop policy if exists "quote_archive_update_admin" on storage.objects;
create policy "quote_archive_update_admin" on storage.objects
  for update using (
    bucket_id = 'quote-archive' and auth.role() = 'authenticated' and current_user_active()
    and exists (
      select 1 from quotes q
      where q.id::text = (storage.foldername(objects.name))[2]
        and q.organization_id::text = (storage.foldername(objects.name))[1]
        and is_organization_admin(q.organization_id)
    )
  );

drop policy if exists "quote_archive_delete_admin" on storage.objects;
create policy "quote_archive_delete_admin" on storage.objects
  for delete using (
    bucket_id = 'quote-archive' and auth.role() = 'authenticated' and current_user_active()
    and exists (
      select 1 from quotes q
      where q.id::text = (storage.foldername(objects.name))[2]
        and q.organization_id::text = (storage.foldername(objects.name))[1]
        and is_organization_admin(q.organization_id)
    )
  );

commit;
