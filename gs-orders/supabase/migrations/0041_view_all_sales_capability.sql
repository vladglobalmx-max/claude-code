-- =========================================================================
-- THÖREN — Fase 6R.1B-1: Activación de visibilidad global (can_view_all_sales)
-- =========================================================================
-- OBJETIVO: ampliar ÚNICAMENTE las policies de SELECT donde hoy existe el
-- patrón "is_admin OR own" para que también reconozcan
-- current_user_has_capability('can_view_all_sales') (0040) como una
-- tercera vía de lectura — sin tocar ninguna policy de escritura, ningún
-- RPC, y sin conceder ninguna otra capability. Esta migración es 100%
-- aditiva sobre RLS ya existente: cada policy modificada agrega UNA rama
-- OR nueva, nunca reemplaza ni relaja las ramas existentes (admin sigue
-- viendo todo por is_admin; un vendedor sin la capability sigue viendo
-- solo lo suyo por la rama "own", sin cambio de comportamiento).
--
-- NO se asigna aquí ninguna capability a ningún usuario real — ver el
-- bloque de asignación SEPARADO entregado aparte para Supabase Cloud SQL
-- Editor (requiere confirmar los emails reales de Diana y Karla antes de
-- poder ejecutarse; no se pudo resolver su user_id de forma inequívoca
-- desde datos existentes en este repositorio).
--
-- =========================================================================
-- DECISIÓN — customers NO se toca
-- =========================================================================
-- Auditado antes de escribir esta migración: `customers_select_member`
-- (0018_core_customers.sql) es `is_organization_admin(organization_id) OR
-- (is_organization_member(organization_id) AND active = true)` — NO existe
-- ningún concepto de "propio" por vendedor en customers (no tiene columna
-- salesperson_id, nunca la tuvo). Los clientes YA son visibles para
-- cualquier miembro activo de la organización, con o sin
-- can_view_all_sales — no hay nada que ampliar aquí, tocar esta policy
-- sería un cambio sin propósito.
--
-- =========================================================================
-- DECISIÓN — alcance exacto: 5 tablas, solo SELECT
-- =========================================================================
-- quotes, orders, purchase_orders, inventory_reservations, deliveries —
-- exactamente las 5 tablas pedidas en 6R.1B-1 §3. NO se tocan tablas hijas
-- (purchase_order_items, inventory_reservation_events, delivery_items,
-- delivery_status_history, delivery_files) — quedan con su RLS actual sin
-- cambios; ver DECISIÓN final de este archivo con el hallazgo
-- correspondiente para la siguiente subfase.
--
-- =========================================================================
-- DECISIÓN — por qué "is_admin OR own OR has_capability" y no reemplazar
-- current_user_is_admin()/is_organization_admin() por has_capability()
-- =========================================================================
-- current_user_has_capability() (0040) YA hace bypass total para admin
-- internamente, pero se mantiene la rama admin explícita en cada policy
-- (redundante a propósito) por el mismo criterio de defensa en profundidad
-- ya usado en el proyecto (ej. PO create es admin-only tanto en RLS como
-- en el RPC, ver auditoría 6R.1) — la policy nunca depende únicamente del
-- comportamiento interno de una función que puede evolucionar en el
-- futuro. can_view_all_sales SOLO amplía SELECT: ninguna policy de
-- INSERT/UPDATE/DELETE se toca en esta migración, así que
-- can_view_all_sales no otorga ninguna capacidad de escritura por
-- construcción (no existe ninguna policy de escritura que la mencione).

begin;

-- =========================================================================
-- 1) quotes — agrega la rama can_view_all_sales, gateada igual que "own"
--    por is_organization_member(organization_id) (aislamiento cross-org:
--    current_user_has_capability() ya resuelve la organización desde el
--    propio usuario consultante, nunca desde esta fila, pero se repite el
--    gate explícitamente por consistencia con la rama "own" existente).
-- =========================================================================
drop policy if exists "quotes_select_own_or_admin" on quotes;
create policy "quotes_select_own_or_admin" on quotes
  for select using (
    is_organization_admin(organization_id)
    or (is_organization_member(organization_id) and salesperson_id = current_user_salesperson_id())
    or (is_organization_member(organization_id) and current_user_has_capability('can_view_all_sales'))
  );

-- =========================================================================
-- 2) orders
-- =========================================================================
drop policy if exists "orders_select_own_or_admin" on orders;
create policy "orders_select_own_or_admin" on orders
  for select using (
    is_organization_member(organization_id)
    and current_user_active()
    and (
      current_user_is_admin()
      or salesperson_id = current_user_salesperson_id()
      or current_user_has_capability('can_view_all_sales')
    )
  );

-- =========================================================================
-- 3) purchase_orders — SOLO lectura (INSERT/UPDATE siguen admin-only, sin
--    tocar; no hay policy de DELETE, sin cambios). "own" se deriva vía
--    join al order padre (purchase_orders no tiene salesperson_id propio).
-- =========================================================================
drop policy if exists "purchase_orders_select" on purchase_orders;
create policy "purchase_orders_select" on purchase_orders
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.id = purchase_orders.order_id
          and o.salesperson_id = current_user_salesperson_id()
      )
      or current_user_has_capability('can_view_all_sales')
    )
  );

-- =========================================================================
-- 4) inventory_reservations — SOLO lectura (no existe policy de escritura;
--    toda escritura va por RPC SECURITY DEFINER, sin tocar).
-- =========================================================================
drop policy if exists "inventory_reservations_select" on inventory_reservations;
create policy "inventory_reservations_select" on inventory_reservations
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.id = inventory_reservations.order_id
          and o.salesperson_id = current_user_salesperson_id()
      )
      or current_user_has_capability('can_view_all_sales')
    )
  );

-- =========================================================================
-- 5) deliveries — SOLO lectura (deliveries ya es SELECT-only en RLS, toda
--    escritura va por RPC SECURITY DEFINER, sin tocar).
-- =========================================================================
drop policy if exists "deliveries_select_own_or_admin" on deliveries;
create policy "deliveries_select_own_or_admin" on deliveries
  for select using (
    current_user_active() and is_organization_member(organization_id) and (
      current_user_is_admin()
      or exists (select 1 from orders o where o.id = deliveries.order_id and o.salesperson_id = current_user_salesperson_id())
      or current_user_has_capability('can_view_all_sales')
    )
  );

commit;

-- =========================================================================
-- AJUSTE (mismo archivo, misma fase 6R.1B-1) — coherencia encabezado ->
-- detalle. El hallazgo original de este archivo (visto en el reporte
-- inicial de 6R.1B-1) señalaba que las tablas hijas de detalle seguían
-- con su RLS "is_admin OR own" original: Diana/Karla verían el encabezado
-- de una Quote/Order/Purchase Order/Reservation/Delivery ajena pero NO su
-- detalle (partidas, imágenes, archivos, historial, eventos). Se resuelve
-- aquí mismo, sin crear 0042.
--
-- =========================================================================
-- DECISIÓN — tablas con policy `for all` (combina SELECT+INSERT+UPDATE+
-- DELETE en una sola policy): order_items_via_order, order_images_via_order,
-- order_files_via_order, order_item_images_via_order,
-- delivery_files_via_delivery. Modificar esas policies directamente
-- ampliaría también la escritura — INACEPTABLE (can_view_all_sales es
-- SOLO lectura). En su lugar se agrega, para cada una, una policy NUEVA
-- Y SEPARADA `for select` que solo añade la rama can_view_all_sales — en
-- Postgres, dos policies permisivas para el mismo comando se combinan con
-- OR, así que esto amplía el SELECT sin tocar en absoluto la policy `for
-- all` original (que sigue siendo la única autoridad sobre INSERT/UPDATE/
-- DELETE, exactamente igual que antes). Las demás tablas de este bloque
-- (quote_items, purchase_order_items, inventory_reservation_events,
-- delivery_items, delivery_status_history, order_operational_status_history)
-- YA tenían su policy de SELECT separada de cualquier policy de escritura
-- — esas se modifican directamente (drop + recreate), sin necesidad de una
-- policy adicional.
-- =========================================================================

begin;

-- =========================================================================
-- 6) quote_items — Quote detail. Requerido: sin esto, Diana/Karla verían
--    el encabezado de una Quote ajena pero no sus partidas.
-- =========================================================================
drop policy if exists "quote_items_select_own_or_admin" on quote_items;
create policy "quote_items_select_own_or_admin" on quote_items
  for select using (
    exists (
      select 1 from quotes q
      where q.id = quote_id
        and (
          is_organization_admin(q.organization_id)
          or (is_organization_member(q.organization_id) and q.salesperson_id = current_user_salesperson_id())
          or (is_organization_member(q.organization_id) and current_user_has_capability('can_view_all_sales'))
        )
    )
  );

-- =========================================================================
-- 7) Order detail — 5 tablas hijas requeridas para renderizar
--    correctamente (auditado contra get-order-detail.ts y
--    operational-status-history): order_items, order_images, order_files,
--    order_item_images (todas con policy `for all`, ver DECISIÓN — se
--    agrega una policy SELECT nueva y separada) y
--    order_operational_status_history (ya era SELECT-only, se modifica
--    directamente).
-- =========================================================================
drop policy if exists "order_items_select_can_view_all_sales" on order_items;
create policy "order_items_select_can_view_all_sales" on order_items
  for select using (
    current_user_active() and exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and is_organization_member(o.organization_id)
        and current_user_has_capability('can_view_all_sales')
    )
  );

drop policy if exists "order_item_images_select_can_view_all_sales" on order_item_images;
create policy "order_item_images_select_can_view_all_sales" on order_item_images
  for select using (
    current_user_active() and exists (
      select 1 from order_items oi
      join orders o on o.id = oi.order_id
      where oi.id = order_item_images.order_item_id
        and is_organization_member(o.organization_id)
        and current_user_has_capability('can_view_all_sales')
    )
  );

drop policy if exists "order_images_select_can_view_all_sales" on order_images;
create policy "order_images_select_can_view_all_sales" on order_images
  for select using (
    current_user_active() and exists (
      select 1 from orders o
      where o.id = order_images.order_id
        and is_organization_member(o.organization_id)
        and current_user_has_capability('can_view_all_sales')
    )
  );

drop policy if exists "order_files_select_can_view_all_sales" on order_files;
create policy "order_files_select_can_view_all_sales" on order_files
  for select using (
    current_user_active() and exists (
      select 1 from orders o
      where o.id = order_files.order_id
        and is_organization_member(o.organization_id)
        and current_user_has_capability('can_view_all_sales')
    )
  );

drop policy if exists "order_operational_status_history_via_order" on order_operational_status_history;
create policy "order_operational_status_history_via_order" on order_operational_status_history
  for select using (
    current_user_active() and exists (
      select 1 from orders o
      where o.id = order_operational_status_history.order_id
        and is_organization_member(o.organization_id)
        and (
          current_user_is_admin()
          or o.salesperson_id = current_user_salesperson_id()
          or current_user_has_capability('can_view_all_sales')
        )
    )
  );

-- =========================================================================
-- 8) purchase_order_items — Purchase Order detail (partidas). INSERT/
--    UPDATE siguen admin-only, sin tocar (ya eran policies separadas).
-- =========================================================================
drop policy if exists "purchase_order_items_select" on purchase_order_items;
create policy "purchase_order_items_select" on purchase_order_items
  for select using (
    current_user_active() and exists (
      select 1 from purchase_orders po
      where po.id = purchase_order_items.purchase_order_id
        and is_organization_member(po.organization_id)
        and (
          current_user_is_admin()
          or exists (
            select 1 from orders o
            where o.id = po.order_id
              and o.salesperson_id = current_user_salesperson_id()
          )
          or current_user_has_capability('can_view_all_sales')
        )
    )
  );

-- =========================================================================
-- 9) inventory_reservation_events — Reservation detail (historial). Sin
--    policy de escritura para `authenticated` (solo RPCs SECURITY
--    DEFINER) — nada que proteger de escritura aquí.
-- =========================================================================
drop policy if exists "inventory_reservation_events_select" on inventory_reservation_events;
create policy "inventory_reservation_events_select" on inventory_reservation_events
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.id = inventory_reservation_events.order_id
          and o.salesperson_id = current_user_salesperson_id()
      )
      or current_user_has_capability('can_view_all_sales')
    )
  );

-- =========================================================================
-- 10) Delivery detail — delivery_items y delivery_status_history ya eran
--     SELECT-only, se modifican directamente. delivery_files tiene policy
--     `for all` (delivery_files_via_delivery) — se agrega policy SELECT
--     separada, ver DECISIÓN arriba.
-- =========================================================================
drop policy if exists "delivery_items_select_own_or_admin" on delivery_items;
create policy "delivery_items_select_own_or_admin" on delivery_items
  for select using (
    current_user_active() and exists (
      select 1 from deliveries d
      join orders o on o.id = d.order_id
      where d.id = delivery_items.delivery_id
        and is_organization_member(d.organization_id)
        and (
          current_user_is_admin()
          or o.salesperson_id = current_user_salesperson_id()
          or current_user_has_capability('can_view_all_sales')
        )
    )
  );

drop policy if exists "delivery_status_history_select_own_or_admin" on delivery_status_history;
create policy "delivery_status_history_select_own_or_admin" on delivery_status_history
  for select using (
    current_user_active() and exists (
      select 1 from deliveries d
      join orders o on o.id = d.order_id
      where d.id = delivery_status_history.delivery_id
        and is_organization_member(d.organization_id)
        and (
          current_user_is_admin()
          or o.salesperson_id = current_user_salesperson_id()
          or current_user_has_capability('can_view_all_sales')
        )
    )
  );

drop policy if exists "delivery_files_select_can_view_all_sales" on delivery_files;
create policy "delivery_files_select_can_view_all_sales" on delivery_files
  for select using (
    current_user_active() and exists (
      select 1 from deliveries d
      join orders o on o.id = d.order_id
      where d.id = delivery_files.delivery_id
        and is_organization_member(d.organization_id)
        and current_user_has_capability('can_view_all_sales')
    )
  );

commit;
