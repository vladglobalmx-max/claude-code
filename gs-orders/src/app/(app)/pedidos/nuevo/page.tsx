import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OrderForm } from "@/components/orders/order-form";
import { emptyOrderForm } from "@/components/orders/types";
import { createOrder } from "../actions";
import type { Salesperson } from "@/types/domain";

export default async function NuevoPedidoPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("salespeople")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  const salespeople = (data ?? []) as Salesperson[];
  const orderId = randomUUID();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <h1 className="text-lg font-semibold text-ink">Nuevo pedido</h1>
        <p className="mt-0.5 text-sm text-ink-faint">
          El folio se genera automáticamente al guardar.
        </p>
      </div>
      <OrderForm
        orderId={orderId}
        salespeople={salespeople}
        initialState={emptyOrderForm(today)}
        onSubmit={createOrder}
      />
    </div>
  );
}
