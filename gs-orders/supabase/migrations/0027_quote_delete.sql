-- GS Orders — Migración 0027: THÖREN Eliminación de Cotizaciones
--
-- Permite a un ADMIN eliminar (hard delete) una Quote de su organización.
-- Hoy `quotes` NO tiene NINGUNA policy de DELETE (0020_core_quotes.sql lo
-- documenta explícitamente: "sin policy de DELETE en quotes (cancelación
-- es un status, no un borrado físico)") — por eso ninguna Quote puede
-- eliminarse todavía, ni siquiera por un ADMIN. Implementa exactamente lo
-- aprobado en "THÖREN — Eliminación de Cotizaciones" de esta misma sesión.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Agrega `quotes_delete_admin` — única policy nueva. ADMIN de la
--    organización real (is_organization_admin(organization_id), mismo
--    helper de siempre) puede eliminar cualquier Quote de su
--    organización, sin importar el status — la protección "no eliminar
--    si ya tiene un Pedido" NO vive en esta policy (ver punto 2): es una
--    regla de integridad referencial, no de autorización, así que le
--    corresponde al FK, no a RLS.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente, verificado
-- empíricamente contra Postgres real antes de escribir esta migración)
-- =========================================================================
-- - NO agrega ninguna policy ni cambio a `quote_items`. `quote_items.
--   quote_id references quotes(id) on delete cascade` (0020) ya garantiza
--   cero huérfanos. Se verificó explícitamente que el cascade de
--   `quote_items` NO queda bloqueado por su propia policy
--   `quote_items_delete_borrador_own_or_admin` (que exige status =
--   'borrador') al eliminar una Quote en cualquier otro status — un
--   DELETE ON CASCADE se ejecuta con la autoridad del propio motor de
--   integridad referencial de Postgres, no como un DELETE normal sujeto a
--   la RLS de la tabla referenciante. Confirmado con una Quote en status
--   'enviada' con 1 línea: el DELETE de la Quote eliminó su línea sin
--   ningún error de RLS y sin dejar huérfanos.
-- - NO agrega ningún CHECK, trigger ni función para bloquear "Quote con
--   Order" — ya es estructuralmente imposible sin ningún cambio: `orders.
--   source_quote_id references quotes(id) on delete restrict` (0023) ya
--   hace que Postgres rechace el DELETE con un error de foreign key
--   real si existe un Order asociado. Confirmado empíricamente: crear un
--   Order desde una Quote y luego intentar `delete from quotes` produce
--   `update or delete on table "quotes" violates foreign key constraint
--   "orders_source_quote_id_fkey"`. La app hace además un pre-chequeo de
--   lectura para mostrar el mensaje claro pedido por el usuario, pero la
--   protección REAL, que no depende del pre-chequeo ni del frontend, es
--   este FK — ya existía desde 0023, sin cambios aquí.
-- - NO relaja ninguna policy existente de `quotes`/`quote_items`
--   (select/insert/update sin cambios).
-- - NO toca `orders`, `order_items`, `rpc_create_order_from_quote`,
--   Business Units, Quote Commercial Terms (0025), Quote PDF.
-- - NO toca el motor de folios: `salesperson_quote_sequences.
--   sequence_current` es un contador independiente que solo avanza al
--   crear una Quote (fn_next_quote_folio, 0020) — eliminar una Quote no
--   lo modifica ni lo reduce, así que un folio eliminado nunca se
--   reutiliza (verificado por diseño, sin necesitar ningún cambio).
--
-- Como el resto del proyecto: idempotente (drop/create policy) y corre
-- completa en una sola transacción (begin/commit).

begin;

drop policy if exists "quotes_delete_admin" on quotes;
create policy "quotes_delete_admin" on quotes
  for delete using (is_organization_admin(organization_id));

commit;
