-- THÖREN — Importación histórica DEFINITIVA de 55 cotizaciones CotizIA
--
-- Carga de datos puntual, de una sola vez, para las 55 Quotes históricas
-- aprobadas (61 documentos totales − 6 excluidas: ver sección EXCLUSIONES
-- abajo). Vive fuera de supabase/migrations/ a propósito: no es un cambio
-- de esquema (0028_quotes_historical_import_schema.sql ya lo cubrió y ya
-- está aplicado en Cloud, verificado con foundation_ok = true), es carga
-- de datos. Se ejecuta manualmente en Supabase Cloud (SQL Editor, rol
-- postgres/superusuario — ver NOTA DE RLS abajo), nunca desde la app.
--
-- =========================================================================
-- FUENTE DE LOS DATOS
-- =========================================================================
-- Cada campo de cada Quote y de cada quote_item fue transcrito directamente
-- de los 55 PDFs reales de CotizIA (leídos visualmente, no OCR). Ningún
-- dato fue inventado: donde el PDF no trae un dato (contacto, email,
-- teléfono, garantía, forma de pago, tiempo de entrega, requisitos del
-- cliente...) el campo queda NULL explícitamente. La aritmética de las 55
-- Quotes (subtotal = Σ line_subtotal, tax_total = subtotal × 16%, total =
-- subtotal + tax_total) fue verificada línea por línea contra el PDF antes
-- de escribir este archivo — ver reporte de validación local que acompaña
-- esta entrega.
--
-- =========================================================================
-- DECISIÓN — quote_date se deriva del folio, NO del campo "Fecha" del PDF
-- =========================================================================
-- Casi todos los 55 PDFs muestran "Fecha: 22 de agosto de 2026" — la fecha
-- en que CotizIA regeneró/exportó el lote completo de PDFs para esta
-- entrega, NO la fecha real en que cada cotización se emitió originalmente
-- (evidencia: un puñado de PDFs sí retiene su fecha real distinta, p.ej.
-- KST-20260817-006 muestra "Fecha: 19 de agosto de 2026", coincidiendo con
-- el segmento de fecha de su propio folio). El folio (YYYYMMDD embebido en
-- el propio número, tanto en el original como en el corregido — nunca se
-- corrigió ese segmento) es la única fuente de fecha consistente y
-- verificable para las 55, así que `quote_date` se deriva de ahí. `valid_until`
-- = quote_date + los días de "Vigencia" tal como aparecen en cada PDF.
--
-- =========================================================================
-- DECISIÓN — resolución de Customers: find-or-create idempotente, no lista
-- hardcodeada de "35 nuevos / 13 existentes"
-- =========================================================================
-- En vez de bifurcar el script en dos rutas (INSERT fijo para los 35 ya
-- clasificados como nuevos / lookup fijo por UUID para los 13 existentes),
-- cada uno de los 55 bloques resuelve su Customer con la MISMA lógica de
-- matching ya validada en Supabase Cloud (RFC exacto normalizado → si no,
-- name exacto normalizado → si no, legal_name exacto normalizado): si
-- encuentra 0 coincidencias, lo crea; si encuentra 1, lo reutiliza. Esto es
-- estrictamente equivalente al resultado ya validado (48 clientes únicos =
-- 13 existentes reutilizados + 35 nuevos creados, 0 conflictos) sin
-- necesitar hardcodear ningún UUID de Cloud en este archivo versionado, y
-- es naturalmente idempotente: una segunda ejecución nunca duplica un
-- Customer porque ya lo encuentra por la misma clave natural.
--
-- =========================================================================
-- IDEMPOTENCIA DE LAS QUOTES
-- =========================================================================
-- Cada INSERT de `quotes` usa `on conflict (original_folio) where
-- source = 'cotizia' do nothing returning id` contra el índice único
-- parcial `quotes_cotizia_original_folio_unique` (0028). Si la fila ya
-- existía, el INSERT no hace nada, el script recupera su id con un SELECT
-- y — crítico — NO vuelve a insertar sus quote_items (evita duplicar
-- líneas en una segunda corrida). Toda la importación corre dentro de una
-- única transacción (BEGIN/COMMIT): si cualquier bloque falla, nada de lo
-- ya insertado en esta corrida queda a medias.
--
-- =========================================================================
-- EXCLUSIONES — 6 documentos históricos NO se importan como Quote
-- estructurada (aprobado explícitamente, se conservan solo como PDF):
-- =========================================================================
--   DOJ-20260814-004, DOJ-20260814-005 — sin ningún dato de cliente en el
--     PDF ("Sin datos del cliente"); quotes.customer_id es NOT NULL, no se
--     inventa un Customer para satisfacerlo.
--   VVJ-20260820-007 — Borrador sin productos, subtotal/IVA/total = 0.
--   EGJ-20260813-004, EGJ-20260608-001, EGJ-20260308-002 — vendedora
--     "Erika González" no existe todavía en people/salespeople de la
--     organización (único vendedor no resuelto de los 5 originales,
--     confirmado en Cloud) — exclusión TEMPORAL, no se crea el vendedor.
--
-- =========================================================================
-- NOTA DE RLS
-- =========================================================================
-- `quote_items_insert_borrador_own_or_admin` (0020) exige que la Quote
-- padre tenga status='borrador' para CUALQUIER insert de quote_items,
-- incluso ADMIN — la mayoría de estas 55 Quotes históricas tienen status
-- enviada/aceptada, nunca todas borrador. Este script DEBE ejecutarse como
-- postgres/superusuario vía Supabase SQL Editor (bypass de RLS), exactamente
-- el mismo contexto ya usado para 0027 y para aplicar 0028 — nunca como una
-- sesión de app autenticada normal.
--
-- =========================================================================
-- QUÉ NO HACE ESTE SCRIPT
-- =========================================================================
-- No toca salesperson_quote_sequences (no consume ningún folio en vivo).
-- No llama rpc_create_quote/rpc_create_order_from_quote. No crea Orders.
-- No modifica ninguna Quote moderna (source='thoren') existente. No sube
-- ningún PDF a Storage (historical_pdf_path queda NULL — paso posterior).

begin;

-- =========================================================================
-- Normalización de nombre completo (acentos/mayúsculas/espacios) para
-- resolver vendedores — misma función validada en el preflight de
-- corrección de matching de vendedores contra Supabase Cloud real
-- (4/5 resueltos tras la corrección; único no resuelto: Erika González).
-- =========================================================================
create or replace function pg_temp.normalize_full_name(input text) returns text
language sql immutable as $$
  select lower(
    btrim(
      regexp_replace(
        translate(
          coalesce(input, ''),
          'áéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛ',
          'aeiouunAEIOUUNaeiouAEIOUaeiouAEIOU'
        ),
        '\s+', ' ', 'g'
      )
    )
  );
$$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260821-011  (original CotizIA: KST-20260821-011)
-- Cliente: AUTOMATIZACION INDUSTRIAL OLIVO  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260821-011): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260821-011): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('AUTOMATIZACION INDUSTRIAL OLIVO'))
      or upper(btrim(legal_name)) = upper(btrim('AUTOMATIZACION INDUSTRIAL OLIVO'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'AUTOMATIZACION INDUSTRIAL OLIVO', null, 'anaolivo28@hotmail.com', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260821-011', 0, date '2026-08-21', 'enviada', 'USD', 16.00, 0,
    date '2026-08-21' + 15, 'AUTOMATIZACION INDUSTRIAL OLIVO', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    2341.00, 0, 374.56, 2715.56,
    null, 'CONTADO', '4 SEMANAS', null,
    'cotizia', 'KST-20260821-011', 'ANA OLIVO', 'anaolivo28@hotmail.com', null, '1 AÑO VS DEFECTOS'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KST-20260821-011' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KST-20260821-011', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'PROYECTOR SEÑALIZACION LED DUAL ( DOS PLANTILLAS PEATONAL - ALTO) CAPACIDAD 400 WATTS CON INTEGRACION 2 SENSOR DE PROXIMIDAD RANGO ( 2 - 3 MTS )', null, 1, 2341.00, 0, 2341.00, 'pza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260819-010  (original CotizIA: KST-20260819-010)
-- Cliente: MARVIC  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260819-010): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260819-010): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('MSI140603PQ9' is not null and upper(btrim(tax_id)) = upper(btrim('MSI140603PQ9')))
      or upper(btrim(name)) = upper(btrim('MARVIC'))
      or upper(btrim(legal_name)) = upper(btrim('MARVIC'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'MARVIC', 'MSI140603PQ9', 'compras@marvic.mx', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260819-010', 0, date '2026-08-19', 'enviada', 'USD', 16.00, 0,
    date '2026-08-19' + 30, 'MARVIC', null, 'MSI140603PQ9',
    'Thunder LED Lights', 'thunder_led', p.name,
    11259.19, 0, 1801.47, 13060.66,
    null, 'Contado', '4 - 5 SEMANAS', null,
    'cotizia', 'KST-20260819-010', null, 'compras@marvic.mx', null, '12 meses en equipos'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KST-20260819-010' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KST-20260819-010', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'SOLUCION INDUSTRIAL LOOK OUT BOX INCLUYE 3 LUCES, 3 SENSORES, ALARMA AUDIBLE 80DB , BURST LIGHT ( LUZ CENTRAL AL PISO) Y CONECTOR.', null, 1, 1243.94, 0, 1243.94, 'pza', null),
      (v_quote_id, 2, 'SENSOR LOOK OUT 3 WALL INCLUYE 3 LUCES, 3 SENSORES, ALARMA AUDIBLE, BURST LIGHT ( FOCO CENTRAL AL PISO) Y CONECTOR', null, 1, 1213.00, 0, 1213.00, 'pza', null),
      (v_quote_id, 3, 'PROYECTOR SEÑALIZACION LED DUAL ( DOS PLANTILLAS PEATONAL - ALTO) CAPACIDAD 400 WATTS CON INTEGRACION 3 SENSOR DE PROXIMIDAD RANGO ( 2 - 3 MTS2)', null, 1, 2669.00, 0, 2669.00, 'pza', null),
      (v_quote_id, 4, 'PROYECTOR SEÑALIZACION LED DUAL ( DOS PLANTILLAS PEATONAL - ALTO) CAPACIDAD 400 WATTS CON INTEGRACION 2 SENSOR DE PROXIMIDAD RANGO ( 2 - 3 MTS )', null, 1, 2341.00, 0, 2341.00, 'pza', null),
      (v_quote_id, 5, 'PROYECTOR VIRTUAL-INDUSTRIAL 400W', null, 1, 1546.00, 0, 1546.00, 'Pieza', 'INCLUYE PLANTILLA PERSONALIZADA, CONVERTIDOR DE VOLTAJE Y BASE PARA MONTAJE'),
      (v_quote_id, 6, 'SOLUCION INDUSTRIAL MEDIANTE SEÑALIZACIÓN LED INCLUYE SKYBEAM CAPACIDAD 600 WATTS , PLANTILLA PERSONALIZADA, CONVERTIDOR DE VOLTAJE Y BASE PARA MONTAJE.', null, 1, 1866.25, 0, 1866.25, 'pza', null),
      (v_quote_id, 7, 'LUZ LED GRUA VIAJERA COLOR ROJO', null, 1, 380.00, 0, 380.00, 'Pieza', 'INCLUYE CONVERTIDOR DE VOLTAJE 110V');
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260818-009  (original CotizIA: KST-20260818-009)
-- Cliente: SERTECH GRUAS  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260818-009): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260818-009): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('SERTECH GRUAS'))
      or upper(btrim(legal_name)) = upper(btrim('SERTECH GRUAS'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'SERTECH GRUAS', null, 'ingenieria@sertechgruas.com', '8995086618')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260818-009', 0, date '2026-08-18', 'enviada', 'USD', 16.00, 0,
    date '2026-08-18' + 30, 'SERTECH GRUAS', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    1186.00, 0, 189.76, 1375.76,
    null, 'CONTADO', '5 semanas', null,
    'cotizia', 'KST-20260818-009', 'JAIME', 'ingenieria@sertechgruas.com', '8995086618', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KST-20260818-009' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KST-20260818-009', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'Ring Dot Pro', null, 1, 1186.00, 0, 1186.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260817-007  (original CotizIA: KST-20260817-007)
-- Cliente: NOVAK INDUSTRIAL  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260817-007): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260817-007): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('NOVAK INDUSTRIAL'))
      or upper(btrim(legal_name)) = upper(btrim('NOVAK INDUSTRIAL'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'NOVAK INDUSTRIAL', null, 'compras@novakindustrial.com', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260817-007', 0, date '2026-08-17', 'enviada', 'USD', 16.00, 0,
    date '2026-08-17' + 15, 'NOVAK INDUSTRIAL', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    1563.50, 0, 250.16, 1813.66,
    null, 'CONTADO', '7 - 10 DIAS', null,
    'cotizia', 'KST-20260817-007', 'MARICELA DIAZ', 'compras@novakindustrial.com', null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KST-20260817-007' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KST-20260817-007', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'LUZ LED GRUA VIAJERA COLOR ROJO', null, 4, 385.00, 0, 1540.00, 'Pieza', 'INCLUYE CONVERTIDOR DE VOLTAJE 110V'),
      (v_quote_id, 2, 'MANIOBRAS', null, 1, 23.50, 0, 23.50, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260817-006  (original CotizIA: KST-20260817-006)
-- Cliente: DISTRIBUIDORA DE EQUIPOS Y COMPONENTES DEL BAJIO  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260817-006): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260817-006): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('DISTRIBUIDORA DE EQUIPOS Y COMPONENTES DEL BAJIO'))
      or upper(btrim(legal_name)) = upper(btrim('DISTRIBUIDORA DE EQUIPOS Y COMPONENTES DEL BAJIO'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'DISTRIBUIDORA DE EQUIPOS Y COMPONENTES DEL BAJIO', null, 'marcomuzquiz@decbajio.com', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260817-006', 0, date '2026-08-17', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-17' + 15, 'DISTRIBUIDORA DE EQUIPOS Y COMPONENTES DEL BAJIO', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    7235.00, 0, 1157.60, 8392.60,
    null, 'CONTADO', 'INMEDIATO', null,
    'cotizia', 'KST-20260817-006', 'ING MARCO MUZQUIZ', 'marcomuzquiz@decbajio.com', null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KST-20260817-006' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KST-20260817-006', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'CONVERTIDOR DE VOLTAJE', null, 5, 1447.00, 0, 7235.00, 'pza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260814-005  (original CotizIA: KST-20260814-005)
-- Cliente: HG ELECTRO SOLUTION  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260814-005): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260814-005): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('HG ELECTRO SOLUTION'))
      or upper(btrim(legal_name)) = upper(btrim('HG ELECTRO SOLUTION'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'HG ELECTRO SOLUTION', null, 'soluelecv@gmail.com', '8112856017')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260814-005', 0, date '2026-08-14', 'enviada', 'USD', 16.00, 0,
    date '2026-08-14' + 30, 'HG ELECTRO SOLUTION', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    33053.00, 0, 5288.48, 38341.48,
    null, 'Contado', '7 Semanas considerando Instalación', null,
    'cotizia', 'KST-20260814-005', 'SILOE VILLANUEVA RIVERA', 'soluelecv@gmail.com', '8112856017', '1 AÑO VS DEFECTOS'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KST-20260814-005' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KST-20260814-005', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'PROYECTOR SEÑALIZACION LED DUAL ( DOS PLANTILLAS PEATONAL - ALTO) CAPACIDAD 600 WATTS CON INTEGRACION 1 SENSOR DE PROXIMIDAD', null, 2, 2524.00, 0, 5048.00, 'pza', null),
      (v_quote_id, 2, 'PROYECTOR SEÑALIZACION LED DUAL ( DOS PLANTILLAS PEATONAL - ALTO) CAPACIDAD 400 WATTS CON INTEGRACION 2 SENSOR DE PROXIMIDAD RANGO ( 2 - 3 MTS )', null, 6, 2565.00, 0, 15390.00, 'pza', null),
      (v_quote_id, 3, 'SUMINISTRO E INSTALACION', null, 1, 12615.00, 0, 12615.00, 'Unidad de servicio', 'Servicio de Instalación electrica y montaje de Proyectores Industriales . Incluye material : Tubo Conduit 1/2" pared delgada, cable LS 12AWG ( negro/blanco/verde) accesorios conduit coples, codos, conectores, registros electricos, unicanal, soporteria, varilla roscada y consumibles de fijacion y electricos. consumibles, equipo, mano de obra, herramientas y equipo necesario para su correcta ejecucion. Se consideran hasta 171 Mts lineales entre recorridos, subidas, bajadas, etc');
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260813-004  (original CotizIA: KST-20260813-004)
-- Cliente: ELECTRONICA INFINITA  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260813-004): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260813-004): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('EIN071106NF7' is not null and upper(btrim(tax_id)) = upper(btrim('EIN071106NF7')))
      or upper(btrim(name)) = upper(btrim('ELECTRONICA INFINITA'))
      or upper(btrim(legal_name)) = upper(btrim('ELECTRONICA INFINITA'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'ELECTRONICA INFINITA', 'EIN071106NF7', null, null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260813-004', 0, date '2026-08-13', 'enviada', 'USD', 16.00, 0,
    date '2026-08-13' + 15, 'ELECTRONICA INFINITA', null, 'EIN071106NF7',
    'Thunder LED Lights', 'thunder_led', p.name,
    618.00, 0, 98.88, 716.88,
    null, 'CONTADO', '5-15 días hábiles', 'L.A.B Monterrey
Atn Srita Berenice',
    'cotizia', 'KST-20260813-004', 'ELECTRONICA INFINITA', null, null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KST-20260813-004' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KST-20260813-004', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'Virtual Laser PRO', null, 1, 283.00, 0, 283.00, 'Pieza', null),
      (v_quote_id, 2, 'Laserguide Forlift para montacargas ( Alineador )', null, 1, 335.00, 0, 335.00, 'pza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260708-003  (original CotizIA: KST-20260708-003)
-- Cliente: MARVIC  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260708-003): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260708-003): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('MSI140603PQ9' is not null and upper(btrim(tax_id)) = upper(btrim('MSI140603PQ9')))
      or upper(btrim(name)) = upper(btrim('MARVIC'))
      or upper(btrim(legal_name)) = upper(btrim('MARVIC'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'MARVIC', 'MSI140603PQ9', 'auxiliar.compras@marvic.mx', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260708-003', 0, date '2026-07-08', 'enviada', 'USD', 16.00, 0,
    date '2026-07-08' + 15, 'MARVIC', null, 'MSI140603PQ9',
    'Thunder LED Lights', 'thunder_led', p.name,
    2737.44, 0, 437.99, 3175.43,
    null, 'CONTADO', '5 SEMANAS', 'L.A.B Monterrey , N.L
No incluye Instalación ( Se cotiza por separado )
Cotizado en USD , si se paga en MXN considerar el tipo de cambio de DOF del Día.',
    'cotizia', 'KST-20260708-003', null, 'auxiliar.compras@marvic.mx', null, '12 meses en Equipos'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KST-20260708-003' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KST-20260708-003', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'PROYECTOR VIRTUAL-INDUSTRIAL 300W', null, 2, 1368.72, 0, 2737.44, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260708-002  (original CotizIA: KST-20260708-002)
-- Cliente: DISTRIBUIDORA AZTECA  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260708-002): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260708-002): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('DISTRIBUIDORA AZTECA'))
      or upper(btrim(legal_name)) = upper(btrim('DISTRIBUIDORA AZTECA'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'DISTRIBUIDORA AZTECA', null, 'distribuidora.aztecanld@gmail.com', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260708-002', 0, date '2026-07-08', 'enviada', 'MXN', 16.00, 0,
    date '2026-07-08' + 15, 'DISTRIBUIDORA AZTECA', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    4050.00, 0, 648.00, 4698.00,
    null, 'contado', '5 - 8 Dias habiles', 'L.A.B Su planta
Atn Srita Patricia García',
    'cotizia', 'KST-20260708-002', 'PATRICIA GARCIA', 'distribuidora.aztecanld@gmail.com', null, '30 DIAS VS DEFECTO FABRICA'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KST-20260708-002' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KST-20260708-002', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'GUANTE PARA GAS PROPANO', null, 6, 630.00, 0, 3780.00, 'par', null),
      (v_quote_id, 2, 'MANIOBRAS', null, 1, 270.00, 0, 270.00, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260708-001  (original CotizIA: KST-20260708-001)
-- Cliente: MADISA  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260708-001): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260708-001): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('MADISA'))
      or upper(btrim(legal_name)) = upper(btrim('MADISA'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'MADISA', null, 'devhernandez@madisa.com', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260708-001', 0, date '2026-07-08', 'enviada', 'MXN', 16.00, 0,
    date '2026-07-08' + 30, 'MADISA', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    4375.00, 0, 700.00, 5075.00,
    null, 'CONTADO', 'INMEDIATO', 'L.A.B Monterrey, su Planta
No incluye Instalación
Atn Srita Devani Hernández',
    'cotizia', 'KST-20260708-001', 'DEVANI HERNÁNDEZ', 'devhernandez@madisa.com', null, '1 AÑO VS DEFECTOS'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KST-20260708-001' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KST-20260708-001', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'LUZ LED SEGURIDAD LINEAL', null, 2, 2187.50, 0, 4375.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260819-005  (original CotizIA: KSJ-20260819-005)
-- Cliente: JV INGENIERIA E INTEGRACIONES ELECTRICAS  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260819-005): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260819-005): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('JV INGENIERIA E INTEGRACIONES ELECTRICAS'))
      or upper(btrim(legal_name)) = upper(btrim('JV INGENIERIA E INTEGRACIONES ELECTRICAS'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'JV INGENIERIA E INTEGRACIONES ELECTRICAS', null, 'enriquez@jvingenieria.mx', '8118116190')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260819-005', 0, date '2026-08-19', 'enviada', 'USD', 16.00, 0,
    date '2026-08-19' + 30, 'JV INGENIERIA E INTEGRACIONES ELECTRICAS', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    33053.00, 0, 5288.48, 38341.48,
    null, 'Contado', '7 Semanas considerando Instalación', null,
    'cotizia', 'KSJ-20260819-005', 'JOSE LUIS ENRIQUEZ', 'enriquez@jvingenieria.mx', '8118116190', '1 AÑO VS DEFECTOS'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KSJ-20260819-005' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KSJ-20260819-005', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'PROYECTOR SEÑALIZACION LED DUAL ( DOS PLANTILLAS PEATONAL - ALTO) CAPACIDAD 600 WATTS CON INTEGRACION 1 SENSOR DE PROXIMIDAD', null, 2, 2524.00, 0, 5048.00, 'PZA', null),
      (v_quote_id, 2, 'PROYECTOR SEÑALIZACION LED DUAL ( DOS PLANTILLAS PEATONAL - ALTO) CAPACIDAD 400 WATTS CON INTEGRACION 2 SENSOR DE PROXIMIDAD RANGO ( 2 - 3 MTS )', null, 6, 2565.00, 0, 15390.00, 'pza', null),
      (v_quote_id, 3, 'SUMINISTRO E INSTALACION', null, 1, 12615.00, 0, 12615.00, 'Unidad de servicio', 'Servicio de y montaje de Proyectores _ Incluyo material Conduit 1/2" pared delgada. cable LS 12AVVG ( negro/blanc-otve•rde) accesorios Conduit conectores. registros unicanal. soportaria, varilla roscada y consumibles de fijacion y electricos. consumibles. equipo. mano de obra. herramientas y equipo necesaria para su correcta Se mnsideran hasta 171 Mts lineales entre bajadas, etc');
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260821-006  (original CotizIA: KSJ-20260821-006)
-- Cliente: MARVIC  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260821-006): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260821-006): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('MSI140603PQ9' is not null and upper(btrim(tax_id)) = upper(btrim('MSI140603PQ9')))
      or upper(btrim(name)) = upper(btrim('MARVIC'))
      or upper(btrim(legal_name)) = upper(btrim('MARVIC'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'MARVIC', 'MSI140603PQ9', 'compras@marvic.mx', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260821-006', 0, date '2026-08-21', 'enviada', 'USD', 16.00, 0,
    date '2026-08-21' + 15, 'MARVIC', null, 'MSI140603PQ9',
    'Thunder LED Lights', 'thunder_led', p.name,
    1648.00, 0, 263.68, 1911.68,
    null, 'CONTADO', '4 - 5 SEMANAS', null,
    'cotizia', 'KSJ-20260821-006', null, 'compras@marvic.mx', null, '1 AÑO VS DEFECTOS'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KSJ-20260821-006' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KSJ-20260821-006', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'SOLUCIÓN LOOK OUT HALL DOOR MONITOR 4 INCLUYE : CAJA DE ALERTA C/2 LUCES PEQUEÑAS, CAJA DOD C/2 LUCES ROJAS, 3 SENSORES INTERIORES, ARNES CABLEADO DE 3'', ALARMA AUDIBLE, CONECTOR Y BURST LIGHS ( FOCO CENTRAL AL PISO)', null, 1, 1648.00, 0, 1648.00, 'pza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260811-004  (original CotizIA: KSJ-20260811-004)
-- Cliente: MAYOREO DE ARTICULOS DE SEGURIDAD SA DE CV  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260811-004): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260811-004): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('MAYOREO DE ARTICULOS DE SEGURIDAD SA DE CV'))
      or upper(btrim(legal_name)) = upper(btrim('MAYOREO DE ARTICULOS DE SEGURIDAD SA DE CV'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'MAYOREO DE ARTICULOS DE SEGURIDAD SA DE CV', null, 'compras@mayoreoenlinea.com', '8182027065')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260811-004', 0, date '2026-08-11', 'enviada', 'USD', 16.00, 0,
    date '2026-08-11' + 15, 'MAYOREO DE ARTICULOS DE SEGURIDAD SA DE CV', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    1188.30, 0, 190.13, 1378.43,
    null, 'CONTADO', '5-15 días hábiles', null,
    'cotizia', 'KSJ-20260811-004', 'RUBI SANDOVAL', 'compras@mayoreoenlinea.com', '8182027065', '30 DIAS VS DEFECTO FABRICA'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KSJ-20260811-004' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KSJ-20260811-004', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'SOLARCAP ENTINTADO 33 PULG X 45 PULG', null, 1, 136.80, 0, 136.80, 'Pieza', null),
      (v_quote_id, 2, 'SOLARCAP ENTINTADO 53 PULG X 45 PULG', null, 1, 166.50, 0, 166.50, 'Pieza', null),
      (v_quote_id, 3, 'CUBIERTA PARA MONTACARGAS', null, 1, 245.00, 0, 245.00, 'Pieza', 'CAPACIDAD 6000 LBS MEDIDA STD'),
      (v_quote_id, 4, 'CUBIERTA PARA MONTACARGAS', null, 1, 285.00, 0, 285.00, 'Pieza', 'CAPACIDAD 8000 LBS MEDIDA GRANDE'),
      (v_quote_id, 5, 'CUBIERTA PARA MONTACARGAS', null, 1, 355.00, 0, 355.00, 'Pieza', 'CAPACIDAD 12000 LBS MEDIDA XL');
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KST-20260811-003  (original CotizIA: KSJ-20260811-003)
-- Cliente: INGPYMA SA DE CV  ·  Vendedor: Karla Saucedo  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KST-20260811-003): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KST-20260811-003): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('INGPYMA SA DE CV'))
      or upper(btrim(legal_name)) = upper(btrim('INGPYMA SA DE CV'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'INGPYMA SA DE CV', null, 'ventas01@ingpyma.com', '4721471180')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KST-20260811-003', 0, date '2026-08-11', 'aceptada', 'MXN', 16.00, 0,
    date '2026-08-11' + 15, 'INGPYMA SA DE CV', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    40126.60, 0, 6420.26, 46546.86,
    null, 'CONTADO', '4 SEMANAS', 'L.A.B MONTERREY, NO INCLUYE ENVIO
NO INCLUYE INSTALACIÓN
ATN SRITA ELIZABETH TAVIRA',
    'cotizia', 'KSJ-20260811-003', 'ELIZABETH TAVIRA', 'ventas01@ingpyma.com', '4721471180', '1 AÑO VS DEFECTOS DE FABRICA'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KSJ-20260811-003' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KSJ-20260811-003', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'PROYECTOR SEÑALIZACION LED DUAL ( DOS PLANTILLAS PEATONAL - ALTO) CAPACIDAD 400 WATTS CON INTEGRACION 2 SENSOR DE PROXIMIDAD RANGO ( 2 - 3 MTS )', null, 1, 40126.60, 0, 40126.60, 'pza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KSJ-20260811-002  (original CotizIA: KSJ-20260811-002)
-- Cliente: MARVIC  ·  Vendedor: Karla Saucedo  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KSJ-20260811-002): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KSJ-20260811-002): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('MSI140603PQ9' is not null and upper(btrim(tax_id)) = upper(btrim('MSI140603PQ9')))
      or upper(btrim(name)) = upper(btrim('MARVIC'))
      or upper(btrim(legal_name)) = upper(btrim('MARVIC'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'MARVIC', 'MSI140603PQ9', 'compras@marvic.mx', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KSJ-20260811-002', 0, date '2026-08-11', 'aceptada', 'MXN', 16.00, 0,
    date '2026-08-11' + 15, 'MARVIC', null, 'MSI140603PQ9',
    'Juno Promotional', 'juno_promotional', p.name,
    4048.00, 0, 647.68, 4695.68,
    null, null, '7 dias', 'Tampografia de 1 Logo , 1 tinta.
L.A.B Monterrey
Atn Srita Josueline Guel',
    'cotizia', 'KSJ-20260811-002', null, 'compras@marvic.mx', null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KSJ-20260811-002' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KSJ-20260811-002', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'BOLIGRAFO CANE', null, 506, 8.00, 0, 4048.00, 'PIEZA', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: KSJ-20260708-001  (original CotizIA: KSJ-20260708-001)
-- Cliente: MARVIC  ·  Vendedor: Karla Saucedo  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (KSJ-20260708-001): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Karla Saucedo');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (KSJ-20260708-001): vendedor % no encontrado.', 'Karla Saucedo';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('MSI140603PQ9' is not null and upper(btrim(tax_id)) = upper(btrim('MSI140603PQ9')))
      or upper(btrim(name)) = upper(btrim('MARVIC'))
      or upper(btrim(legal_name)) = upper(btrim('MARVIC'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'MARVIC', 'MSI140603PQ9', 'compras@marvic.mx', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'KSJ-20260708-001', 0, date '2026-07-08', 'enviada', 'MXN', 16.00, 0,
    date '2026-07-08' + 15, 'MARVIC', null, 'MSI140603PQ9',
    'Juno Promotional', 'juno_promotional', p.name,
    4048.00, 0, 647.68, 4695.68,
    null, 'CONTADO', '7 dias', 'L.A.B  Su Planta
Incluye ; 1 Personalizacion tampografia 1 color logotipo
Atn : Josueline Guel',
    'cotizia', 'KSJ-20260708-001', null, 'compras@marvic.mx', null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'KSJ-20260708-001' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=KSJ-20260708-001', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'BOLIGRAFO CANE', null, 506, 8.00, 0, 4048.00, 'pza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VPG-20260810-001  (original CotizIA: VPG-20260810-001)
-- Cliente: IOS Offices  ·  Vendedor: Vladimir Peña  ·  BU: got_fresh_breath
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'got_fresh_breath' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VPG-20260810-001): Business Unit % no encontrada/activa.', 'got_fresh_breath';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Vladimir Peña');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VPG-20260810-001): vendedor % no encontrado.', 'Vladimir Peña';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('IOS Offices'))
      or upper(btrim(legal_name)) = upper(btrim('IOS Offices'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'IOS Offices', null, 'Jen.martinez@iosoffices.com', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VPG-20260810-001', 0, date '2026-08-10', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-10' + 15, 'IOS Offices', null, null,
    'Got Fresh Breath Mexico', 'got_fresh_breath', p.name,
    21250.00, 0, 3400.00, 24650.00,
    null, 'Contado', '3-5 Dias Habiles', null,
    'cotizia', 'VPG-20260810-001', 'Jen Martinez', 'Jen.martinez@iosoffices.com', null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VPG-20260810-001' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VPG-20260810-001', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'DISPENSADOR NICKEL', null, 5, 1850.00, 0, 9250.00, 'Pieza', null),
      (v_quote_id, 2, 'DISPENSADOR NEGRO', null, 2, 1650.00, 0, 3300.00, 'Pieza', null),
      (v_quote_id, 3, 'GOT FRESH BREATH-ENJUAGUE BUCAL', null, 5, 1650.00, 0, 8250.00, 'Caja', '3 cajas para Monterrey y 2 cajas a CDMX.'),
      (v_quote_id, 4, 'MANIOBRAS', null, 1, 450.00, 0, 450.00, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VPJ-20260821-006  (original CotizIA: VPJ-20260821-006)
-- Cliente: Dexadi  ·  Vendedor: Vladimir Peña  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VPJ-20260821-006): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Vladimir Peña');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VPJ-20260821-006): vendedor % no encontrado.', 'Vladimir Peña';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('Dexadi'))
      or upper(btrim(legal_name)) = upper(btrim('Dexadi'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'Dexadi', null, null, null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VPJ-20260821-006', 0, date '2026-08-21', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-21' + 15, 'Dexadi', null, null,
    'Juno Promotional', 'juno_promotional', p.name,
    40800.00, 0, 6528.00, 47328.00,
    null, 'Contado', '3-5 Días Habiles', null,
    'cotizia', 'VPJ-20260821-006', 'Manuel Valladares', null, null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VPJ-20260821-006' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VPJ-20260821-006', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'LIBRETA AGENDARIO BORGES', null, 300, 80.00, 0, 24000.00, 'Pieza', 'Libreta de espiral con pasta rígida de curpiel. Incluye 96 hojas a rayas, elástico para cerrar y mantener tus notas seguras y elástico para bolígrafo (no incluido). Su diseño agendario te permite usarlo en tu día a día para organizar citas y tareas fácilmente.'),
      (v_quote_id, 2, 'LIBRETA VITA', null, 300, 56.00, 0, 16800.00, 'Pieza', 'Libreta con pasta rígida de curpiel (poliuretano), espiral metálico y 80 hojas de raya con un apartado en la parte superior para la fecha, cual la hace ideal para tomar notas de manera ordenada. El curpiel le da un acabado suave y elegante convirtiéndola en la libreta perfecta para cualquier ocasión.');
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VPJ-20260819-004  (original CotizIA: VPJ-20260819-004)
-- Cliente: EPL CAS  ·  Vendedor: Vladimir Peña  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VPJ-20260819-004): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Vladimir Peña');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VPJ-20260819-004): vendedor % no encontrado.', 'Vladimir Peña';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('ECA240503NK7' is not null and upper(btrim(tax_id)) = upper(btrim('ECA240503NK7')))
      or upper(btrim(name)) = upper(btrim('EPL CAS'))
      or upper(btrim(legal_name)) = upper(btrim('EPL CAS'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'EPL CAS', 'ECA240503NK7', 'ttorres@surtidorepl.mx', '101')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VPJ-20260819-004', 0, date '2026-08-19', 'borrador', 'MXN', 16.00, 0,
    date '2026-08-19' + 15, 'EPL CAS', null, 'ECA240503NK7',
    'Juno Promotional', 'juno_promotional', p.name,
    1188.00, 0, 190.08, 1378.08,
    null, null, null, null,
    'cotizia', 'VPJ-20260819-004', 'EPL CAS', 'ttorres@surtidorepl.mx', '101', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VPJ-20260819-004' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VPJ-20260819-004', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'PARAGUAS DANUBIO', null, 12, 99.00, 0, 1188.00, 'PIEZA', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VPJ-20260708-002  (original CotizIA: VPJ-20260708-002)
-- Cliente: HOGAN LOVELLS CADWALADER  ·  Vendedor: Vladimir Peña  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VPJ-20260708-002): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Vladimir Peña');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VPJ-20260708-002): vendedor % no encontrado.', 'Vladimir Peña';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('BST8201028Y2' is not null and upper(btrim(tax_id)) = upper(btrim('BST8201028Y2')))
      or upper(btrim(name)) = upper(btrim('HOGAN LOVELLS CADWALADER'))
      or upper(btrim(legal_name)) = upper(btrim('HOGAN LOVELLS CADWALADER'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'HOGAN LOVELLS CADWALADER', 'BST8201028Y2', 'andrea.cortez@hoganlovells.com', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VPJ-20260708-002', 0, date '2026-07-08', 'enviada', 'MXN', 16.00, 0,
    date '2026-07-08' + 15, 'HOGAN LOVELLS CADWALADER', null, 'BST8201028Y2',
    'Juno Promotional', 'juno_promotional', p.name,
    74100.00, 0, 11856.00, 85956.00,
    null, 'Contado', '5-7 dias habiles', 'Los productos se entregan en sus instalaciones, la tecnica que se utilizara en todos los productos es Serigrafia, un logo, un tono y un lado.',
    'cotizia', 'VPJ-20260708-002', 'Andrea Cortez', 'andrea.cortez@hoganlovells.com', null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VPJ-20260708-002' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VPJ-20260708-002', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'SET DE GOLF AVEIRO - Incluye sacadivot con marcador de bolas, 2 pelotas, 2 tees, carabina, placa metálica para impresión y estuche.', null, 150, 372.00, 0, 55800.00, 'pza', null),
      (v_quote_id, 2, 'TOALLA DEPORTIVA NURMI - Toalla deportiva ligera y de secado rápido. Su material suave y absorbente lo hace ideal para su uso diario en cualquier actividad deportiva. Incluye banda elástica para guardarla de forma práctica y compacta.', null, 150, 63.00, 0, 9450.00, 'pza', null),
      (v_quote_id, 3, 'PELOTA ANTI-STRESS LISA', null, 150, 17.00, 0, 2550.00, 'Pieza', null),
      (v_quote_id, 4, 'CILINDRO LAKE', null, 150, 24.00, 0, 3600.00, 'Pieza', null),
      (v_quote_id, 5, 'CILINDRO SINKER', null, 150, 18.00, 0, 2700.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VPJ-20260408-001  (original CotizIA: VPJ-20260408-001)
-- Cliente: MAXIRENT  ·  Vendedor: Vladimir Peña  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VPJ-20260408-001): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Vladimir Peña');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VPJ-20260408-001): vendedor % no encontrado.', 'Vladimir Peña';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('TMO010314A25' is not null and upper(btrim(tax_id)) = upper(btrim('TMO010314A25')))
      or upper(btrim(name)) = upper(btrim('MAXIRENT'))
      or upper(btrim(legal_name)) = upper(btrim('MAXIRENT'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'MAXIRENT', 'TMO010314A25', 'Sandra.mendoza@maxirent.com.mx', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VPJ-20260408-001', 0, date '2026-04-08', 'aceptada', 'MXN', 16.00, 0,
    date '2026-04-08' + 5, 'MAXIRENT', null, 'TMO010314A25',
    'Juno Promotional', 'juno_promotional', p.name,
    53730.00, 0, 8596.80, 62326.80,
    null, 'Contado', '5-7 dias habiles', 'Tiempo de entrega es despues de aprobada la muestra virtual.',
    'cotizia', 'VPJ-20260408-001', null, 'Sandra.mendoza@maxirent.com.mx', null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VPJ-20260408-001' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VPJ-20260408-001', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'Set Personalizable', null, 30, 290.00, 0, 8700.00, 'Pieza', null),
      (v_quote_id, 2, 'Botella Vigan', null, 30, 310.00, 0, 9300.00, 'Pieza', null),
      (v_quote_id, 3, 'Power Bank Ultra Slim', null, 30, 470.00, 0, 14100.00, 'Pieza', null),
      (v_quote_id, 4, 'Libreta Vejle', null, 30, 85.00, 0, 2550.00, 'Pieza', null),
      (v_quote_id, 5, 'Bolígrafo Escaldes', null, 30, 42.00, 0, 1260.00, 'Pieza', null),
      (v_quote_id, 6, 'Bolígrafo Narni', null, 30, 18.00, 0, 540.00, 'Pieza', null),
      (v_quote_id, 7, 'SET KHALID', null, 30, 161.00, 0, 4830.00, 'Kit (Conjunto de piezas)', null),
      (v_quote_id, 8, 'SET NOTULA', null, 30, 415.00, 0, 12450.00, 'Kit (Conjunto de piezas)', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VPT-20260818-004  (original CotizIA: VPT-20260818-004)
-- Cliente: BASCOMEX  ·  Vendedor: Vladimir Peña  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VPT-20260818-004): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Vladimir Peña');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VPT-20260818-004): vendedor % no encontrado.', 'Vladimir Peña';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('BAS840904P51' is not null and upper(btrim(tax_id)) = upper(btrim('BAS840904P51')))
      or upper(btrim(name)) = upper(btrim('BASCOMEX'))
      or upper(btrim(legal_name)) = upper(btrim('BASCOMEX'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'BASCOMEX', 'BAS840904P51', 'arcelia.vasquez@jasomexico.com.mx', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VPT-20260818-004', 0, date '2026-08-18', 'borrador', 'USD', 16.00, 0,
    date '2026-08-18' + 15, 'BASCOMEX', null, 'BAS840904P51',
    'Thunder LED Lights', 'thunder_led', p.name,
    1520.00, 0, 243.20, 1763.20,
    null, 'Contado', '3-5 Dias Habiles', null,
    'cotizia', 'VPT-20260818-004', 'Arcelia Vasquez', 'arcelia.vasquez@jasomexico.com.mx', null, '1 año por defectos de fabricacion.'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VPT-20260818-004' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VPT-20260818-004', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'LUZ LED GRUA VIAJERA COLOR ROJO', null, 4, 295.00, 0, 1180.00, 'Pieza', null),
      (v_quote_id, 2, 'CONVERTIDOR DE VOLTAJE', null, 4, 85.00, 0, 340.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VPT-20260814-003  (original CotizIA: VPT-20260814-003)
-- Cliente: POSCO MPPC  ·  Vendedor: Vladimir Peña  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VPT-20260814-003): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Vladimir Peña');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VPT-20260814-003): vendedor % no encontrado.', 'Vladimir Peña';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('PMP060127R53' is not null and upper(btrim(tax_id)) = upper(btrim('PMP060127R53')))
      or upper(btrim(name)) = upper(btrim('POSCO MPPC'))
      or upper(btrim(legal_name)) = upper(btrim('POSCO MPPC'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'POSCO MPPC', 'PMP060127R53', 'valeria.mejia@poscomppc.com', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VPT-20260814-003', 0, date '2026-08-14', 'enviada', 'USD', 16.00, 0,
    date '2026-08-14' + 15, 'POSCO MPPC', null, 'PMP060127R53',
    'Thunder LED Lights', 'thunder_led', p.name,
    6450.00, 0, 1032.00, 7482.00,
    null, 'Ant. 50% Resto al entregar.', '7-10 Dias Habiles', null,
    'cotizia', 'VPT-20260814-003', 'VALERIA MEJIA', 'valeria.mejia@poscomppc.com', null, '1 año por defectos de fabricacion.'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VPT-20260814-003' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VPT-20260814-003', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'LUZ LED GRUA VIAJERA COLOR ROJO', null, 15, 335.00, 0, 5025.00, 'Pieza', null),
      (v_quote_id, 2, 'CONVERTIDOR DE VOLTAJE', null, 15, 95.00, 0, 1425.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VPT-20260408-002  (original CotizIA: VPT-20260408-002)
-- Cliente: MAGNE  ·  Vendedor: Vladimir Peña  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VPT-20260408-002): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Vladimir Peña');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VPT-20260408-002): vendedor % no encontrado.', 'Vladimir Peña';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('MAGNE'))
      or upper(btrim(legal_name)) = upper(btrim('MAGNE'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'MAGNE', null, 'compras@magnemx.com', '8112408661')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VPT-20260408-002', 0, date '2026-04-08', 'enviada', 'USD', 16.00, 0,
    date '2026-04-08' + 10, 'MAGNE', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    40000.00, 0, 6400.00, 46400.00,
    null, 'Contado', '4-6 Semanas', null,
    'cotizia', 'VPT-20260408-002', 'Mauricio Esquivel', 'compras@magnemx.com', '8112408661', '1 año'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VPT-20260408-002' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VPT-20260408-002', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'Ring Dot Pro', null, 40, 1000.00, 0, 40000.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VPT-20260408-001  (original CotizIA: VPT-20260408-001)
-- Cliente: VISUAL ELECTRIC  ·  Vendedor: Vladimir Peña  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VPT-20260408-001): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Vladimir Peña');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VPT-20260408-001): vendedor % no encontrado.', 'Vladimir Peña';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('VEL0607242IA' is not null and upper(btrim(tax_id)) = upper(btrim('VEL0607242IA')))
      or upper(btrim(name)) = upper(btrim('VISUAL ELECTRIC'))
      or upper(btrim(legal_name)) = upper(btrim('VISUAL ELECTRIC'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'VISUAL ELECTRIC', 'VEL0607242IA', 'zoraida.coronado@vslenergy.com.mx', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VPT-20260408-001', 0, date '2026-04-08', 'enviada', 'USD', 16.00, 0,
    date '2026-04-08' + 10, 'VISUAL ELECTRIC', null, 'VEL0607242IA',
    'Thunder LED Lights', 'thunder_led', p.name,
    40000.00, 0, 6400.00, 46400.00,
    null, 'Contado', '3-4 Semanas', null,
    'cotizia', 'VPT-20260408-001', 'Zoraida Coronado', 'zoraida.coronado@vslenergy.com.mx', null, '1 año'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VPT-20260408-001' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VPT-20260408-001', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'Ring Dot Pro', null, 40, 1000.00, 0, 40000.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVG-20260821-011  (original CotizIA: VVG-20260821-011)
-- Cliente: VISION DENTAL  ·  Vendedor: Verónica Vargas  ·  BU: got_fresh_breath
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'got_fresh_breath' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVG-20260821-011): Business Unit % no encontrada/activa.', 'got_fresh_breath';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVG-20260821-011): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('VISION DENTAL'))
      or upper(btrim(legal_name)) = upper(btrim('VISION DENTAL'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'VISION DENTAL', null, 'Visiondentalmx@gmail.com', '6646707023')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVG-20260821-011', 0, date '2026-08-21', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-21' + 15, 'VISION DENTAL', null, null,
    'Got Fresh Breath Mexico', 'got_fresh_breath', p.name,
    3300.00, 0, 528.00, 3828.00,
    null, 'CONTADO', '7-15 días hábiles', 'L.A.B Libre a Bordo Mty-No Incluye Envío
Contacto Dr. Jorge Garcia
Tel 6646707023',
    'cotizia', 'VVG-20260821-011', 'JORGE GARCIA', 'Visiondentalmx@gmail.com', '6646707023', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVG-20260821-011' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVG-20260821-011', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'DISPENSADOR NEGRO', null, 1, 1650.00, 0, 1650.00, 'PIEZA', null),
      (v_quote_id, 2, 'GOT FRESH BREATH-ENJUAGUE BUCAL', null, 1, 1650.00, 0, 1650.00, 'CAJA', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVG-20260821-010  (original CotizIA: VVG-20260821-010)
-- Cliente: CONSULTORIO ODONTOLOGICO  ·  Vendedor: Verónica Vargas  ·  BU: got_fresh_breath
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'got_fresh_breath' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVG-20260821-010): Business Unit % no encontrada/activa.', 'got_fresh_breath';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVG-20260821-010): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('CONSULTORIO ODONTOLOGICO'))
      or upper(btrim(legal_name)) = upper(btrim('CONSULTORIO ODONTOLOGICO'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'CONSULTORIO ODONTOLOGICO', null, 'thelma.rgz33@gmail.com', '4423466301')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVG-20260821-010', 0, date '2026-08-21', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-21' + 15, 'CONSULTORIO ODONTOLOGICO', null, null,
    'Got Fresh Breath Mexico', 'got_fresh_breath', p.name,
    3580.00, 0, 572.80, 4152.80,
    null, 'CONTADO', '7-15 días hábiles', 'Incluye flete a Querétaro
Contacto Dra. Thelma Rdz Tel 4423466301',
    'cotizia', 'VVG-20260821-010', 'THELMA RODRIGUEZ', 'thelma.rgz33@gmail.com', '4423466301', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVG-20260821-010' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVG-20260821-010', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'DISPENSADOR NEGRO', null, 1, 1650.00, 0, 1650.00, 'PIEZA', null),
      (v_quote_id, 2, 'GOT FRESH BREATH-ENJUAGUE BUCAL', null, 1, 1650.00, 0, 1650.00, 'CAJA', null),
      (v_quote_id, 3, 'MANIOBRAS', null, 1, 280.00, 0, 280.00, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVG-20260819-009  (original CotizIA: VVG-20260819-009)
-- Cliente: CLINICA ORTODONTICA POBLANA ORTHOS  ·  Vendedor: Verónica Vargas  ·  BU: got_fresh_breath
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'got_fresh_breath' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVG-20260819-009): Business Unit % no encontrada/activa.', 'got_fresh_breath';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVG-20260819-009): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('CLINICA ORTODONTICA POBLANA ORTHOS'))
      or upper(btrim(legal_name)) = upper(btrim('CLINICA ORTODONTICA POBLANA ORTHOS'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'CLINICA ORTODONTICA POBLANA ORTHOS', null, 'gcisnerosaragon@yahoo.com.mx', '2223569168')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVG-20260819-009', 0, date '2026-08-19', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-19' + 15, 'CLINICA ORTODONTICA POBLANA ORTHOS', null, null,
    'Got Fresh Breath Mexico', 'got_fresh_breath', p.name,
    3300.00, 0, 528.00, 3828.00,
    null, 'CONTADO', '7-15 días hábiles', 'L.A.B Libre a Bordo Mty- No Incluye Envío
Contacto Dr. Gilberto Cisneros
2223569168',
    'cotizia', 'VVG-20260819-009', 'DR GILBERTO CISNEROS ARAGON', 'gcisnerosaragon@yahoo.com.mx', '2223569168', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVG-20260819-009' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVG-20260819-009', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'DISPENSADOR NEGRO', null, 1, 1650.00, 0, 1650.00, 'PIEZA', null),
      (v_quote_id, 2, 'GOT FRESH BREATH-ENJUAGUE BUCAL', null, 1, 1650.00, 0, 1650.00, 'CAJA', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVG-20260814-008  (original CotizIA: VVG-20260814-008)
-- Cliente: MIRYAM GUEDEA DE GUERRERO  ·  Vendedor: Verónica Vargas  ·  BU: got_fresh_breath
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'got_fresh_breath' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVG-20260814-008): Business Unit % no encontrada/activa.', 'got_fresh_breath';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVG-20260814-008): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('MIRYAM GUEDEA DE GUERRERO'))
      or upper(btrim(legal_name)) = upper(btrim('MIRYAM GUEDEA DE GUERRERO'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'MIRYAM GUEDEA DE GUERRERO', null, 'Miryam99@hotmail.com', '8115996274')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVG-20260814-008', 0, date '2026-08-14', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-14' + 15, 'MIRYAM GUEDEA DE GUERRERO', null, null,
    'Got Fresh Breath Mexico', 'got_fresh_breath', p.name,
    3300.00, 0, 528.00, 3828.00,
    null, 'CONTADO', '7-15 días hábiles', 'Lab Libre a Bordo No incluye Envio',
    'cotizia', 'VVG-20260814-008', 'DRA MILY', 'Miryam99@hotmail.com', '8115996274', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVG-20260814-008' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVG-20260814-008', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'DISPENSADOR NEGRO', null, 1, 1650.00, 0, 1650.00, 'PIEZA', null),
      (v_quote_id, 2, 'GOT FRESH BREATH-ENJUAGUE BUCAL', null, 1, 1650.00, 0, 1650.00, 'CAJA', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVG-20260814-007  (original CotizIA: VVG-20260814-007)
-- Cliente: SERENICA HEALTH  ·  Vendedor: Verónica Vargas  ·  BU: got_fresh_breath
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'got_fresh_breath' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVG-20260814-007): Business Unit % no encontrada/activa.', 'got_fresh_breath';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVG-20260814-007): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('SERENICA HEALTH'))
      or upper(btrim(legal_name)) = upper(btrim('SERENICA HEALTH'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'SERENICA HEALTH', null, 'Ricardoazcorraq@gmail.com', '9991223607')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVG-20260814-007', 0, date '2026-08-14', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-14' + 15, 'SERENICA HEALTH', null, null,
    'Got Fresh Breath Mexico', 'got_fresh_breath', p.name,
    3750.00, 0, 600.00, 4350.00,
    null, 'CONTADO', '7-15 días hábiles', 'Lab -Yucatán',
    'cotizia', 'VVG-20260814-007', 'RICARDO AZCORRA', 'Ricardoazcorraq@gmail.com', '9991223607', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVG-20260814-007' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVG-20260814-007', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'DISPENSADOR BLANCO', null, 1, 1650.00, 0, 1650.00, 'PIEZA', null),
      (v_quote_id, 2, 'GOT FRESH BREATH-ENJUAGUE BUCAL', null, 1, 1650.00, 0, 1650.00, 'CAJA', null),
      (v_quote_id, 3, 'MANIOBRAS', null, 1, 450.00, 0, 450.00, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVG-20260813-006  (original CotizIA: VVG-20260813-006)
-- Cliente: DENTAL LEON  ·  Vendedor: Verónica Vargas  ·  BU: got_fresh_breath
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'got_fresh_breath' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVG-20260813-006): Business Unit % no encontrada/activa.', 'got_fresh_breath';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVG-20260813-006): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('DENTAL LEON'))
      or upper(btrim(legal_name)) = upper(btrim('DENTAL LEON'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'DENTAL LEON', null, 'dentaleon2012@gmail.com', '4428542001')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVG-20260813-006', 0, date '2026-08-13', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-13' + 15, 'DENTAL LEON', null, null,
    'Got Fresh Breath Mexico', 'got_fresh_breath', p.name,
    3650.00, 0, 584.00, 4234.00,
    null, 'CONTADO', '7-15 días hábiles', 'Atn Dra. Martha Lilia Cihuatlán Jalisco',
    'cotizia', 'VVG-20260813-006', 'DRA MARTHA LILIA', 'dentaleon2012@gmail.com', '4428542001', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVG-20260813-006' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVG-20260813-006', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'DISPENSADOR NEGRO', null, 1, 1650.00, 0, 1650.00, 'PIEZA', null),
      (v_quote_id, 2, 'GOT FRESH BREATH-ENJUAGUE BUCAL', null, 1, 1650.00, 0, 1650.00, 'CAJA', null),
      (v_quote_id, 3, 'MANIOBRAS', null, 1, 350.00, 0, 350.00, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVG-20260813-005  (original CotizIA: VVG-20260813-005)
-- Cliente: DENTALIX  ·  Vendedor: Verónica Vargas  ·  BU: got_fresh_breath
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'got_fresh_breath' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVG-20260813-005): Business Unit % no encontrada/activa.', 'got_fresh_breath';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVG-20260813-005): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('DENTALIX'))
      or upper(btrim(legal_name)) = upper(btrim('DENTALIX'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'DENTALIX', null, null, '5585803375')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVG-20260813-005', 0, date '2026-08-13', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-13' + 30, 'DENTALIX', null, null,
    'Got Fresh Breath Mexico', 'got_fresh_breath', p.name,
    3650.00, 0, 584.00, 4234.00,
    null, 'CONTADO', '7-15 días hábiles', 'Atn Dr. José Hernández Bonilla Mexico D.F',
    'cotizia', 'VVG-20260813-005', 'JOSE ANTONIO HERNANDEZ BONILLA', null, '5585803375', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVG-20260813-005' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVG-20260813-005', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'DISPENSADOR NEGRO', null, 1, 1650.00, 0, 1650.00, 'PIEZA', null),
      (v_quote_id, 2, 'GOT FRESH BREATH-ENJUAGUE BUCAL', null, 1, 1650.00, 0, 1650.00, 'CAJA', null),
      (v_quote_id, 3, 'MANIOBRAS', null, 1, 350.00, 0, 350.00, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVG-20260813-004  (original CotizIA: VVG-20260813-004)
-- Cliente: ODONTOLOGIA ESTETICA Y RECONSTRUCTIVA  ·  Vendedor: Verónica Vargas  ·  BU: got_fresh_breath
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'got_fresh_breath' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVG-20260813-004): Business Unit % no encontrada/activa.', 'got_fresh_breath';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVG-20260813-004): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('ODONTOLOGIA ESTETICA Y RECONSTRUCTIVA'))
      or upper(btrim(legal_name)) = upper(btrim('ODONTOLOGIA ESTETICA Y RECONSTRUCTIVA'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'ODONTOLOGIA ESTETICA Y RECONSTRUCTIVA', null, 'dr_alejandrosm@hotmail.com', '2961052943')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVG-20260813-004', 0, date '2026-08-13', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-13' + 30, 'ODONTOLOGIA ESTETICA Y RECONSTRUCTIVA', null, null,
    'Got Fresh Breath Mexico', 'got_fresh_breath', p.name,
    3650.00, 0, 584.00, 4234.00,
    null, 'CONTADO', '7-15 días hábiles', 'Contacto Dr. Alejandro Sanchez se cotiza con flete a Veracruz',
    'cotizia', 'VVG-20260813-004', 'DR ALEJANDRO SANCHEZ', 'dr_alejandrosm@hotmail.com', '2961052943', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVG-20260813-004' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVG-20260813-004', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'DISPENSADOR NEGRO', null, 1, 1650.00, 0, 1650.00, 'PIEZA', null),
      (v_quote_id, 2, 'GOT FRESH BREATH-ENJUAGUE BUCAL', null, 1, 1650.00, 0, 1650.00, 'CAJA', null),
      (v_quote_id, 3, 'MANIOBRAS', null, 1, 350.00, 0, 350.00, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVG-20260812-003  (original CotizIA: VVG-20260812-003)
-- Cliente: LA JEFA  ·  Vendedor: Verónica Vargas  ·  BU: got_fresh_breath
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'got_fresh_breath' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVG-20260812-003): Business Unit % no encontrada/activa.', 'got_fresh_breath';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVG-20260812-003): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('LA JEFA'))
      or upper(btrim(legal_name)) = upper(btrim('LA JEFA'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'LA JEFA', null, 'Lic_arturo@guerreroasociados.com', '5548800430')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVG-20260812-003', 0, date '2026-08-12', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-12' + 30, 'LA JEFA', null, null,
    'Got Fresh Breath Mexico', 'got_fresh_breath', p.name,
    3650.00, 0, 584.00, 4234.00,
    null, 'CONTADO', '7-15 días hábiles', 'CONTACTO ARTURO SILVA EDO DE MEXICO D.F',
    'cotizia', 'VVG-20260812-003', 'ARTURO SILVA VENCIS', 'Lic_arturo@guerreroasociados.com', '5548800430', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVG-20260812-003' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVG-20260812-003', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'DISPENSADOR BLANCO', null, 1, 1650.00, 0, 1650.00, 'PIEZA', null),
      (v_quote_id, 2, 'GOT FRESH BREATH-ENJUAGUE BUCAL', null, 1, 1650.00, 0, 1650.00, 'CAJA', null),
      (v_quote_id, 3, 'MANIOBRAS', null, 1, 350.00, 0, 350.00, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVG-20260812-002  (original CotizIA: VVG-20260812-002)
-- Cliente: DENTAL CORPORATIVA  ·  Vendedor: Verónica Vargas  ·  BU: got_fresh_breath
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'got_fresh_breath' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVG-20260812-002): Business Unit % no encontrada/activa.', 'got_fresh_breath';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVG-20260812-002): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('DENTAL CORPORATIVA'))
      or upper(btrim(legal_name)) = upper(btrim('DENTAL CORPORATIVA'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'DENTAL CORPORATIVA', null, 'jose_alday@dentistasenaguascalientes.com.mx', '4499902864')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVG-20260812-002', 0, date '2026-08-12', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-12' + 30, 'DENTAL CORPORATIVA', null, null,
    'Got Fresh Breath Mexico', 'got_fresh_breath', p.name,
    3650.00, 0, 584.00, 4234.00,
    null, 'CONTADO', '5-8 días hábiles', 'se cotiza con flete a Aguascalientes Atn Dr. José de Jesús',
    'cotizia', 'VVG-20260812-002', 'DR JOSE DE JESUS', 'jose_alday@dentistasenaguascalientes.com.mx', '4499902864', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVG-20260812-002' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVG-20260812-002', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'DISPENSADOR NEGRO', null, 1, 1650.00, 0, 1650.00, 'Pieza', null),
      (v_quote_id, 2, 'GOT FRESH BREATH-ENJUAGUE BUCAL', null, 1, 1650.00, 0, 1650.00, 'Caja', null),
      (v_quote_id, 3, 'MANIOBRAS', null, 1, 350.00, 0, 350.00, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVG-20260811-001  (original CotizIA: VVG-20260811-001)
-- Cliente: JONATHAN FLORES GUERRA  ·  Vendedor: Verónica Vargas  ·  BU: got_fresh_breath
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'got_fresh_breath' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVG-20260811-001): Business Unit % no encontrada/activa.', 'got_fresh_breath';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVG-20260811-001): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('JONATHAN FLORES GUERRA'))
      or upper(btrim(legal_name)) = upper(btrim('JONATHAN FLORES GUERRA'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'JONATHAN FLORES GUERRA', null, 'jonzzzbus@hotmail.com', '2213633829')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVG-20260811-001', 0, date '2026-08-11', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-11' + 15, 'JONATHAN FLORES GUERRA', null, null,
    'Got Fresh Breath Mexico', 'got_fresh_breath', p.name,
    3770.00, 0, 603.20, 4373.20,
    null, null, null, null,
    'cotizia', 'VVG-20260811-001', null, 'jonzzzbus@hotmail.com', '2213633829', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVG-20260811-001' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVG-20260811-001', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'DISPENSADOR NEGRO', null, 1, 1700.00, 0, 1700.00, 'Pieza', null),
      (v_quote_id, 2, 'GOT FRESH BREATH-ENJUAGUE BUCAL', null, 1, 1700.00, 0, 1700.00, 'Caja', null),
      (v_quote_id, 3, 'MANIOBRAS', null, 1, 370.00, 0, 370.00, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVJ-20260821-009  (original CotizIA: VVJ-20260821-009)
-- Cliente: LEONOR INZUNZA  ·  Vendedor: Verónica Vargas  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVJ-20260821-009): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVJ-20260821-009): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('LEONOR INZUNZA'))
      or upper(btrim(legal_name)) = upper(btrim('LEONOR INZUNZA'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'LEONOR INZUNZA', null, 'inzunzaleoe@gmail.com', '7444088538')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVJ-20260821-009', 0, date '2026-08-21', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-21' + 15, 'LEONOR INZUNZA', null, null,
    'Juno Promotional', 'juno_promotional', p.name,
    3675.00, 0, 588.00, 4263.00,
    null, 'CONTADO', '5-7 Días Habiles', 'L.A.B Libre a Bordo -Mty -No Incluye Envío
incluye serigrafia a una tinta imagen colibrí
contacto Leonor Inzunza 7444088538',
    'cotizia', 'VVJ-20260821-009', null, 'inzunzaleoe@gmail.com', '7444088538', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVJ-20260821-009' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVJ-20260821-009', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'LIBRETA SMYRNA', null, 50, 58.50, 0, 2925.00, 'Pieza', null),
      (v_quote_id, 2, 'SERVICIO DE SERIGRAFIA', null, 50, 15.00, 0, 750.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVJ-20260820-008  (original CotizIA: VVJ-20260820-008)
-- Cliente: AURELIA SIFUENTES CHACON  ·  Vendedor: Verónica Vargas  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVJ-20260820-008): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVJ-20260820-008): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('AURELIA SIFUENTES CHACON'))
      or upper(btrim(legal_name)) = upper(btrim('AURELIA SIFUENTES CHACON'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'AURELIA SIFUENTES CHACON', null, 'asc_dperez@hotmail.com', '8132419950')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVJ-20260820-008', 0, date '2026-08-20', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-20' + 15, 'AURELIA SIFUENTES CHACON', null, null,
    'Juno Promotional', 'juno_promotional', p.name,
    2047.50, 0, 327.60, 2375.10,
    null, 'CONTADO', '3-5 Días hábiles', 'L.A.B Libre a Bordo Mty No Incluye envió
se cotiza sin personalización solo el cuaderno
Contacto Aurelia Tel 8132419950',
    'cotizia', 'VVJ-20260820-008', null, 'asc_dperez@hotmail.com', '8132419950', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVJ-20260820-008' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVJ-20260820-008', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'LIBRETA SMYRNA', null, 35, 58.50, 0, 2047.50, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVJ-20260819-006  (original CotizIA: VVJ-20260819-006)
-- Cliente: LETICIA PAREDES SERRANO  ·  Vendedor: Verónica Vargas  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVJ-20260819-006): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVJ-20260819-006): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('LETICIA PAREDES SERRANO'))
      or upper(btrim(legal_name)) = upper(btrim('LETICIA PAREDES SERRANO'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'LETICIA PAREDES SERRANO', null, null, '5530221388')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVJ-20260819-006', 0, date '2026-08-19', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-19' + 15, 'LETICIA PAREDES SERRANO', null, null,
    'Juno Promotional', 'juno_promotional', p.name,
    667.00, 0, 106.72, 773.72,
    null, 'CONTADO', '5-7 Días hábiles', 'Incluye fletera servicio a domicilio
Contacto Leticia Paredes
Tel 5530221388',
    'cotizia', 'VVJ-20260819-006', null, null, '5530221388', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVJ-20260819-006' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVJ-20260819-006', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'SET DE VINO "VINICIUS"', null, 1, 667.00, 0, 667.00, 'pza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVJ-20260819-005  (original CotizIA: VVJ-20260819-005)
-- Cliente: CARLOS GARCIA  ·  Vendedor: Verónica Vargas  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVJ-20260819-005): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVJ-20260819-005): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('CARLOS GARCIA'))
      or upper(btrim(legal_name)) = upper(btrim('CARLOS GARCIA'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'CARLOS GARCIA', null, null, null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVJ-20260819-005', 0, date '2026-08-19', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-19' + 15, 'CARLOS GARCIA', null, null,
    'Juno Promotional', 'juno_promotional', p.name,
    36100.00, 0, 5776.00, 41876.00,
    null, 'CONTADO', '7-15 días hábiles', null,
    'cotizia', 'VVJ-20260819-005', null, null, null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVJ-20260819-005' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVJ-20260819-005', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'LIBRETA SMYRNA', null, 500, 72.20, 0, 36100.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVJ-20260819-004  (original CotizIA: VVJ-20260819-004)
-- Cliente: LILIA ANA MOTA  ·  Vendedor: Verónica Vargas  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVJ-20260819-004): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVJ-20260819-004): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('LILIA ANA MOTA'))
      or upper(btrim(legal_name)) = upper(btrim('LILIA ANA MOTA'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'LILIA ANA MOTA', null, 'lili_mota@yahoo.com.mx', '5591993191')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVJ-20260819-004', 0, date '2026-08-19', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-19' + 15, 'LILIA ANA MOTA', null, null,
    'Juno Promotional', 'juno_promotional', p.name,
    8750.00, 0, 1400.00, 10150.00,
    null, 'CONTADO', '7-15 días hábiles', 'L.A.B Libre a Bordo Mty No Incluye Envío
5591993191 Contacto Lilia
serigrafia logo a una tinta  tamaño 5 x 5',
    'cotizia', 'VVJ-20260819-004', null, 'lili_mota@yahoo.com.mx', '5591993191', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVJ-20260819-004' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVJ-20260819-004', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'LIBRETA SMYRNA', null, 100, 87.50, 0, 8750.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVJ-20260819-003  (original CotizIA: VVJ-20260819-003)
-- Cliente: ALEJANDRA ALCAIDE  ·  Vendedor: Verónica Vargas  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVJ-20260819-003): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVJ-20260819-003): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('ALEJANDRA ALCAIDE'))
      or upper(btrim(legal_name)) = upper(btrim('ALEJANDRA ALCAIDE'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'ALEJANDRA ALCAIDE', null, 'tania.alcaide37@gmail.com', '5584771063')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVJ-20260819-003', 0, date '2026-08-19', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-19' + 15, 'ALEJANDRA ALCAIDE', null, null,
    'Juno Promotional', 'juno_promotional', p.name,
    36100.00, 0, 5776.00, 41876.00,
    null, 'CONTADO', '7-15 días hábiles', 'L.A.B Libre a Bordo Mty No incluye envió
Tel. 5584771063 Contacto Alejandra
serigrafia a una sola tinta en color blanco logo , libretas en color negro',
    'cotizia', 'VVJ-20260819-003', null, 'tania.alcaide37@gmail.com', '5584771063', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVJ-20260819-003' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVJ-20260819-003', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'LIBRETA SMYRNA', null, 500, 72.20, 0, 36100.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVJ-20260819-002  (original CotizIA: VVJ-20260819-002)
-- Cliente: ANA LAURA SERNA  ·  Vendedor: Verónica Vargas  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVJ-20260819-002): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVJ-20260819-002): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('ANA LAURA SERNA'))
      or upper(btrim(legal_name)) = upper(btrim('ANA LAURA SERNA'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'ANA LAURA SERNA', null, null, '4426800060')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVJ-20260819-002', 0, date '2026-08-19', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-19' + 11, 'ANA LAURA SERNA', null, null,
    'Juno Promotional', 'juno_promotional', p.name,
    2608.99, 0, 417.44, 3026.43,
    null, 'CONTADO', '7-15 días hábiles', 'L.A.B Libre a Bordo Mty-No incluye Envío
Tel 4426800060 Ana serna',
    'cotizia', 'VVJ-20260819-002', null, null, '4426800060', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVJ-20260819-002' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVJ-20260819-002', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'SET DE VASOS TEQUILERO "TOC TOC"', null, 17, 138.47, 0, 2353.99, 'pza', null),
      (v_quote_id, 2, 'SERVICIO DE REDISEÑO DE LOGO', null, 17, 15.00, 0, 255.00, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVJ-20260814-001  (original CotizIA: VVJ-20260814-001)
-- Cliente: GETZAIN BLANCAS TORRIJOS  ·  Vendedor: Verónica Vargas  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVJ-20260814-001): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVJ-20260814-001): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('GETZAIN BLANCAS TORRIJOS'))
      or upper(btrim(legal_name)) = upper(btrim('GETZAIN BLANCAS TORRIJOS'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'GETZAIN BLANCAS TORRIJOS', null, 'Getzain_2@hotmail.com', '5515022234')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVJ-20260814-001', 0, date '2026-08-14', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-14' + 30, 'GETZAIN BLANCAS TORRIJOS', null, null,
    'Juno Promotional', 'juno_promotional', p.name,
    24830.00, 0, 3972.80, 28802.80,
    null, 'CONTADO', '7-15 días hábiles', 'Usuario Getzain Blancas Edo Mex
Lab su Planta',
    'cotizia', 'VVJ-20260814-001', 'GETZAIN', 'Getzain_2@hotmail.com', '5515022234', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVJ-20260814-001' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVJ-20260814-001', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'T490 SET DE ASADO / BBQ "SPRING"', null, 50, 479.60, 0, 23980.00, 'pza', null),
      (v_quote_id, 2, 'MANIOBRAS', null, 1, 850.00, 0, 850.00, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVT-20260814-010  (original CotizIA: VVT-20260814-010)
-- Cliente: ITZAMARA ROCIO SALAZAR CANTU  ·  Vendedor: Verónica Vargas  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVT-20260814-010): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVT-20260814-010): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('ITZAMARA ROCIO SALAZAR CANTU'))
      or upper(btrim(legal_name)) = upper(btrim('ITZAMARA ROCIO SALAZAR CANTU'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'ITZAMARA ROCIO SALAZAR CANTU', null, 'rodaza@gmail.co', '8112619563')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVT-20260814-010', 0, date '2026-08-14', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-14' + 15, 'ITZAMARA ROCIO SALAZAR CANTU', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    5259.20, 0, 841.47, 6100.67,
    null, 'CONTADO', null, 'Lab Libre a Bordo Mty- No Incluye Envío',
    'cotizia', 'VVT-20260814-010', 'ROBERTO ORDAZ', 'rodaza@gmail.co', '8112619563', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVT-20260814-010' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVT-20260814-010', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'SOLARCAP ENTINTADO 33 PULG X 45 PULG', null, 2, 2629.60, 0, 5259.20, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVT-20260811-009  (original CotizIA: VVT-20260811-009)
-- Cliente: SERVICIOS INDUSTRIALES DE ORIENTE  ·  Vendedor: Verónica Vargas  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVT-20260811-009): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVT-20260811-009): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('SERVICIOS INDUSTRIALES DE ORIENTE'))
      or upper(btrim(legal_name)) = upper(btrim('SERVICIOS INDUSTRIALES DE ORIENTE'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'SERVICIOS INDUSTRIALES DE ORIENTE', null, 'ventas@sdeoriente.com', '4443706762')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVT-20260811-009', 0, date '2026-08-11', 'enviada', 'USD', 16.00, 0,
    date '2026-08-11' + 15, 'SERVICIOS INDUSTRIALES DE ORIENTE', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    1866.25, 0, 298.60, 2164.85,
    null, 'CONTADO', '5 semanas', 'LAB - Libre a Bordo Mty No incluye envió
No Incluye Instalación
Cotización en USD , Si se paga en MXN se considerara el tipo de cambio del DOF del dia correspondiente',
    'cotizia', 'VVT-20260811-009', 'MAYELA VARELA', 'ventas@sdeoriente.com', '4443706762', '1 año'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVT-20260811-009' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVT-20260811-009', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'Solucion Industrial mediante Señalizacion Led Incluye : Skybeam capacidad 600 eatts , plantilla personalizada, convertidor de voltaje y base para montaje', null, 1, 1866.25, 0, 1866.25, 'pza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVT-20260810-007  (original CotizIA: VVT-20260810-007)
-- Cliente: ITZAMARA ROCIO SALAZAR CANTU  ·  Vendedor: Verónica Vargas  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVT-20260810-007): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVT-20260810-007): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('ITZAMARA ROCIO SALAZAR CANTU'))
      or upper(btrim(legal_name)) = upper(btrim('ITZAMARA ROCIO SALAZAR CANTU'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'ITZAMARA ROCIO SALAZAR CANTU', null, 'rodaza@gmail.co', '8112619563')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVT-20260810-007', 0, date '2026-08-10', 'enviada', 'USD', 16.00, 0,
    date '2026-08-10' + 15, 'ITZAMARA ROCIO SALAZAR CANTU', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    337.00, 0, 53.92, 390.92,
    null, 'CONTADO', '7-15 días hábiles', 'LAB Libre a Bordo Mty -No Incluye Envió
Usuario Ing. Roberto Ordaz tel. 8112619563',
    'cotizia', 'VVT-20260810-007', 'ROBERTO ORDAZ', 'rodaza@gmail.co', '8112619563', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVT-20260810-007' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVT-20260810-007', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'SOLARCAP ENTINTADO 33 PULG X 45 PULG', null, 1, 152.00, 0, 152.00, 'Pieza', null),
      (v_quote_id, 2, 'SOLARCAP ENTINTADO 53 PULG X 45 PULG', null, 1, 185.00, 0, 185.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVT-20260708-005  (original CotizIA: VVT-20260708-005)
-- Cliente: TECHNIMARKDE REYNOSA, S.A DE C.V  ·  Vendedor: Verónica Vargas  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVT-20260708-005): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVT-20260708-005): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('TECHNIMARKDE REYNOSA, S.A DE C.V'))
      or upper(btrim(legal_name)) = upper(btrim('TECHNIMARKDE REYNOSA, S.A DE C.V'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'TECHNIMARKDE REYNOSA, S.A DE C.V', null, 'Baldemar.davila@technimark.com', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVT-20260708-005', 0, date '2026-07-08', 'enviada', 'USD', 16.00, 0,
    date '2026-07-08' + 15, 'TECHNIMARKDE REYNOSA, S.A DE C.V', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    2600.00, 0, 416.00, 3016.00,
    null, 'Contado', '3-4 Semanas', 'Plantillas:
200 Watts EPP
300 Watts Precaucion Almacen',
    'cotizia', 'VVT-20260708-005', 'BALDEMAR DAVILA', 'Baldemar.davila@technimark.com', null, '1 año'
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VVT-20260708-005' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VVT-20260708-005', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'PROYECTOR VIRTUAL-INDUSTRIAL 200W', null, 1, 1250.00, 0, 1250.00, 'pza', null),
      (v_quote_id, 2, 'PROYECTOR VIRTUAL-INDUSTRIAL 300W', null, 1, 1350.00, 0, 1350.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVT-20260608-002  (original CotizIA: VV-20260608-002)
-- Cliente: MONTAPARTS COMPONENTS  ·  Vendedor: Verónica Vargas  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVT-20260608-002): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVT-20260608-002): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('MONTAPARTS COMPONENTS'))
      or upper(btrim(legal_name)) = upper(btrim('MONTAPARTS COMPONENTS'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'MONTAPARTS COMPONENTS', null, 'montapartscomponents@gmail.com', '4272885123')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVT-20260608-002', 0, date '2026-06-08', 'enviada', 'USD', 16.00, 0,
    date '2026-06-08' + 15, 'MONTAPARTS COMPONENTS', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    425.60, 0, 68.10, 493.70,
    null, 'CONTADO', '7-15 días hábiles', 'Contacto con el Ing Victor Rodriguez se cotiza con servicio a domicilio (Fletera) san juan del Rio Qrto
ATRIUM FORKLIFT CABINA DE MONCATARGAS HASTA 6000 LBS STD',
    'cotizia', 'VV-20260608-002', 'VICTOR RODRIGUEZ', 'montapartscomponents@gmail.com', '4272885123', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VV-20260608-002' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VV-20260608-002', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'CUBIERTA PARA MONTACARGAS', null, 1, 260.00, 0, 260.00, 'Pieza', null),
      (v_quote_id, 2, 'SOLARCAP ENTINTADO 33 PULG X 45 PULG', null, 1, 152.00, 0, 152.00, 'Pieza', null),
      (v_quote_id, 3, 'MANIOBRAS', null, 1, 13.60, 0, 13.60, 'Unidad de servicio', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: VVT-20260508-001  (original CotizIA: VV-20260508-001)
-- Cliente: MH SIGNAL  ·  Vendedor: Verónica Vargas  ·  BU: thunder_led
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'thunder_led' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (VVT-20260508-001): Business Unit % no encontrada/activa.', 'thunder_led';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Verónica Vargas');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (VVT-20260508-001): vendedor % no encontrado.', 'Verónica Vargas';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('MH SIGNAL'))
      or upper(btrim(legal_name)) = upper(btrim('MH SIGNAL'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'MH SIGNAL', null, null, '2216716069')
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'VVT-20260508-001', 0, date '2026-05-08', 'enviada', 'USD', 16.00, 0,
    date '2026-05-08' + 30, 'MH SIGNAL', null, null,
    'Thunder LED Lights', 'thunder_led', p.name,
    337.00, 0, 53.92, 390.92,
    null, 'CONTADO', '7-15 días hábiles', 'Atn Ing Rogelio Torres
L.A.B Mty No Incluye Envio .',
    'cotizia', 'VV-20260508-001', 'ING ROGELIO TORRES', null, '2216716069', null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'VV-20260508-001' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=VV-20260508-001', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'SOLARCAP ENTINTADO 33 PULG X 45 PULG', null, 1, 152.00, 0, 152.00, 'Pieza', null),
      (v_quote_id, 2, 'SOLARCAP ENTINTADO 53 PULG X 45 PULG', null, 1, 185.00, 0, 185.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: DOJ-20260819-008  (original CotizIA: DOJ-20260819-008)
-- Cliente: CENTRO RESIDENCIAL AVERO  ·  Vendedor: Diana Ochoa  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (DOJ-20260819-008): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Diana Ochoa');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (DOJ-20260819-008): vendedor % no encontrado.', 'Diana Ochoa';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('CRA2607076B1' is not null and upper(btrim(tax_id)) = upper(btrim('CRA2607076B1')))
      or upper(btrim(name)) = upper(btrim('CENTRO RESIDENCIAL AVERO'))
      or upper(btrim(legal_name)) = upper(btrim('CENTRO RESIDENCIAL AVERO'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'CENTRO RESIDENCIAL AVERO', 'CRA2607076B1', 'FACTURACION@AVERO771.COM', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'DOJ-20260819-008', 0, date '2026-08-19', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-19' + 15, 'CENTRO RESIDENCIAL AVERO', null, 'CRA2607076B1',
    'Juno Promotional', 'juno_promotional', p.name,
    495.00, 0, 79.20, 574.20,
    null, 'Contado', '3-5 Dias Habiles', null,
    'cotizia', 'DOJ-20260819-008', null, 'FACTURACION@AVERO771.COM', null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'DOJ-20260819-008' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=DOJ-20260819-008', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'PARAGUAS DANUBIO', null, 5, 99.00, 0, 495.00, 'PIEZA', 'Paraguas con diseño de 8 paneles y protección UV. Su medida es ideal para niños y su sistema de apertura automática facilita su uso. El mango de plástico no solo proporciona un agarre cómodo, sino que también cuenta con un divertido silbato de juguete incorporado. ¡Este paraguas no solo protege de la lluvia, sino que también despierta la imaginación y el entusiasmo de los más pequeños!');
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: DOJ-20260817-007  (original CotizIA: DOJ-20260817-007)
-- Cliente: EPL CAS  ·  Vendedor: Diana Ochoa  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (DOJ-20260817-007): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Diana Ochoa');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (DOJ-20260817-007): vendedor % no encontrado.', 'Diana Ochoa';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      ('ECA240503NK7' is not null and upper(btrim(tax_id)) = upper(btrim('ECA240503NK7')))
      or upper(btrim(name)) = upper(btrim('EPL CAS'))
      or upper(btrim(legal_name)) = upper(btrim('EPL CAS'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'EPL CAS', 'ECA240503NK7', 'ttorres@surtidorepl.mx', null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'DOJ-20260817-007', 0, date '2026-08-17', 'borrador', 'MXN', 16.00, 0,
    date '2026-08-17' + 15, 'EPL CAS', null, 'ECA240503NK7',
    'Juno Promotional', 'juno_promotional', p.name,
    7000.00, 0, 1120.00, 8120.00,
    null, 'Credito', '3-5 Dias Habiles', null,
    'cotizia', 'DOJ-20260817-007', 'Tere Torres', 'ttorres@surtidorepl.mx', null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'DOJ-20260817-007' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=DOJ-20260817-007', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'TERMO NUMA', null, 25, 220.00, 0, 5500.00, 'PIEZA', null),
      (v_quote_id, 2, 'SERVICIO DE SERIGRAFIA', null, 1, 1500.00, 0, 1500.00, 'Pieza', null);
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: DOJ-20260812-003  (original CotizIA: DOJ-20260812-003)
-- Cliente: CARMEN ROSAS  ·  Vendedor: Diana Ochoa  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (DOJ-20260812-003): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Diana Ochoa');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (DOJ-20260812-003): vendedor % no encontrado.', 'Diana Ochoa';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('CARMEN ROSAS'))
      or upper(btrim(legal_name)) = upper(btrim('CARMEN ROSAS'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'CARMEN ROSAS', null, null, null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'DOJ-20260812-003', 0, date '2026-08-12', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-12' + 15, 'CARMEN ROSAS', null, null,
    'Juno Promotional', 'juno_promotional', p.name,
    4500.00, 0, 720.00, 5220.00,
    null, 'Contado', '3-5 Dias Habiles', null,
    'cotizia', 'DOJ-20260812-003', null, null, null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'DOJ-20260812-003' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=DOJ-20260812-003', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'PORTA PASAPORTE GIRIS', null, 30, 150.00, 0, 4500.00, 'PIEZA', 'Funda para pasaporte con cierre magnético. Ideal para mantener los documentos seguros, y ordenados. Incluye 3 ranuras para tarjetas y 1 bolsillo adicional. Llévalo fácilmente en cualquier viaje.');
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: DOJ-20260811-002  (original CotizIA: DOJ-20260811-002)
-- Cliente: CARMEN ROSAS  ·  Vendedor: Diana Ochoa  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (DOJ-20260811-002): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Diana Ochoa');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (DOJ-20260811-002): vendedor % no encontrado.', 'Diana Ochoa';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('CARMEN ROSAS'))
      or upper(btrim(legal_name)) = upper(btrim('CARMEN ROSAS'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'CARMEN ROSAS', null, null, null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'DOJ-20260811-002', 0, date '2026-08-11', 'enviada', 'MXN', 16.00, 0,
    date '2026-08-11' + 15, 'CARMEN ROSAS', null, null,
    'Juno Promotional', 'juno_promotional', p.name,
    7800.00, 0, 1248.00, 9048.00,
    null, 'Contado', '3-5 Dias Habiles', null,
    'cotizia', 'DOJ-20260811-002', null, null, null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'DOJ-20260811-002' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=DOJ-20260811-002', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'Set Mauron.', null, 30, 180.00, 0, 5400.00, 'PIEZA', 'Set ejecutivo, incluye  bolígrafo y libreta tamaño A5 con cubierta fabricada en termo PU con una etiqueta fabricada en termo PU cosida en la esquina inferior derecha, esquinas micro-redondas ,costura alrededor.
Interior 80 hojas blancas de 80g rayadas, esquinas cuadradas. Páginas finales: 135 g papel blanco cinta en blanco, incluye caja de regalo color negro.

Tecnica: Serigrafia, Un logo, Un tono, Un lado y solo se aplica en la libreta.'),
      (v_quote_id, 2, 'PORTA PASAPORTE RUNA', null, 30, 80.00, 0, 2400.00, 'PIEZA', 'Funda de curpiel para pasaporte. Incluye un libreta de 32 hojas a raya, un bolígrafo de tinta negra y un práctico compartimento para tu pasaporte. Ideal para viajes y notas rápidas.

Tecnica: Serigrafia, Un logo, Un tono, Un lado.');
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Quote histórica: DOJ-20260508-001  (original CotizIA: DOJ-20260508-001)
-- Cliente: SAFI Royal Luxury Hotels  ·  Vendedor: Diana Ochoa  ·  BU: juno_promotional
-- ----------------------------------------------------------------------
do $$
declare
  v_org_id uuid;
  v_bu_id uuid;
  v_salesperson_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_rowcount int;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  if v_org_id is null then
    raise exception 'THÖREN import: organización global-supplier-mty no encontrada.';
  end if;

  select id into v_bu_id from business_units
  where organization_id = v_org_id and code = 'juno_promotional' and active = true;
  if v_bu_id is null then
    raise exception 'THÖREN import (DOJ-20260508-001): Business Unit % no encontrada/activa.', 'juno_promotional';
  end if;

  select s.id into v_salesperson_id
  from salespeople s
  join people p on p.id = s.person_id
  where p.organization_id = v_org_id
    and pg_temp.normalize_full_name(p.name) = pg_temp.normalize_full_name('Diana Ochoa');
  if v_salesperson_id is null then
    raise exception 'THÖREN import (DOJ-20260508-001): vendedor % no encontrado.', 'Diana Ochoa';
  end if;

  -- Cliente: find-or-create idempotente por RFC/nombre normalizado (misma
  -- lógica validada en el preflight de clasificación de 48 clientes).
  select id into v_customer_id from customers
  where organization_id = v_org_id
    and (
      (null is not null and upper(btrim(tax_id)) = upper(btrim(null)))
      or upper(btrim(name)) = upper(btrim('SAFI Royal Luxury Hotels'))
      or upper(btrim(legal_name)) = upper(btrim('SAFI Royal Luxury Hotels'))
    )
  limit 1;

  if v_customer_id is null then
    insert into customers (organization_id, name, tax_id, email, phone)
    values (v_org_id, 'SAFI Royal Luxury Hotels', null, null, null)
    returning id into v_customer_id;
  end if;

  -- Quote histórica: idempotente por (source='cotizia', original_folio) —
  -- índice único parcial quotes_cotizia_original_folio_unique (0028).
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, tax_rate, global_discount_percent,
    valid_until, customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    notes, payment_terms, delivery_time, customer_notes,
    source, original_folio, customer_contact_name, customer_email, customer_phone, warranty
  )
  select
    v_org_id, v_bu_id, v_salesperson_id, v_customer_id,
    'DOJ-20260508-001', 0, date '2026-05-08', 'enviada', 'MXN', 16.00, 0,
    date '2026-05-08' + 15, 'SAFI Royal Luxury Hotels', null, null,
    'Juno Promotional', 'juno_promotional', p.name,
    16000.00, 0, 2560.00, 18560.00,
    null, 'Contado', '5-7 días hábiles', 'Tiempo de entrega: Despues de aprobada la muestra virtual.
Incluye: grabado láser en shaker y vaso medidor, por un lado, un logo.',
    'cotizia', 'DOJ-20260508-001', 'Roberto Safi', null, null, null
  from people p
  join salespeople s on s.person_id = p.id
  where s.id = v_salesperson_id
  on conflict (original_folio) where source = 'cotizia' do nothing
  returning id into v_quote_id;

  get diagnostics v_rowcount = row_count;

  if v_rowcount = 0 then
    select id into v_quote_id from quotes where original_folio = 'DOJ-20260508-001' and source = 'cotizia';
    raise notice 'Quote % ya existía (idempotente, sin duplicar quote_items) — original_folio=DOJ-20260508-001', v_quote_id;
  else
    insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_discount_percent, line_subtotal, unit, customer_requirements)
    values
      (v_quote_id, 1, 'Set para preparación de bebidas. Incluye: shaker de 23 cm de alto por 8 cm de ancho, pinzas, medidor, popote con cucharilla incluida y colador/mezclador.', null, 40, 400.00, 0, 16000.00, 'pza', null);
  end if;
end $$;

commit;
