-- THÖREN — Ajuste de cierre: eliminación definitiva de vendedores para
-- limpieza inicial (arranque limpio). Permite borrar perfiles de vendedor
-- duplicados o de prueba, siempre que no tengan operaciones reales que
-- deban conservarse.
--
-- =========================================================================
-- AUDITORÍA PREVIA (reportada y aprobada antes de esta migración) — todas
-- las referencias REALES a `salespeople.id` en el esquema:
--   - orders                      (salesperson_id NOT NULL, on delete restrict)
--   - quotes                      (salesperson_id NOT NULL, on delete restrict)
--   - salesperson_quote_sequences (salesperson_id NOT NULL, on delete restrict)
--   - sales_orders                (salesperson_id NOT NULL, on delete restrict)
--   - commission_records          (salesperson_id NOT NULL, on delete restrict)
--   - user_profiles                (salesperson_id nullable, UNIQUE, on delete set null —
--                                    pero el CHECK user_profiles_vendedor_requires_salesperson
--                                    (0011) exige salesperson_id NOT NULL mientras role='vendedor',
--                                    así que un SET NULL con role='vendedor' vigente violaría ese
--                                    CHECK dentro del mismo DELETE. Un role='admin' ligado sí
--                                    permite el SET NULL sin tocar el login.)
--   - salespeople.person_id -> people(id) es la ÚNICA relación con Persona, y es SALIENTE
--     (de salespeople hacia people, on delete set null): borrar un salespeople jamás
--     toca la fila de `people`, no requiere lógica adicional.
--
-- DECISIÓN: en vez de confiar en que los `on delete restrict`/CHECK simplemente
-- hagan fallar el DELETE con un error genérico de Postgres, esta función
-- verifica cada referencia PRIMERO y arma un mensaje en español que dice
-- exactamente qué debe limpiarse/reasignarse antes de poder eliminar —
-- igual que el resto de excepciones de negocio del proyecto (código P0001,
-- mapDbError las muestra tal cual al usuario).
--
-- Seguridad: SECURITY DEFINER (no existe policy de DELETE sobre
-- `salespeople` para ningún rol — todo hard delete pasa obligatoriamente
-- por aquí) — resuelve organización y autoridad admin INTERNAMENTE
-- (current_user_organization_id()/current_user_is_admin(), 0011/0013),
-- nunca acepta organization_id como parámetro del cliente. Un vendedor de
-- otra organización se trata como "no encontrado", nunca se filtra su
-- existencia ni se ve afectado.
-- =========================================================================

begin;

create or replace function rpc_delete_salesperson(p_salesperson_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_blockers text[] := array[]::text[];
  v_count integer;
  v_vendedor_user_id uuid;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() then
    raise exception 'Solo un administrador puede eliminar vendedores.';
  end if;

  v_organization_id := current_user_organization_id();
  if v_organization_id is null then
    raise exception 'Tu usuario no tiene una organización asociada. Contacta a soporte.';
  end if;

  if not exists (
    select 1 from salespeople
    where id = p_salesperson_id and organization_id = v_organization_id
  ) then
    raise exception 'Vendedor no encontrado.';
  end if;

  select count(*) into v_count from orders
    where salesperson_id = p_salesperson_id and organization_id = v_organization_id;
  if v_count > 0 then
    v_blockers := array_append(v_blockers, v_count || ' pedido(s)');
  end if;

  select count(*) into v_count from quotes
    where salesperson_id = p_salesperson_id and organization_id = v_organization_id;
  if v_count > 0 then
    v_blockers := array_append(v_blockers, v_count || ' cotización(es)');
  end if;

  select count(*) into v_count from salesperson_quote_sequences
    where salesperson_id = p_salesperson_id and organization_id = v_organization_id;
  if v_count > 0 then
    v_blockers := array_append(v_blockers, v_count || ' configuración(es) de folio de cotizaciones');
  end if;

  select count(*) into v_count from sales_orders
    where salesperson_id = p_salesperson_id and organization_id = v_organization_id;
  if v_count > 0 then
    v_blockers := array_append(v_blockers, v_count || ' orden(es) de venta');
  end if;

  select count(*) into v_count from commission_records
    where salesperson_id = p_salesperson_id and organization_id = v_organization_id;
  if v_count > 0 then
    v_blockers := array_append(v_blockers, v_count || ' comisión(es)');
  end if;

  if array_length(v_blockers, 1) > 0 then
    raise exception 'No se puede eliminar este vendedor: tiene % asociado(s). Elimina o reasigna esas operaciones primero.',
      array_to_string(v_blockers, ', ');
  end if;

  select user_id into v_vendedor_user_id
    from user_profiles
    where salesperson_id = p_salesperson_id and role = 'vendedor';
  if v_vendedor_user_id is not null then
    raise exception 'No se puede eliminar este vendedor: tiene un usuario con rol "Vendedor" ligado a este perfil. Reasigna ese usuario a otro vendedor o cambia su rol antes de eliminar.';
  end if;

  -- Ningún bloqueo: el hard delete es seguro. Si un usuario ADMIN sigue
  -- ligado (caso híbrido), la FK user_profiles.salesperson_id (0011, on
  -- delete set null) desvincula el login SIN borrarlo. `people` nunca se
  -- toca (relación saliente, ver arriba).
  delete from salespeople where id = p_salesperson_id and organization_id = v_organization_id;
end;
$$;

commit;
