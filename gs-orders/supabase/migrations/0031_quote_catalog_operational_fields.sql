-- GS Orders — Migración 0031: THÖREN Quote Catalog Operational Fields +
-- Enforcement DB de catalog_product_id (Fase 6D — cierre)
--
-- Fase 6D conectó el Catálogo Maestro (0030) al Quote Builder en la capa de
-- aplicación (búsqueda/autocompletado/snapshot/preview de imagen), pero
-- dejó explícitamente pendientes dos huecos reales, documentados en el
-- reporte de esa fase, que requerían tocar los RPCs (no solo la app):
--
-- 1) `quotes.warranty` / `quote_items.unit` / `quote_items.customer_
--    requirements` existen desde 0028 (import histórico de CotizIA) pero
--    rpc_create_quote/rpc_update_quote (última versión real: 0025) nunca
--    los leen ni escriben para Quotes nativas de THÖREN — el Quote Builder
--    no podía capturarlos aunque el esquema ya los soportara.
-- 2) rpc_create_quote/rpc_update_quote (SECURITY INVOKER) nunca validaron
--    que `catalog_product_id` perteneciera a la organización de la Quote
--    ni fuera elegible para su Business Unit — la única defensa real vivía
--    en cotizaciones/actions.ts (validateCatalogProductSelections), que un
--    caller directo del RPC (fuera de la UI de THÖREN) podía evitar por
--    completo.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) rpc_create_quote / rpc_update_quote: agregan lectura/persistencia de
--    `p_quote.warranty` (mismo patrón de captura que payment_terms/
--    delivery_time/customer_notes, 0025) y `p_items[].unit`/`customer_
--    requirements` por línea (mismo patrón que model/description).
-- 2) trg_quote_status_transition: agrega `warranty` a la lista de columnas
--    congeladas fuera de "borrador" — mismo tratamiento que payment_terms/
--    delivery_time/customer_notes (0025): es la misma clase de condición
--    comercial emitida al cliente, no debe poder editarse después de que
--    la Quote salga de "borrador" (ver DECISIÓN abajo).
-- 3) fn_check_quote_item_catalog_product(): función auxiliar nueva,
--    SECURITY INVOKER (ver DECISIÓN abajo), reutilizada por ambos RPCs —
--    mismo criterio de reutilización que fn_next_quote_folio/fn_next_
--    order_folio (una sola función, dos llamadores, sin duplicar lógica).
--    Para cada catalog_product_id no nulo, valida:
--      a) que exista y sea visible bajo RLS (product_catalog_select,
--         0019/0030) — un id de otra organización nunca es visible, así
--         que esto por sí solo ya cierra el cross-org (ver DECISIÓN).
--      b) organization_id del producto === organization_id de la Quote
--         (chequeo explícito adicional — no depende únicamente de que RLS
--         lo oculte, documentado igual que "defensa en profundidad" en el
--         resto del proyecto).
--      c) active = true (ver DECISIÓN "producto inactivo" abajo).
--      d) elegible para la Business Unit de la Quote: 0 filas en
--         product_business_units = TODAS, 1+ filas = únicamente esas
--         (misma semántica exacta de 0019/0030, sin reinterpretarla).
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO toca `orders`/`order_items`/`rpc_create_order`/`rpc_create_order_
--   from_quote`/`rpc_delete_order` — Orders tiene el mismo hueco de fondo
--   (catalog_product_id sin validar organización/Business Unit a nivel
--   RPC) pero queda **fuera de alcance explícito de esta fase** (pedido
--   textual del usuario). Se reporta como siguiente hardening separado,
--   no se toca aquí.
-- - NO agrega ninguna tabla nueva.
-- - NO relaja RLS de quotes/quote_items/product_catalog — sin cambios ahí.
-- - NO cambia el guard de UI existente al cambiar Business Unit
--   (quote-form.tsx, Fase 6D) — la validación de este archivo es la
--   ÚLTIMA defensa (DB), no reemplaza ni depende del guard de UI.
--
-- =========================================================================
-- DECISIÓN — cross-org se resuelve solo, vía RLS, sin necesitar bypass:
-- =========================================================================
-- fn_check_quote_item_catalog_product() es SECURITY INVOKER (no DEFINER):
-- corre con los privilegios/RLS de quien llama al RPC (rpc_create_quote/
-- rpc_update_quote también son SECURITY INVOKER). product_catalog_select
-- (0019, reafirmada por 0030) ya restringe SELECT a
-- is_organization_admin(organization_id) OR (is_organization_member(...)
-- AND active) — un catalog_product_id de otra organización simplemente NO
-- aparece en el SELECT sin importar el rol de quien llama. El chequeo
-- explícito de organization_id en este archivo es una segunda capa
-- (defensa en profundidad, mismo criterio que el resto del proyecto), no
-- la única barrera real — la RLS ya existente sigue siéndolo.
--
-- =========================================================================
-- DECISIÓN — producto inactivo: se rechaza, igual que organización/BU:
-- =========================================================================
-- La UI (Fase 6D) ya solo ofrece catálogo activo (`.eq("active", true)`)
-- para seleccionar un producto nuevo. A nivel RPC se aplica el mismo
-- criterio de forma explícita: un catalog_product_id inactivo se rechaza
-- con la misma excepción que organización/Business Unit. Esto es
-- relevante en particular para ADMIN (product_catalog_select SÍ le deja
-- ver productos inactivos de su propia organización, a diferencia de un
-- VENDEDOR) — sin este chequeo explícito, un ADMIN podría reactivar por
-- error la selección de un producto ya desactivado, algo que la UI nunca
-- ofrece a propósito. Trade-off aceptado y documentado: si una Quote en
-- borrador ya referenciaba un producto que se desactiva DESPUÉS, volver a
-- guardar esa misma Quote sin tocar esa línea también fallará — el
-- vendedor deberá quitar o reemplazar esa línea para poder seguir editando
-- el resto de la Quote. Se considera aceptable: el catálogo de Fase 6C ya
-- documentó "active" como la señal explícita de disponibilidad comercial
-- vigente, y quote_items siempre recibe el array COMPLETO de líneas en
-- cada guardado (rpc_update_quote hace delete+insert, nunca actualiza in
-- place) — no hay forma de "no volver a validar" una línea sin tratar
-- todas igual.
--
-- =========================================================================
-- DECISIÓN — warranty SÍ se agrega a las columnas congeladas de
-- trg_quote_status_transition (0025) fuera de "borrador":
-- =========================================================================
-- payment_terms/delivery_time/customer_notes ya están congelados una vez
-- que la Quote sale de "borrador" (0025) — son condiciones comerciales
-- emitidas al cliente, no notas internas. warranty es exactamente la misma
-- clase de contenido (domain.ts ya lo documentaba así desde 0028: "igual
-- que payment_terms/delivery_time, es contenido comercial editable
-- mientras la Quote esté en 'borrador'" — nunca implementado en el
-- trigger hasta ahora). Dejarla fuera de la lista sería inconsistente y
-- permitiría alterar una condición comercial ya emitida al cliente después
-- de "enviada"/"aceptada" — inaceptable para el mismo criterio que ya
-- protege a los otros 3 campos.
--
-- Esto retira el mecanismo que 0029_functional_tests.sql TEST 3 usaba
-- para demostrar la inmutabilidad del snapshot del Order (mutar warranty
-- de la Quote ya convertida). Ese test se reescribe en este mismo cambio:
-- primero confirma que el intento normal (trigger activo) de modificar
-- warranty fuera de "borrador" SÍ se rechaza (prueba directa de la regla
-- de negocio), y separadamente prueba la independencia real del snapshot
-- del Order deshabilitando el trigger SOLO dentro de la transacción de
-- prueba (que además siempre termina en ROLLBACK) — nunca en el camino de
-- producción, que sigue teniendo el trigger activo sin excepción alguna.
--
-- Como el resto del proyecto: idempotente (create or replace) y corre
-- completa en una sola transacción (begin/commit).

begin;

-- =========================================================================
-- 1) fn_check_quote_item_catalog_product — validación reutilizable por
--    rpc_create_quote y rpc_update_quote. No retorna nada: solo lanza
--    excepción si algo no cumple (mismo estilo que el resto de checks del
--    proyecto, ej. trg_check_product_business_unit_same_org, 0019).
-- =========================================================================
create or replace function fn_check_quote_item_catalog_product(
  p_catalog_product_id uuid,
  p_organization_id uuid,
  p_business_unit_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_product_org uuid;
  v_product_active boolean;
  v_has_bu_restriction boolean;
  v_eligible_for_bu boolean;
begin
  select organization_id, active into v_product_org, v_product_active
    from product_catalog where id = p_catalog_product_id;

  if v_product_org is null then
    raise exception 'catalog_product_id % no existe o no pertenece a tu organización.', p_catalog_product_id;
  end if;

  if v_product_org <> p_organization_id then
    raise exception 'catalog_product_id % no pertenece a tu organización.', p_catalog_product_id;
  end if;

  if not v_product_active then
    raise exception 'catalog_product_id % no está activo.', p_catalog_product_id;
  end if;

  select exists (select 1 from product_business_units where product_id = p_catalog_product_id)
    into v_has_bu_restriction;

  if v_has_bu_restriction then
    select exists (
      select 1 from product_business_units
      where product_id = p_catalog_product_id and business_unit_id = p_business_unit_id
    ) into v_eligible_for_bu;

    if not v_eligible_for_bu then
      raise exception 'catalog_product_id % no está disponible para la Business Unit de esta cotización.', p_catalog_product_id;
    end if;
  end if;
end;
$$;

-- =========================================================================
-- 2) rpc_create_quote — agrega warranty (Quote) + unit/customer_
--    requirements (por línea) + validación de catalog_product_id.
-- =========================================================================
create or replace function rpc_create_quote(
  p_quote_id uuid,
  p_quote jsonb,
  p_items jsonb default '[]'::jsonb
)
returns quotes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quote quotes;
  v_business_unit_id uuid := (p_quote->>'business_unit_id')::uuid;
  v_salesperson_id uuid := (p_quote->>'salesperson_id')::uuid;
  v_customer_id uuid := (p_quote->>'customer_id')::uuid;
  v_quote_date date := coalesce((p_quote->>'quote_date')::date, current_date);
  v_currency text := p_quote->>'currency';
  v_tax_rate numeric(5,2) := coalesce((p_quote->>'tax_rate')::numeric, 16.00);
  v_global_discount_percent numeric(5,2) := coalesce((p_quote->>'global_discount_percent')::numeric, 0);
  v_valid_until date := coalesce((p_quote->>'valid_until')::date, (coalesce((p_quote->>'quote_date')::date, current_date) + 15));
  v_notes text := p_quote->>'notes';
  v_payment_terms text := nullif(p_quote->>'payment_terms', '');
  v_delivery_time text := nullif(p_quote->>'delivery_time', '');
  v_customer_notes text := nullif(p_quote->>'customer_notes', '');
  v_warranty text := nullif(p_quote->>'warranty', '');

  v_organization_id uuid;
  v_bu_name text;
  v_bu_code text;
  v_sp_name text;
  v_customer_name text;
  v_customer_legal_name text;
  v_customer_tax_id text;

  v_folio_result record;

  v_item jsonb;
  v_position integer;
  v_catalog_product_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_discount_percent numeric(5,2);
  v_line_gross numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_subtotal numeric(12,2);

  v_subtotal numeric(12,2) := 0;
  v_discount_total numeric(12,2) := 0;
  v_global_discount_amount numeric(12,2);
  v_taxable_base numeric(12,2);
  v_tax_total numeric(12,2);
  v_total numeric(12,2);
begin
  select organization_id, name, code into v_organization_id, v_bu_name, v_bu_code
    from business_units where id = v_business_unit_id;
  if v_organization_id is null then
    raise exception 'rpc_create_quote: business unit % no encontrada.', v_business_unit_id;
  end if;

  select name into v_sp_name from salespeople where id = v_salesperson_id;
  if v_sp_name is null then
    raise exception 'rpc_create_quote: salesperson % no encontrado.', v_salesperson_id;
  end if;

  select name, legal_name, tax_id into v_customer_name, v_customer_legal_name, v_customer_tax_id
    from customers where id = v_customer_id;
  if v_customer_name is null then
    raise exception 'rpc_create_quote: customer % no encontrado.', v_customer_id;
  end if;

  select * into v_folio_result from fn_next_quote_folio(v_salesperson_id, v_business_unit_id, v_quote_date);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    if v_catalog_product_id is not null then
      perform fn_check_quote_item_catalog_product(v_catalog_product_id, v_organization_id, v_business_unit_id);
    end if;

    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_discount_total := v_discount_total + v_line_discount_amount;
  end loop;

  v_global_discount_amount := round(v_subtotal * v_global_discount_percent / 100, 2);
  v_discount_total := v_discount_total + v_global_discount_amount;
  v_taxable_base := v_subtotal - v_global_discount_amount;
  v_tax_total := round(v_taxable_base * v_tax_rate / 100, 2);
  v_total := v_taxable_base + v_tax_total;

  insert into quotes (
    id, organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status,
    currency, tax_rate, global_discount_percent, valid_until,
    customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total, notes,
    payment_terms, delivery_time, customer_notes, warranty
  )
  values (
    p_quote_id, v_organization_id, v_business_unit_id, v_salesperson_id, v_customer_id,
    v_folio_result.folio, v_folio_result.sequence_number, v_quote_date, 'borrador',
    v_currency, v_tax_rate, v_global_discount_percent, v_valid_until,
    v_customer_name, v_customer_legal_name, v_customer_tax_id,
    v_bu_name, v_bu_code, v_sp_name,
    v_subtotal, v_discount_total, v_tax_total, v_total, v_notes,
    v_payment_terms, v_delivery_time, v_customer_notes, v_warranty
  )
  returning * into v_quote;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);
    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    insert into quote_items (
      quote_id, position, catalog_product_id, model, description, quantity, unit_price,
      line_discount_percent, line_subtotal, unit, customer_requirements
    )
    values (
      v_quote.id, v_position, nullif(v_item->>'catalog_product_id', '')::uuid,
      v_item->>'model', v_item->>'description', v_quantity, v_unit_price,
      v_line_discount_percent, v_line_subtotal,
      nullif(v_item->>'unit', ''), nullif(v_item->>'customer_requirements', '')
    );

    v_position := v_position + 1;
  end loop;

  return v_quote;
end;
$$;

-- =========================================================================
-- 3) rpc_update_quote — mismo criterio: warranty + unit/customer_
--    requirements por línea + validación de catalog_product_id. Sigue
--    rechazando cualquier escritura fuera de "borrador" (sin cambios ahí).
-- =========================================================================
create or replace function rpc_update_quote(
  p_quote_id uuid,
  p_quote jsonb,
  p_items jsonb default '[]'::jsonb
)
returns quotes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quote quotes;
  v_current_status text;
  v_organization_id uuid;
  v_business_unit_id uuid;
  v_customer_id uuid := (p_quote->>'customer_id')::uuid;
  v_currency text := p_quote->>'currency';
  v_tax_rate numeric(5,2) := coalesce((p_quote->>'tax_rate')::numeric, 16.00);
  v_global_discount_percent numeric(5,2) := coalesce((p_quote->>'global_discount_percent')::numeric, 0);
  v_valid_until date := (p_quote->>'valid_until')::date;
  v_notes text := p_quote->>'notes';
  v_payment_terms text := nullif(p_quote->>'payment_terms', '');
  v_delivery_time text := nullif(p_quote->>'delivery_time', '');
  v_customer_notes text := nullif(p_quote->>'customer_notes', '');
  v_warranty text := nullif(p_quote->>'warranty', '');

  v_customer_name text;
  v_customer_legal_name text;
  v_customer_tax_id text;

  v_item jsonb;
  v_position integer;
  v_catalog_product_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_discount_percent numeric(5,2);
  v_line_gross numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_subtotal numeric(12,2);

  v_subtotal numeric(12,2) := 0;
  v_discount_total numeric(12,2) := 0;
  v_global_discount_amount numeric(12,2);
  v_taxable_base numeric(12,2);
  v_tax_total numeric(12,2);
  v_total numeric(12,2);
begin
  select status, organization_id, business_unit_id into v_current_status, v_organization_id, v_business_unit_id
    from quotes where id = p_quote_id;
  if v_current_status is null then
    raise exception 'rpc_update_quote: Quote % no encontrada.', p_quote_id;
  end if;
  if v_current_status <> 'borrador' then
    raise exception
      'rpc_update_quote: la Quote % no está en borrador (status actual: %); su contenido comercial no puede editarse.',
      p_quote_id, v_current_status;
  end if;

  select name, legal_name, tax_id into v_customer_name, v_customer_legal_name, v_customer_tax_id
    from customers where id = v_customer_id;
  if v_customer_name is null then
    raise exception 'rpc_update_quote: customer % no encontrado.', v_customer_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    if v_catalog_product_id is not null then
      perform fn_check_quote_item_catalog_product(v_catalog_product_id, v_organization_id, v_business_unit_id);
    end if;

    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);
    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_discount_total := v_discount_total + v_line_discount_amount;
  end loop;

  v_global_discount_amount := round(v_subtotal * v_global_discount_percent / 100, 2);
  v_discount_total := v_discount_total + v_global_discount_amount;
  v_taxable_base := v_subtotal - v_global_discount_amount;
  v_tax_total := round(v_taxable_base * v_tax_rate / 100, 2);
  v_total := v_taxable_base + v_tax_total;

  update quotes set
    customer_id = v_customer_id,
    currency = v_currency,
    tax_rate = v_tax_rate,
    global_discount_percent = v_global_discount_percent,
    valid_until = v_valid_until,
    customer_name = v_customer_name,
    customer_legal_name = v_customer_legal_name,
    customer_tax_id = v_customer_tax_id,
    subtotal = v_subtotal,
    discount_total = v_discount_total,
    tax_total = v_tax_total,
    total = v_total,
    notes = v_notes,
    payment_terms = v_payment_terms,
    delivery_time = v_delivery_time,
    customer_notes = v_customer_notes,
    warranty = v_warranty
  where id = p_quote_id
  returning * into v_quote;

  if not found then
    raise exception 'rpc_update_quote: Quote % no encontrada al actualizar.', p_quote_id;
  end if;

  delete from quote_items where quote_id = p_quote_id;
  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);
    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    insert into quote_items (
      quote_id, position, catalog_product_id, model, description, quantity, unit_price,
      line_discount_percent, line_subtotal, unit, customer_requirements
    )
    values (
      p_quote_id, v_position, nullif(v_item->>'catalog_product_id', '')::uuid,
      v_item->>'model', v_item->>'description', v_quantity, v_unit_price,
      v_line_discount_percent, v_line_subtotal,
      nullif(v_item->>'unit', ''), nullif(v_item->>'customer_requirements', '')
    );

    v_position := v_position + 1;
  end loop;

  return v_quote;
end;
$$;

-- =========================================================================
-- 4) trg_quote_status_transition — agrega `warranty` a las columnas
--    congeladas fuera de "borrador" (mismo tratamiento que payment_terms/
--    delivery_time/customer_notes, 0025 — ver DECISIÓN arriba). Mismo
--    trigger ya existente (trg_quotes_status_transition, 0020), solo se
--    reemplaza la función.
-- =========================================================================
create or replace function trg_quote_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'borrador' and new.status in ('enviada', 'cancelada'))
      or (old.status = 'enviada' and new.status in ('aceptada', 'rechazada', 'cancelada'))
    ) then
      raise exception 'Transición de status inválida: % -> %.', old.status, new.status;
    end if;
  end if;

  if old.status <> 'borrador' then
    if new.customer_id is distinct from old.customer_id
      or new.currency is distinct from old.currency
      or new.tax_rate is distinct from old.tax_rate
      or new.global_discount_percent is distinct from old.global_discount_percent
      or new.valid_until is distinct from old.valid_until
      or new.subtotal is distinct from old.subtotal
      or new.discount_total is distinct from old.discount_total
      or new.tax_total is distinct from old.tax_total
      or new.total is distinct from old.total
      or new.customer_name is distinct from old.customer_name
      or new.customer_legal_name is distinct from old.customer_legal_name
      or new.customer_tax_id is distinct from old.customer_tax_id
      or new.business_unit_name is distinct from old.business_unit_name
      or new.business_unit_code is distinct from old.business_unit_code
      or new.salesperson_name is distinct from old.salesperson_name
      or new.payment_terms is distinct from old.payment_terms
      or new.delivery_time is distinct from old.delivery_time
      or new.customer_notes is distinct from old.customer_notes
      or new.warranty is distinct from old.warranty
    then
      raise exception 'No se puede modificar el contenido comercial de una Quote fuera de status borrador (actual: %).', old.status;
    end if;
  end if;

  return new;
end;
$$;

commit;
