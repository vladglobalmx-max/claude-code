-- GS Orders — smoke test manual de folios (NO se ejecuta en este sandbox:
-- requiere un Postgres real). Valida formato AAAADDMM, consecutivo
-- independiente por vendedor, inmutabilidad del folio y que el consecutivo
-- NO se consuma cuando la creación de un pedido falla.
--
-- Cómo correrlo contra Supabase local:
--   supabase start && supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -f supabase/tests/folio_smoke_test.sql
--
-- Termina en ROLLBACK: no deja datos de prueba. Si algo falla, la sesión
-- imprime un error "FAIL: ..."; si todo pasa, imprime "OK: ...".

begin;

do $$
declare
  v_vlad_id uuid;
  v_karla_id uuid;
  v_order_id uuid;
  v_folio text;
  v_seq_before integer;
  v_seq_after integer;
begin
  insert into salespeople (name, prefix, sequence_current, active)
  values ('Test Vladimir', 'ZZV', 0, true) returning id into v_vlad_id;

  insert into salespeople (name, prefix, sequence_current, active)
  values ('Test Karla', 'ZZK', 0, true) returning id into v_karla_id;

  -- Formato AAAA + DD + MM (NO AAAA + MM + DD), consecutivo inicial 001
  insert into orders (salesperson_id, order_date, client_name, product_type)
  values (v_vlad_id, '2026-08-11', 'Cliente 1', 'otro')
  returning folio, id into v_folio, v_order_id;
  if v_folio <> 'ZZV-20261108-001' then
    raise exception 'FAIL formato folio: esperado ZZV-20261108-001, obtuve %', v_folio;
  end if;

  -- Segundo pedido, mismo vendedor y fecha -> consecutivo 002
  insert into orders (salesperson_id, order_date, client_name, product_type)
  values (v_vlad_id, '2026-08-11', 'Cliente 2', 'otro')
  returning folio into v_folio;
  if v_folio <> 'ZZV-20261108-002' then
    raise exception 'FAIL consecutivo no incremental: obtuve %', v_folio;
  end if;

  -- Tercer pedido, fecha distinta -> el consecutivo NO se reinicia (003)
  insert into orders (salesperson_id, order_date, client_name, product_type)
  values (v_vlad_id, '2026-08-12', 'Cliente 3', 'otro')
  returning folio into v_folio;
  if v_folio <> 'ZZV-20261208-003' then
    raise exception 'FAIL: el consecutivo se reinició o la fecha se formateó mal, obtuve %', v_folio;
  end if;

  -- Otro vendedor mantiene su propia secuencia, independiente de Vladimir
  insert into orders (salesperson_id, order_date, client_name, product_type)
  values (v_karla_id, '2026-08-11', 'Cliente 4', 'otro')
  returning folio into v_folio;
  if v_folio <> 'ZZK-20261108-001' then
    raise exception 'FAIL: el consecutivo de Karla no es independiente, obtuve %', v_folio;
  end if;

  -- El folio no se puede escribir a mano
  begin
    insert into orders (salesperson_id, order_date, client_name, product_type, folio)
    values (v_vlad_id, '2026-08-11', 'Cliente 5', 'otro', 'MANUAL-000');
    raise exception 'FAIL: se permitió asignar un folio manualmente';
  exception when others then
    if sqlerrm not like '%no puede asignarse manualmente%' then
      raise;
    end if;
  end;

  -- El consecutivo NO se consume si la creación del pedido falla
  select sequence_current into v_seq_before from salespeople where id = v_vlad_id;
  begin
    insert into orders (salesperson_id, order_date, client_name, product_type)
    values (v_vlad_id, '2026-08-13', 'Cliente falla', 'tipo_invalido');
    raise exception 'FAIL: se insertó un pedido con product_type inválido';
  exception when check_violation then
    null; -- esperado: el check de product_type debe rechazarlo
  end;
  select sequence_current into v_seq_after from salespeople where id = v_vlad_id;
  if v_seq_after <> v_seq_before then
    raise exception 'FAIL: el consecutivo se consumió aunque el pedido no se llegó a crear (% -> %)',
      v_seq_before, v_seq_after;
  end if;

  -- El folio es inmutable una vez generado
  begin
    update orders set folio = 'OTRO-000' where id = v_order_id;
    raise exception 'FAIL: se permitió modificar el folio de un pedido existente';
  exception when others then
    if sqlerrm not like '%no se puede modificar%' then
      raise;
    end if;
  end;

  -- La fecha usada para construir el folio tampoco se puede modificar
  begin
    update orders set order_date = '2026-01-01' where id = v_order_id;
    raise exception 'FAIL: se permitió modificar la fecha de un pedido existente';
  exception when others then
    if sqlerrm not like '%fecha%no se puede cambiar%' then
      raise;
    end if;
  end;

  raise notice 'OK: todas las validaciones de folio pasaron';
end $$;

rollback;
