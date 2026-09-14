-- THÖREN 0072 — Facturación + Cobranza básica MVP.
--
-- =========================================================================
-- OBJETIVO (ticket): registrar factura, vencimiento, pagos/cobros y saldo
-- pendiente por Sales Order. Reutiliza la arquitectura existente. NO
-- construye contabilidad completa, NO SAT/CFDI, NO comisiones.
--
-- =========================================================================
-- DECISIÓN — "no duplicar lógica si ya existe infraestructura de pagos":
-- el ticket mismo resuelve la pregunta "¿construir algo nuevo o
-- reutilizar?" a favor de INTEGRAR (a diferencia de 0070, que sí requirió
-- una pregunta de clarificación al usuario porque el ticket describía algo
-- que ya existía SIN saberlo). 0068 (sales_order_financial_release) ya
-- tiene: sales_orders.financial_status/amount_paid/payment_required_amount,
-- rpc_register_sales_order_payment (registra el pago y deriva
-- pending/partially_paid/paid a nivel de Sales Order), y
-- sales_order_financial_events (historial). 0072 NO reimplementa nada de
-- eso — agrega una capa de DOCUMENTO (factura) que:
--   a) impone la regla NUEVA que 0068 nunca tuvo: "no permitir sobrepago"
--      (confirmado leyendo rpc_register_sales_order_payment completa: no
--      valida amount_paid contra ningún total — puede excederlo sin límite).
--   b) DELEGA, en la misma transacción, a rpc_register_sales_order_payment
--      ya existente para mantener sales_orders.amount_paid/financial_status/
--      fulfillment_release_status exactamente como ya funcionan hoy — mismo
--      patrón EXACTO de rpc_post_goods_receipt -> rpc_receive_purchase_order_item
--      (0070) y rpc_dispatch_sales_fulfillment -> inventory_movements (0071):
--      un RPC de documento nuevo llama al RPC de más bajo nivel ya
--      auditado, nunca reimplementa su validación/mutación.
--
-- =========================================================================
-- DECISIÓN — capability: se reutiliza `can_manage_sales_order_finance`
-- (0068) TAL CUAL, sin crear una nueva. A diferencia de 0071
-- (can_fulfill_inventory era explícitamente de Pedidos, no de Sales
-- Orders — ambigüedad real), aquí facturar/cobrar es LITERALMENTE la
-- misma función de Finanzas ya cubierta por esa capability, extendida a
-- un documento nuevo. Mismo criterio de 0069 (reutilizó
-- can_prepare_purchase_orders sin crear una nueva).
--
-- =========================================================================
-- DECISIÓN — 'overdue' es el mismo patrón de "valor de enum reservado
-- para un ticket futuro" ya visto dos veces en este proyecto:
-- fulfillment_release_status incluía 'fulfilled' desde 0068 sin que nada
-- lo asignara, hasta que 0071 lo implementó. sales_orders.financial_status
-- incluye 'overdue' desde 0068 (mismo CHECK) sin que nada lo asignara
-- nunca — la señal es idéntica. invoices.status reutiliza el mismo
-- vocabulario para el documento de factura (no para financial_status de
-- la Sales Order, que 0068 sigue gobernando sin cambios).
--
-- =========================================================================
-- DECISIÓN — sin scheduler/cron en este entorno (documentado ya en 0069+):
-- 'overdue' no puede recalcularse periódicamente. Se resuelve con
-- rpc_refresh_overdue_invoices(organization_id), invocable bajo demanda
-- (llamado desde las páginas de listado/detalle de facturas cuando el
-- usuario tiene autoridad financiera) — UPDATE de conjunto (todas las
-- facturas vencidas de la organización en una sola sentencia), no un loop
-- por fila. Quien NO tiene can_manage_sales_order_finance simplemente ve
-- el status tal como quedó en el último refresh de alguien que sí la
-- tiene — limitación MVP aceptada y documentada, no un bug.
--
-- =========================================================================
-- DECISIÓN — "una factura pertenece a una Sales Order": a lo sumo UNA
-- factura no-cancelada por Sales Order (índice único parcial, mismo
-- patrón EXACTO de purchase_requirements_active_unique, 0064). Evita
-- doble-cobro accidental del mismo documento comercial; cancelar la
-- factura existente libera el cupo para una nueva (mismo criterio que
-- 0064).
--
-- =========================================================================
-- DECISIÓN — montos de la factura son SNAPSHOT congelado de la Sales
-- Order al momento de crear (subtotal/tax_total/total + todas sus líneas
-- vía invoice_items) — mismo patrón MASTER DATA vs TRANSACTION SNAPSHOT ya
-- usado en 0066/0067/0068/0069/0070/0071. Satisface literalmente "no
-- editar montos históricos silenciosamente": una vez creada, ninguna
-- columna de monto/línea de la factura puede cambiar (trigger de
-- congelamiento total, sección 8) — solo status/amount_paid, y
-- EXCLUSIVAMENTE a través de las RPCs de esta migración.
--
-- =========================================================================
-- DECISIÓN — invoice_payments es la tabla auditable ("pago registrado
-- debe ser auditable"): append-only, sin policy de UPDATE/DELETE para
-- `authenticated` — mismo criterio que sales_order_financial_events/
-- goods_receipt_events/sales_fulfillment_events (historiales inmutables).
--
-- =========================================================================
-- DECISIÓN — cancelación explícita (rpc_cancel_invoice): permitida desde
-- pending/partially_paid/overdue, NUNCA desde 'paid' (revertir una factura
-- ya cobrada por completo requeriría nota de crédito/reembolso — fuera de
-- alcance MVP, "NO contabilidad completa"). Cancelar una factura
-- parcialmente pagada NO revierte los pagos ya registrados a nivel de
-- Sales Order (0068) — el cobro físico ya ocurrió; es una decisión
-- administrativa/de negocio fuera de este MVP, documentada como
-- limitación aceptada (igual que 0071 documentó la limitación de
-- fulfillment_release_status al bloquear financieramente una SO ya
-- surtida).
--
-- Como el resto del proyecto: idempotente (create table if not exists,
-- add column if not exists, drop+create para policies/funciones/
-- constraints) y corre completa en una transacción (begin/commit).

begin;

-- =========================================================================
-- 1) invoice_sequences — motor de invoice_number, mismo patrón que
--    sales_fulfillment_sequences/goods_receipt_sequences/
--    purchase_requisition_sequences (0069/0070/0071), con el mismo
--    endurecimiento REVOKE PUBLIC + GRANT authenticated desde el día uno.
-- =========================================================================
create table if not exists invoice_sequences (
  organization_id uuid primary key references organizations (id) on delete restrict,
  prefix text not null default 'INV'
    constraint invoice_sequences_prefix_format check (prefix = upper(prefix))
    constraint invoice_sequences_prefix_charset check (prefix ~ '^[A-Z0-9-]+$')
    constraint invoice_sequences_prefix_length check (char_length(prefix) between 1 and 20),
  sequence_current integer not null default 0 check (sequence_current >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table invoice_sequences enable row level security;

drop policy if exists "invoice_sequences_select_admin" on invoice_sequences;
create policy "invoice_sequences_select_admin" on invoice_sequences
  for select using (is_organization_admin(organization_id));

create or replace function fn_next_invoice_number(
  p_organization_id uuid,
  p_date date
) returns table (invoice_number text, sequence_number integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_seq integer;
  v_date_part text;
begin
  if not is_organization_member(p_organization_id) then
    raise exception 'fn_next_invoice_number: no tienes permiso para generar un número de factura de esta organización.';
  end if;

  insert into invoice_sequences (organization_id)
    values (p_organization_id)
    on conflict (organization_id) do nothing;

  update invoice_sequences
    set sequence_current = sequence_current + 1
    where organization_id = p_organization_id
    returning sequence_current, prefix into v_seq, v_prefix;

  v_date_part := to_char(p_date, 'YYYY') || to_char(p_date, 'DD') || to_char(p_date, 'MM');
  return query select v_prefix || '-' || v_date_part || '-' || lpad(v_seq::text, 3, '0'), v_seq;
end;
$$;

revoke all on function fn_next_invoice_number(uuid, date) from public;
grant execute on function fn_next_invoice_number(uuid, date) to authenticated;

-- =========================================================================
-- 2) invoices — encabezado del documento de factura. Snapshot congelado
--    de subtotal/tax_total/total/payment_terms_type desde la Sales Order
--    al crear (regla: "no editar montos históricos silenciosamente").
-- =========================================================================
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  invoice_number text not null,
  sequence_number integer not null,
  sales_order_id uuid not null references sales_orders (id) on delete restrict,

  status text not null default 'pending'
    check (status in ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled')),

  payment_terms_type text not null
    constraint invoices_payment_terms_type_check check (payment_terms_type in ('cash', 'credit', 'advance', 'custom')),

  issue_date date not null default current_date,
  -- DECISIÓN: due_date NO exige ser >= issue_date a nivel de DB/RPC — una
  -- captura tardía de una factura con condición ya vencida es un caso real
  -- (mismo criterio que permitir capturar documentos históricos en otros
  -- módulos del proyecto), y es lo que permite probar 'overdue' de forma
  -- determinística sin necesitar un mecanismo de "viaje en el tiempo" que
  -- este proyecto no tiene en ningún otro lado.
  due_date date not null,

  subtotal numeric(12,2) not null check (subtotal >= 0),
  tax_total numeric(12,2) not null check (tax_total >= 0),
  total numeric(12,2) not null check (total >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),

  notes text,

  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete restrict,
  cancellation_reason text,

  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoices_amount_paid_not_exceed_total check (amount_paid <= total),
  constraint invoices_paid_requires_full_amount check (status <> 'paid' or amount_paid >= total),
  constraint invoices_cancelled_requires_reason check (status <> 'cancelled' or cancellation_reason is not null)
);

create unique index if not exists invoices_number_unique on invoices (organization_id, invoice_number);
create index if not exists invoices_organization_idx on invoices (organization_id);
create index if not exists invoices_sales_order_idx on invoices (sales_order_id);
create index if not exists invoices_status_idx on invoices (status);

-- Regla "una factura pertenece a una Sales Order": a lo sumo UNA factura
-- no-cancelada por Sales Order — mismo patrón que
-- purchase_requirements_active_unique (0064).
create unique index if not exists invoices_sales_order_active_unique
  on invoices (sales_order_id) where status <> 'cancelled';

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_invoices_updated_at') then
    create trigger trg_invoices_updated_at
      before update on invoices
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 3) invoice_items — snapshot de TODAS las líneas de la Sales Order al
--    crear la factura (MVP: una factura = la Sales Order completa, sin
--    selección parcial de líneas — el ticket no pide facturación
--    parcial de líneas, solo pagos parciales).
-- =========================================================================
create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  sales_order_item_id uuid not null references sales_order_items (id) on delete restrict,
  catalog_product_id uuid references product_catalog (id) on delete set null,

  description_snapshot text not null constraint invoice_items_description_not_blank check (btrim(description_snapshot) <> ''),
  uom_snapshot text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  discount numeric(5,2) not null default 0 check (discount between 0 and 100),
  tax numeric(5,2) not null default 0 check (tax between 0 and 100),
  line_subtotal numeric(12,2) not null check (line_subtotal >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),

  created_at timestamptz not null default now()
);

create index if not exists invoice_items_invoice_idx on invoice_items (invoice_id);
create index if not exists invoice_items_sales_order_item_idx on invoice_items (sales_order_item_id);

-- =========================================================================
-- 4) invoice_payments — ledger append-only de cobros ("pago registrado
--    debe ser auditable"). Nunca UPDATE/DELETE para `authenticated`.
-- =========================================================================
create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete restrict,
  organization_id uuid not null references organizations (id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  notes text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists invoice_payments_invoice_idx on invoice_payments (invoice_id);
create index if not exists invoice_payments_organization_idx on invoice_payments (organization_id);

-- =========================================================================
-- 5) invoice_events — historial mínimo, inmutable (solo INSERT). Mismo
--    criterio que sales_order_financial_events/goods_receipt_events/
--    sales_fulfillment_events.
-- =========================================================================
create table if not exists invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  event_type text not null check (event_type in ('created', 'payment_registered', 'paid', 'overdue_detected', 'cancelled')),
  amount numeric(12,2),
  previous_status text,
  new_status text,
  reason text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists invoice_events_invoice_idx on invoice_events (invoice_id);

-- =========================================================================
-- 6) Trigger: elegibilidad al crear — la Sales Order de origen debe
--    existir, pertenecer a la misma organización, y no estar en
--    draft/cancelled (mismo criterio de eligibilidad ya usado en
--    0069/0070/0071 para su documento de origen respectivo). A
--    diferencia de 0071 (surtido), NO se exige que la Sales Order esté
--    financieramente liberada — facturar es independiente de/puede
--    preceder a la liberación (p.ej. crédito: se factura, luego se cobra
--    y eso es lo que dispara la liberación vía 0068).
-- =========================================================================
create or replace function trg_check_invoice_eligible()
returns trigger
language plpgsql
as $$
declare
  v_so_org uuid;
  v_so_status text;
begin
  select organization_id, status into v_so_org, v_so_status
    from sales_orders where id = new.sales_order_id;
  if v_so_org is null then
    raise exception 'invoices: Sales Order % no existe o no es visible para tu usuario.', new.sales_order_id;
  end if;
  if new.organization_id is distinct from v_so_org then
    raise exception 'invoices: organization_id (%) no coincide con la organización de la Sales Order (%).', new.organization_id, v_so_org;
  end if;
  if v_so_status = 'draft' then
    raise exception 'No se puede facturar una Sales Order en draft.';
  end if;
  if v_so_status = 'cancelled' then
    raise exception 'No se puede facturar una Sales Order cancelada.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoices_eligible on invoices;
create trigger trg_invoices_eligible
  before insert on invoices
  for each row execute function trg_check_invoice_eligible();

-- =========================================================================
-- 7) Trigger: máquina de estados de invoices. pending/partially_paid ->
--    overdue (por fecha, vía refresh) o -> paid/partially_paid (por pago,
--    vía rpc_register_invoice_payment) o -> cancelled (explícito).
--    overdue -> partially_paid/paid (un pago posterior corrige el status)
--    o -> cancelled. 'paid'/'cancelled' son terminales.
-- =========================================================================
create or replace function trg_invoice_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if old.status in ('paid', 'cancelled') then
      raise exception 'El status de una factura % es definitivo y no puede cambiar (intentado: %).', old.status, new.status;
    end if;
    if not (
      (old.status in ('pending', 'partially_paid', 'overdue') and new.status in ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled'))
    ) then
      raise exception 'Transición de estado inválida para una factura: % -> %.', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoices_status_transition on invoices;
create trigger trg_invoices_status_transition
  before update on invoices
  for each row execute function trg_invoice_status_transition();

-- =========================================================================
-- 8) Trigger: congelamiento — invoice_number/sequence_number/
--    organization_id/sales_order_id/payment_terms_type/issue_date/
--    due_date/subtotal/tax_total/total SIEMPRE inmutables tras crear
--    (snapshot congelado, regla "no editar montos históricos
--    silenciosamente"). status/amount_paid/cancelled_*/notes SÍ cambian,
--    pero EXCLUSIVAMENTE a través de las RPCs de esta migración (RLS de
--    UPDATE, sección 11, ya exige can_manage_sales_order_finance/admin).
-- =========================================================================
create or replace function trg_prevent_invoice_field_change()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is distinct from old.invoice_number then
    raise exception 'El número de una factura no se puede modificar (%).', old.invoice_number;
  end if;
  if new.sequence_number is distinct from old.sequence_number then
    raise exception 'El consecutivo de una factura no se puede modificar.';
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'La organización de una factura no se puede modificar.';
  end if;
  if new.sales_order_id is distinct from old.sales_order_id then
    raise exception 'La Sales Order de origen de una factura no se puede modificar.';
  end if;
  if new.payment_terms_type is distinct from old.payment_terms_type then
    raise exception 'La condición de pago de una factura no se puede modificar.';
  end if;
  if new.issue_date is distinct from old.issue_date then
    raise exception 'La fecha de emisión de una factura no se puede modificar.';
  end if;
  if new.due_date is distinct from old.due_date then
    raise exception 'La fecha de vencimiento de una factura no se puede modificar.';
  end if;
  if new.subtotal is distinct from old.subtotal or new.tax_total is distinct from old.tax_total or new.total is distinct from old.total then
    raise exception 'Los montos de una factura son un snapshot congelado y no se pueden modificar.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoices_prevent_field_change on invoices;
create trigger trg_invoices_prevent_field_change
  before update on invoices
  for each row execute function trg_prevent_invoice_field_change();

-- Líneas: 100% inmutables tras creadas — ninguna RPC de esta migración
-- las modifica ni las borra jamás (a diferencia de sales_fulfillment_items,
-- aquí no hay "editar en draft": la factura nace ya completa desde el
-- snapshot de la Sales Order).
create or replace function trg_prevent_invoice_item_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'No se puede eliminar una línea de factura.';
  end if;
  raise exception 'No se puede modificar una línea de factura — es un snapshot congelado.';
end;
$$;

drop trigger if exists trg_invoice_items_freeze on invoice_items;
create trigger trg_invoice_items_freeze
  before update or delete on invoice_items
  for each row execute function trg_prevent_invoice_item_change();

-- =========================================================================
-- 9) RLS — sales_orders/sales_order_items: can_manage_sales_order_finance
--    YA tiene rama de SELECT desde 0068 — nada que ampliar aquí (a
--    diferencia de 0069/0071, que sí necesitaron agregar una rama nueva
--    para su propia capability nueva). Sección incluida solo para dejar
--    constancia de que se auditó y NO requiere cambio.
-- =========================================================================

-- =========================================================================
-- 10) RLS — invoices / invoice_items / invoice_payments / invoice_events.
--     Autoridad uniforme, mismo patrón que sales_order_financial_events
--     (0068): SELECT amplio (admin, dueño-salesperson de la SO,
--     can_view_all_sales, can_manage_sales_order_finance);
--     INSERT/UPDATE exclusivos de admin/can_manage_sales_order_finance
--     (las RPCs son el único código que escribe).
-- =========================================================================
alter table invoices enable row level security;

drop policy if exists "invoices_select" on invoices;
create policy "invoices_select" on invoices
  for select using (
    exists (
      select 1 from sales_orders so
      where so.id = invoices.sales_order_id
        and (
          is_organization_admin(so.organization_id)
          or (is_organization_member(so.organization_id) and so.salesperson_id = current_user_salesperson_id())
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_view_all_sales'))
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_manage_sales_order_finance'))
        )
    )
  );

drop policy if exists "invoices_insert" on invoices;
create policy "invoices_insert" on invoices
  for insert with check (
    current_user_active()
    and is_organization_member(organization_id)
    and (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance'))
  );

drop policy if exists "invoices_update" on invoices;
create policy "invoices_update" on invoices
  for update using (
    current_user_active()
    and is_organization_member(organization_id)
    and (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance'))
  )
  with check (
    current_user_active()
    and is_organization_member(organization_id)
    and (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance'))
  );

alter table invoice_items enable row level security;

drop policy if exists "invoice_items_select" on invoice_items;
create policy "invoice_items_select" on invoice_items
  for select using (
    exists (
      select 1 from invoices inv
      join sales_orders so on so.id = inv.sales_order_id
      where inv.id = invoice_items.invoice_id
        and (
          is_organization_admin(so.organization_id)
          or (is_organization_member(so.organization_id) and so.salesperson_id = current_user_salesperson_id())
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_view_all_sales'))
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_manage_sales_order_finance'))
        )
    )
  );

drop policy if exists "invoice_items_insert" on invoice_items;
create policy "invoice_items_insert" on invoice_items
  for insert with check (
    exists (
      select 1 from invoices inv
      where inv.id = invoice_items.invoice_id
        and is_organization_member(inv.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance'))
    )
  );

-- UPDATE/DELETE: la RLS SÍ permite el intento (misma autoridad que
-- INSERT) a propósito — mismo criterio que sales_fulfillment_items
-- (0071): es trg_invoice_items_freeze (sección 8) quien rechaza con un
-- mensaje explícito, en vez de dejar que RLS lo filtre en silencio (0
-- filas afectadas, sin error) — mejor UX/auditoría del intento.
drop policy if exists "invoice_items_update" on invoice_items;
create policy "invoice_items_update" on invoice_items
  for update using (
    exists (
      select 1 from invoices inv
      where inv.id = invoice_items.invoice_id
        and is_organization_member(inv.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance'))
    )
  );

drop policy if exists "invoice_items_delete" on invoice_items;
create policy "invoice_items_delete" on invoice_items
  for delete using (
    exists (
      select 1 from invoices inv
      where inv.id = invoice_items.invoice_id
        and is_organization_member(inv.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance'))
    )
  );

alter table invoice_payments enable row level security;

drop policy if exists "invoice_payments_select" on invoice_payments;
create policy "invoice_payments_select" on invoice_payments
  for select using (
    exists (
      select 1 from invoices inv
      join sales_orders so on so.id = inv.sales_order_id
      where inv.id = invoice_payments.invoice_id
        and (
          is_organization_admin(so.organization_id)
          or (is_organization_member(so.organization_id) and so.salesperson_id = current_user_salesperson_id())
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_view_all_sales'))
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_manage_sales_order_finance'))
        )
    )
  );

drop policy if exists "invoice_payments_insert" on invoice_payments;
create policy "invoice_payments_insert" on invoice_payments
  for insert with check (
    is_organization_member(organization_id)
    and (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance'))
  );

alter table invoice_events enable row level security;

drop policy if exists "invoice_events_select" on invoice_events;
create policy "invoice_events_select" on invoice_events
  for select using (
    exists (
      select 1 from invoices inv
      join sales_orders so on so.id = inv.sales_order_id
      where inv.id = invoice_events.invoice_id
        and (
          is_organization_admin(so.organization_id)
          or (is_organization_member(so.organization_id) and so.salesperson_id = current_user_salesperson_id())
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_view_all_sales'))
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_manage_sales_order_finance'))
        )
    )
  );

drop policy if exists "invoice_events_insert" on invoice_events;
create policy "invoice_events_insert" on invoice_events
  for insert with check (
    exists (
      select 1 from invoices inv
      where inv.id = invoice_events.invoice_id
        and is_organization_member(inv.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance'))
    )
  );

-- =========================================================================
-- 11) rpc_create_invoice — SECURITY INVOKER. Snapshotea encabezado +
--     TODAS las líneas de la Sales Order en una transacción.
--     organization_id/created_by/montos siempre resueltos server-side
--     desde la propia Sales Order (nunca confiados al cliente).
-- =========================================================================
create or replace function rpc_create_invoice(
  p_invoice_id uuid,
  p_sales_order_id uuid,
  p_due_date date,
  p_notes text default null
)
returns invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inv invoices;
  v_so sales_orders;
  v_organization_id uuid;
  v_number_result record;
  v_item sales_order_items;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance')) then
    raise exception 'Solo un administrador o un usuario con autoridad financiera puede crear una factura.';
  end if;
  if p_sales_order_id is null then
    raise exception 'Debe indicarse la Sales Order de origen.';
  end if;
  if p_due_date is null then
    raise exception 'Debe indicarse la fecha de vencimiento.';
  end if;

  select * into v_so from sales_orders where id = p_sales_order_id for update;
  if v_so.id is null then
    raise exception 'rpc_create_invoice: Sales Order % no encontrada.', p_sales_order_id;
  end if;
  if not is_organization_member(v_so.organization_id) then
    raise exception 'Esta Sales Order no pertenece a tu organización.';
  end if;

  v_organization_id := v_so.organization_id;

  select * into v_number_result from fn_next_invoice_number(v_organization_id, current_date);

  insert into invoices (
    id, organization_id, invoice_number, sequence_number, sales_order_id,
    status, payment_terms_type, issue_date, due_date,
    subtotal, tax_total, total, amount_paid, notes, created_by
  ) values (
    p_invoice_id, v_organization_id, v_number_result.invoice_number, v_number_result.sequence_number, p_sales_order_id,
    'pending', v_so.payment_terms_type, current_date, p_due_date,
    v_so.subtotal, v_so.tax_total, v_so.total, 0, nullif(p_notes, ''), auth.uid()
  )
  returning * into v_inv;

  for v_item in select * from sales_order_items where sales_order_id = p_sales_order_id order by position
  loop
    insert into invoice_items (
      invoice_id, sales_order_item_id, catalog_product_id,
      description_snapshot, uom_snapshot, quantity, unit_price, discount, tax,
      line_subtotal, line_total
    ) values (
      v_inv.id, v_item.id, v_item.catalog_product_id,
      coalesce(v_item.description_snapshot, v_item.sku_snapshot), v_item.uom_snapshot,
      v_item.quantity, v_item.unit_price, v_item.discount, v_item.tax,
      v_item.line_subtotal, v_item.line_total
    );
  end loop;

  insert into invoice_events (invoice_id, event_type, previous_status, new_status, created_by)
    values (v_inv.id, 'created', null, 'pending', auth.uid());

  return v_inv;
end;
$$;

-- =========================================================================
-- 12) rpc_register_invoice_payment — SECURITY INVOKER. Es la pieza NUEVA
--     de esta migración (regla "no permitir sobrepago"), y DELEGA a
--     rpc_register_sales_order_payment (0068, ya existente) para
--     mantener la Sales Order sincronizada — mismo patrón de delegación
--     de 0070/0071. Ambas escrituras ocurren en la MISMA transacción
--     PL/pgSQL: si cualquiera falla, la otra revierte.
-- =========================================================================
create or replace function rpc_register_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date default current_date,
  p_notes text default null
)
returns invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inv invoices;
  v_prev_status text;
  v_new_amount_paid numeric(12,2);
  v_new_status text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance')) then
    raise exception 'Solo un administrador o un usuario con autoridad financiera puede registrar un pago de factura.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero.';
  end if;

  select * into v_inv from invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'rpc_register_invoice_payment: Factura % no encontrada.', p_invoice_id;
  end if;
  if not is_organization_member(v_inv.organization_id) then
    raise exception 'Esta factura no pertenece a tu organización.';
  end if;
  if v_inv.status = 'cancelled' then
    raise exception 'No se pueden registrar pagos sobre una factura cancelada.';
  end if;
  if v_inv.status = 'paid' then
    raise exception 'Esta factura ya está pagada en su totalidad.';
  end if;

  v_new_amount_paid := v_inv.amount_paid + p_amount;

  -- Regla del ticket: "no permitir sobrepago" — la Sales Order (0068) NO
  -- impone este límite; la factura sí, aquí, ANTES de delegar.
  if v_new_amount_paid > v_inv.total then
    raise exception 'El pago de % excede el saldo pendiente de la factura (saldo: %).', p_amount, (v_inv.total - v_inv.amount_paid);
  end if;

  -- "overdue derivado por fecha y saldo": un pago parcial que NO liquida
  -- una factura cuya fecha de vencimiento ya pasó debe seguir leyendo
  -- 'overdue', no regresar a 'partially_paid' (evita una falsa lectura de
  -- "al corriente" tras el pago).
  v_prev_status := v_inv.status;
  v_new_status := case
    when v_new_amount_paid >= v_inv.total then 'paid'
    when v_inv.due_date < current_date then 'overdue'
    else 'partially_paid'
  end;

  insert into invoice_payments (invoice_id, organization_id, amount, payment_date, notes, created_by)
    values (p_invoice_id, v_inv.organization_id, p_amount, coalesce(p_payment_date, current_date), nullif(p_notes, ''), auth.uid());

  update invoices set amount_paid = v_new_amount_paid, status = v_new_status
    where id = p_invoice_id
    returning * into v_inv;

  insert into invoice_events (invoice_id, event_type, amount, previous_status, new_status, created_by)
    values (p_invoice_id, 'payment_registered', p_amount, v_prev_status, v_new_status, auth.uid());

  if v_new_status = 'paid' and v_prev_status <> 'paid' then
    insert into invoice_events (invoice_id, event_type, previous_status, new_status, created_by)
      values (p_invoice_id, 'paid', v_prev_status, v_new_status, auth.uid());
  end if;

  -- Delegación (regla "no duplicar lógica... integrar con
  -- sales_orders.financial_status sin romper 0068"): la MISMA RPC ya
  -- auditada de 0068 sigue siendo la única que escribe
  -- sales_orders.amount_paid/financial_status/fulfillment_release_status.
  perform rpc_register_sales_order_payment(v_inv.sales_order_id, p_amount, p_notes);

  return v_inv;
end;
$$;

-- =========================================================================
-- 13) rpc_cancel_invoice — SECURITY INVOKER. Cancelación explícita, motivo
--     obligatorio (mismo patrón que rpc_set_sales_order_financial_hold,
--     0068). NUNCA desde 'paid' (ver DECISIÓN de cabecera).
-- =========================================================================
create or replace function rpc_cancel_invoice(
  p_invoice_id uuid,
  p_reason text
)
returns invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inv invoices;
  v_prev_status text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance')) then
    raise exception 'Solo un administrador o un usuario con autoridad financiera puede cancelar una factura.';
  end if;
  if v_reason is null then
    raise exception 'Debes indicar un motivo para cancelar esta factura.';
  end if;

  select * into v_inv from invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'rpc_cancel_invoice: Factura % no encontrada.', p_invoice_id;
  end if;
  if not is_organization_member(v_inv.organization_id) then
    raise exception 'Esta factura no pertenece a tu organización.';
  end if;
  if v_inv.status = 'cancelled' then
    raise exception 'Esta factura ya está cancelada.';
  end if;
  if v_inv.status = 'paid' then
    raise exception 'No se puede cancelar una factura ya pagada en su totalidad.';
  end if;

  v_prev_status := v_inv.status;

  update invoices set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = v_reason
    where id = p_invoice_id
    returning * into v_inv;

  insert into invoice_events (invoice_id, event_type, previous_status, new_status, reason, created_by)
    values (p_invoice_id, 'cancelled', v_prev_status, 'cancelled', v_reason, auth.uid());

  return v_inv;
end;
$$;

-- =========================================================================
-- 14) rpc_refresh_overdue_invoices — SECURITY INVOKER. UPDATE de conjunto
--     (no un loop por fila): todas las facturas pending/partially_paid de
--     la organización con due_date ya pasada pasan a 'overdue'. Sin
--     scheduler/cron en este entorno (ver DECISIÓN de cabecera) — se
--     invoca bajo demanda desde las páginas de listado/detalle.
-- =========================================================================
create or replace function rpc_refresh_overdue_invoices(
  p_organization_id uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_organization_id uuid := coalesce(p_organization_id, current_user_organization_id());
  v_updated integer;
  v_row invoices;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance')) then
    raise exception 'Solo un administrador o un usuario con autoridad financiera puede refrescar el estado de vencimiento de facturas.';
  end if;
  if not is_organization_member(v_organization_id) then
    raise exception 'Esta organización no es la tuya.';
  end if;

  v_updated := 0;
  for v_row in
    update invoices
      set status = 'overdue'
      where organization_id = v_organization_id
        and status in ('pending', 'partially_paid')
        and due_date < current_date
        and amount_paid < total
      returning *
  loop
    v_updated := v_updated + 1;
    insert into invoice_events (invoice_id, event_type, previous_status, new_status, created_by)
      values (v_row.id, 'overdue_detected', case when v_row.amount_paid > 0 then 'partially_paid' else 'pending' end, 'overdue', auth.uid());
  end loop;

  return v_updated;
end;
$$;

commit;
