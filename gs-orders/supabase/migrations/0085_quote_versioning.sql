-- THÖREN — CotizIA: edición de cotizaciones existentes con versionado (0085).
--
-- =========================================================================
-- CONTEXTO
-- =========================================================================
-- Ticket: permitir editar una Quote ya creada sin perder el histórico de
-- lo que realmente se envió al cliente. Auditoría previa confirmó que ya
-- existe edición completa para 'borrador' (rpc_update_quote, 0020/0031) y
-- "Duplicar como nueva cotización" (duplicateQuote, capa de aplicación) —
-- ninguno de los dos se toca. Lo que no existía: poder editar una Quote ya
-- 'enviada' sin perder la versión que el cliente recibió.
--
-- =========================================================================
-- DECISIÓN — principio general: `quotes` sigue siendo la versión vigente
-- =========================================================================
-- Mismo id, mismo folio, misma fila. Nada que hoy lee `quotes`/`quote_items`
-- directamente (PDF, reportes, orders.source_quote_id, invoicing) se
-- rompe. Se agrega `quotes.version` (integer, arranca en 1) y una tabla de
-- archivo `quote_versions` que guarda una foto completa (jsonb) de la
-- Quote+items cada vez que una edición SOBRE UNA QUOTE 'enviada' la
-- reemplaza. Editar mientras sigue en 'borrador' NUNCA archiva nada — usa
-- rpc_update_quote exactamente como hoy, sin tocar `version`.
--
-- =========================================================================
-- DECISIÓN — flujo de versionado aprobado
-- =========================================================================
-- Quote 'enviada' → usuario edita → rpc_create_quote_revision (nueva,
-- SECURITY DEFINER):
--   1) Archiva el contenido ACTUAL (quotes + quote_items tal como están)
--      en quote_versions con version = quotes.version (el número que
--      tenía ANTES de este cambio).
--   2) Aplica la edición con el mismo cálculo exacto de
--      rpc_update_quote (mismas fórmulas, mismo snapshot de cliente).
--   3) Pone status = 'borrador' (SIEMPRE, nunca lo decide el cliente) y
--      version = version anterior + 1.
-- El usuario revisa la nueva versión en borrador y la reenvía
-- explícitamente (setQuoteStatus) para volver a 'enviada' — mismo flujo
-- de envío que ya existe, sin cambios.
-- El folio JAMÁS cambia (trg_prevent_quote_folio_change, sin tocar) — la
-- "v2"/"v3" es únicamente `quotes.version`, un dato independiente del
-- folio.
--
-- =========================================================================
-- DECISIÓN — estados que NO admiten revisión
-- =========================================================================
-- rpc_create_quote_revision exige status = 'enviada' exactamente. Una
-- Quote 'aceptada' o 'rechazada' es terminal (0020) y estructuralmente
-- nunca puede tener un Order vinculado si sigue en 'enviada' —
-- rpc_create_order_from_quote (0023) exige 'aceptada' para convertir, así
-- que este chequeo de status ya excluye por completo el caso "Quote ya
-- convertida en Pedido" sin necesitar una validación aparte. Para
-- aceptada/rechazada, la única vía es "Duplicar" (ya existe, sin cambios):
-- nuevo id, nuevo folio, status 'borrador', la Quote original y cualquier
-- Order vinculado quedan absolutamente intactos.
--
-- =========================================================================
-- DECISIÓN — trg_quote_status_transition: única extensión de la máquina de
-- estados, acotada al mínimo
-- =========================================================================
-- Se agrega la transición 'enviada' -> 'borrador' (antes inexistente),
-- PERO gateada por el GUC local de transacción
-- `thoren.creating_quote_revision` — solo rpc_create_quote_revision lo fija,
-- y lo hace DESPUÉS de archivar la versión anterior en quote_versions. Sin
-- ese GUC en `true`, ni la transición de status ni ningún cambio de
-- contenido comercial (columnas congeladas, incluida `version`) son
-- legales para esa combinación — el trigger los rechaza exactamente igual
-- que cualquier otra transición inválida.
--
-- Esto es deliberadamente MÁS estricto que dejar la transición abierta a
-- cualquier UPDATE: RLS (`quotes_update_own_or_admin`) NO restringe
-- columnas, solo filas — un UPDATE directo vía PostgREST/supabase-js (sin
-- pasar por ningún server action de la app) podría, en principio, poner
-- `status = 'borrador'` sobre una Quote 'enviada' sin que ningún código de
-- la aplicación lo impida. Confiar solo en que `setQuoteStatus` (capa de
-- aplicación) rechace 'borrador' como destino NO cierra esa vía — deja la
-- integridad real dependiendo de que nadie llame a PostgREST directo. El
-- GUC hace que la propia base de datos sea la única autoridad: la
-- transición jamás ocurre sin que el archivado ya haya pasado en la MISMA
-- transacción. `setQuoteStatus` conserva su guard explícito como defensa
-- en profundidad adicional (mensaje de error más claro para el usuario,
-- sin ni siquiera llegar a la base de datos) — pero ya no es la única
-- protección real.
--
-- =========================================================================
-- DECISIÓN — quote_versions: sin policy de escritura directa (mismo
-- criterio que organization_modules, 0084)
-- =========================================================================
-- Solo política de SELECT (visibilidad idéntica a la Quote padre, mismo
-- patrón "via quote" que quote_items). La única escritura posible es
-- rpc_create_quote_revision (SECURITY DEFINER) — ni ADMIN ni VENDEDOR
-- tienen INSERT/UPDATE/DELETE directo sobre el historial.
--
-- =========================================================================
-- DECISIÓN — snapshot completo en jsonb, sin PDF binario por versión
-- =========================================================================
-- `snapshot` guarda `{ quote: <fila completa de quotes>, items: <arreglo
-- completo de quote_items> }` tal como estaban ANTES del reemplazo —
-- incluye customer_requirements/unit/model/description por línea y todas
-- las condiciones comerciales (payment_terms/delivery_time/customer_notes/
-- warranty). Suficiente para reconstruir fielmente el contenido comercial
-- en una vista de solo lectura, sin generar ni almacenar un PDF binario
-- por versión (fuera de alcance, sin necesidad real: el snapshot ya es
-- fuente completa y fiel).
--
-- Como el resto del proyecto: idempotente donde aplica y corre completa
-- en una transacción (begin/commit).

begin;

-- =========================================================================
-- 1) quotes.version — arranca en 1, nunca lo toca la app directamente
--    (solo rpc_create_quote_revision, vía SECURITY DEFINER).
-- =========================================================================
alter table quotes
  add column if not exists version integer not null default 1;

-- =========================================================================
-- 2) quote_versions — archivo de versiones superadas. Ver DECISIÓN arriba.
-- =========================================================================
create table if not exists quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes (id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  -- Snapshot del nombre — mismo criterio que order_operational_status_history.changed_by_name
  -- (0033): nunca se recalcula contra user_profiles al leer.
  created_by_name text,
  created_at timestamptz not null default now(),
  constraint quote_versions_unique_pair unique (quote_id, version)
);

create index if not exists quote_versions_quote_idx on quote_versions (quote_id, version desc);

alter table quote_versions enable row level security;

drop policy if exists "quote_versions_select_own_or_admin" on quote_versions;
create policy "quote_versions_select_own_or_admin" on quote_versions
  for select using (
    exists (
      select 1 from quotes q
      where q.id = quote_id
        and (is_organization_admin(q.organization_id)
          or (is_organization_member(q.organization_id) and q.salesperson_id = current_user_salesperson_id()))
    )
  );

-- =========================================================================
-- 3) rpc_create_quote_revision — única vía para editar una Quote 'enviada'.
--    SECURITY DEFINER: necesario porque quote_items_insert/update/delete_
--    borrador_own_or_admin (0020) solo permiten escribir mientras la Quote
--    padre está en 'borrador' — bajo SECURITY INVOKER esta operación
--    fallaría por RLS sin importar la autorización de negocio. La
--    autorización real (admin de la organización, o el propio vendedor
--    dueño) se reimplementa aquí explícitamente, igual criterio que
--    fn_next_quote_folio (0020) y rpc_set_organization_module (0084).
--    Mismo cálculo de totales/snapshots que rpc_update_quote — mismas
--    fórmulas, ninguna lógica comercial nueva. Única función que fija
--    thoren.creating_quote_revision (ver DECISIÓN de cabecera) — el único
--    camino real por el que trg_quote_status_transition acepta
--    'enviada' -> 'borrador'.
-- =========================================================================
create or replace function rpc_create_quote_revision(
  p_quote_id uuid,
  p_quote jsonb,
  p_items jsonb default '[]'::jsonb
)
returns quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes;
  v_created_by_name text;
  v_items_snapshot jsonb;

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
  if not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  select * into v_quote from quotes where id = p_quote_id for update;
  if not found then
    raise exception 'rpc_create_quote_revision: Quote % no encontrada.', p_quote_id;
  end if;

  if not (
    is_organization_admin(v_quote.organization_id)
    or (is_organization_member(v_quote.organization_id) and v_quote.salesperson_id = current_user_salesperson_id())
  ) then
    raise exception 'rpc_create_quote_revision: no tienes permiso para crear una nueva versión de esta cotización.';
  end if;

  if v_quote.status <> 'enviada' then
    raise exception
      'rpc_create_quote_revision: solo se puede crear una nueva versión de una cotización en estado "enviada" (actual: %). Si está en borrador, guárdala directamente; si ya fue aceptada/rechazada, duplícala.',
      v_quote.status;
  end if;

  select name into v_created_by_name from user_profiles where user_id = auth.uid();

  select coalesce(jsonb_agg(to_jsonb(qi) order by qi.position), '[]'::jsonb)
    into v_items_snapshot
    from quote_items qi where qi.quote_id = p_quote_id;

  insert into quote_versions (quote_id, version, snapshot, created_by, created_by_name)
  values (
    p_quote_id,
    v_quote.version,
    jsonb_build_object('quote', to_jsonb(v_quote), 'items', v_items_snapshot),
    auth.uid(),
    v_created_by_name
  );

  select name, legal_name, tax_id into v_customer_name, v_customer_legal_name, v_customer_tax_id
    from customers where id = v_customer_id;
  if v_customer_name is null then
    raise exception 'rpc_create_quote_revision: customer % no encontrado.', v_customer_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    if v_catalog_product_id is not null then
      perform fn_check_quote_item_catalog_product(v_catalog_product_id, v_quote.organization_id, v_quote.business_unit_id);
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

  -- GUC local a esta transacción (nunca persiste, nunca se filtra a otra
  -- sesión/conexión) — la ÚNICA forma en que trg_quote_status_transition
  -- acepta 'enviada' -> 'borrador'. Se fija DESPUÉS del insert en
  -- quote_versions de arriba, así que la transición nunca puede completarse
  -- sin que el archivado ya haya ocurrido en la misma transacción. Mismo
  -- patrón que thoren.allow_demo_seed (seed_demo_data.sql).
  perform set_config('thoren.creating_quote_revision', 'true', true);

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
    warranty = v_warranty,
    status = 'borrador',
    version = v_quote.version + 1
  where id = p_quote_id
  returning * into v_quote;

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
-- 4) trg_quote_status_transition — agrega la transición 'enviada' ->
--    'borrador' (exclusiva de rpc_create_quote_revision) y permite el
--    congelamiento de contenido comercial ceder EXACTAMENTE en esa
--    transición. `version` se agrega a la lista de columnas congeladas
--    (protegida en cualquier otro caso). Ver DECISIÓN de cabecera.
-- =========================================================================
create or replace function trg_quote_status_transition()
returns trigger
language plpgsql
as $$
declare
  v_is_revision boolean;
begin
  -- THÖREN 0085 — 'enviada' -> 'borrador' SOLO es legal cuando
  -- rpc_create_quote_revision fijó este GUC local a la transacción,
  -- inmediatamente después de archivar la versión anterior en
  -- quote_versions (ver esa función). Un UPDATE directo (setQuoteStatus,
  -- PostgREST/supabase-js sin pasar por el RPC, cualquier otro código)
  -- nunca fija este GUC, así que esa transición le queda estructuralmente
  -- prohibida a cualquier vía que no sea el RPC — no es solo una
  -- convención de la app, RLS por sí sola permite un UPDATE de columna
  -- libre y no bastaría para cerrar esto.
  v_is_revision := old.status = 'enviada' and new.status = 'borrador'
    and coalesce(current_setting('thoren.creating_quote_revision', true), 'false') = 'true';

  if new.status is distinct from old.status then
    if not (
      (old.status = 'borrador' and new.status in ('enviada', 'cancelada'))
      or (old.status = 'enviada' and new.status in ('aceptada', 'rechazada', 'cancelada'))
      or v_is_revision
    ) then
      raise exception 'Transición de status inválida: % -> %.', old.status, new.status;
    end if;
  end if;

  if old.status <> 'borrador' and not v_is_revision then
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
      or new.version is distinct from old.version
    then
      raise exception 'No se puede modificar el contenido comercial de una Quote fuera de status borrador (actual: %).', old.status;
    end if;
  end if;

  return new;
end;
$$;

commit;
