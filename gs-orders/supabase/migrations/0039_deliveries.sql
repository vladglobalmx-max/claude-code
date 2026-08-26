-- =========================================================================
-- THÖREN — Fase 6P: Entregas e Instalaciones
-- =========================================================================
-- OBJETIVO: cerrar operativamente el ciclo Pedido → Compra → Recepción →
-- Inventario → Reserva → Surtido → Entrega/Instalación. Una Entrega
-- consume cantidades YA SURTIDAS (Fase 6O) — nunca vuelve a tocar
-- inventario (ON HAND/COMMITTED/AVAILABLE/INCOMING intactos, cero
-- inventory_movements nuevos). Cuando una partida de la Entrega/
-- Instalación queda COMPLETADA y, agregando todas las Entregas no
-- canceladas del Pedido, TODAS las partidas aplicables (con
-- catalog_product_id) quedan con pedido = surtido = entregado, se marca
-- automáticamente operational_status = 'completado' reutilizando el
-- mecanismo de historial de 0033 (Fase 6H) — cero tabla/lógica paralela.
--
-- =========================================================================
-- DECISIÓN — sin folio propio: identificador = secuencial POR PEDIDO
-- =========================================================================
-- El proyecto ya tiene TRES motores de folio independientes (Orders 0002,
-- Quotes 0020, Purchase Orders 0035) para documentos de negocio de primer
-- nivel visibles al cliente/proveedor. Una Entrega es un sub-documento del
-- Pedido, no un documento de negocio independiente — se le da un
-- `sequence_number` secuencial POR order_id (1, 2, 3...), mostrado en la
-- UI como "{folio del Pedido}-E{sequence_number}" (resuelto vía join,
-- nunca almacenado). Evita un CUARTO motor de secuencias para lo que es,
-- en esencia, un contador de líneas. Concurrencia: se bloquea la fila de
-- `orders` (`select ... for update`) antes de calcular
-- `max(sequence_number)+1` — reutiliza `orders` como mutex en vez de crear
-- una tabla de secuencias nueva.
--
-- =========================================================================
-- DECISIÓN — "surtido total del Pedido" = SUM(fulfilled_quantity) de TODAS
-- las reservas (activas o liberadas), nunca solo las activas
-- =========================================================================
-- `rpc_inventory_committed_levels` (6O) solo cuenta reservas ACTIVAS
-- (released_at is null) porque COMMITTED es "lo que sigue pendiente de
-- surtir ahora". Pero `fulfilled_quantity` es físico e IRREVERSIBLE (0038:
-- nunca se reduce, nunca se borra el movimiento) — una vez liberada la
-- reserva, lo ya surtido para ESE Pedido/producto sigue siendo un hecho
-- físico real. Por eso "surtido total" para las validaciones y el cálculo
-- de completitud de esta fase suma `fulfilled_quantity` de TODAS las
-- filas de `inventory_reservations` de ese Pedido+producto, sin filtrar
-- por `released_at` — es la verdad física completa, no el estado
-- administrativo de la reserva.
--
-- =========================================================================
-- DECISIÓN — solo partidas con catalog_product_id son "entregables" y
-- "aplicables" para la completitud automática
-- =========================================================================
-- Igual criterio que Reservas (0037) y Surtido (0038): una línea manual
-- sin catalog_product_id no tiene "surtido" que rastrear, así que tampoco
-- puede tener "entregado". El enunciado mismo dice "para todas las
-- partidas APLICABLES" — se interpreta como las que tienen
-- catalog_product_id. Si un Pedido no tiene ninguna partida así, la
-- completitud automática nunca se dispara (nada que verificar), sin
-- bloquear el resto del módulo.
--
-- =========================================================================
-- DECISIÓN — items de una Entrega son INMUTABLES una vez creados
-- =========================================================================
-- Mismo criterio que purchase_order_items: "no hay edición de partidas
-- una vez creada" — si se registró mal una cantidad, se CANCELA la
-- Entrega (nunca se borra, nunca se edita el número) y se crea una nueva.
-- `delivery_items` no tiene policy de UPDATE/DELETE en absoluto (más
-- estricto incluso que purchase_order_items, que sí permite actualizar
-- quantity_received vía la RPC de recepción — aquí ni eso: una Entrega
-- completa se crea de una vez con sus partidas finales).
--
-- =========================================================================
-- DECISIÓN — permisos "propio o admin" (igual que Orders/Reservas), NO
-- admin-only como Compras
-- =========================================================================
-- El enunciado de esta fase es explícito: "ADMIN: acceso completo.
-- VENDEDOR: acceso a entregas de sus propios Pedidos" — mismo criterio que
-- `orders_update_own_or_admin`. A diferencia de Compras (ADMIN-only) y de
-- los movimientos de Inventory (ADMIN-only), aquí SÍ hay policies reales
-- de INSERT/UPDATE para `authenticated` (own-or-admin) — las RPCs de
-- creación/edición son SECURITY INVOKER (confían en esa RLS para
-- autorizar), igual patrón que rpc_create_order/rpc_create_quote.
--
-- =========================================================================
-- DECISIÓN — completitud automática vive en UN trigger, no en la RPC
-- =========================================================================
-- La RPC de cambio de estado (`rpc_update_delivery_status`) solo valida
-- transiciones y actualiza la fila. El trigger `trg_deliveries_status_history`
-- (AFTER INSERT OR UPDATE, mismo patrón exacto que 0033) hace DOS cosas:
-- 1) registra el historial en `delivery_status_history`, 2) si el nuevo
-- estado es 'completada' (y antes no lo era), llama a
-- `fn_check_order_delivery_completion(order_id)`, que es la ÚNICA función
-- que puede escribir `orders.operational_status = 'completado'` desde esta
-- fase. Esto garantiza que la verificación corra sin importar la vía de
-- escritura (RPC o, en teoría, un UPDATE directo bajo la misma RLS) —
-- mismo espíritu que 0033 ("cero RPC nueva, la misma policy ya lo cubre"),
-- adaptado aquí porque sí hace falta un guard de "estado final" que una
-- policy no puede expresar.
--
-- =========================================================================
-- DECISIÓN — evidencia: se reutiliza Storage existente, CERO cambios a
-- storage.objects
-- =========================================================================
-- Los buckets `order-media`/`order-files` (0003/0011) ya autorizan
-- SELECT por el PRIMER segmento de la ruta = order_id
-- (`(storage.foldername(objects.name))[1]`). Subiendo evidencia bajo
-- `{orderId}/entregas/{deliveryId}/...` (fotos, bucket order-media) o
-- `{orderId}/...` (documento, bucket order-files) las policies de
-- storage.objects YA protegen la evidencia sin tocarlas — solo se agrega
-- `delivery_files`, una tabla de metadatos (mismo rol que
-- order_images/order_files), y se reutilizan
-- `uploadOrderMedia`/`uploadOrderFile` de storage-actions.ts tal cual.
--
-- =========================================================================
-- FUERA DE ALCANCE de esta migración (ver enunciado completo de la fase)
-- =========================================================================
-- Facturación, cobranza, costos/márgenes, firma digital, rutas/logística,
-- GPS, notificaciones, órdenes de servicio complejas, cambios a
-- Purchasing, cambios al cálculo de Inventory (ON HAND/COMMITTED/
-- AVAILABLE/INCOMING intactos, verificado — cero inventory_movements
-- nuevos en toda esta migración).
-- =========================================================================

begin;

-- =========================================================================
-- 1) deliveries — una fila por Entrega/Instalación, ligada a un Pedido.
-- =========================================================================
create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  order_id uuid not null references orders (id) on delete cascade,
  sequence_number integer not null,
  delivery_type text not null
    check (delivery_type in ('entrega', 'instalacion', 'entrega_instalacion')),
  status text not null default 'programada'
    check (status in ('programada', 'en_proceso', 'completada', 'cancelada')),
  scheduled_date date,
  actual_datetime timestamptz,
  address text,
  contact_name text,
  contact_phone text,
  responsible_name text,
  -- Solo aplica si delivery_type incluye instalación (ver CHECK abajo).
  installer_name text,
  installation_datetime timestamptz,
  installation_notes text,
  notes text,
  -- Recepción del cliente (requisito #6) — estructura preparada para
  -- firma/evidencia futura (6Q+), sin implementar firma digital aquí.
  received_by_name text,
  customer_observations text,
  completed_at timestamptz,
  created_by_user_id uuid not null,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deliveries_order_sequence_unique unique (order_id, sequence_number),
  constraint deliveries_installation_fields_check check (
    delivery_type in ('instalacion', 'entrega_instalacion')
    or (installer_name is null and installation_datetime is null and installation_notes is null)
  )
);

create index if not exists deliveries_organization_idx on deliveries (organization_id);
create index if not exists deliveries_order_idx on deliveries (order_id);
create index if not exists deliveries_status_idx on deliveries (status);

drop trigger if exists trg_deliveries_updated_at on deliveries;
create trigger trg_deliveries_updated_at
  before update on deliveries
  for each row execute function set_updated_at();

alter table deliveries enable row level security;

-- Limpieza defensiva por si una iteración anterior de esta misma migración
-- (antes de fijar el diseño "solo RPCs SECURITY DEFINER escriben aquí",
-- ver DECISIÓN abajo) llegó a crear policies de escritura directa.
drop policy if exists "deliveries_insert_own_or_admin" on deliveries;
drop policy if exists "deliveries_update_own_or_admin" on deliveries;

drop policy if exists "deliveries_select_own_or_admin" on deliveries;
create policy "deliveries_select_own_or_admin" on deliveries
  for select using (
    current_user_active() and is_organization_member(organization_id) and (
      current_user_is_admin()
      or exists (select 1 from orders o where o.id = deliveries.order_id and o.salesperson_id = current_user_salesperson_id())
    )
  );

-- Sin policy de INSERT/UPDATE/DELETE para `authenticated` — mismo patrón
-- exacto que inventory_reservations (0037): todas las escrituras pasan por
-- RPCs SECURITY DEFINER (sección 5/6) que validan cross-org/pertenencia/
-- permiso "propio o admin" EXPLÍCITAMENTE en el cuerpo de la función,
-- nunca delegado a RLS. Se eligió este patrón (y no INSERT/UPDATE RLS
-- directas) porque la creación/edición de una Entrega siempre requiere
-- validar cantidades cruzando `inventory_reservations`/`delivery_items`
-- (algo que una policy no puede expresar) — dado que la RPC YA necesita
-- ser el único camino de escritura, mantener además políticas RLS de
-- escritura sería redundante y, peor, daría mensajes de error inconsistentes
-- (bajo SECURITY INVOKER, "no tienes permiso" y "no existe" se confunden
-- según lo que la RLS ya haya filtrado antes de que la RPC pueda
-- distinguirlos).

-- =========================================================================
-- 2) delivery_items — partidas de la Entrega, snapshot de order_items
--    (nunca se vuelve a consultar order_items para reconstruir lo
--    mostrado). INMUTABLES una vez creadas — ver DECISIÓN arriba.
-- =========================================================================
create table if not exists delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries (id) on delete cascade,
  catalog_product_id uuid not null references product_catalog (id) on delete restrict,
  model text not null,
  description text,
  unit text,
  quantity_delivered integer not null check (quantity_delivered > 0),
  created_at timestamptz not null default now()
);

create index if not exists delivery_items_delivery_idx on delivery_items (delivery_id);
create index if not exists delivery_items_catalog_product_idx on delivery_items (catalog_product_id);

alter table delivery_items enable row level security;

drop policy if exists "delivery_items_insert_own_or_admin" on delivery_items;

drop policy if exists "delivery_items_select_own_or_admin" on delivery_items;
create policy "delivery_items_select_own_or_admin" on delivery_items
  for select using (
    current_user_active() and exists (
      select 1 from deliveries d
      join orders o on o.id = d.order_id
      where d.id = delivery_items.delivery_id
        and is_organization_member(d.organization_id)
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  );

-- Sin policy de INSERT/UPDATE/DELETE — solo rpc_create_delivery (SECURITY
-- DEFINER) escribe aquí, ver DECISIÓN arriba sobre `deliveries`.

-- =========================================================================
-- 3) delivery_status_history — ledger insert-only de cada cambio de
--    estado (requisito #13: quién/cuándo). Mismo patrón exacto que
--    order_operational_status_history (0033). Sin policy de insert/
--    update/delete — solo el trigger de la sección 6 escribe aquí.
-- =========================================================================
create table if not exists delivery_status_history (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries (id) on delete cascade,
  previous_status text
    check (previous_status is null or previous_status in ('programada', 'en_proceso', 'completada', 'cancelada')),
  new_status text not null
    check (new_status in ('programada', 'en_proceso', 'completada', 'cancelada')),
  changed_by_user_id uuid references auth.users (id) on delete set null,
  changed_by_name text,
  changed_at timestamptz not null default clock_timestamp()
);

create index if not exists delivery_status_history_delivery_idx on delivery_status_history (delivery_id, changed_at desc);

alter table delivery_status_history enable row level security;

drop policy if exists "delivery_status_history_select_own_or_admin" on delivery_status_history;
create policy "delivery_status_history_select_own_or_admin" on delivery_status_history
  for select using (
    current_user_active() and exists (
      select 1 from deliveries d
      join orders o on o.id = d.order_id
      where d.id = delivery_status_history.delivery_id
        and is_organization_member(d.organization_id)
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  );

-- =========================================================================
-- 4) delivery_files — evidencia (fotos/documento) de una Entrega. Mismo
--    rol que order_images/order_files; los storage_path apuntan a los
--    buckets EXISTENTES order-media/order-files (ver DECISIÓN arriba) —
--    cero cambios a storage.objects.
-- =========================================================================
create table if not exists delivery_files (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries (id) on delete cascade,
  kind text not null check (kind in ('foto', 'documento')),
  storage_path text not null,
  file_name text not null,
  file_type text,
  file_size bigint,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists delivery_files_delivery_idx on delivery_files (delivery_id);

alter table delivery_files enable row level security;

drop policy if exists "delivery_files_via_delivery" on delivery_files;
create policy "delivery_files_via_delivery" on delivery_files
  for all using (
    current_user_active() and exists (
      select 1 from deliveries d
      join orders o on o.id = d.order_id
      where d.id = delivery_files.delivery_id
        and is_organization_member(d.organization_id)
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  ) with check (
    current_user_active() and exists (
      select 1 from deliveries d
      join orders o on o.id = d.order_id
      where d.id = delivery_files.delivery_id
        and is_organization_member(d.organization_id)
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  );

-- =========================================================================
-- 5) rpc_create_delivery — crea la Entrega + sus partidas en una sola
--    transacción. SECURITY INVOKER: confía en las policies de INSERT de
--    arriba (own-or-admin) para autorizar — mismo patrón que
--    rpc_create_order/rpc_create_quote. Valida cross-org, pertenencia al
--    Pedido, y el tope real (surtido total - ya entregado no cancelado).
-- =========================================================================
create or replace function rpc_create_delivery(
  p_delivery_id uuid,
  p_delivery jsonb,
  p_items jsonb default '[]'::jsonb
)
returns deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_order_id uuid;
  v_order_organization_id uuid;
  v_order_salesperson_id uuid;
  v_delivery_type text;
  v_sequence_number integer;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_delivery deliveries;
  v_item jsonb;
  v_catalog_product_id uuid;
  v_quantity integer;
  v_src_model text;
  v_src_description text;
  v_src_unit text;
  v_fulfilled integer;
  v_previously_delivered integer;
  v_available integer;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  v_organization_id := current_user_organization_id();
  v_order_id := nullif(p_delivery->>'order_id', '')::uuid;

  select organization_id, salesperson_id into v_order_organization_id, v_order_salesperson_id
    from orders where id = v_order_id;
  if v_order_organization_id is null then
    raise exception 'Pedido no encontrado: %', v_order_id;
  end if;
  if v_order_organization_id <> v_organization_id then
    raise exception 'El Pedido no pertenece a tu organización.';
  end if;
  if not current_user_is_admin() and v_order_salesperson_id <> current_user_salesperson_id() then
    raise exception 'No tienes permiso para crear entregas sobre este Pedido.';
  end if;

  v_delivery_type := p_delivery->>'delivery_type';
  if v_delivery_type not in ('entrega', 'instalacion', 'entrega_instalacion') then
    raise exception '"%" no es un tipo de entrega válido.', v_delivery_type;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Una entrega debe incluir al menos una partida.';
  end if;

  -- Bloquea la fila del Pedido como mutex para calcular el siguiente
  -- sequence_number sin colisión entre Entregas concurrentes del mismo
  -- Pedido — ver DECISIÓN "sin folio propio" arriba.
  perform 1 from orders where id = v_order_id for update;
  select coalesce(max(sequence_number), 0) + 1 into v_sequence_number from deliveries where order_id = v_order_id;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

  insert into deliveries (
    id, organization_id, order_id, sequence_number, delivery_type, status,
    scheduled_date, actual_datetime, address, contact_name, contact_phone,
    responsible_name, installer_name, installation_datetime, installation_notes,
    notes, received_by_name, customer_observations,
    created_by_user_id, created_by_name
  ) values (
    p_delivery_id, v_organization_id, v_order_id, v_sequence_number, v_delivery_type, 'programada',
    nullif(p_delivery->>'scheduled_date', '')::date,
    nullif(p_delivery->>'actual_datetime', '')::timestamptz,
    nullif(p_delivery->>'address', ''),
    nullif(p_delivery->>'contact_name', ''),
    nullif(p_delivery->>'contact_phone', ''),
    nullif(p_delivery->>'responsible_name', ''),
    nullif(p_delivery->>'installer_name', ''),
    nullif(p_delivery->>'installation_datetime', '')::timestamptz,
    nullif(p_delivery->>'installation_notes', ''),
    nullif(p_delivery->>'notes', ''),
    nullif(p_delivery->>'received_by_name', ''),
    nullif(p_delivery->>'customer_observations', ''),
    v_user_id, coalesce(v_user_name, '—')
  )
  returning * into v_delivery;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    v_quantity := nullif(v_item->>'quantity_delivered', '')::integer;

    if v_catalog_product_id is null then
      raise exception 'Cada partida de la entrega requiere un producto de catálogo.';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad a entregar debe ser mayor a cero.';
    end if;

    select model, description, unit into v_src_model, v_src_description, v_src_unit
      from order_items where order_id = v_order_id and catalog_product_id = v_catalog_product_id
      limit 1;
    if v_src_model is null then
      raise exception 'El producto % no forma parte de las partidas de este Pedido.', v_catalog_product_id;
    end if;

    -- Surtido total = TODAS las reservas del Pedido+producto (activas o
    -- liberadas) — ver DECISIÓN arriba. Ya entregado = solo Entregas NO
    -- canceladas.
    select coalesce(sum(fulfilled_quantity), 0) into v_fulfilled
      from inventory_reservations
      where order_id = v_order_id and product_id = v_catalog_product_id;
    select coalesce(sum(di.quantity_delivered), 0) into v_previously_delivered
      from delivery_items di
      join deliveries d on d.id = di.delivery_id
      where d.order_id = v_order_id and d.status <> 'cancelada' and di.catalog_product_id = v_catalog_product_id;
    v_available := v_fulfilled - v_previously_delivered;

    if v_quantity > v_available then
      raise exception 'No puedes entregar más de lo surtido disponible (surtido: %, ya entregado: %, disponible: %, solicitado: %).',
        v_fulfilled, v_previously_delivered, v_available, v_quantity;
    end if;

    insert into delivery_items (delivery_id, catalog_product_id, model, description, unit, quantity_delivered)
    values (v_delivery.id, v_catalog_product_id, v_src_model, v_src_description, v_src_unit, v_quantity);
  end loop;

  return v_delivery;
end;
$$;

-- =========================================================================
-- 6) rpc_update_delivery_status + trigger de historial/completitud.
-- =========================================================================

-- DECISIÓN — "entregado" tiene DOS agregados distintos, a propósito
-- =========================================================================
-- (a) Para prevenir sobre-reservar el mismo surtido entre varios
--     documentos de Entrega (rpc_create_delivery, requisito #12), "ya
--     entregado" cuenta CUALQUIER Entrega no cancelada
--     (programada/en_proceso/completada) — dos Entregas 'programada' no
--     pueden reclamar las mismas unidades surtidas aunque ninguna se haya
--     completado todavía. Esto también es lo que expone
--     `rpc_order_delivery_progress` (usado por la UI para calcular cuánto
--     se puede seguir entregando) y coincide con los ejemplos obligatorios
--     de la fase (requisito #3): "pendiente" baja al CREAR la Entrega, no
--     al completarla.
-- (b) Para decidir si el PEDIDO completo terminó (requisito #9),
--     "entregado" cuenta SOLO Entregas con status = 'completada'. Si se
--     usara el mismo agregado que (a), crear dos Entregas 'programada' que
--     sumen el 100% del surtido —sin haber completado NINGUNA— ya
--     satisfaría pedido=surtido=entregado y marcaría el Pedido como
--     completado sin que nada se haya entregado realmente. Por eso
--     `fn_check_order_delivery_completion` usa su propio agregado
--     filtrado a 'completada', distinto del expuesto por
--     rpc_order_delivery_progress.
--
-- fn_check_order_delivery_completion — única función que puede escribir
-- orders.operational_status = 'completado' desde esta fase. SECURITY
-- DEFINER por explicitud (aunque quien llega aquí ya tiene permiso de
-- escritura sobre esa Order vía la misma condición own-or-admin, se
-- declara sin ambigüedad — mismo criterio de cautela que 0033).
create or replace function fn_check_order_delivery_completion(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_applicable_count integer;
  v_all_complete boolean;
  v_current_status text;
begin
  select count(*) into v_applicable_count
  from (select distinct catalog_product_id from order_items where order_id = p_order_id and catalog_product_id is not null) p;

  if v_applicable_count = 0 then
    return;
  end if;

  select bool_and(t.ordered = t.fulfilled and t.fulfilled = t.delivered) into v_all_complete
  from (
    select
      oi.catalog_product_id,
      sum(oi.quantity) as ordered,
      coalesce((
        select sum(ir.fulfilled_quantity) from inventory_reservations ir
        where ir.order_id = p_order_id and ir.product_id = oi.catalog_product_id
      ), 0) as fulfilled,
      coalesce((
        select sum(di.quantity_delivered) from delivery_items di
        join deliveries d on d.id = di.delivery_id
        where d.order_id = p_order_id and d.status = 'completada' and di.catalog_product_id = oi.catalog_product_id
      ), 0) as delivered
    from order_items oi
    where oi.order_id = p_order_id and oi.catalog_product_id is not null
    group by oi.catalog_product_id
  ) t;

  if not coalesce(v_all_complete, false) then
    return;
  end if;

  select operational_status into v_current_status from orders where id = p_order_id;
  if v_current_status in ('completado', 'cancelado') then
    return;
  end if;

  update orders
    set operational_status = 'completado',
        actual_completion_date = coalesce(actual_completion_date, current_date)
    where id = p_order_id;
end;
$$;

-- fn_log_delivery_status_change — mismo patrón exacto que
-- fn_log_order_operational_status_change (0033): registra el historial en
-- INSERT/UPDATE de status, y en la transición hacia 'completada' dispara
-- la verificación de completitud del Pedido completo.
create or replace function fn_log_delivery_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed_by_name text;
begin
  select name into v_changed_by_name from user_profiles where user_id = auth.uid();

  if tg_op = 'INSERT' then
    insert into delivery_status_history (delivery_id, previous_status, new_status, changed_by_user_id, changed_by_name)
    values (new.id, null, new.status, auth.uid(), v_changed_by_name);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into delivery_status_history (delivery_id, previous_status, new_status, changed_by_user_id, changed_by_name)
    values (new.id, old.status, new.status, auth.uid(), v_changed_by_name);
  end if;

  if new.status = 'completada' and (tg_op = 'INSERT' or old.status is distinct from 'completada') then
    perform fn_check_order_delivery_completion(new.order_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_deliveries_status_history on deliveries;
create trigger trg_deliveries_status_history
  after insert or update on deliveries
  for each row execute function fn_log_delivery_status_change();

-- rpc_update_delivery_status — valida transición (estados finales
-- 'completada'/'cancelada' bloquean cualquier cambio posterior, igual
-- criterio que 'cancelada' en Purchase Orders) y actualiza; toda la lógica
-- de historial/completitud vive en el trigger de arriba — corre siempre,
-- sin importar la RPC, porque `deliveries` no tiene otra vía de escritura.
create or replace function rpc_update_delivery_status(
  p_delivery_id uuid,
  p_status text
)
returns deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery deliveries;
  v_order_salesperson_id uuid;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  if p_status not in ('programada', 'en_proceso', 'completada', 'cancelada') then
    raise exception '"%" no es un estado válido de entrega.', p_status;
  end if;

  select * into v_delivery from deliveries where id = p_delivery_id;
  if v_delivery.id is null then
    raise exception 'Entrega no encontrada: %', p_delivery_id;
  end if;
  if not is_organization_member(v_delivery.organization_id) then
    raise exception 'Esta entrega no pertenece a tu organización.';
  end if;
  select salesperson_id into v_order_salesperson_id from orders where id = v_delivery.order_id;
  if not current_user_is_admin() and v_order_salesperson_id <> current_user_salesperson_id() then
    raise exception 'No tienes permiso para cambiar el estado de esta entrega.';
  end if;
  if v_delivery.status in ('completada', 'cancelada') then
    raise exception 'Esta entrega ya está en un estado final (%) y no puede cambiar de estado.', v_delivery.status;
  end if;

  update deliveries
    set status = p_status,
        completed_at = case when p_status = 'completada' then clock_timestamp() else completed_at end
    where id = p_delivery_id
    returning * into v_delivery;

  return v_delivery;
end;
$$;

-- =========================================================================
-- 7) rpc_update_delivery_details — edita solo cabecera (fechas/contacto/
--    responsable/instalación/notas/recepción cliente). Bloqueado si la
--    Entrega ya está en un estado final. Nunca toca partidas ni estado.
-- =========================================================================
create or replace function rpc_update_delivery_details(
  p_delivery_id uuid,
  p_delivery jsonb
)
returns deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery deliveries;
  v_order_salesperson_id uuid;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  select * into v_delivery from deliveries where id = p_delivery_id;
  if v_delivery.id is null then
    raise exception 'Entrega no encontrada: %', p_delivery_id;
  end if;
  if not is_organization_member(v_delivery.organization_id) then
    raise exception 'Esta entrega no pertenece a tu organización.';
  end if;
  select salesperson_id into v_order_salesperson_id from orders where id = v_delivery.order_id;
  if not current_user_is_admin() and v_order_salesperson_id <> current_user_salesperson_id() then
    raise exception 'No tienes permiso para editar esta entrega.';
  end if;
  if v_delivery.status in ('completada', 'cancelada') then
    raise exception 'No se pueden editar los datos de una entrega en estado %.', v_delivery.status;
  end if;

  update deliveries set
    scheduled_date = nullif(p_delivery->>'scheduled_date', '')::date,
    actual_datetime = nullif(p_delivery->>'actual_datetime', '')::timestamptz,
    address = nullif(p_delivery->>'address', ''),
    contact_name = nullif(p_delivery->>'contact_name', ''),
    contact_phone = nullif(p_delivery->>'contact_phone', ''),
    responsible_name = nullif(p_delivery->>'responsible_name', ''),
    installer_name = nullif(p_delivery->>'installer_name', ''),
    installation_datetime = nullif(p_delivery->>'installation_datetime', '')::timestamptz,
    installation_notes = nullif(p_delivery->>'installation_notes', ''),
    notes = nullif(p_delivery->>'notes', ''),
    received_by_name = nullif(p_delivery->>'received_by_name', ''),
    customer_observations = nullif(p_delivery->>'customer_observations', '')
  where id = p_delivery_id
  returning * into v_delivery;

  return v_delivery;
end;
$$;

-- =========================================================================
-- 8) rpc_order_delivery_progress — pedido/surtido/entregado/pendiente por
--    producto de catálogo de UN Pedido. SECURITY INVOKER: la visibilidad
--    que necesita (inventory_reservations/delivery_items del Pedido) es
--    EXACTAMENTE la misma que ya tiene quien puede ver ese Pedido
--    (own-or-admin) — a diferencia de Inventory (6M/6N), aquí no hace
--    falta bypassear RLS porque no hay descalce de visibilidad.
-- =========================================================================
create or replace function rpc_order_delivery_progress(p_order_id uuid)
returns table (
  catalog_product_id uuid,
  ordered integer,
  fulfilled integer,
  delivered integer,
  pending_to_deliver integer
)
language sql
stable
as $$
  select
    oi.catalog_product_id,
    sum(oi.quantity)::integer as ordered,
    coalesce((
      select sum(ir.fulfilled_quantity) from inventory_reservations ir
      where ir.order_id = p_order_id and ir.product_id = oi.catalog_product_id
    ), 0)::integer as fulfilled,
    coalesce((
      select sum(di.quantity_delivered) from delivery_items di
      join deliveries d on d.id = di.delivery_id
      where d.order_id = p_order_id and d.status <> 'cancelada' and di.catalog_product_id = oi.catalog_product_id
    ), 0)::integer as delivered,
    (
      coalesce((
        select sum(ir.fulfilled_quantity) from inventory_reservations ir
        where ir.order_id = p_order_id and ir.product_id = oi.catalog_product_id
      ), 0)
      - coalesce((
        select sum(di.quantity_delivered) from delivery_items di
        join deliveries d on d.id = di.delivery_id
        where d.order_id = p_order_id and d.status <> 'cancelada' and di.catalog_product_id = oi.catalog_product_id
      ), 0)
    )::integer as pending_to_deliver
  from order_items oi
  where oi.order_id = p_order_id and oi.catalog_product_id is not null
  group by oi.catalog_product_id;
$$;

commit;
