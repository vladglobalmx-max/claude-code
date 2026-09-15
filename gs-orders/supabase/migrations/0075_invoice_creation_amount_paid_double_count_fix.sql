-- THÖREN 0075 — Fix de integridad: doble contabilización de cobro entre
-- 0068 y 0072 al crear una factura para una Sales Order YA cobrada.
--
-- =========================================================================
-- BUG (detectado en prueba end-to-end, SO-20261409-003): Sales Order con
-- total $8,209.00 ya cobrada por completo (sales_orders.amount_paid =
-- 8209, vía rpc_register_sales_order_payment directo, 0068). Al crear
-- INV-20261409-001 (rpc_create_invoice, 0072), la factura SIEMPRE nacía
-- con amount_paid = 0 / status = 'pending' — SIN IMPORTAR que la Sales
-- Order ya estuviera cobrada. La única forma de que la factura reflejara
-- el cobro real era llamar rpc_register_invoice_payment por el monto ya
-- cobrado (8209) — pero esa función SIEMPRE delega ese monto a
-- rpc_register_sales_order_payment (0068, sección "no duplicar lógica"),
-- que lo SUMA a sales_orders.amount_paid otra vez: 8209 (ya existente) +
-- 8209 (re-registrado desde la factura) = 16,418.00 — exactamente el
-- doble reportado. rpc_refresh_commission_eligibility/
-- fn_commission_eligible_amount (0073) simplemente LEEN
-- sales_orders.amount_paid — nunca tuvieron su propio bug; heredaron el
-- valor ya corrupto.
--
-- =========================================================================
-- CAUSA RAÍZ: rpc_create_invoice nunca considera que la Sales Order de
-- origen pudo haber sido cobrada (total o parcialmente) ANTES de que la
-- factura existiera — un camino perfectamente legítimo, ya que 0068
-- (rpc_register_sales_order_payment) es una vía de cobro directa e
-- independiente de la facturación, y 0072 nunca prohibió facturar una SO
-- ya cobrada (correctamente: el ticket de 0072 nunca exigió que facturar
-- preceda al cobro). El único punto de sincronización SO -> factura
-- existente era "hacia adelante" (rpc_register_invoice_payment delegando
-- pagos NUEVOS), nunca "hacia atrás" (importar cobro YA existente al
-- nacer la factura) — ese hueco es lo que forzaba al usuario a
-- re-registrar el mismo pago, duplicándolo.
--
-- =========================================================================
-- FIX (puntual, UNA sola función reemplazada): rpc_create_invoice ahora
-- IMPORTA sales_orders.amount_paid como snapshot inicial de
-- invoices.amount_paid/status al crear — SIN llamar jamás a
-- rpc_register_sales_order_payment ni tocar sales_orders (esa Sales Order
-- YA está correctamente contabilizada; la factura solo REFLEJA ese hecho,
-- nunca lo vuelve a contabilizar — regla explícita del ticket). Con esto:
--   - SO ya cobrada al 100% -> factura nace directamente 'paid' con el
--     monto correcto, sin ninguna acción manual adicional, y
--     rpc_register_invoice_payment la rechaza de inmediato si alguien
--     intenta "volver a cobrarla" (guard `status = 'paid'` ya existente,
--     sin cambios) — el vector de duplicación queda cerrado de raíz.
--   - SO parcialmente cobrada -> factura nace 'partially_paid' con el
--     saldo YA cobrado importado; un pago posterior por la DIFERENCIA
--     (nunca por el monto ya importado) sigue delegando normalmente a
--     rpc_register_sales_order_payment, exactamente como antes.
--   - SO sin ningún cobro (flujo normal, mayoría de los casos hasta hoy)
--     -> comportamiento IDÉNTICO al de antes de este fix (amount_paid=0,
--     status='pending') — este fix es puramente aditivo para el caso que
--     tenía el bug, nunca cambia el camino ya correcto.
--
-- =========================================================================
-- DECISIÓN — guard contra amount_paid > sales_order.total al importar
-- (pregunta explícita del ticket: "¿0072 requiere además guard contra
-- amount_paid > sales_order.total?"): SÍ. rpc_register_sales_order_payment
-- (0068) confirmado NO tiene tope contra sales_orders.total — una Sales
-- Order puede quedar sobre-cobrada a nivel de 0068 sin que 0072 lo
-- cause ni lo pueda evitar (fuera de alcance de este fix puntual — sería
-- tocar 0068, una migración ya enviada, por un problema que 0072/0075 no
-- originan). Lo que SÍ es responsabilidad de este fix: el snapshot
-- importado NUNCA puede violar el propio CHECK de invoices
-- (amount_paid <= total) — se usa LEAST(sales_orders.amount_paid,
-- sales_orders.total) al importar, así que una Sales Order sobre-cobrada
-- (caso raro, preexistente a 0072) simplemente produce una factura 'paid'
-- con amount_paid = total (el máximo válido), nunca un error de
-- constraint ni un monto imposible en la factura.
--
-- =========================================================================
-- DECISIÓN — sin fila nueva en invoice_payments para el monto importado:
-- invoice_payments representa "un pago QUE OCURRIÓ contra esta factura" —
-- el cobro importado no ocurrió contra la factura (la factura ni existía
-- cuando se cobró), así que crear una fila ahí falsearía cuándo/cómo se
-- cobró. En vez de eso, el evento 'created' en invoice_events (ya
-- existente) ahora incluye el monto importado en su columna `amount`
-- (nullable, sin cambio de esquema) — auditable sin inventar un pago que
-- nunca existió como tal.
--
-- Como el resto del proyecto: idempotente (create or replace) y corre
-- completa en una transacción (begin/commit). Ningún otro RPC de 0072/0073
-- se modifica.

begin;

create or replace function rpc_create_invoice(
  p_invoice_id uuid,
  p_sales_order_id uuid,
  p_due_date date,
  p_notes text default null
)
returns invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inv invoices;
  v_so sales_orders;
  v_organization_id uuid;
  v_number_result record;
  v_item sales_order_items;
  v_initial_amount_paid numeric(12,2);
  v_initial_status text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_order_finance')) then
    raise exception 'Solo un administrador o un usuario con autoridad financiera puede crear una factura.';
  end if;
  if p_sales_order_id is null then
    raise exception 'Debe indicarse la Sales Order de origen.';
  end if;
  if p_due_date is null then
    raise exception 'Debe indicarse la fecha de vencimiento.';
  end if;

  select * into v_so from sales_orders where id = p_sales_order_id for update;
  if v_so.id is null then
    raise exception 'rpc_create_invoice: Sales Order % no encontrada.', p_sales_order_id;
  end if;
  if not is_organization_member(v_so.organization_id) then
    raise exception 'Esta Sales Order no pertenece a tu organización.';
  end if;

  v_organization_id := v_so.organization_id;

  -- THÖREN 0075 — importa el cobro YA existente de la Sales Order como
  -- snapshot inicial (nunca lo vuelve a contabilizar en sales_orders: solo
  -- lo LEE). LEAST(...) evita que una Sales Order sobre-cobrada (0068 no
  -- lo impide) produzca un amount_paid de factura imposible.
  v_initial_amount_paid := least(v_so.amount_paid, v_so.total);
  v_initial_status := case
    when v_initial_amount_paid > 0 and v_initial_amount_paid >= v_so.total then 'paid'
    when v_initial_amount_paid > 0 then 'partially_paid'
    else 'pending'
  end;

  select * into v_number_result from fn_next_invoice_number(v_organization_id, current_date);

  insert into invoices (
    id, organization_id, invoice_number, sequence_number, sales_order_id,
    status, payment_terms_type, issue_date, due_date,
    subtotal, tax_total, total, amount_paid, notes, created_by
  ) values (
    p_invoice_id, v_organization_id, v_number_result.invoice_number, v_number_result.sequence_number, p_sales_order_id,
    v_initial_status, v_so.payment_terms_type, current_date, p_due_date,
    v_so.subtotal, v_so.tax_total, v_so.total, v_initial_amount_paid, nullif(p_notes, ''), auth.uid()
  )
  returning * into v_inv;

  for v_item in select * from sales_order_items where sales_order_id = p_sales_order_id order by position
  loop
    insert into invoice_items (
      invoice_id, sales_order_item_id, catalog_product_id,
      description_snapshot, uom_snapshot, quantity, unit_price, discount, tax,
      line_subtotal, line_total
    ) values (
      v_inv.id, v_item.id, v_item.catalog_product_id,
      coalesce(v_item.description_snapshot, v_item.sku_snapshot), v_item.uom_snapshot,
      v_item.quantity, v_item.unit_price, v_item.discount, v_item.tax,
      v_item.line_subtotal, v_item.line_total
    );
  end loop;

  insert into invoice_events (invoice_id, event_type, amount, previous_status, new_status, created_by)
    values (v_inv.id, 'created', nullif(v_initial_amount_paid, 0), null, v_inv.status, auth.uid());

  return v_inv;
end;
$$;

commit;
