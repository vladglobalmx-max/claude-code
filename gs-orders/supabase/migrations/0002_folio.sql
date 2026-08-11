-- GS Orders — Migración 0002: generación atómica de folios
--
-- Formato: [PREFIJO]-[AAAADDMM]-[CONSECUTIVO]  (ej. VPT-20261108-001)
-- AAAADDMM = año + día + mes (NO año-mes-día).
--
-- El consecutivo es propiedad del vendedor (salespeople.sequence_current):
-- nunca se reinicia por día/mes/año. `select ... for update` bloquea la fila
-- del vendedor mientras dura la transacción del insert, así que dos pedidos
-- creados casi simultáneamente para el mismo vendedor nunca reciben el mismo
-- consecutivo. El folio es inmutable: el usuario no lo escribe ni lo edita.

create or replace function fn_next_order_folio(p_salesperson_id uuid, p_order_date date)
returns table (folio text, sequence_number integer)
language plpgsql
as $$
declare
  v_prefix text;
  v_active boolean;
  v_seq integer;
  v_date_part text;
begin
  select prefix, active
    into v_prefix, v_active
    from salespeople
    where id = p_salesperson_id
    for update;

  if v_prefix is null then
    raise exception 'Vendedor no encontrado: %', p_salesperson_id;
  end if;

  if not v_active then
    raise exception 'El vendedor % está inactivo y no puede generar pedidos', v_prefix;
  end if;

  update salespeople
    set sequence_current = sequence_current + 1
    where id = p_salesperson_id
    returning sequence_current into v_seq;

  -- AAAA + DD + MM
  v_date_part := to_char(p_order_date, 'YYYY') || to_char(p_order_date, 'DD') || to_char(p_order_date, 'MM');

  return query select
    upper(v_prefix) || '-' || v_date_part || '-' || lpad(v_seq::text, 3, '0'),
    v_seq;
end;
$$;

create or replace function trg_set_order_folio()
returns trigger
language plpgsql
as $$
declare
  v_result record;
begin
  if new.folio is not null then
    raise exception 'El folio no puede asignarse manualmente';
  end if;

  select * into v_result from fn_next_order_folio(new.salesperson_id, new.order_date);
  new.folio := v_result.folio;
  new.sequence_number := v_result.sequence_number;

  return new;
end;
$$;

create trigger trg_orders_set_folio
  before insert on orders
  for each row execute function trg_set_order_folio();

create or replace function trg_prevent_folio_change()
returns trigger
language plpgsql
as $$
begin
  if new.folio is distinct from old.folio then
    raise exception 'El folio de un pedido no se puede modificar (%). Duplica el pedido para generar uno nuevo.', old.folio;
  end if;
  if new.sequence_number is distinct from old.sequence_number then
    raise exception 'El consecutivo de un pedido no se puede modificar';
  end if;
  if new.salesperson_id is distinct from old.salesperson_id then
    raise exception 'El vendedor de un pedido no se puede cambiar una vez generado el folio';
  end if;
  return new;
end;
$$;

create trigger trg_orders_prevent_folio_change
  before update on orders
  for each row execute function trg_prevent_folio_change();
