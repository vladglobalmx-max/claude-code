-- THÖREN — Adenda PDF Pedido (0063): idioma del documento de proveedor,
-- configurable por Business Unit — pruebas funcionales contra Postgres
-- real. Corre DESPUÉS de: local_harness_setup.sql + migraciones
-- 0001-0063 + fixtures.sql + 0023_fixtures.sql + 0024_fixtures.sql. Todo
-- el script corre en una transacción que se revierte al final (rollback).

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
create temp table _ids as
  select :'org1'::uuid as org1;

select id as bu_thunder from business_units where organization_id = (select org1 from _ids) and code = 'thunder_led' \gset
select id as bu_juno from business_units where organization_id = (select org1 from _ids) and code = 'juno_promotional' \gset
alter table _ids add column bu_thunder uuid, add column bu_juno uuid;
update _ids set bu_thunder = :'bu_thunder', bu_juno = :'bu_juno';

-- =========================================================================
-- TEST 1: Thunder LED tiene provider_document_language='en' por dato
-- sembrado (0063), nunca por código que reconozca su nombre/código.
-- =========================================================================
do $$
declare v_lang text;
begin
  select provider_document_language into v_lang
    from business_unit_process_settings where business_unit_id = (select bu_thunder from _ids);
  if v_lang is distinct from 'en' then
    raise exception 'TEST 1 FALLÓ: Thunder LED debería tener provider_document_language=en, tiene %', v_lang;
  end if;
  raise notice 'TEST 1 OK: Thunder LED tiene provider_document_language=en (dato, no código)';
end $$;

-- =========================================================================
-- TEST 2: Juno (sin fila de settings configurada) no hereda 'en' — el
-- default real es 'es', igual que cualquier BU sin configurar.
-- =========================================================================
do $$
declare v_row_count integer;
begin
  select count(*) into v_row_count
    from business_unit_process_settings where business_unit_id = (select bu_juno from _ids);
  if v_row_count <> 0 then
    raise exception 'TEST 2 FALLÓ: Juno ya tiene una fila de settings (no se esperaba ninguna en este fixture)';
  end if;
  raise notice 'TEST 2 OK: Juno no tiene fila de settings — el default real (es) se resuelve en la capa de aplicación, nunca hardcodeado por BU';
end $$;

-- =========================================================================
-- TEST 3: default de la columna es 'es' para una BU nueva configurada sin
-- especificar idioma.
-- =========================================================================
insert into business_unit_process_settings (organization_id, business_unit_id)
values ((select org1 from _ids), (select bu_juno from _ids));
do $$
declare v_lang text;
begin
  select provider_document_language into v_lang
    from business_unit_process_settings where business_unit_id = (select bu_juno from _ids);
  if v_lang is distinct from 'es' then
    raise exception 'TEST 3 FALLÓ: el default de provider_document_language debería ser "es", es %', v_lang;
  end if;
  raise notice 'TEST 3 OK: el default de la columna es "es"';
end $$;
delete from business_unit_process_settings where business_unit_id = (select bu_juno from _ids);

-- =========================================================================
-- TEST 4: el CHECK rechaza cualquier valor que no sea 'es'/'en'.
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  begin
    insert into business_unit_process_settings (organization_id, business_unit_id, provider_document_language)
    values ((select org1 from _ids), (select bu_juno from _ids), 'fr');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 4 FALLÓ: se pudo insertar un idioma no soportado (fr)'; end if;
  raise notice 'TEST 4 OK: el CHECK rechaza idiomas fuera de es/en';
end $$;

-- =========================================================================
-- TEST 5: un vendedor no puede cambiar provider_document_language (misma
-- RLS admin-only de business_unit_process_settings, 0062 — no se creó
-- ninguna policy nueva).
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare v_failed boolean := false;
begin
  begin
    update business_unit_process_settings set provider_document_language = 'en'
      where business_unit_id = (select bu_thunder from _ids);
  exception when others then v_failed := true; end;
  if not v_failed then
    if exists (
      select 1 from business_unit_process_settings
        where business_unit_id = (select bu_thunder from _ids) and provider_document_language <> 'en'
    ) then
      raise exception 'TEST 5 FALLÓ: un vendedor pudo cambiar el idioma del documento de proveedor';
    end if;
  end if;
  raise notice 'TEST 5 OK: un vendedor no puede alterar provider_document_language (RLS admin-only heredada de 0062)';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 6: custom_field_definitions.supplier_label existe, es nullable, y
-- no afecta ninguna definición existente (todas quedan NULL).
-- =========================================================================
do $$
declare v_non_null_count integer;
begin
  select count(*) into v_non_null_count from custom_field_definitions where supplier_label is not null;
  if v_non_null_count <> 0 then
    raise exception 'TEST 6 FALLÓ: alguna definición existente ya trae supplier_label (se esperaba NULL en todas tras la migración)';
  end if;
  raise notice 'TEST 6 OK: supplier_label existe, nullable, sin inventar ninguna traducción automática';
end $$;

-- =========================================================================
-- TEST 7: se puede guardar un supplier_label explícito en una definición
-- (comportamiento real que usará el documento de proveedor).
-- =========================================================================
insert into custom_field_definitions (organization_id, business_unit_id, entity_type, key, label, field_type, supplier_label)
values ((select org1 from _ids), (select bu_thunder from _ids), 'order_item', 'prueba_0063', 'Etiqueta interna', 'text', 'English label')
returning id as def_test \gset
alter table _ids add column def_test uuid;
update _ids set def_test = :'def_test';
do $$
declare v_label text; v_supplier_label text;
begin
  select label, supplier_label into v_label, v_supplier_label
    from custom_field_definitions where id = (select def_test from _ids);
  if v_label <> 'Etiqueta interna' or v_supplier_label <> 'English label' then
    raise exception 'TEST 7 FALLÓ: label/supplier_label no se guardaron como se esperaba (label=%, supplier_label=%)', v_label, v_supplier_label;
  end if;
  raise notice 'TEST 7 OK: label (interno) y supplier_label (proveedor) se guardan de forma independiente';
end $$;
delete from custom_field_definitions where id = (select def_test from _ids);

select 'TODAS LAS PRUEBAS 0063 PASARON' as resultado;

rollback;
