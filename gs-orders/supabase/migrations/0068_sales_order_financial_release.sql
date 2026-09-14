-- =========================================================================
-- THÖREN — 0068: Sales Orders / Financial Release
-- =========================================================================
-- OBJETIVO: controlar si una Sales Order puede avanzar a surtido/compra
-- según su condición financiera. 100% aditivo sobre 0067
-- (sales_orders_mvp) — ninguna tabla ajena se toca, ningún RPC de
-- Orders/Purchase Orders/Quotes se modifica. NO implementa Inventory,
-- Procurement automático, Commissions, Accounts Receivable completo ni
-- integración bancaria — únicamente el candado financiero mínimo pedido.
--
-- =========================================================================
-- DECISIÓN — payment_terms_type (columna NUEVA, justificación):
-- =========================================================================
-- payment_terms (0067) es texto libre ("50% anticipo, 50% contra
-- entrega") — no se puede derivar de forma confiable si una Sales Order
-- "necesita pago previo" o "necesita aprobación de crédito" parseando ese
-- texto. El ticket pide explícitamente "clasificación lógica" para
-- cash/credit/advance/custom — payment_terms_type es esa clasificación
-- estructurada (enum), la ÚNICA columna nueva de "modelo" fuera de las
-- explícitamente listadas en el ticket. payment_terms (texto) NO se toca
-- ni se reemplaza — ambas conviven: payment_terms es la leyenda visible/
-- imprimible, payment_terms_type es el dato que gatea la lógica de
-- liberación.
--
-- =========================================================================
-- DECISIÓN — payment_required_amount para 'cash' es SIEMPRE derivado
-- (nunca capturado), para 'advance'/'custom' es capturado por el usuario,
-- para 'credit' siempre NULL:
-- =========================================================================
-- 'cash' significa "se debe pagar el total" por definición — permitir un
-- valor manual distinto sería inventar un caso de uso que el ticket no
-- pidió. rpc_create_sales_order/rpc_update_sales_order (reemplazados aquí)
-- fuerzan payment_required_amount := subtotal+tax_total cuando
-- payment_terms_type = 'cash', ignoran cualquier valor mandado por el
-- cliente para ese campo en ese caso, y lo fuerzan a NULL para 'credit'
-- (irrelevante para ese camino de liberación). 'advance'/'custom' sí usan
-- el valor que envía el formulario — sin motor genérico de reglas, dos
-- ramas nada más (pago-requerido vs crédito-requerido).
--
-- =========================================================================
-- DECISIÓN — dos triggers nuevos sobre sales_orders, mismo patrón ya
-- usado en el proyecto (0045 trg_prevent_approve_only_detail_edit,
-- 0067 trg_sales_order_status_transition):
-- =========================================================================
-- 1) trg_sales_order_financial_guard: (a) exige
--    can_manage_sales_order_finance (o admin) para tocar CUALQUIERA de
--    las 7 columnas financieras — cierra "manipulación directa de
--    financial fields" para quien no tiene autoridad, sin necesitar un
--    mecanismo nuevo (GUC/flag) que el proyecto no usa en ningún otro
--    lado; (b) financial_released_at es de solo lectura una vez asignado
--    (mismo criterio que confirmed_at, 0067); (c) valida en DB que
--    fulfillment_release_status solo pase a 'released' cuando la
--    condición financiera real se cumple (crédito aprobado, o pago
--    suficiente) — la app/RPC nunca es la única autoridad.
-- 2) trg_sales_order_status_transition (REEMPLAZADO, mismo nombre/trigger
--    que 0067): se le agrega payment_terms_type/payment_required_amount
--    a la lista de contenido comercial congelado fuera de "draft" — sin
--    esto, un UPDATE directo (fuera de las RPCs, que ya solo escriben en
--    draft) podría alterar la clasificación de pago de una SO confirmada.
--
-- =========================================================================
-- DECISIÓN — "Liberar por pago" se resuelve DENTRO de "Registrar pago"
-- (una sola RPC, no dos):
-- =========================================================================
-- El ticket describe el resultado de "Liberar por pago" (qué columnas
-- setea) como parte del efecto de alcanzar el monto requerido — separarlo
-- en una segunda acción manual dejaría una ventana donde
-- financial_status='paid' pero fulfillment_release_status sigue
-- 'blocked' hasta que alguien lo recuerde, contrario a "no
-- sobrecomplicar". rpc_register_sales_order_payment hace ambos cambios
-- atómicamente cuando corresponde. rpc_release_sales_order SÍ existe como
-- RPC aparte, pero para el caso real que la necesita: re-evaluar y
-- liberar cuando la condición YA se cumple pero fulfillment_release_status
-- quedó en 'blocked' por un hold explícito posterior (rpc_set_sales_order_
-- financial_hold) — el contrapunto natural de "Bloquear".
--
-- =========================================================================
-- DECISIÓN — nueva capability `can_manage_sales_order_finance`:
-- =========================================================================
-- Mismo patrón exacto que can_prepare_purchase_orders/
-- can_approve_purchase_orders (0040/0045): catálogo + policy de UPDATE
-- ADICIONAL sobre sales_orders gateada SOLO por la capability (sin
-- exigir ser el salesperson dueño) — necesario porque una persona de
-- Finanzas típicamente no es la dueña de la Sales Order que está
-- cobrando. La policy "own or admin" existente (0067) NO se toca.
--
-- =========================================================================
-- DECISIÓN — sales_order_financial_events: historial mínimo nuevo,
-- ninguna infraestructura de audit log genérica existe en el proyecto
-- hoy (auditado: order_operational_status_history/delivery_status_history
-- son historiales POR DOMINIO, cada feature crea el suyo — mismo
-- criterio aquí, sin inventar un audit log global fuera de alcance).
--
-- Como el resto del proyecto: idempotente (create table if not exists,
-- add column if not exists, drop+create para policies/constraints/
-- funciones) y corre completa en una transacción (begin/commit).

begin;

-- =========================================================================
-- 0) FIX — sales_orders_order_number_unique (0067) era un índice único
--    GLOBAL, no por organización, a diferencia del patrón ya establecido
--    (purchase_orders_folio_unique, 0035: unique (organization_id, folio)).
--    Cada organización tiene su PROPIA secuencia (sales_order_sequences,
--    keyed por organization_id) con el mismo prefijo por defecto ('SO'),
--    así que dos organizaciones distintas generan el MISMO order_number
--    para su primer Sales Order del mismo día ("SO-<fecha>-001") — un
--    choque real, descubierto empíricamente al probar 0068 con dos
--    organizaciones. Se corrige aquí, sin tocar 0067_sales_orders_mvp.sql
--    (mismo criterio que 0054 corrigiendo un trigger de 0020: nunca se
--    edita un archivo de migración ya escrito, se corrige hacia
--    adelante).
-- =========================================================================
drop index if exists sales_orders_order_number_unique;
create unique index if not exists sales_orders_order_number_unique
  on sales_orders (organization_id, order_number);

-- =========================================================================
-- 0b) FIX — trg_sales_orders_consistency (0067) disparaba en CUALQUIER
--    UPDATE de sales_orders, no solo cuando customer_id/salesperson_id
--    realmente cambian. Como salesperson_id es inmutable después de creada
--    la SO (trg_prevent_sales_order_identity_change, 0067), revalidarlo en
--    cada UPDATE es innecesario y, descubierto empíricamente al probar
--    0068, ROMPE a un usuario con can_manage_sales_order_finance que no es
--    ni admin ni el salesperson dueño: su sesión no puede leer la fila de
--    `salespeople` del vendedor dueño de la SO (RLS de salespeople,
--    0051), así que trg_check_sales_order_consistency (SECURITY INVOKER)
--    resuelve NULL y rechaza con un falso "el vendedor no existe o no es
--    visible" — aunque el UPDATE en cuestión (registrar un pago) no toque
--    customer_id ni salesperson_id en absoluto. Se corrige acotando el
--    trigger a disparar solo en INSERT o cuando esas columnas de
--    identidad cambian (mismo patrón ya usado en
--    trg_salesperson_quote_sequences_valid, 0020) — la función
--    trg_check_sales_order_consistency() NO se toca, solo su disparador.
-- =========================================================================
drop trigger if exists trg_sales_orders_consistency on sales_orders;
create trigger trg_sales_orders_consistency
  before insert or update of customer_id, salesperson_id, organization_id on sales_orders
  for each row execute function trg_check_sales_order_consistency();

-- =========================================================================
-- 1) capabilities — nueva capacidad, aditiva sobre el catálogo de 0040.
-- =========================================================================
insert into capabilities (key, description) values
  ('can_manage_sales_order_finance', 'Registrar pagos, aprobar crédito y bloquear/liberar el estado financiero de Sales Orders.')
on conflict (key) do nothing;

-- =========================================================================
-- 2) sales_orders — columnas nuevas (todas ADD COLUMN, sin tocar ninguna
--    existente).
-- =========================================================================
alter table sales_orders
  add column if not exists payment_terms_type text not null default 'custom'
    constraint sales_orders_payment_terms_type_check check (payment_terms_type in ('cash', 'credit', 'advance', 'custom')),
  add column if not exists financial_status text not null default 'pending'
    constraint sales_orders_financial_status_check check (financial_status in ('pending', 'partially_paid', 'paid', 'credit_approved', 'overdue')),
  add column if not exists fulfillment_release_status text not null default 'blocked'
    constraint sales_orders_fulfillment_release_status_check check (fulfillment_release_status in ('blocked', 'released', 'partially_released', 'fulfilled')),
  add column if not exists financial_released_at timestamptz,
  add column if not exists financial_released_by uuid references auth.users (id) on delete restrict,
  add column if not exists financial_hold_reason text,
  add column if not exists amount_paid numeric(12,2) not null default 0
    constraint sales_orders_amount_paid_non_negative check (amount_paid >= 0),
  add column if not exists payment_required_amount numeric(12,2)
    constraint sales_orders_payment_required_amount_non_negative check (payment_required_amount is null or payment_required_amount >= 0);

-- Regla 1 del ticket: una SO draft NUNCA puede estar liberada — impuesto
-- en DB, no solo en las RPCs.
alter table sales_orders drop constraint if exists sales_orders_release_requires_non_draft;
alter table sales_orders add constraint sales_orders_release_requires_non_draft
  check (status <> 'draft' or fulfillment_release_status = 'blocked');

-- "paid con amount_paid menor al requerido" — 'paid' EXIGE un monto
-- requerido definido Y cubierto (sin escape por NULL: dejar
-- payment_required_amount vacío nunca permite marcar 'paid').
alter table sales_orders drop constraint if exists sales_orders_paid_requires_amount;
alter table sales_orders add constraint sales_orders_paid_requires_amount
  check (financial_status <> 'paid' or (payment_required_amount is not null and amount_paid >= payment_required_amount));

-- "credit_approved en una SO que no es de crédito" — rechazado en DB.
alter table sales_orders drop constraint if exists sales_orders_credit_approved_requires_credit_terms;
alter table sales_orders add constraint sales_orders_credit_approved_requires_credit_terms
  check (financial_status <> 'credit_approved' or payment_terms_type = 'credit');

create index if not exists sales_orders_financial_status_idx on sales_orders (financial_status);
create index if not exists sales_orders_fulfillment_release_status_idx on sales_orders (fulfillment_release_status);

-- =========================================================================
-- 3) sales_order_financial_events — historial mínimo, inmutable
--    (solo INSERT, nunca UPDATE/DELETE para `authenticated`).
-- =========================================================================
create table if not exists sales_order_financial_events (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_orders (id) on delete cascade,
  event_type text not null check (event_type in ('payment_registered', 'credit_approved', 'released', 'financial_hold')),
  amount numeric(12,2),
  previous_financial_status text,
  new_financial_status text,
  previous_release_status text,
  new_release_status text,
  reason text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists sales_order_financial_events_sales_order_idx on sales_order_financial_events (sales_order_id);

alter table sales_order_financial_events enable row level security;

-- SELECT: misma visibilidad que la Sales Order padre (own-or-admin, +
-- can_view_all_sales/can_manage_sales_order_finance de solo lectura acá —
-- mismo patrón que sales_order_items). Sin can_manage_sales_order_finance
-- aquí, quien registra un pago no podría ver el historial que él mismo
-- generó (confirmado empíricamente).
drop policy if exists "sales_order_financial_events_select" on sales_order_financial_events;
create policy "sales_order_financial_events_select" on sales_order_financial_events
  for select using (
    exists (
      select 1 from sales_orders so
      where so.id = sales_order_financial_events.sales_order_id
        and (
          is_organization_admin(so.organization_id)
          or (is_organization_member(so.organization_id) and so.salesperson_id = current_user_salesperson_id())
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_view_all_sales'))
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_manage_sales_order_finance'))
        )
    )
  );

-- INSERT: exclusivo de admin/can_manage_sales_order_finance — las 4 RPCs
-- financieras (SECURITY INVOKER) son el único código que escribe aquí.
-- Sin policy de UPDATE/DELETE: historial inmutable.
drop policy if exists "sales_order_financial_events_insert_finance" on sales_order_financial_events;
create policy "sales_order_financial_events_insert_finance" on sales_order_financial_events
  for insert with check (
    exists (
      select 1 from sales_orders so
      where so.id = sales_order_financial_events.sales_order_id
        and is_organization_member(so.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance'))
    )
  );

-- =========================================================================
-- 4) RLS — sales_orders: policy ADICIONAL de UPDATE para
--    can_manage_sales_order_finance, sin restricción de "dueño" (una
--    persona de Finanzas normalmente NO es el salesperson de la SO que
--    está cobrando) — mismo patrón que purchase_orders_update_approve
--    (0045). La policy own-or-admin existente (0067) NO se toca. Qué
--    columnas puede realmente tocar cada quien lo deciden los triggers de
--    la sección 6, no esta policy (misma división de responsabilidades
--    que 0045).
-- =========================================================================
drop policy if exists "sales_orders_update_finance" on sales_orders;
create policy "sales_orders_update_finance" on sales_orders
  for update using (
    current_user_active()
    and is_organization_member(organization_id)
    and current_user_has_capability('can_manage_sales_order_finance')
  )
  with check (
    current_user_active()
    and is_organization_member(organization_id)
    and current_user_has_capability('can_manage_sales_order_finance')
  );

-- SELECT — companion NECESARIO de la policy de UPDATE anterior: sin esto,
-- un usuario con can_manage_sales_order_finance que no es admin ni el
-- salesperson dueño (el caso típico: una persona de Finanzas) no puede ni
-- siquiera VER la fila bajo sales_orders_select_own_or_admin (0067), así
-- que el `select ... for update` dentro de cada RPC financiera devolvería
-- "no encontrada" — confirmado empíricamente al probar 0068. Mismo
-- criterio que can_view_all_sales (0041): amplía SOLO lectura, nunca
-- escritura por sí sola (la escritura la sigue autorizando
-- sales_orders_update_finance, arriba).
drop policy if exists "sales_orders_select_own_or_admin" on sales_orders;
create policy "sales_orders_select_own_or_admin" on sales_orders
  for select using (
    is_organization_admin(organization_id)
    or (is_organization_member(organization_id) and salesperson_id = current_user_salesperson_id())
    or (is_organization_member(organization_id) and current_user_has_capability('can_view_all_sales'))
    or (is_organization_member(organization_id) and current_user_has_capability('can_manage_sales_order_finance'))
  );

-- Mismo companion, para sales_order_items (0067) — quien tiene autoridad
-- financiera sobre una Sales Order también debe poder ver sus líneas
-- (qué se está cobrando), no solo el encabezado.
drop policy if exists "sales_order_items_select_own_or_admin" on sales_order_items;
create policy "sales_order_items_select_own_or_admin" on sales_order_items
  for select using (
    exists (
      select 1 from sales_orders so
      where so.id = sales_order_items.sales_order_id
        and (
          is_organization_admin(so.organization_id)
          or (is_organization_member(so.organization_id) and so.salesperson_id = current_user_salesperson_id())
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_view_all_sales'))
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_manage_sales_order_finance'))
        )
    )
  );

-- =========================================================================
-- 5) trg_sales_order_status_transition — REEMPLAZA la versión de 0067.
--    Único cambio: payment_terms_type/payment_required_amount se agregan
--    a la lista de contenido comercial congelado fuera de "draft". Resto
--    carácter por carácter igual.
-- =========================================================================
create or replace function trg_sales_order_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('in_progress', 'cancelled'))
      or (old.status = 'in_progress' and new.status in ('fulfilled', 'cancelled'))
      or (old.status = 'fulfilled' and new.status = 'closed')
    ) then
      raise exception 'Transición de estado inválida para una Sales Order: % -> %.', old.status, new.status;
    end if;
  end if;

  if old.status = 'draft' and new.status = 'confirmed' then
    new.confirmed_at := now();
  elsif new.confirmed_at is distinct from old.confirmed_at then
    raise exception 'confirmed_at es de solo lectura — se asigna automáticamente al confirmar la Sales Order.';
  end if;

  if new.status <> 'draft' then
    if new.customer_id is distinct from old.customer_id
      or new.currency is distinct from old.currency
      or new.exchange_rate is distinct from old.exchange_rate
      or new.payment_terms is distinct from old.payment_terms
      or new.payment_terms_type is distinct from old.payment_terms_type
      or new.payment_required_amount is distinct from old.payment_required_amount
      or new.requested_delivery_date is distinct from old.requested_delivery_date
      or new.billing_address_snapshot is distinct from old.billing_address_snapshot
      or new.shipping_address_snapshot is distinct from old.shipping_address_snapshot
      or new.customer_contact_snapshot is distinct from old.customer_contact_snapshot
      or new.commercial_notes is distinct from old.commercial_notes
      or new.subtotal is distinct from old.subtotal
      or new.tax_total is distinct from old.tax_total
      or new.total is distinct from old.total
    then
      raise exception 'No se puede modificar el contenido comercial de una Sales Order fuera de status draft (actual: %).', old.status;
    end if;
  end if;

  return new;
end;
$$;

-- =========================================================================
-- 6) trg_sales_order_financial_guard — NUEVO. Ver DECISIÓN arriba.
-- =========================================================================
create or replace function trg_sales_order_financial_guard()
returns trigger
language plpgsql
as $$
declare
  v_financial_changed boolean;
begin
  v_financial_changed := (
    new.financial_status is distinct from old.financial_status
    or new.fulfillment_release_status is distinct from old.fulfillment_release_status
    or new.financial_released_at is distinct from old.financial_released_at
    or new.financial_released_by is distinct from old.financial_released_by
    or new.financial_hold_reason is distinct from old.financial_hold_reason
    or new.amount_paid is distinct from old.amount_paid
    or new.payment_required_amount is distinct from old.payment_required_amount
  );

  if v_financial_changed and not (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance')) then
    raise exception 'Solo un administrador o un usuario con autoridad financiera puede modificar el estado financiero de una Sales Order.';
  end if;

  if old.financial_released_at is not null and new.financial_released_at is distinct from old.financial_released_at then
    raise exception 'financial_released_at es de solo lectura una vez asignado — refleja el primer momento en que la Sales Order se liberó financieramente.';
  end if;

  if new.fulfillment_release_status = 'released' and old.fulfillment_release_status is distinct from new.fulfillment_release_status then
    if new.payment_terms_type = 'credit' then
      if new.financial_status <> 'credit_approved' then
        raise exception 'No se puede liberar una Sales Order de crédito sin haber aprobado el crédito.';
      end if;
    else
      if new.payment_required_amount is null or new.amount_paid < new.payment_required_amount then
        raise exception 'No se puede liberar esta Sales Order: el pago requerido (%) aún no se cubre (pagado: %).', new.payment_required_amount, new.amount_paid;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sales_orders_financial_guard on sales_orders;
create trigger trg_sales_orders_financial_guard
  before update on sales_orders
  for each row execute function trg_sales_order_financial_guard();

-- =========================================================================
-- 7) rpc_create_sales_order — REEMPLAZA la versión de 0067. Único cambio:
--    resuelve payment_terms_type/payment_required_amount (ver DECISIÓN
--    "payment_required_amount" arriba) tras calcular los totales. Resto
--    carácter por carácter igual — snapshots, cross-org, cálculo de
--    subtotal/tax_total/total sin tocar.
-- =========================================================================
create or replace function rpc_create_sales_order(
  p_sales_order_id uuid,
  p_sales_order jsonb,
  p_items jsonb default '[]'::jsonb
)
returns sales_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_so sales_orders;
  v_organization_id uuid;
  v_customer_id uuid := nullif(p_sales_order->>'customer_id', '')::uuid;
  v_salesperson_id uuid := nullif(p_sales_order->>'salesperson_id', '')::uuid;
  v_currency text := p_sales_order->>'currency';
  v_exchange_rate numeric(12,6) := nullif(p_sales_order->>'exchange_rate', '')::numeric;
  v_payment_terms text := nullif(p_sales_order->>'payment_terms', '');
  v_payment_terms_type text := coalesce(nullif(p_sales_order->>'payment_terms_type', ''), 'custom');
  v_payment_required_amount numeric(12,2) := nullif(p_sales_order->>'payment_required_amount', '')::numeric;
  v_requested_delivery_date date := nullif(p_sales_order->>'requested_delivery_date', '')::date;
  v_billing_address text := nullif(p_sales_order->>'billing_address_snapshot', '');
  v_shipping_address text := nullif(p_sales_order->>'shipping_address_snapshot', '');
  v_commercial_notes text := nullif(p_sales_order->>'commercial_notes', '');
  v_internal_notes text := nullif(p_sales_order->>'internal_notes', '');

  v_customer_active boolean;
  v_contact_name text;
  v_contact_email text;
  v_contact_phone text;
  v_customer_contact_snapshot text;

  v_order_date date := current_date;
  v_number_result record;

  v_item jsonb;
  v_position integer;
  v_catalog_product_id uuid;
  v_cat_sku text;
  v_cat_name text;
  v_cat_unit text;
  v_cat_org uuid;
  v_sku_snapshot text;
  v_description_snapshot text;
  v_uom_snapshot text;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_discount numeric(5,2);
  v_tax numeric(5,2);
  v_line_gross numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_subtotal numeric(12,2);
  v_line_tax_amount numeric(12,2);
  v_line_total numeric(12,2);
  v_estimated_unit_cost numeric(12,2);
  v_estimated_margin numeric(12,2);

  v_subtotal numeric(12,2) := 0;
  v_tax_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  v_organization_id := current_user_organization_id();

  if not (
    current_user_is_admin()
    or (is_organization_member(v_organization_id) and v_salesperson_id = current_user_salesperson_id())
  ) then
    raise exception 'Solo puedes crear una Sales Order a tu propio nombre, salvo que seas administrador.';
  end if;

  select active into v_customer_active from customers where id = v_customer_id;
  if v_customer_active is null then
    raise exception 'rpc_create_sales_order: cliente % no encontrado.', v_customer_id;
  end if;
  if not v_customer_active then
    raise exception 'No se puede crear una Sales Order para un cliente inactivo.';
  end if;

  if v_currency not in ('MXN', 'USD') then
    raise exception 'Selecciona una moneda válida (MXN o USD).';
  end if;

  if v_payment_terms_type not in ('cash', 'credit', 'advance', 'custom') then
    raise exception 'Tipo de condición de pago inválido: %.', v_payment_terms_type;
  end if;

  select name, email, phone into v_contact_name, v_contact_email, v_contact_phone
    from customer_contacts
    where customer_id = v_customer_id and is_primary = true and active = true
    limit 1;
  v_customer_contact_snapshot := nullif(btrim(concat_ws(' · ', v_contact_name, v_contact_email, v_contact_phone)), '');

  select * into v_number_result from fn_next_sales_order_number(v_organization_id, v_order_date);

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    v_quantity := nullif(v_item->>'quantity', '')::integer;
    v_unit_price := nullif(v_item->>'unit_price', '')::numeric;
    v_discount := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    v_tax := coalesce(nullif(v_item->>'tax', '')::numeric, 0);

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad de cada línea debe ser mayor a cero.';
    end if;
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'El precio unitario de cada línea es obligatorio y no puede ser negativo.';
    end if;

    if v_catalog_product_id is not null then
      select sku, name, unit, organization_id into v_cat_sku, v_cat_name, v_cat_unit, v_cat_org
        from product_catalog where id = v_catalog_product_id;
      if v_cat_org is null then
        raise exception 'rpc_create_sales_order: producto de catálogo % no encontrado.', v_catalog_product_id;
      end if;
      if v_cat_org <> v_organization_id then
        raise exception 'Uno o más productos seleccionados no pertenecen a tu organización.';
      end if;
    else
      v_sku_snapshot := nullif(v_item->>'sku_snapshot', '');
      if v_sku_snapshot is null then
        raise exception 'Una línea libre (sin producto de catálogo) debe indicar al menos un SKU/referencia.';
      end if;
    end if;

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_discount / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;
    v_line_tax_amount := round(v_line_subtotal * v_tax / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax_amount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax_amount;
    v_total := v_total + v_line_total;
  end loop;

  -- Ver DECISIÓN "payment_required_amount" (0068): 'cash' siempre es el
  -- total calculado (nunca lo que mande el cliente); 'credit' siempre
  -- NULL (irrelevante para ese camino); 'advance'/'custom' respetan lo
  -- capturado en el formulario.
  if v_payment_terms_type = 'cash' then
    v_payment_required_amount := v_total;
  elsif v_payment_terms_type = 'credit' then
    v_payment_required_amount := null;
  end if;

  insert into sales_orders (
    id, organization_id, customer_id, salesperson_id, order_number, sequence_number, status,
    currency, exchange_rate, payment_terms, payment_terms_type, payment_required_amount, requested_delivery_date,
    billing_address_snapshot, shipping_address_snapshot, customer_contact_snapshot,
    commercial_notes, internal_notes,
    subtotal, tax_total, total, created_by
  )
  values (
    p_sales_order_id, v_organization_id, v_customer_id, v_salesperson_id,
    v_number_result.order_number, v_number_result.sequence_number, 'draft',
    v_currency, v_exchange_rate, v_payment_terms, v_payment_terms_type, v_payment_required_amount, v_requested_delivery_date,
    v_billing_address, v_shipping_address, v_customer_contact_snapshot,
    v_commercial_notes, v_internal_notes,
    v_subtotal, v_tax_total, v_total, auth.uid()
  )
  returning * into v_so;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_discount := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    v_tax := coalesce(nullif(v_item->>'tax', '')::numeric, 0);
    v_estimated_unit_cost := nullif(v_item->>'estimated_unit_cost', '')::numeric;
    v_estimated_margin := nullif(v_item->>'estimated_margin', '')::numeric;

    if v_catalog_product_id is not null then
      select sku, name, unit into v_cat_sku, v_cat_name, v_cat_unit from product_catalog where id = v_catalog_product_id;
      v_sku_snapshot := v_cat_sku;
      v_description_snapshot := coalesce(nullif(v_item->>'description_snapshot', ''), v_cat_name);
      v_uom_snapshot := coalesce(nullif(v_item->>'uom_snapshot', ''), v_cat_unit);
    else
      v_sku_snapshot := v_item->>'sku_snapshot';
      v_description_snapshot := nullif(v_item->>'description_snapshot', '');
      v_uom_snapshot := nullif(v_item->>'uom_snapshot', '');
    end if;

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_discount / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;
    v_line_tax_amount := round(v_line_subtotal * v_tax / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax_amount;

    insert into sales_order_items (
      sales_order_id, position, catalog_product_id,
      sku_snapshot, description_snapshot, uom_snapshot,
      quantity, unit_price, discount, tax, line_subtotal, line_total,
      estimated_unit_cost, estimated_margin
    )
    values (
      v_so.id, v_position, v_catalog_product_id,
      v_sku_snapshot, v_description_snapshot, v_uom_snapshot,
      v_quantity, v_unit_price, v_discount, v_tax, v_line_subtotal, v_line_total,
      v_estimated_unit_cost, v_estimated_margin
    );

    v_position := v_position + 1;
  end loop;

  return v_so;
end;
$$;

-- =========================================================================
-- 8) rpc_update_sales_order — REEMPLAZA la versión de 0067. Mismo cambio
--    que rpc_create_sales_order: resuelve payment_terms_type/
--    payment_required_amount tras recalcular totales. Resto igual.
-- =========================================================================
create or replace function rpc_update_sales_order(
  p_sales_order_id uuid,
  p_sales_order jsonb,
  p_items jsonb default '[]'::jsonb
)
returns sales_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_so sales_orders;
  v_current_status text;
  v_organization_id uuid;
  v_customer_id uuid := nullif(p_sales_order->>'customer_id', '')::uuid;
  v_currency text := p_sales_order->>'currency';
  v_exchange_rate numeric(12,6) := nullif(p_sales_order->>'exchange_rate', '')::numeric;
  v_payment_terms text := nullif(p_sales_order->>'payment_terms', '');
  v_payment_terms_type text := coalesce(nullif(p_sales_order->>'payment_terms_type', ''), 'custom');
  v_payment_required_amount numeric(12,2) := nullif(p_sales_order->>'payment_required_amount', '')::numeric;
  v_requested_delivery_date date := nullif(p_sales_order->>'requested_delivery_date', '')::date;
  v_billing_address text := nullif(p_sales_order->>'billing_address_snapshot', '');
  v_shipping_address text := nullif(p_sales_order->>'shipping_address_snapshot', '');
  v_commercial_notes text := nullif(p_sales_order->>'commercial_notes', '');
  v_internal_notes text := nullif(p_sales_order->>'internal_notes', '');

  v_customer_active boolean;
  v_contact_name text;
  v_contact_email text;
  v_contact_phone text;
  v_customer_contact_snapshot text;

  v_item jsonb;
  v_position integer;
  v_catalog_product_id uuid;
  v_cat_sku text;
  v_cat_name text;
  v_cat_unit text;
  v_cat_org uuid;
  v_sku_snapshot text;
  v_description_snapshot text;
  v_uom_snapshot text;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_discount numeric(5,2);
  v_tax numeric(5,2);
  v_line_gross numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_subtotal numeric(12,2);
  v_line_tax_amount numeric(12,2);
  v_line_total numeric(12,2);
  v_estimated_unit_cost numeric(12,2);
  v_estimated_margin numeric(12,2);

  v_subtotal numeric(12,2) := 0;
  v_tax_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
begin
  select status, organization_id into v_current_status, v_organization_id
    from sales_orders where id = p_sales_order_id for update;
  if v_current_status is null then
    raise exception 'rpc_update_sales_order: Sales Order % no encontrada.', p_sales_order_id;
  end if;
  if not is_organization_member(v_organization_id) then
    raise exception 'Esta Sales Order no pertenece a tu organización.';
  end if;
  if v_current_status <> 'draft' then
    raise exception
      'rpc_update_sales_order: la Sales Order % no está en draft (status actual: %); su contenido no puede editarse.',
      p_sales_order_id, v_current_status;
  end if;

  select active into v_customer_active from customers where id = v_customer_id;
  if v_customer_active is null then
    raise exception 'rpc_update_sales_order: cliente % no encontrado.', v_customer_id;
  end if;
  if not v_customer_active then
    raise exception 'No se puede asignar un cliente inactivo a una Sales Order.';
  end if;

  if v_currency not in ('MXN', 'USD') then
    raise exception 'Selecciona una moneda válida (MXN o USD).';
  end if;

  if v_payment_terms_type not in ('cash', 'credit', 'advance', 'custom') then
    raise exception 'Tipo de condición de pago inválido: %.', v_payment_terms_type;
  end if;

  select name, email, phone into v_contact_name, v_contact_email, v_contact_phone
    from customer_contacts
    where customer_id = v_customer_id and is_primary = true and active = true
    limit 1;
  v_customer_contact_snapshot := nullif(btrim(concat_ws(' · ', v_contact_name, v_contact_email, v_contact_phone)), '');

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    v_quantity := nullif(v_item->>'quantity', '')::integer;
    v_unit_price := nullif(v_item->>'unit_price', '')::numeric;
    v_discount := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    v_tax := coalesce(nullif(v_item->>'tax', '')::numeric, 0);

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad de cada línea debe ser mayor a cero.';
    end if;
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'El precio unitario de cada línea es obligatorio y no puede ser negativo.';
    end if;

    if v_catalog_product_id is not null then
      select organization_id into v_cat_org from product_catalog where id = v_catalog_product_id;
      if v_cat_org is null then
        raise exception 'rpc_update_sales_order: producto de catálogo % no encontrado.', v_catalog_product_id;
      end if;
      if v_cat_org <> v_organization_id then
        raise exception 'Uno o más productos seleccionados no pertenecen a tu organización.';
      end if;
    else
      if nullif(v_item->>'sku_snapshot', '') is null then
        raise exception 'Una línea libre (sin producto de catálogo) debe indicar al menos un SKU/referencia.';
      end if;
    end if;

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_discount / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;
    v_line_tax_amount := round(v_line_subtotal * v_tax / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax_amount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax_amount;
    v_total := v_total + v_line_total;
  end loop;

  if v_payment_terms_type = 'cash' then
    v_payment_required_amount := v_total;
  elsif v_payment_terms_type = 'credit' then
    v_payment_required_amount := null;
  end if;

  update sales_orders set
    customer_id = v_customer_id,
    currency = v_currency,
    exchange_rate = v_exchange_rate,
    payment_terms = v_payment_terms,
    payment_terms_type = v_payment_terms_type,
    payment_required_amount = v_payment_required_amount,
    requested_delivery_date = v_requested_delivery_date,
    billing_address_snapshot = v_billing_address,
    shipping_address_snapshot = v_shipping_address,
    customer_contact_snapshot = v_customer_contact_snapshot,
    commercial_notes = v_commercial_notes,
    internal_notes = v_internal_notes,
    subtotal = v_subtotal,
    tax_total = v_tax_total,
    total = v_total
  where id = p_sales_order_id
  returning * into v_so;

  delete from sales_order_items where sales_order_id = p_sales_order_id;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_discount := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    v_tax := coalesce(nullif(v_item->>'tax', '')::numeric, 0);
    v_estimated_unit_cost := nullif(v_item->>'estimated_unit_cost', '')::numeric;
    v_estimated_margin := nullif(v_item->>'estimated_margin', '')::numeric;

    if v_catalog_product_id is not null then
      select sku, name, unit into v_cat_sku, v_cat_name, v_cat_unit from product_catalog where id = v_catalog_product_id;
      v_sku_snapshot := v_cat_sku;
      v_description_snapshot := coalesce(nullif(v_item->>'description_snapshot', ''), v_cat_name);
      v_uom_snapshot := coalesce(nullif(v_item->>'uom_snapshot', ''), v_cat_unit);
    else
      v_sku_snapshot := v_item->>'sku_snapshot';
      v_description_snapshot := nullif(v_item->>'description_snapshot', '');
      v_uom_snapshot := nullif(v_item->>'uom_snapshot', '');
    end if;

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_discount / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;
    v_line_tax_amount := round(v_line_subtotal * v_tax / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax_amount;

    insert into sales_order_items (
      sales_order_id, position, catalog_product_id,
      sku_snapshot, description_snapshot, uom_snapshot,
      quantity, unit_price, discount, tax, line_subtotal, line_total,
      estimated_unit_cost, estimated_margin
    )
    values (
      p_sales_order_id, v_position, v_catalog_product_id,
      v_sku_snapshot, v_description_snapshot, v_uom_snapshot,
      v_quantity, v_unit_price, v_discount, v_tax, v_line_subtotal, v_line_total,
      v_estimated_unit_cost, v_estimated_margin
    );

    v_position := v_position + 1;
  end loop;

  return v_so;
end;
$$;

-- =========================================================================
-- 9) rpc_register_sales_order_payment — NUEVA. Registra un pago, recalcula
--    amount_paid/financial_status y libera automáticamente cuando
--    corresponde (ver DECISIÓN "Liberar por pago" arriba). NUNCA aplica a
--    crédito ni "downgradea" un release ya alcanzado.
-- =========================================================================
create or replace function rpc_register_sales_order_payment(
  p_sales_order_id uuid,
  p_amount numeric,
  p_note text default null
)
returns sales_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_so sales_orders;
  v_prev_financial_status text;
  v_prev_release_status text;
  v_new_amount_paid numeric(12,2);
  v_new_financial_status text;
  v_release boolean := false;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance')) then
    raise exception 'Solo un administrador o un usuario con autoridad financiera puede registrar pagos de una Sales Order.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero.';
  end if;

  select * into v_so from sales_orders where id = p_sales_order_id for update;
  if v_so.id is null then
    raise exception 'rpc_register_sales_order_payment: Sales Order % no encontrada.', p_sales_order_id;
  end if;
  if not is_organization_member(v_so.organization_id) then
    raise exception 'Esta Sales Order no pertenece a tu organización.';
  end if;
  if v_so.status not in ('confirmed', 'in_progress', 'fulfilled') then
    raise exception 'Solo se pueden registrar pagos sobre una Sales Order confirmada, en proceso o surtida (status actual: %).', v_so.status;
  end if;

  v_prev_financial_status := v_so.financial_status;
  v_prev_release_status := v_so.fulfillment_release_status;

  v_new_amount_paid := v_so.amount_paid + p_amount;

  if v_so.payment_required_amount is not null and v_new_amount_paid >= v_so.payment_required_amount then
    v_new_financial_status := 'paid';
  elsif v_new_amount_paid > 0 then
    v_new_financial_status := 'partially_paid';
  else
    v_new_financial_status := v_so.financial_status;
  end if;

  if v_so.payment_terms_type <> 'credit' and v_new_financial_status = 'paid' and v_prev_release_status = 'blocked' then
    v_release := true;
  end if;

  update sales_orders set
    amount_paid = v_new_amount_paid,
    financial_status = v_new_financial_status,
    fulfillment_release_status = case when v_release then 'released' else fulfillment_release_status end,
    financial_released_at = case when v_release then coalesce(financial_released_at, now()) else financial_released_at end,
    financial_released_by = case when v_release then coalesce(financial_released_by, auth.uid()) else financial_released_by end
  where id = p_sales_order_id
  returning * into v_so;

  insert into sales_order_financial_events (
    sales_order_id, event_type, amount, previous_financial_status, new_financial_status,
    previous_release_status, new_release_status, reason, created_by
  ) values (
    p_sales_order_id, 'payment_registered', p_amount,
    v_prev_financial_status, v_so.financial_status,
    v_prev_release_status, v_so.fulfillment_release_status,
    p_note, auth.uid()
  );

  return v_so;
end;
$$;

-- =========================================================================
-- 10) rpc_approve_sales_order_credit — NUEVA. Solo para SO de crédito.
-- =========================================================================
create or replace function rpc_approve_sales_order_credit(
  p_sales_order_id uuid
)
returns sales_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_so sales_orders;
  v_prev_financial_status text;
  v_prev_release_status text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance')) then
    raise exception 'Solo un administrador o un usuario con autoridad financiera puede aprobar crédito de una Sales Order.';
  end if;

  select * into v_so from sales_orders where id = p_sales_order_id for update;
  if v_so.id is null then
    raise exception 'rpc_approve_sales_order_credit: Sales Order % no encontrada.', p_sales_order_id;
  end if;
  if not is_organization_member(v_so.organization_id) then
    raise exception 'Esta Sales Order no pertenece a tu organización.';
  end if;
  if v_so.status not in ('confirmed', 'in_progress', 'fulfilled') then
    raise exception 'Solo se puede aprobar crédito sobre una Sales Order confirmada, en proceso o surtida (status actual: %).', v_so.status;
  end if;
  if v_so.payment_terms_type <> 'credit' then
    raise exception 'Solo se puede aprobar crédito en una Sales Order configurada con condición de pago "crédito".';
  end if;
  if v_so.financial_status = 'credit_approved' then
    raise exception 'El crédito de esta Sales Order ya fue aprobado.';
  end if;

  v_prev_financial_status := v_so.financial_status;
  v_prev_release_status := v_so.fulfillment_release_status;

  update sales_orders set
    financial_status = 'credit_approved',
    fulfillment_release_status = 'released',
    financial_released_at = coalesce(financial_released_at, now()),
    financial_released_by = coalesce(financial_released_by, auth.uid())
  where id = p_sales_order_id
  returning * into v_so;

  insert into sales_order_financial_events (
    sales_order_id, event_type, previous_financial_status, new_financial_status,
    previous_release_status, new_release_status, created_by
  ) values (
    p_sales_order_id, 'credit_approved', v_prev_financial_status, v_so.financial_status,
    v_prev_release_status, v_so.fulfillment_release_status, auth.uid()
  );

  return v_so;
end;
$$;

-- =========================================================================
-- 11) rpc_set_sales_order_financial_hold — NUEVA. Motivo obligatorio.
-- =========================================================================
create or replace function rpc_set_sales_order_financial_hold(
  p_sales_order_id uuid,
  p_reason text
)
returns sales_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_so sales_orders;
  v_prev_financial_status text;
  v_prev_release_status text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance')) then
    raise exception 'Solo un administrador o un usuario con autoridad financiera puede bloquear financieramente una Sales Order.';
  end if;
  if v_reason is null then
    raise exception 'Debes indicar un motivo para bloquear financieramente esta Sales Order.';
  end if;

  select * into v_so from sales_orders where id = p_sales_order_id for update;
  if v_so.id is null then
    raise exception 'rpc_set_sales_order_financial_hold: Sales Order % no encontrada.', p_sales_order_id;
  end if;
  if not is_organization_member(v_so.organization_id) then
    raise exception 'Esta Sales Order no pertenece a tu organización.';
  end if;
  if v_so.status not in ('confirmed', 'in_progress', 'fulfilled') then
    raise exception 'Solo se puede bloquear financieramente una Sales Order confirmada, en proceso o surtida (status actual: %).', v_so.status;
  end if;

  v_prev_financial_status := v_so.financial_status;
  v_prev_release_status := v_so.fulfillment_release_status;

  update sales_orders set
    fulfillment_release_status = 'blocked',
    financial_hold_reason = v_reason
  where id = p_sales_order_id
  returning * into v_so;

  insert into sales_order_financial_events (
    sales_order_id, event_type, previous_financial_status, new_financial_status,
    previous_release_status, new_release_status, reason, created_by
  ) values (
    p_sales_order_id, 'financial_hold', v_prev_financial_status, v_so.financial_status,
    v_prev_release_status, v_so.fulfillment_release_status, v_reason, auth.uid()
  );

  return v_so;
end;
$$;

-- =========================================================================
-- 12) rpc_release_sales_order — NUEVA. Contrapunto de "Bloquear": re-evalúa
--     y libera únicamente si la condición financiera YA se cumple (nunca
--     "fuerza" una liberación sin sustento — la reevaluación pasa por el
--     mismo UPDATE, que trg_sales_order_financial_guard vuelve a validar).
-- =========================================================================
create or replace function rpc_release_sales_order(
  p_sales_order_id uuid
)
returns sales_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_so sales_orders;
  v_prev_financial_status text;
  v_prev_release_status text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance')) then
    raise exception 'Solo un administrador o un usuario con autoridad financiera puede liberar una Sales Order.';
  end if;

  select * into v_so from sales_orders where id = p_sales_order_id for update;
  if v_so.id is null then
    raise exception 'rpc_release_sales_order: Sales Order % no encontrada.', p_sales_order_id;
  end if;
  if not is_organization_member(v_so.organization_id) then
    raise exception 'Esta Sales Order no pertenece a tu organización.';
  end if;
  if v_so.status not in ('confirmed', 'in_progress', 'fulfilled') then
    raise exception 'Solo se puede liberar una Sales Order confirmada, en proceso o surtida (status actual: %).', v_so.status;
  end if;
  if v_so.fulfillment_release_status = 'released' then
    raise exception 'Esta Sales Order ya está liberada.';
  end if;

  if v_so.payment_terms_type = 'credit' then
    if v_so.financial_status <> 'credit_approved' then
      raise exception 'No se puede liberar: el crédito de esta Sales Order todavía no está aprobado.';
    end if;
  else
    if v_so.payment_required_amount is null or v_so.amount_paid < v_so.payment_required_amount then
      raise exception 'No se puede liberar: el pago requerido (%) todavía no se cubre (pagado: %).', v_so.payment_required_amount, v_so.amount_paid;
    end if;
  end if;

  v_prev_financial_status := v_so.financial_status;
  v_prev_release_status := v_so.fulfillment_release_status;

  update sales_orders set
    fulfillment_release_status = 'released',
    financial_released_at = coalesce(financial_released_at, now()),
    financial_released_by = coalesce(financial_released_by, auth.uid())
  where id = p_sales_order_id
  returning * into v_so;

  insert into sales_order_financial_events (
    sales_order_id, event_type, previous_financial_status, new_financial_status,
    previous_release_status, new_release_status, created_by
  ) values (
    p_sales_order_id, 'released', v_prev_financial_status, v_so.financial_status,
    v_prev_release_status, v_so.fulfillment_release_status, auth.uid()
  );

  return v_so;
end;
$$;

commit;
