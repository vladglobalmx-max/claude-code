-- THÖREN 0073 — Comisiones privadas de Dirección MVP.
--
-- =========================================================================
-- OBJETIVO (ticket): calcular, liberar y registrar comisiones por Sales
-- Order sin que ventas pueda ver información sensible. Reutiliza
-- sales_orders/vendedor/facturación/cobranza existentes. NO motor complejo
-- de incentivos, NO refactors generales.
--
-- =========================================================================
-- DECISIÓN — modelo de exactamente 2 tablas, tal como el ticket lo pide
-- literalmente (a diferencia de 0072, que usó 4): commission_records
-- (encabezado + estado) y commission_events (auditoría). NO se crea una
-- tabla de "pagos de comisión" separada — commission_events YA es
-- append-only/inmutable y su columna `amount` sirve como el registro
-- auditable de cada pago (mismo campo que invoice_events, 0072), evitando
-- un tercer documento que el ticket no pidió.
--
-- =========================================================================
-- DECISIÓN — privacidad real, no solo UI (el punto de seguridad más
-- importante del ticket): se crea la capability NUEVA
-- `can_manage_commissions` (Dirección General). A diferencia de TODAS las
-- capabilities anteriores de este proyecto (0068/0069/0070/0071), la
-- policy de SELECT/INSERT/UPDATE de commission_records/commission_events
-- NO tiene rama de "dueño" (salesperson_id = current_user_salesperson_id())
-- NI de can_view_all_sales NI de can_manage_sales_order_finance —
-- únicamente can_manage_commissions. El propio vendedor titular de la
-- Sales Order NUNCA puede ver su propia comisión vía RLS, tal como pide
-- el ticket explícitamente ("vendedores NO deben poder consultar montos,
-- porcentajes, margen ni pagos de comisión"). Esto es una divergencia
-- DELIBERADA del patrón "dueño o admin" usado en el resto del proyecto —
-- no un descuido a corregir después.
--
-- =========================================================================
-- DECISIÓN — ni siquiera `admin` obtiene acceso automático (ajuste
-- explícito post-review, antes del commit): la autoridad de comisiones es
-- EXCLUSIVAMENTE can_manage_commissions — Dirección General la recibe
-- como capability, otros admins NO la tienen por defecto. Esto exige un
-- helper NUEVO, `current_user_has_commission_authority()` (sección 2b):
-- la función compartida `current_user_has_capability()` (0040) SIEMPRE
-- devuelve true para cualquier admin como primera línea de su cuerpo —
-- ese atajo es correcto e intencional para el resto del proyecto (todas
-- las demás capabilities SÍ quieren "admin o capability"), así que NO se
-- modifica esa función compartida (evitaría romper 0068/0069/0070/0071 y
-- toda otra capability futura) — en su lugar, comisiones usa su PROPIO
-- helper, que replica la misma lógica de scoping por organización pero
-- SIN el atajo de admin. Se usa consistentemente en RLS (sección 5),
-- RPCs (secciones 9-12) y en la ampliación de sales_orders/salespeople
-- (sección 4) — nunca current_user_is_admin() ni current_user_has_capability()
-- para autorizar comisiones en ningún punto de esta migración.
--
-- =========================================================================
-- DECISIÓN — sin SECURITY DEFINER en ninguna función de esta migración:
-- a diferencia de 0070/0071 (que necesitaron escribir en inventory_movements/
-- sales_orders sin policy propia), aquí NINGÚN RPC escribe en una tabla
-- ajena — solo lee sales_orders.total/amount_paid (ya visible vía la
-- ampliación de sales_orders_select_own_or_admin de la sección 3) y
-- escribe exclusivamente en commission_records/commission_events, ambas
-- con su propia policy de INSERT/UPDATE para can_manage_commissions. Todas
-- las funciones son SECURITY INVOKER — la autoridad real es 100% RLS +
-- el chequeo de capability al inicio de cada función.
--
-- =========================================================================
-- DECISIÓN — commission_base: por defecto `sales_orders.subtotal` (antes
-- de impuestos — el impuesto no es ingreso de la organización, criterio
-- estándar de comisión sobre venta neta), pero Dirección puede indicar un
-- monto distinto al crear (p_commission_base) — sin motor de reglas, solo
-- un valor numérico capturado y congelado. commission_rule_snapshot (jsonb)
-- guarda el contexto completo de esa decisión (rate/base/nota) — snapshot
-- permanente: cambios futuros en cómo se decide una tasa NUNCA alteran una
-- comisión ya creada (no existe tabla de "reglas" que editar en este MVP;
-- la inmutabilidad se logra directamente vía el trigger de congelamiento,
-- sección 6).
--
-- =========================================================================
-- DECISIÓN — "liberación ligada a cobro real" + "comisión proporcional":
-- eligible_amount = round(commission_amount × LEAST(1, sales_orders.amount_paid
-- / sales_orders.total), 2). sales_orders.amount_paid (0068) YA es el
-- agregado real de cobro, sin importar si el pago llegó vía
-- rpc_register_sales_order_payment directo o vía rpc_register_invoice_payment
-- (0072, que delega en el mismo campo) — se reutiliza tal cual, sin tocar
-- ninguna tabla de facturación. rpc_refresh_commission_eligibility (UPDATE
-- de conjunto, sin cron en este entorno — mismo patrón que
-- rpc_refresh_overdue_invoices, 0072) recalcula bajo demanda;
-- rpc_register_commission_payment TAMBIÉN recalcula en vivo antes de
-- validar un pago, para nunca confiar en un valor persistido posiblemente
-- desactualizado.
--
-- =========================================================================
-- DECISIÓN — "no pagar más de la comisión calculada": DOS candados. (a) DB:
-- paid_amount <= eligible_amount <= commission_amount (constraints
-- encadenadas — la primera ya implica la segunda transitivamente). (b) RPC:
-- rpc_register_commission_payment valida contra el saldo ELEGIBLE (liberado
-- por cobro real), no solo contra el monto total calculado — más estricto
-- que un simple tope, es la regla real de negocio del ticket.
--
-- =========================================================================
-- DECISIÓN — split de comisión: "solo si encaja fácil". Encaja: NO se
-- fuerza p_salesperson_id = sales_orders.salesperson_id al crear —
-- Dirección puede crear comisiones para CUALQUIER vendedor de su
-- organización sobre la misma Sales Order (p.ej. un referido). El único
-- candado es "a lo sumo una comisión activa por (Sales Order, vendedor)"
-- (índice único parcial, mismo patrón que purchase_requirements_active_unique,
-- 0064) — evita doble captura por error para el MISMO vendedor, sin
-- impedir splits entre vendedores distintos. NO se agrega ningún motor de
-- reparto automático/porcentajes que sumen 100%.
--
-- Como el resto del proyecto: idempotente (create table if not exists,
-- add column if not exists, drop+create para policies/funciones/
-- constraints) y corre completa en una transacción (begin/commit).

begin;

-- =========================================================================
-- 1) capabilities — nueva capacidad, aditiva sobre el catálogo de 0040.
-- =========================================================================
insert into capabilities (key, description) values
  ('can_manage_commissions', 'Ver, calcular, liberar y registrar pagos de comisiones de venta (Dirección General). Estrictamente privado: única fuente de autoridad — ni vendedores, ni Finanzas, ni otros admins la tienen por defecto.')
on conflict (key) do nothing;

-- =========================================================================
-- 2) commission_records — encabezado + estado de una comisión sobre una
--    Sales Order. Snapshot congelado de la regla/tasa al crear.
-- =========================================================================
create table if not exists commission_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  sales_order_id uuid not null references sales_orders (id) on delete restrict,
  salesperson_id uuid not null references salespeople (id) on delete restrict,

  commission_rule_snapshot jsonb not null,
  commission_base numeric(12,2) not null check (commission_base >= 0),
  commission_rate numeric(5,2) not null check (commission_rate between 0 and 100),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),

  eligible_amount numeric(12,2) not null default 0 check (eligible_amount >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),

  status text not null default 'pending'
    check (status in ('pending', 'eligible', 'partially_paid', 'paid', 'cancelled')),

  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete restrict,
  cancellation_reason text,

  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- paid <= eligible <= amount encadenado — un pago nunca puede exceder lo
  -- liberado por cobro real, y lo liberado nunca puede exceder lo calculado.
  constraint commission_records_eligible_not_exceed_amount check (eligible_amount <= commission_amount),
  constraint commission_records_paid_not_exceed_eligible check (paid_amount <= eligible_amount),
  constraint commission_records_paid_requires_full_amount check (status <> 'paid' or paid_amount >= commission_amount),
  constraint commission_records_cancelled_requires_reason check (status <> 'cancelled' or cancellation_reason is not null)
);

create index if not exists commission_records_organization_idx on commission_records (organization_id);
create index if not exists commission_records_sales_order_idx on commission_records (sales_order_id);
create index if not exists commission_records_salesperson_idx on commission_records (salesperson_id);
create index if not exists commission_records_status_idx on commission_records (status);

-- Split de comisión soportado entre vendedores DISTINTOS (sección de
-- cabecera) — el candado es por PAR (Sales Order, vendedor), no por Sales
-- Order sola.
create unique index if not exists commission_records_so_salesperson_active_unique
  on commission_records (sales_order_id, salesperson_id) where status <> 'cancelled';

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_commission_records_updated_at') then
    create trigger trg_commission_records_updated_at
      before update on commission_records
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 3) commission_events — historial mínimo, inmutable (solo INSERT). El
--    campo `amount` hace de registro auditable de cada pago (regla:
--    "auditoría de cada cambio" + "pago registrado debe ser auditable").
-- =========================================================================
create table if not exists commission_events (
  id uuid primary key default gen_random_uuid(),
  commission_record_id uuid not null references commission_records (id) on delete cascade,
  event_type text not null check (event_type in ('created', 'eligibility_updated', 'payment_registered', 'paid', 'cancelled')),
  amount numeric(12,2),
  previous_status text,
  new_status text,
  reason text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists commission_events_commission_record_idx on commission_events (commission_record_id);

-- =========================================================================
-- 2b) current_user_has_commission_authority() — ÚNICO punto de verdad
--     para autorizar comisiones en TODA esta migración (RLS + RPCs).
--     Replica el scoping por organización de current_user_has_capability()
--     (0040) pero SIN su atajo de "admin siempre true" — ver DECISIÓN de
--     cabecera. security definer: necesita leer user_capabilities más
--     allá de lo que la propia RLS de esa tabla le permitiría al usuario
--     de a pie (mismo patrón exacto que current_user_has_capability()).
-- =========================================================================
create or replace function current_user_has_commission_authority()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  if not current_user_active() then
    return false;
  end if;

  v_organization_id := current_user_organization_id();
  if v_organization_id is null then
    return false;
  end if;

  return exists (
    select 1 from user_capabilities uc
    where uc.user_id = auth.uid()
      and uc.organization_id = v_organization_id
      and uc.capability = 'can_manage_commissions'
      and uc.active = true
  );
end;
$$;

-- =========================================================================
-- 4) RLS — sales_orders/salespeople: se amplía SOLO lectura para quien
--    tiene autoridad de comisiones (mismo patrón que 0069/0071) —
--    Dirección necesita VER la Sales Order y el catálogo de vendedores
--    para crear una comisión. Esto NO expone ningún dato de comisión —
--    solo permite leer la Sales Order/vendedor en sí. Reemplaza las
--    policies de 0071, agregando una rama más — el resto queda carácter
--    por carácter igual. Nota: un admin SIN can_manage_commissions ya ve
--    estas tablas de todas formas vía su propia rama
--    is_organization_admin() de siempre — esta rama nueva solo importa
--    para un titular de can_manage_commissions que NO es admin.
-- =========================================================================
drop policy if exists "sales_orders_select_own_or_admin" on sales_orders;
create policy "sales_orders_select_own_or_admin" on sales_orders
  for select using (
    is_organization_admin(organization_id)
    or (is_organization_member(organization_id) and salesperson_id = current_user_salesperson_id())
    or (is_organization_member(organization_id) and current_user_has_capability('can_view_all_sales'))
    or (is_organization_member(organization_id) and current_user_has_capability('can_manage_sales_order_finance'))
    or (is_organization_member(organization_id) and current_user_has_capability('can_prepare_purchase_orders'))
    or (is_organization_member(organization_id) and current_user_has_capability('can_manage_sales_fulfillment'))
    or (is_organization_member(organization_id) and current_user_has_commission_authority())
  );

drop policy if exists "salespeople_select_own_or_admin" on salespeople;
create policy "salespeople_select_own_or_admin" on salespeople
  for select using (
    current_user_active() and (
      is_organization_admin(organization_id)
      or id = current_user_salesperson_id()
      or (is_organization_member(organization_id) and current_user_has_commission_authority())
    )
  );

-- =========================================================================
-- 5) RLS — commission_records / commission_events. ÚNICAMENTE quien tiene
--    can_manage_commissions — sin rama de dueño, sin can_view_all_sales,
--    sin can_manage_sales_order_finance (ver DECISIÓN de cabecera: esto es
--    intencional, no un patrón a "completar" luego).
-- =========================================================================
alter table commission_records enable row level security;

drop policy if exists "commission_records_select" on commission_records;
create policy "commission_records_select" on commission_records
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and current_user_has_commission_authority()
  );

drop policy if exists "commission_records_insert" on commission_records;
create policy "commission_records_insert" on commission_records
  for insert with check (
    current_user_active()
    and is_organization_member(organization_id)
    and current_user_has_commission_authority()
  );

drop policy if exists "commission_records_update" on commission_records;
create policy "commission_records_update" on commission_records
  for update using (
    current_user_active()
    and is_organization_member(organization_id)
    and current_user_has_commission_authority()
  )
  with check (
    current_user_active()
    and is_organization_member(organization_id)
    and current_user_has_commission_authority()
  );

alter table commission_events enable row level security;

drop policy if exists "commission_events_select" on commission_events;
create policy "commission_events_select" on commission_events
  for select using (
    exists (
      select 1 from commission_records cr
      where cr.id = commission_events.commission_record_id
        and current_user_active() and is_organization_member(cr.organization_id)
        and current_user_has_commission_authority()
    )
  );

drop policy if exists "commission_events_insert" on commission_events;
create policy "commission_events_insert" on commission_events
  for insert with check (
    exists (
      select 1 from commission_records cr
      where cr.id = commission_events.commission_record_id
        and is_organization_member(cr.organization_id)
        and current_user_has_commission_authority()
    )
  );

-- =========================================================================
-- 6) Trigger: congelamiento total de identidad/snapshot/cálculo — SIEMPRE,
--    sin excepción de status (a diferencia de invoices/sales_fulfillments,
--    aquí NO hay ningún campo de encabezado legítimamente editable después
--    de crear). Solo status/eligible_amount/paid_amount/cancelled_*/
--    updated_at cambian, y únicamente vía los RPCs de esta migración (RLS
--    ya lo restringe a can_manage_commissions, sin admin por defecto).
-- =========================================================================
create or replace function trg_prevent_commission_record_field_change()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'La organización de una comisión no se puede modificar.';
  end if;
  if new.sales_order_id is distinct from old.sales_order_id then
    raise exception 'La Sales Order de origen de una comisión no se puede modificar.';
  end if;
  if new.salesperson_id is distinct from old.salesperson_id then
    raise exception 'El vendedor de una comisión no se puede modificar.';
  end if;
  if new.commission_rule_snapshot is distinct from old.commission_rule_snapshot then
    raise exception 'El snapshot de la regla de comisión es inmutable.';
  end if;
  if new.commission_base is distinct from old.commission_base then
    raise exception 'La base de una comisión ya creada no se puede modificar.';
  end if;
  if new.commission_rate is distinct from old.commission_rate then
    raise exception 'El porcentaje de una comisión ya creada no se puede modificar.';
  end if;
  if new.commission_amount is distinct from old.commission_amount then
    raise exception 'El monto calculado de una comisión ya creada no se puede modificar.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_commission_records_prevent_field_change on commission_records;
create trigger trg_commission_records_prevent_field_change
  before update on commission_records
  for each row execute function trg_prevent_commission_record_field_change();

-- =========================================================================
-- 7) Trigger: máquina de estados. pending -> eligible; eligible ->
--    partially_paid | paid; partially_paid -> paid; cualquiera de los tres
--    no-terminales -> cancelled. paid/cancelled son terminales.
-- =========================================================================
create or replace function trg_commission_record_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if old.status in ('paid', 'cancelled') then
      raise exception 'El status de una comisión % es definitivo y no puede cambiar (intentado: %).', old.status, new.status;
    end if;
    if new.status = 'cancelled' then
      -- permitido desde pending/eligible/partially_paid.
      null;
    elsif not (
      (old.status = 'pending' and new.status = 'eligible')
      or (old.status = 'eligible' and new.status in ('partially_paid', 'paid'))
      or (old.status = 'partially_paid' and new.status = 'paid')
    ) then
      raise exception 'Transición de estado inválida para una comisión: % -> %.', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_commission_records_status_transition on commission_records;
create trigger trg_commission_records_status_transition
  before update on commission_records
  for each row execute function trg_commission_record_status_transition();

-- =========================================================================
-- 8) fn_commission_eligible_amount — SQL/STABLE. Único lugar donde vive la
--    fórmula de proporcionalidad — tanto rpc_refresh_commission_eligibility
--    como rpc_register_commission_payment la reutilizan (nunca la
--    duplican).
-- =========================================================================
create or replace function fn_commission_eligible_amount(p_commission_record_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select round(cr.commission_amount * least(1, coalesce(so.amount_paid, 0) / nullif(so.total, 0)), 2)
  from commission_records cr
  join sales_orders so on so.id = cr.sales_order_id
  where cr.id = p_commission_record_id;
$$;

-- =========================================================================
-- 9) rpc_create_commission_record — SECURITY INVOKER, requiere
--    can_manage_commissions (sin admin por defecto). Nace desde la Sales Order (regla:
--    "comisión nace desde la Sales Order"); snapshotea regla/base/tasa;
--    calcula eligible_amount inicial contra el cobro YA existente (una
--    venta de contado ya cobrada al crear la comisión no debe nacer en
--    'pending').
-- =========================================================================
create or replace function rpc_create_commission_record(
  p_commission_id uuid,
  p_sales_order_id uuid,
  p_salesperson_id uuid,
  p_commission_rate numeric,
  p_commission_base numeric default null,
  p_rule_snapshot jsonb default null
)
returns commission_records
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cr commission_records;
  v_so sales_orders;
  v_sp_org uuid;
  v_base numeric(12,2);
  v_amount numeric(12,2);
  v_eligible numeric(12,2);
  v_status text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_has_commission_authority()) then
    raise exception 'Solo Dirección General o un usuario con autoridad de comisiones puede crear una comisión.';
  end if;
  if p_commission_rate is null or p_commission_rate < 0 or p_commission_rate > 100 then
    raise exception 'El porcentaje de comisión debe estar entre 0 y 100.';
  end if;

  -- Sin FOR UPDATE a propósito: 0073 nunca escribe en sales_orders, solo la
  -- lee. `FOR UPDATE` exige además satisfacer alguna policy de UPDATE de la
  -- tabla (Postgres RLS aplica las quals de UPDATE a los locking clauses),
  -- y can_manage_commissions deliberadamente NO tiene ninguna — bloquearía
  -- aquí incluso una lectura legítima (confirmado empíricamente).
  select * into v_so from sales_orders where id = p_sales_order_id;
  if v_so.id is null then
    raise exception 'rpc_create_commission_record: Sales Order % no encontrada.', p_sales_order_id;
  end if;
  if not is_organization_member(v_so.organization_id) then
    raise exception 'Esta Sales Order no pertenece a tu organización.';
  end if;
  if v_so.status in ('draft', 'cancelled') then
    raise exception 'No se puede crear una comisión sobre una Sales Order en draft o cancelada.';
  end if;

  select organization_id into v_sp_org from salespeople where id = p_salesperson_id;
  if v_sp_org is null then
    raise exception 'rpc_create_commission_record: vendedor % no encontrado.', p_salesperson_id;
  end if;
  if v_sp_org <> v_so.organization_id then
    raise exception 'El vendedor debe pertenecer a la misma organización que la Sales Order.';
  end if;

  if exists (
    select 1 from commission_records
    where sales_order_id = p_sales_order_id and salesperson_id = p_salesperson_id and status <> 'cancelled'
  ) then
    raise exception 'Ya existe una comisión activa para este vendedor sobre esta Sales Order. Cancélala antes de crear una nueva.';
  end if;

  v_base := coalesce(p_commission_base, v_so.subtotal);
  if v_base < 0 then
    raise exception 'La base de comisión no puede ser negativa.';
  end if;
  v_amount := round(v_base * p_commission_rate / 100, 2);

  insert into commission_records (
    id, organization_id, sales_order_id, salesperson_id,
    commission_rule_snapshot, commission_base, commission_rate, commission_amount,
    eligible_amount, paid_amount, status, created_by
  ) values (
    p_commission_id, v_so.organization_id, p_sales_order_id, p_salesperson_id,
    coalesce(p_rule_snapshot, jsonb_build_object('rate', p_commission_rate, 'base', v_base)),
    v_base, p_commission_rate, v_amount,
    0, 0, 'pending', auth.uid()
  )
  returning * into v_cr;

  v_eligible := fn_commission_eligible_amount(v_cr.id);
  v_status := case when v_eligible > 0 then 'eligible' else 'pending' end;

  if v_status <> 'pending' then
    update commission_records set eligible_amount = v_eligible, status = v_status where id = v_cr.id returning * into v_cr;
  end if;

  insert into commission_events (commission_record_id, event_type, previous_status, new_status, created_by)
    values (v_cr.id, 'created', null, v_cr.status, auth.uid());

  return v_cr;
end;
$$;

-- =========================================================================
-- 10) rpc_refresh_commission_eligibility — SECURITY INVOKER, requiere
--     can_manage_commissions (sin admin por defecto). UPDATE de conjunto (sin cron en
--     este entorno, mismo patrón que rpc_refresh_overdue_invoices, 0072):
--     recalcula eligible_amount/status de todas las comisiones no
--     terminales de la organización. Solo escribe (y solo genera evento)
--     cuando el valor realmente cambió.
-- =========================================================================
create or replace function rpc_refresh_commission_eligibility(
  p_organization_id uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_organization_id uuid := coalesce(p_organization_id, current_user_organization_id());
  v_updated integer := 0;
  v_row commission_records;
  v_new_eligible numeric(12,2);
  v_new_status text;
  v_prev_status text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_has_commission_authority()) then
    raise exception 'Solo Dirección General o un usuario con autoridad de comisiones puede refrescar la elegibilidad de comisiones.';
  end if;
  if not is_organization_member(v_organization_id) then
    raise exception 'Esta organización no es la tuya.';
  end if;

  for v_row in
    select * from commission_records
    where organization_id = v_organization_id and status not in ('paid', 'cancelled')
    for update
  loop
    v_new_eligible := fn_commission_eligible_amount(v_row.id);
    if v_new_eligible = v_row.eligible_amount then
      continue;
    end if;

    v_prev_status := v_row.status;
    v_new_status := case
      when v_row.paid_amount > 0 then 'partially_paid'
      when v_new_eligible > 0 then 'eligible'
      else 'pending'
    end;

    update commission_records set eligible_amount = v_new_eligible, status = v_new_status where id = v_row.id;
    v_updated := v_updated + 1;

    insert into commission_events (commission_record_id, event_type, amount, previous_status, new_status, created_by)
      values (v_row.id, 'eligibility_updated', v_new_eligible, v_prev_status, v_new_status, auth.uid());
  end loop;

  return v_updated;
end;
$$;

-- =========================================================================
-- 11) rpc_register_commission_payment — SECURITY INVOKER, requiere
--     can_manage_commissions (sin admin por defecto). Recalcula eligible_amount EN VIVO
--     (nunca confía en el valor persistido) antes de validar — "liberación
--     ligada a cobro real" es la autoridad real del tope de pago, más
--     estricta que el tope de commission_amount.
-- =========================================================================
create or replace function rpc_register_commission_payment(
  p_commission_record_id uuid,
  p_amount numeric,
  p_notes text default null
)
returns commission_records
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cr commission_records;
  v_live_eligible numeric(12,2);
  v_remaining numeric(12,2);
  v_new_paid numeric(12,2);
  v_new_status text;
  v_prev_status text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_has_commission_authority()) then
    raise exception 'Solo Dirección General o un usuario con autoridad de comisiones puede registrar un pago de comisión.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero.';
  end if;

  select * into v_cr from commission_records where id = p_commission_record_id for update;
  if v_cr.id is null then
    raise exception 'rpc_register_commission_payment: comisión % no encontrada.', p_commission_record_id;
  end if;
  if not is_organization_member(v_cr.organization_id) then
    raise exception 'Esta comisión no pertenece a tu organización.';
  end if;
  if v_cr.status = 'cancelled' then
    raise exception 'No se pueden registrar pagos sobre una comisión cancelada.';
  end if;
  if v_cr.status = 'paid' then
    raise exception 'Esta comisión ya está pagada en su totalidad.';
  end if;

  v_live_eligible := fn_commission_eligible_amount(v_cr.id);
  v_remaining := v_live_eligible - v_cr.paid_amount;

  if p_amount > v_remaining then
    raise exception 'El pago de % excede el saldo de comisión liberado por cobro real (elegible pendiente: %).', p_amount, v_remaining;
  end if;

  v_prev_status := v_cr.status;
  v_new_paid := v_cr.paid_amount + p_amount;
  v_new_status := case when v_new_paid >= v_cr.commission_amount then 'paid' else 'partially_paid' end;

  update commission_records set eligible_amount = v_live_eligible, paid_amount = v_new_paid, status = v_new_status
    where id = p_commission_record_id
    returning * into v_cr;

  insert into commission_events (commission_record_id, event_type, amount, previous_status, new_status, reason, created_by)
    values (p_commission_record_id, 'payment_registered', p_amount, v_prev_status, v_cr.status, p_notes, auth.uid());

  if v_cr.status = 'paid' and v_prev_status <> 'paid' then
    insert into commission_events (commission_record_id, event_type, previous_status, new_status, created_by)
      values (p_commission_record_id, 'paid', v_prev_status, v_cr.status, auth.uid());
  end if;

  return v_cr;
end;
$$;

-- =========================================================================
-- 12) rpc_cancel_commission_record — SECURITY INVOKER, requiere
--     can_manage_commissions (sin admin por defecto). Cancelación explícita, motivo
--     obligatorio. Nunca permitida desde 'paid' (mismo criterio que
--     rpc_cancel_invoice, 0072). Cancelar una comisión parcialmente pagada
--     NO revierte los pagos ya registrados — limitación MVP aceptada,
--     documentada (mismo criterio que 0072).
-- =========================================================================
create or replace function rpc_cancel_commission_record(
  p_commission_record_id uuid,
  p_reason text
)
returns commission_records
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cr commission_records;
  v_prev_status text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_has_commission_authority()) then
    raise exception 'Solo Dirección General o un usuario con autoridad de comisiones puede cancelar una comisión.';
  end if;
  if v_reason is null then
    raise exception 'Debes indicar un motivo para cancelar esta comisión.';
  end if;

  select * into v_cr from commission_records where id = p_commission_record_id for update;
  if v_cr.id is null then
    raise exception 'rpc_cancel_commission_record: comisión % no encontrada.', p_commission_record_id;
  end if;
  if not is_organization_member(v_cr.organization_id) then
    raise exception 'Esta comisión no pertenece a tu organización.';
  end if;
  if v_cr.status = 'cancelled' then
    raise exception 'Esta comisión ya está cancelada.';
  end if;
  if v_cr.status = 'paid' then
    raise exception 'No se puede cancelar una comisión ya pagada en su totalidad.';
  end if;

  v_prev_status := v_cr.status;

  update commission_records set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = v_reason
    where id = p_commission_record_id
    returning * into v_cr;

  insert into commission_events (commission_record_id, event_type, previous_status, new_status, reason, created_by)
    values (p_commission_record_id, 'cancelled', v_prev_status, 'cancelled', v_reason, auth.uid());

  return v_cr;
end;
$$;

commit;
