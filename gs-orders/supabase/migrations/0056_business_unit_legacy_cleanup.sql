-- =========================================================================
-- THÖREN — Fase 8B: retirar la autoridad legacy de business_unit
-- (salespeople/orders) — NO destructiva, NO drop column
-- =========================================================================
-- HALLAZGO (smoke test Tenant B): `salespeople.business_unit` y
-- `orders.business_unit` son columnas text con
-- `default 'thunder' check (business_unit in ('thunder','juno_promotional',
-- 'got_fresh_breath','the_fire_spot'))` — 4 valores fijos de Global
-- Supplier, desde 0001_core.sql. YA estaban documentadas como deprecated
-- desde 0022 ("`orders.business_unit` (legacy, 4 valores fijos) y
-- `salespeople.business_unit` NO se tocan... quedan documentados como
-- deprecated pero compatibles"): la relación REAL con Business Units vive
-- en `orders.business_unit_id` (uuid, FK real a business_units, ya
-- existente desde 0022) — `rpc_create_order`/`rpc_update_order` NUNCA
-- escriben la columna text, y ningún formulario de la app la expone para
-- editar (confirmado: createSalesperson() no la envía; el form de
-- vendedores no tiene ese campo).
--
-- CONSECUENCIA PRÁCTICA (el problema real): como la columna es NOT NULL
-- con DEFAULT 'thunder', CUALQUIER organización nueva (Tenant B, o
-- cualquier tenant futuro) recibe SILENCIOSAMENTE 'thunder' en cada
-- salesperson/order que crea — un dato incorrecto y confuso, aunque no
-- rompa ninguna autoridad real (nada la lee para decidir permisos, ver
-- 0022). No es SaaS-safe dejarlo así.
--
-- =========================================================================
-- FIX — relajar, NUNCA eliminar
-- =========================================================================
-- 1) Se quita el CHECK (los 4 valores fijos dejan de ser una regla dura).
-- 2) Se quita el DEFAULT 'thunder' (una organización nueva ya no recibe
--    ese valor por accidente).
-- 3) La columna pasa a NULLABLE (para no forzar a inventar un valor en
--    cada INSERT que ya no la necesita).
-- 4) NINGÚN dato existente se modifica — todo lo que Global Supplier ya
--    tenía en estas columnas ('thunder', 'juno_promotional', etc.) queda
--    exactamente igual. NINGUNA columna se elimina (NO DROP COLUMN) — la
--    columna sigue existiendo, legible, para cualquier reporte/consulta
--    histórica que todavía la use.
-- 5) `orders.business_unit_id` (la relación real) y sus RLS/triggers no se
--    tocan en absoluto — este fix es exclusivamente sobre la columna text
--    legacy, nunca sobre la relación real ya vigente desde 0022.
--
-- Confirmado antes de aplicar (ver reporte): esto NO rompe folios (los
-- folios de Orders/Quotes nunca han dependido de esta columna — dependen
-- de salespeople.prefix/sequence_current y de salesperson_quote_sequences,
-- ninguno de los dos toca business_unit) y NO es una migración destructiva
-- (cero DROP COLUMN, cero pérdida de datos).

begin;

alter table salespeople alter column business_unit drop default;
alter table salespeople alter column business_unit drop not null;
alter table salespeople drop constraint if exists salespeople_business_unit_check;

alter table orders alter column business_unit drop default;
alter table orders alter column business_unit drop not null;
alter table orders drop constraint if exists orders_business_unit_check;

-- =========================================================================
-- FIX REAL DESCUBIERTO AL PROBAR: el índice único de prefijo
-- (0051, salespeople_prefix_unique_per_org_unit) incluye `business_unit`
-- en la clave — con la columna ahora NULLABLE, dos salespeople de la
-- MISMA organización con el MISMO prefix y AMBOS business_unit = NULL ya
-- NO chocarían (Postgres nunca considera dos NULL como iguales en un
-- índice único) — un prefix duplicado real DENTRO de la misma
-- organización generaría folios colisionando. `business_unit` (legacy)
-- nunca fue la dimensión real de scoping de todas formas — eso ya es
-- `salespeople.organization_id` desde 0051; el índice se corrige para
-- reflejar la única unicidad que en verdad importa: prefix único POR
-- ORGANIZACIÓN, sin importar business_unit. Verificado contra datos
-- reales antes de aplicar: cero filas violan
-- (organization_id, upper(prefix)) hoy.
drop index if exists salespeople_prefix_unique_per_org_unit;
create unique index salespeople_prefix_unique_per_org
  on salespeople (organization_id, upper(prefix));

commit;
