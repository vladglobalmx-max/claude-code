-- THÖREN 0076 — Fix de integridad: rpc_register_sales_order_payment (0068)
-- nunca tuvo tope contra sales_orders.total — segunda mitad del bug de
-- doble contabilización (0075 cerró el vector "factura importa un cobro
-- ya existente"; este migra cierra el vector "cualquier acumulado de
-- pagos directos sobre la Sales Order, con o sin factura de por medio,
-- puede rebasar el total sin límite").
--
-- =========================================================================
-- HALLAZGO CONFIRMADO (auditoría solicitada tras 0075): leyendo el cuerpo
-- completo de rpc_register_sales_order_payment (0068, sección 9), NINGUNA
-- línea valida v_new_amount_paid contra v_so.total. payment_required_amount
-- SOLO se usa para decidir financial_status/liberación ('paid' cuando
-- amount_paid >= payment_required_amount) — nunca como tope de cobranza.
-- Para 'cash', payment_required_amount = total (0068 lo fuerza en
-- rpc_create_sales_order/rpc_update_sales_order), así que ahí el hueco
-- pasaba desapercibido salvo doble registro accidental (el bug real,
-- 0075). Para 'advance'/'custom', payment_required_amount puede ser MENOR
-- al total a propósito (un anticipo) — y ahí el hueco es más peligroso:
-- nada impedía que, tras cubrir el anticipo y liberar la Sales Order,
-- siguieran registrándose pagos sin límite alguno.
--
-- =========================================================================
-- FIX (puntual, UNA sola función reemplazada): se agrega UN candado
-- nuevo, ANTES de cualquier escritura (rechazo atómico — ni la Sales
-- Order ni sales_order_financial_events cambian si se rechaza):
--   v_new_amount_paid > v_so.total -> rechazado.
-- payment_required_amount SIGUE gobernando ÚNICAMENTE cuándo
-- financial_status pasa a 'paid'/se libera — ese comportamiento NO
-- cambia (un anticipo sigue liberando con solo el 50% pagado, tal como
-- 0068 lo diseñó). El único tope absoluto de CUÁNTO se puede cobrar en
-- total es sales_orders.total — exactamente la regla pedida. Resto de la
-- función: carácter por carácter igual a 0068.
--
-- Como el resto del proyecto: idempotente (create or replace) y corre
-- completa en una transacción (begin/commit). Ningún otro RPC se modifica
-- — rpc_approve_sales_order_credit/rpc_set_sales_order_financial_hold/
-- rpc_release_sales_order no tocan amount_paid, fuera de alcance.

begin;

create or replace function rpc_register_sales_order_payment(
  p_sales_order_id uuid,
  p_amount numeric,
  p_note text default null
)
returns sales_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_so sales_orders;
  v_prev_financial_status text;
  v_prev_release_status text;
  v_new_amount_paid numeric(12,2);
  v_new_financial_status text;
  v_release boolean := false;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance')) then
    raise exception 'Solo un administrador o un usuario con autoridad financiera puede registrar pagos de una Sales Order.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero.';
  end if;

  select * into v_so from sales_orders where id = p_sales_order_id for update;
  if v_so.id is null then
    raise exception 'rpc_register_sales_order_payment: Sales Order % no encontrada.', p_sales_order_id;
  end if;
  if not is_organization_member(v_so.organization_id) then
    raise exception 'Esta Sales Order no pertenece a tu organización.';
  end if;
  if v_so.status not in ('confirmed', 'in_progress', 'fulfilled') then
    raise exception 'Solo se pueden registrar pagos sobre una Sales Order confirmada, en proceso o surtida (status actual: %).', v_so.status;
  end if;

  v_new_amount_paid := v_so.amount_paid + p_amount;

  -- THÖREN 0076 — tope absoluto: el acumulado de pagos NUNCA puede exceder
  -- el total de la Sales Order. payment_required_amount (anticipo/crédito
  -- parcial) sigue siendo EXCLUSIVAMENTE el umbral de liberación, nunca el
  -- tope de cobranza — se puede seguir cobrando después de liberar,
  -- mientras no se rebase el total.
  if v_new_amount_paid > v_so.total then
    raise exception 'El pago de % excede el saldo pendiente de la Sales Order (saldo: %).', p_amount, (v_so.total - v_so.amount_paid);
  end if;

  v_prev_financial_status := v_so.financial_status;
  v_prev_release_status := v_so.fulfillment_release_status;

  if v_so.payment_required_amount is not null and v_new_amount_paid >= v_so.payment_required_amount then
    v_new_financial_status := 'paid';
  elsif v_new_amount_paid > 0 then
    v_new_financial_status := 'partially_paid';
  else
    v_new_financial_status := v_so.financial_status;
  end if;

  if v_so.payment_terms_type <> 'credit' and v_new_financial_status = 'paid' and v_prev_release_status = 'blocked' then
    v_release := true;
  end if;

  update sales_orders set
    amount_paid = v_new_amount_paid,
    financial_status = v_new_financial_status,
    fulfillment_release_status = case when v_release then 'released' else fulfillment_release_status end,
    financial_released_at = case when v_release then coalesce(financial_released_at, now()) else financial_released_at end,
    financial_released_by = case when v_release then coalesce(financial_released_by, auth.uid()) else financial_released_by end
  where id = p_sales_order_id
  returning * into v_so;

  insert into sales_order_financial_events (
    sales_order_id, event_type, amount, previous_financial_status, new_financial_status,
    previous_release_status, new_release_status, reason, created_by
  ) values (
    p_sales_order_id, 'payment_registered', p_amount,
    v_prev_financial_status, v_so.financial_status,
    v_prev_release_status, v_so.fulfillment_release_status,
    p_note, auth.uid()
  );

  return v_so;
end;
$$;

commit;
