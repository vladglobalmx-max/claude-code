"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { getMissingProjectorFields, type OrderPayload } from "@/lib/validations/order";
import type { OrderStatus, Salesperson } from "@/types/domain";
import type { OrderActionResult } from "@/app/(app)/pedidos/actions";
import { DatosGeneralesSection } from "./datos-generales-section";
import { ProductosSection } from "./productos-section";
import { ProyectorSection } from "./proyector-section";
import { ImagenesSection } from "./imagenes-section";
import { ObservacionesSection } from "./observaciones-section";
import { RevisarSection } from "./revisar-section";
import type { OrderFormState } from "./types";

const TABS = [
  { key: "datos", label: "Datos generales" },
  { key: "productos", label: "Productos" },
  { key: "imagenes", label: "Imágenes / archivos" },
  { key: "observaciones", label: "Observaciones" },
  { key: "revisar", label: "Revisar" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function buildPayload(state: OrderFormState, status: OrderStatus): OrderPayload {
  return {
    order_date: state.orderDate,
    salesperson_id: state.salespersonId,
    client_name: state.clientName,
    supplier_name: state.supplierName || undefined,
    product_type: state.productType,
    status,
    general_notes: state.generalNotes || undefined,
    vendor_notes: state.vendorNotes || undefined,
    items: state.items.map((item) => ({
      model: item.model,
      description: item.description || undefined,
      quantity: item.quantity,
      notes: item.notes || undefined,
      image_path: item.image?.path ?? null,
    })),
    images: state.images.map((img) => ({ storage_path: img.path, caption: img.caption || undefined })),
    files: state.files.map((f) => ({
      storage_path: f.path,
      file_name: f.name,
      file_type: f.type || undefined,
      file_size: f.size,
    })),
    projector:
      state.productType === "proyector_gobo"
        ? {
            model: state.projector.model || undefined,
            quantity: state.projector.quantity ? Number(state.projector.quantity) : undefined,
            power: state.projector.power || undefined,
            lens_type: state.projector.lensType || undefined,
            lens_pending_factory: state.projector.lensPendingFactory,
            description: state.projector.description || undefined,
            file: state.projector.file
              ? { path: state.projector.file.path, name: state.projector.file.name, type: state.projector.file.type }
              : null,
            width: state.projector.width ? Number(state.projector.width) : undefined,
            height: state.projector.height ? Number(state.projector.height) : undefined,
            size_unit: state.projector.sizeUnit,
            installation_height: state.projector.installationHeight
              ? Number(state.projector.installationHeight)
              : undefined,
            installation_height_unit: state.projector.installationHeightUnit,
            installation_distance: state.projector.installationDistance
              ? Number(state.projector.installationDistance)
              : undefined,
            orientation: state.projector.orientation || undefined,
            use: state.projector.use || undefined,
            surface_type: state.projector.surfaceType || undefined,
            surface_material: state.projector.surfaceMaterial || undefined,
            surface_notes: state.projector.surfaceNotes || undefined,
          }
        : null,
  };
}

export function OrderForm({
  orderId,
  salespeople,
  initialState,
  folio,
  submitLabel = { draft: "Guardar borrador", order: "Generar pedido" },
  onSubmit,
}: {
  orderId: string;
  salespeople: Salesperson[];
  initialState: OrderFormState;
  folio?: string;
  submitLabel?: { draft: string; order: string };
  onSubmit: (orderId: string, payload: OrderPayload) => Promise<OrderActionResult>;
}) {
  const router = useRouter();
  const isEdit = !!folio;
  const [tab, setTab] = useState<TabKey>("datos");
  const [state, setState] = useState<OrderFormState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);

  function patch(p: Partial<OrderFormState>) {
    setState((prev) => ({ ...prev, ...p }));
  }

  const activeSalesperson = salespeople.find((sp) => sp.id === state.salespersonId);
  const folioPreview = useMemo(() => {
    if (!activeSalesperson || !state.orderDate) return null;
    const [y, m, d] = state.orderDate.split("-");
    if (!y || !m || !d) return null;
    const next = activeSalesperson.sequence_current + 1;
    return `${activeSalesperson.prefix}-${y}${d}${m}-${String(next).padStart(3, "0")}`;
  }, [activeSalesperson, state.orderDate]);

  const missingFields = useMemo(() => {
    const payload = buildPayload(state, "pedido");
    return getMissingProjectorFields(payload);
  }, [state]);

  function handleSubmit(status: OrderStatus) {
    if (!state.salespersonId) {
      toast.error("Selecciona un vendedor");
      setTab("datos");
      return;
    }
    if (!state.clientName.trim()) {
      toast.error("El cliente es obligatorio");
      setTab("datos");
      return;
    }
    if (state.items.every((item) => !item.model.trim())) {
      toast.error("Agrega al menos un producto con modelo");
      setTab("productos");
      return;
    }

    const payload = buildPayload(state, status);

    if (status === "pedido") {
      const missing = getMissingProjectorFields(payload);
      if (missing.length > 0) {
        toast.error("Falta información para enviar este pedido a fábrica");
        setTab("revisar");
        return;
      }
    }

    setPendingStatus(status);
    startTransition(async () => {
      const result = await onSubmit(orderId, payload);
      if (result?.error) {
        toast.error(result.error);
        setTab("revisar");
      }
      setPendingStatus(null);
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      {folio && (
        <div className="mb-5 flex items-center justify-between rounded-lg border border-border bg-surface-2 px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Folio</span>
          <span className="font-mono text-base font-semibold text-ink">{folio}</span>
        </div>
      )}
      <div className="no-print mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "bg-accent text-accent-ink" : "text-ink-soft hover:bg-surface-2"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === "datos" ? "block" : "hidden"}>
        <DatosGeneralesSection
          state={state}
          salespeople={salespeople}
          onChange={patch}
          folioPreview={folioPreview}
          locked={!!folio}
        />
      </div>

      <div className={tab === "productos" ? "block" : "hidden"}>
        <ProductosSection orderId={orderId} items={state.items} onChange={(items) => patch({ items })} />
      </div>

      {state.productType === "proyector_gobo" && (
        <div className={tab === "productos" ? "mt-5 block" : "hidden"}>
          <ProyectorSection
            orderId={orderId}
            value={state.projector}
            onChange={(p) => patch({ projector: { ...state.projector, ...p } })}
          />
        </div>
      )}

      <div className={tab === "imagenes" ? "block" : "hidden"}>
        <ImagenesSection
          orderId={orderId}
          images={state.images}
          files={state.files}
          onImagesChange={(images) => patch({ images })}
          onFilesChange={(files) => patch({ files })}
        />
      </div>

      <div className={tab === "observaciones" ? "block" : "hidden"}>
        <ObservacionesSection value={state.vendorNotes} onChange={(vendorNotes) => patch({ vendorNotes })} />
      </div>

      <div className={tab === "revisar" ? "block" : "hidden"}>
        <RevisarSection
          state={state}
          salespeople={salespeople}
          missingFields={missingFields}
          editableStatus={isEdit}
          onStatusChange={(status) => patch({ status })}
        />
      </div>

      <div className="no-print mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancelar
        </Button>
        <div className="flex gap-2">
          {isEdit ? (
            <Button type="button" loading={isPending} disabled={isPending} onClick={() => handleSubmit(state.status)}>
              {submitLabel.draft}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                loading={isPending && pendingStatus === "borrador"}
                disabled={isPending}
                onClick={() => handleSubmit("borrador")}
              >
                {submitLabel.draft}
              </Button>
              <Button
                type="button"
                loading={isPending && pendingStatus === "pedido"}
                disabled={isPending}
                onClick={() => handleSubmit("pedido")}
              >
                {submitLabel.order}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
