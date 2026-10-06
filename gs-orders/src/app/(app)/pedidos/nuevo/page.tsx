import { redirect } from "next/navigation";

/**
 * THÖREN Ticket E1 — el Pedido oficial de THÖREN es sales_orders. Esta
 * ruta legacy ya no debe crear filas nuevas en `orders`: redirige a la
 * creación oficial (/ordenes-venta/nueva), que reutiliza
 * rpc_create_sales_order (0067) en vez de abrir un flujo paralelo.
 * La ruta se conserva (no se elimina) para no romper enlaces existentes.
 */
export default function NuevoPedidoPage() {
  redirect("/ordenes-venta/nueva");
}
