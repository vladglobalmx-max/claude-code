-- =========================================================================
-- THÖREN — Fase 7C: timezone por organización
-- =========================================================================
-- OBJETIVO: una organización en una zona horaria distinta de Monterrey
-- debe generar folios/fechas de negocio con SU fecha local, no la de
-- Monterrey. Cambio deliberadamente pequeño: una columna con default, sin
-- CHECK de validez de IANA (Postgres no lo valida nativamente sin una
-- extensión — confiar en quien provisiona/edita la organización, mismo
-- nivel de confianza ya aplicado a otros campos de texto libre del
-- proyecto como business_units.name).
--
-- =========================================================================
-- DECISIÓN — DEFAULT 'America/Monterrey', backfill explícito de
-- organizaciones existentes
-- =========================================================================
-- Global Supplier MTY (y cualquier organización creada antes de esta
-- migración) sigue operando en América/Monterrey — el DEFAULT ya lo cubre
-- para filas existentes (Postgres aplica el DEFAULT también a filas ya
-- insertadas cuando se agrega la columna con `add column ... default`,
-- sin necesitar un UPDATE aparte). Se agrega igual un UPDATE explícito
-- para cualquier fila que por algún motivo ya tuviera NULL — defensivo,
-- no debería ejecutar nada en la práctica.
--
-- =========================================================================
-- DECISIÓN — dónde SÍ se usa esta columna (alcance acotado a lo pedido)
-- =========================================================================
-- Esta migración SOLO agrega la columna. El uso real (business-date.ts
-- aceptando un parámetro de timezone, y los call sites que generan
-- fecha/folio de un pedido/cotización nueva resolviendo el timezone de su
-- propia organización) vive en código de aplicación — no hay lógica de
-- negocio nueva en SQL para esto.

begin;

alter table organizations
  add column if not exists timezone text not null default 'America/Monterrey';

update organizations set timezone = 'America/Monterrey' where timezone is null;

commit;
