import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * THÖREN 0085 — Quick actions del dashboard: "Nueva Cotización" y "Nueva
 * Orden de Trabajo" están abiertas a cualquier usuario activo (mismo
 * guard, o ausencia de guard, que /cotizaciones/nueva y /pedidos/nuevo);
 * "Nueva Orden de Compra" se gatea con `canCreatePurchaseOrder`, EL MISMO
 * guard real que ya protege /compras/nueva (canPreparePurchaseOrders) —
 * nunca un permiso inventado aquí.
 */
export function DashboardQuickActions({ canCreatePurchaseOrder }: { canCreatePurchaseOrder: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/cotizaciones/nueva" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        <Plus className="h-3.5 w-3.5" />
        Nueva Cotización
      </Link>
      {canCreatePurchaseOrder && (
        <Link href="/compras/nueva" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          <Plus className="h-3.5 w-3.5" />
          Nueva Orden de Compra
        </Link>
      )}
      <Link href="/pedidos/nuevo" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        <Plus className="h-3.5 w-3.5" />
        Nueva Orden de Trabajo
      </Link>
    </div>
  );
}
