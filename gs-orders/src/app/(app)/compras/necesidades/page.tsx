import { ClipboardList } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getOpenPurchaseRequirements, getRequirementRepresentativeOrderItem } from "@/lib/purchasing/purchase-requirements";
import type { Supplier } from "@/types/domain";
import { NecesidadesList } from "./necesidades-list";

export const dynamic = "force-dynamic";

/**
 * THÖREN Fase 9 / Block 1 (0064) — "Necesidades de compra": una fila por
 * cada purchase_requirement abierto/parcialmente asignado. Deliberadamente
 * minimal (una tabla + checkboxes + un selector de proveedor) — la vista
 * de "Recomendaciones" con métricas de planning (Parte R del enunciado
 * completo) es Block 3, fuera de esta entrega.
 */
export default async function NecesidadesDeCompraPage() {
  const supabase = createSupabaseServerClient();

  const [requirements, { data: suppliersData }] = await Promise.all([
    getOpenPurchaseRequirements(supabase),
    supabase.from("suppliers").select("*").eq("active", true).order("name"),
  ]);
  const suppliers = (suppliersData ?? []) as Supplier[];

  // El order_item representativo se resuelve server-side (no hace falta
  // exponer la tabla de trazabilidad completa al cliente) — cada fila ya
  // trae el único dato que la acción de crear PO necesita del lado del
  // navegador.
  const rows = await Promise.all(
    requirements.map(async (requirement) => ({
      ...requirement,
      representativeOrderItemId: await getRequirementRepresentativeOrderItem(supabase, requirement.id),
    }))
  );
  const validRows = rows.filter((row): row is typeof row & { representativeOrderItemId: string } => !!row.representativeOrderItemId);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Necesidades de compra"
        description="Faltantes detectados automáticamente al confirmar un Pedido — selecciona las que quieras cubrir con una Purchase Order."
      />

      {validRows.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No hay necesidades de compra abiertas"
            description="Cuando un Pedido confirmado no tenga stock suficiente, aparecerá aquí."
          />
        </Card>
      ) : (
        <NecesidadesList requirements={validRows} suppliers={suppliers} />
      )}
    </div>
  );
}
