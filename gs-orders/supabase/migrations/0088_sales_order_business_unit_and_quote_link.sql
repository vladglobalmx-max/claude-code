-- THÖREN — Ticket A1 de la transición orders -> sales_orders: agrega a
-- `sales_orders` las dos columnas prerrequisito para que pueda ser el
-- Pedido oficial (Decisión confirmada en FASE 0 — `sales_orders` extendido,
-- `orders` queda legado/histórico).
--
-- =========================================================================
-- ALCANCE EXACTO — 100% aditivo, sin tocar RPCs/UI/RLS/conversión
-- =========================================================================
-- 1) `sales_orders.business_unit_id` — mismo patrón EXACTO que
--    `orders.business_unit_id` (0022_orders_v2_foundation.sql línea 122):
--    uuid NULLABLE, `references business_units (id) on delete restrict`,
--    sin NOT NULL (a diferencia de `quotes.business_unit_id`, que sí es
--    NOT NULL desde 0020 — `sales_orders` sigue aquí el patrón de `orders`,
--    no el de `quotes`, porque es la misma clase de entidad: un documento
--    ya existente al que se le agrega la columna después, con filas vivas
--    que deben seguir siendo válidas). Igual que en `orders`, no se agrega
--    ningún trigger ni constraint que valide que `business_unit_id`
--    pertenezca a la misma `organization_id` de la fila — esa validación
--    cross-org, en `orders`, vive en `rpc_create_order`/`rpc_update_order`
--    (capa de aplicación, no de esquema); aquí no se toca ningún RPC
--    todavía, así que por ahora el único resguardo es el FK normal (la
--    fila de `business_units` debe existir). Igual que en `orders`, se
--    agrega el índice simple equivalente (`orders_business_unit_idx`).
--
-- 2) `sales_orders.source_quote_id` — mismo patrón EXACTO que
--    `orders.source_quote_id` (0023_quote_to_order.sql líneas 97-101): uuid
--    NULLABLE, `references quotes (id) on delete restrict`, con índice
--    único PARCIAL `where source_quote_id is not null` (permite múltiples
--    NULL, único solo entre valores no-null) — mismo nombre que su
--    equivalente en orders, cambiando `orders` por `sales_orders`:
--    `sales_orders_source_quote_id_unique`. Esta es la protección REAL
--    contra que una misma Cotización genere más de un `sales_order` (igual
--    razonamiento que el comentario de 0023/0029 sobre
--    `orders_source_quote_id_unique`).
--
-- =========================================================================
-- FUERA DE ALCANCE A PROPÓSITO (instrucción explícita del ticket)
-- =========================================================================
-- - Ningún RPC se modifica: `rpc_create_sales_order_from_quote` (conversión
--   Cotización -> sales_order) es el ticket B1, posterior y separado.
-- - Ninguna pantalla/UI se modifica.
-- - Ningún backfill: las 3 filas de `sales_orders` existentes en producción
--   quedan con ambas columnas NULL — consistente con que ninguna de las 3
--   nació de una Cotización (confirmado en FASE 0) y con que la decisión
--   explícita del usuario fue "no migraremos los 7 orders actuales", lo
--   cual aplica por igual a no inventar un `business_unit_id` para
--   sales_orders ya existentes sin evidencia.
-- - RLS de `sales_orders`: NO se toca. Sus 3 policies (0067) ya filtran
--   exclusivamente por `organization_id` (`is_organization_admin`/
--   `is_organization_member`), igual que las de `orders` desde 0022 — la
--   nueva columna `business_unit_id` no participa en ninguna policy de
--   `orders` tampoco, así que no hay ninguna inconsistencia que esta
--   migración deba resolver a nivel RLS.
-- - `inventory_reservations`, `purchase_requisitions`, `sales_fulfillments`,
--   `invoices`, `commission_records`: ningún cambio. Fuera de alcance de
--   este ticket (fases C/D del plan de transición).
--
-- Como el resto del proyecto: idempotente (`add column if not exists`,
-- `create index/unique index if not exists`) y corre completa en una sola
-- transacción (begin/commit).

begin;

alter table sales_orders
  add column if not exists business_unit_id uuid references business_units (id) on delete restrict,
  add column if not exists source_quote_id uuid references quotes (id) on delete restrict;

create index if not exists sales_orders_business_unit_idx on sales_orders (business_unit_id);

create unique index if not exists sales_orders_source_quote_id_unique
  on sales_orders (source_quote_id)
  where source_quote_id is not null;

commit;
