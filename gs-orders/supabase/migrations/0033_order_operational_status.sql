-- =========================================================================
-- THÖREN — Fase 6H: Flujo Operativo y Estados de Pedidos
-- =========================================================================
-- OBJETIVO: convertir Pedidos en una herramienta de seguimiento operativo
-- (Pedido → En proceso → Ordenado a proveedor → En tránsito → Recibido →
-- Programado para entrega/instalación → Completado, con Cancelado como
-- salida en cualquier punto), con historial completo de cambios (quién,
-- cuándo). CERO cambios a Quotes. CERO dinero agregado a Orders.
--
-- =========================================================================
-- DECISIÓN — columna nueva `operational_status`, NO reemplaza `status`
-- =========================================================================
-- `orders.status` ('borrador'|'pedido'|'cerrado'|'cancelado', 0001) es un
-- GATE de flujo de captura: controla si el pedido sigue siendo un borrador
-- editable, si ya se envió a fábrica (gatea la validación de campos de
-- proyector, getMissingProjectorFields), y consume el folio. Ese mecanismo
-- ya está probado extensamente (0001-0032) y ninguna parte de esta fase
-- necesita cambiarlo.
--
-- El seguimiento pedido por el usuario ("Pedido, En proceso, Ordenado a
-- proveedor, En tránsito, Recibido, Programado para entrega/instalación,
-- Completado, Cancelado") es un eje DISTINTO: qué tan avanzado está el
-- cumplimiento logístico de un pedido YA enviado. Ni "Borrador" aparece en
-- esa lista, ni tiene sentido forzar que "cerrado"/"cancelado" (gate de
-- captura) colapsen 1:1 con "completado"/"cancelado" (seguimiento
-- operativo) — son preguntas distintas ("¿puedo seguir editando esto?" vs
-- "¿en qué paso de cumplimiento va?").
--
-- Por eso: `operational_status` es una columna NUEVA, independiente,
-- default 'pedido'. `status` no se toca en ninguna RPC de esta migración
-- (rpc_create_order/rpc_update_order/rpc_duplicate_order/
-- rpc_create_order_from_quote quedan bit-a-bit idénticas — de hecho no se
-- tocan en absoluto, ver DECISIÓN "cero cambios de RPC" abajo). Ambas
-- columnas conviven en el detalle/listado como dos badges distintos,
-- claramente etiquetados.
--
-- =========================================================================
-- DECISIÓN — cero cambios de RPC (rpc_create_order/rpc_update_order/
-- rpc_duplicate_order/rpc_create_order_from_quote)
-- =========================================================================
-- Los cuatro hacen `insert into orders (columna, columna, ...) values (...)`
-- o `update orders set columna = ..., columna = ...` con listas EXPLÍCITAS
-- de columnas (nunca `select *` ni `set *`). `operational_status` no
-- aparece en ninguna de esas listas, así que:
--   - rpc_create_order / rpc_create_order_from_quote: toda fila nueva cae
--     en el DEFAULT ('pedido') sin que la función necesite saberlo.
--   - rpc_update_order: nunca toca operational_status — editar un pedido
--     (Editar Pedido) nunca resetea ni pisa el seguimiento operativo.
--   - rpc_duplicate_order: un pedido duplicado es un pedido NUEVO — cae en
--     el DEFAULT ('pedido'), nunca copia el seguimiento/historial del
--     origen (correcto: el duplicado no heredó su trayectoria logística).
-- Consecuencia: esta migración es puramente aditiva a nivel de función —
-- cero riesgo de regresión en Quotes, folios, validación de proyector,
-- Quote→Order, ni RLS existente de `orders`.
--
-- =========================================================================
-- DECISIÓN — cambiar operational_status es un UPDATE directo, no una RPC
-- =========================================================================
-- Mismo patrón que ya usa `status` hoy: `setOrderStatus` en pedidos/
-- actions.ts hace `supabase.from("orders").update({ status }).eq("id", ...)`
-- sin RPC — protegido únicamente por la RLS de UPDATE ya existente en
-- `orders` (orders_update_own_or_admin, 0022: ADMIN ve/edita todo dentro de
-- su organización, VENDEDOR solo lo suyo). operational_status es solo otra
-- columna de esa misma fila, así que la MISMA policy ya la cubre — cero
-- RLS nueva en `orders`, cero función nueva para hacer el cambio. El
-- historial se resuelve con un TRIGGER (ver abajo), no con una RPC.
--
-- Transiciones: libres entre cualquiera de los 8 valores (igual que
-- `status` hoy — el Select de OrderStatusQuickActions no restringe
-- transiciones, cualquier ADMIN/VENDEDOR-dueño puede corregir un estado
-- mal puesto). No se modela como máquina de estados con pasos obligatorios
-- — es una herramienta de seguimiento, no un documento legal como Quotes
-- (que sí tiene transiciones restringidas por trg_quote_status_transition,
-- 0020, con estados terminales). Ningún valor de operational_status es
-- terminal/bloquea edición futura del campo.
--
-- =========================================================================
-- DECISIÓN — historial: tabla + trigger, no un array/jsonb en `orders`
-- =========================================================================
-- Requisito explícito: "No borrar historial al cambiar nuevamente de
-- estado" y "mantener historial visible". Una tabla `INSERT-only` protegida
-- por RLS (solo SELECT para authenticated, el INSERT lo hace
-- EXCLUSIVAMENTE un trigger SECURITY DEFINER) es más robusta que confiar en
-- que el código de la app siempre haga `append` sobre un jsonb — aquí es
-- IMPOSIBLE perder una fila de historial por un bug de la app: la escritura
-- ni siquiera está expuesta a `authenticated`. Mismo criterio de
-- integridad comercial ya aplicado en este proyecto (ej. congelar
-- warranty vía trigger en 0031 en vez de confiar en que el formulario no
-- lo edite).
--
-- El trigger fn_log_order_operational_status_change() corre en INSERT
-- (registra el estado inicial de todo pedido nuevo, previous_status=null)
-- y en UPDATE cuando operational_status cambia (WHEN new IS DISTINCT FROM
-- old — un UPDATE que no toca esta columna, como rpc_update_order, jamás
-- genera una fila de historial). Resuelve "quién" con auth.uid() +
-- snapshot de user_profiles.name en el momento del cambio (igual criterio
-- que client_name/product_type_name_snapshot en el resto del proyecto: si
-- el usuario cambia de nombre o se desactiva después, el historial sigue
-- mostrando quién lo hizo, con el nombre que tenía ese día).
--
-- =========================================================================
-- DECISIÓN — backfill de pedidos existentes
-- =========================================================================
-- Todo pedido existente recibe operational_status = 'pedido' por el
-- DEFAULT de la columna, EXCEPTO: status='cerrado' -> 'completado' (un
-- pedido ya cerrado, en los términos de este seguimiento nuevo, ya
-- terminó su ciclo) y status='cancelado' -> 'cancelado' (mapeo directo,
-- nunca inventa un estado intermedio que no existió). status='borrador' y
-- status='pedido' quedan en operational_status='pedido' — el primer paso
-- del seguimiento, sin inventar avance que no ocurrió. Se inserta además
-- UNA fila de historial "estado inicial" por cada pedido existente
-- (previous_status null, changed_by null, changed_by_name explicando que
-- es un backfill de esta migración) — nunca se inventan transiciones
-- intermedias que no se pueden reconstruir con los datos que existen hoy.
--
-- =========================================================================
-- DECISIÓN — RLS de order_operational_status_history
-- =========================================================================
-- Mismo patrón "via order" que order_items/order_images/order_files
-- (0011): el scoping de organización se hereda automáticamente vía el
-- `exists (select ... from orders o where o.id = ...)`, porque esa
-- subconsulta corre bajo la RLS propia de `orders` (is_organization_member
-- + admin-o-dueño). Solo SELECT para `authenticated` — sin policy de
-- INSERT/UPDATE/DELETE, así que ni un ADMIN puede escribir/editar/borrar
-- historial desde la app; solo el trigger (SECURITY DEFINER) puede.
-- =========================================================================

begin;

-- =========================================================================
-- 1) orders.operational_status
-- =========================================================================
alter table orders
  add column if not exists operational_status text not null default 'pedido'
    check (operational_status in (
      'pedido',
      'en_proceso',
      'ordenado_a_proveedor',
      'en_transito',
      'recibido',
      'programado_entrega_instalacion',
      'completado',
      'cancelado'
    ));

create index if not exists orders_operational_status_idx on orders (operational_status);

-- Backfill de pedidos ya existentes (ver DECISIÓN arriba) — corre una sola
-- vez, en el momento de aplicar esta migración; toda fila NUEVA a partir de
-- aquí ya nace con el DEFAULT correcto sin necesitar este UPDATE.
update orders set operational_status = 'completado' where status = 'cerrado';
update orders set operational_status = 'cancelado' where status = 'cancelado';

-- =========================================================================
-- 2) order_operational_status_history
-- =========================================================================
create table if not exists order_operational_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  previous_status text
    check (previous_status is null or previous_status in (
      'pedido', 'en_proceso', 'ordenado_a_proveedor', 'en_transito',
      'recibido', 'programado_entrega_instalacion', 'completado', 'cancelado'
    )),
  new_status text not null
    check (new_status in (
      'pedido', 'en_proceso', 'ordenado_a_proveedor', 'en_transito',
      'recibido', 'programado_entrega_instalacion', 'completado', 'cancelado'
    )),
  changed_by_user_id uuid references auth.users (id) on delete set null,
  -- Snapshot del nombre al momento del cambio (ver DECISIÓN arriba) — igual
  -- criterio que client_name/product_type_name_snapshot: nunca se
  -- recalcula contra user_profiles al leer, así que un cambio de nombre o
  -- una baja posterior del usuario no reescribe el historial.
  changed_by_name text,
  -- clock_timestamp() (hora real de ejecución), no now() (hora de inicio
  -- de la transacción) — dos cambios de estado dentro de la misma
  -- transacción deben quedar temporalmente distinguibles en el historial.
  changed_at timestamptz not null default clock_timestamp()
);

create index if not exists order_operational_status_history_order_idx
  on order_operational_status_history (order_id, changed_at desc);

-- Backfill: una fila "estado inicial" por cada pedido ya existente, con el
-- operational_status ya resuelto en el paso 1. previous_status/changed_by
-- quedan null a propósito — no se inventa quién ni desde qué estado se
-- llegó ahí, porque esa información no existe antes de esta migración.
insert into order_operational_status_history
  (order_id, previous_status, new_status, changed_by_user_id, changed_by_name, changed_at)
select id, null, operational_status, null, 'Backfill 0033 (estado inicial al migrar)', now()
from orders;

alter table order_operational_status_history enable row level security;

drop policy if exists "order_operational_status_history_via_order" on order_operational_status_history;
create policy "order_operational_status_history_via_order" on order_operational_status_history
  for select using (
    current_user_active() and exists (
      select 1 from orders o
      where o.id = order_operational_status_history.order_id
        and is_organization_member(o.organization_id)
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  );

-- =========================================================================
-- 3) Trigger — única vía de escritura hacia order_operational_status_history.
--    SECURITY DEFINER: order_operational_status_history no tiene policy de
--    INSERT para `authenticated`, así que sin este privilegio elevado el
--    propio trigger fallaría por RLS. Alcance mínimo: una sola inserción,
--    sin SQL dinámico, set search_path fijo (mismo patrón que
--    fn_salesperson_organization_id, 0022).
-- =========================================================================
create or replace function fn_log_order_operational_status_change()
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
    insert into order_operational_status_history
      (order_id, previous_status, new_status, changed_by_user_id, changed_by_name)
    values (new.id, null, new.operational_status, auth.uid(), v_changed_by_name);
  elsif tg_op = 'UPDATE' and new.operational_status is distinct from old.operational_status then
    insert into order_operational_status_history
      (order_id, previous_status, new_status, changed_by_user_id, changed_by_name)
    values (new.id, old.operational_status, new.operational_status, auth.uid(), v_changed_by_name);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_operational_status_history on orders;
create trigger trg_orders_operational_status_history
  after insert or update on orders
  for each row execute function fn_log_order_operational_status_change();

commit;
