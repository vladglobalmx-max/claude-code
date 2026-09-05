"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OrderPayload } from "@/lib/validations/order";
import { computeFolioPreview } from "@/lib/folio-preview";
import { catalogProductsById, findIncompatibleItems } from "@/lib/orders/catalog-picker";
import { getMissingRequiredCustomFields } from "@/lib/custom-fields/completeness";
import type { CustomFieldDefinition } from "@/lib/custom-fields/types";
import type { OrderStatus, ProductTypeItem, Salesperson } from "@/types/domain";
import type { OrderActionResult } from "@/app/(app)/pedidos/actions";
import { DatosGeneralesSection } from "./datos-generales-section";
import { ProductosSection } from "./productos-section";
import { ImagenesSection } from "./imagenes-section";
import { ObservacionesSection } from "./observaciones-section";
import { RevisarSection } from "./revisar-section";
import type { CatalogProductOption, OrderFormState } from "./types";

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
    business_unit_id: state.businessUnitId || null,
    client_name: state.clientName,
    supplier_name: state.supplierName || undefined,
    product_type: state.productType,
    status,
    general_notes: state.generalNotes || undefined,
    vendor_notes: state.vendorNotes || undefined,
    vendor_notes_en: state.vendorNotesEn || undefined,
    supplier_commitment_date: state.supplierCommitmentDate || undefined,
    estimated_reception_date: state.estimatedReceptionDate || undefined,
    scheduled_delivery_date: state.scheduledDeliveryDate || undefined,
    actual_completion_date: state.actualCompletionDate || undefined,
    items: state.items.map((item) => ({
      model: item.model,
      description: item.description || undefined,
      quantity: item.quantity,
      notes: item.notes || undefined,
      image_path: item.image?.path ?? null,
      reference_images: item.referenceImages.map((img) => ({ path: img.path, name: img.name, type: img.type })),
      // THÖREN 8C — ninguno de estos campos depende ya de isProjector: su
      // VISIBILIDAD en el formulario sale de custom_field_definitions (ver
      // ProductosSection), así que se envían siempre — un campo que el
      // usuario nunca vio queda con su valor de borrador vacío, que el RPC
      // (0058/0059) simplemente ignora si no hay una definición activa
      // para esa organización/BU.
      catalog_product_id: item.catalogProductId,
      color: item.color || undefined,
      unit: item.unit || undefined,
      customer_requirements: item.customerRequirements || undefined,
      power: item.power || undefined,
      lens_type: item.lensType || undefined,
      lens_pending_factory: item.lensPendingFactory,
      projection_description: item.projectionDescription || undefined,
      projection_description_en: item.projectionDescriptionEn || undefined,
      projection_images: item.projectionImages.map((img) => ({ path: img.path, name: img.name, type: img.type })),
      projection_width: item.projectionWidth ? Number(item.projectionWidth) : undefined,
      projection_height: item.projectionHeight ? Number(item.projectionHeight) : undefined,
      projection_size_unit: item.projectionSizeUnit,
      installation_height: item.installationHeight ? Number(item.installationHeight) : undefined,
      installation_height_unit: item.installationHeightUnit,
      installation_distance: item.installationDistance ? Number(item.installationDistance) : undefined,
      installation_orientation: item.orientation || undefined,
      installation_use: item.use || undefined,
      surface_type: item.surfaceType || undefined,
      surface_material: item.surfaceMaterial || undefined,
      surface_notes: item.surfaceNotes || undefined,
      surface_notes_en: item.surfaceNotesEn || undefined,
      // custom_field_values lleva tanto los campos de texto/número/select/
      // checkbox como, para "file"/"image", un JSON de rutas de Storage
      // (ver fn_apply_order_item_custom_fields, 0059) — projection_images
      // (Thunder) se serializa aquí igual que cualquier otro adjunto
      // genérico, nunca como un caso especial del RPC.
      custom_field_values: {
        ...item.customFieldValues,
        projection_images: JSON.stringify(item.projectionImages.map((img) => img.path)),
        ...Object.fromEntries(
          Object.entries(item.customFieldFiles).map(([key, files]) => [
            key,
            JSON.stringify(files.map((f) => f.path)),
          ])
        ),
      },
    })),
    images: state.images.map((img) => ({ storage_path: img.path, caption: img.caption || undefined })),
    files: state.files.map((f) => ({
      storage_path: f.path,
      file_name: f.name,
      file_type: f.type || undefined,
      file_size: f.size,
    })),
  };
}

export function OrderForm({
  orderId,
  salespeople,
  businessUnits,
  catalogProducts,
  productTypes,
  customFieldDefinitions = [],
  requireSupplierBeforeOrderByBusinessUnit = {},
  initialState,
  folio,
  canChooseSalesperson = true,
  submitLabel = { draft: "Guardar borrador", order: "Generar pedido" },
  onSubmit,
}: {
  orderId: string;
  salespeople: Salesperson[];
  /** Fase 6F — Business Units de la organización, para el selector de datos generales. */
  businessUnits: { id: string; name: string }[];
  catalogProducts: CatalogProductOption[];
  productTypes: ProductTypeItem[];
  /** THÖREN 8B — definiciones de custom_field_definitions (entity_type="order_item") de toda la organización, sin filtrar por BU (ver ProductosSection). */
  customFieldDefinitions?: CustomFieldDefinition[];
  /** THÖREN 8D (gap final) — por business_unit_id, si esa BU exige Proveedor antes de "Pedido" (0062, requisito CORE, no un custom field). */
  requireSupplierBeforeOrderByBusinessUnit?: Record<string, boolean>;
  initialState: OrderFormState;
  folio?: string;
  /** false para VENDEDOR: nunca puede elegir a nombre de quién se crea el pedido. */
  canChooseSalesperson?: boolean;
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

  const productsById = useMemo(() => catalogProductsById(catalogProducts), [catalogProducts]);

  /**
   * Bloquea el cambio de Business Unit del Order (Fase 6F §5) si alguna
   * línea ya elegida del catálogo dejaría de ser válida para la nueva BU.
   * A diferencia de Quotes, business_unit_id de un Order NUNCA queda
   * inmutable por generar folio (0022/0032 lo permiten editar siempre vía
   * rpc_update_order) — este bloqueo aplica tanto en crear como en editar.
   * Nunca elimina líneas en silencio: si hay incompatibles, se rechaza el
   * cambio y se explica cuáles hay que quitar primero.
   */
  function tryChangeBusinessUnit(businessUnitId: string) {
    if (!businessUnitId || businessUnitId === state.businessUnitId) {
      patch({ businessUnitId });
      return;
    }
    const incompatible = findIncompatibleItems(state.items, productsById, businessUnitId);
    if (incompatible.length > 0) {
      const names = incompatible.map(({ product }) => product.name).join(", ");
      toast.error(
        `No puedes cambiar de Business Unit: ${names} no ${incompatible.length === 1 ? "está disponible" : "están disponibles"} para la nueva Business Unit. Quita esa línea primero.`
      );
      return;
    }
    patch({ businessUnitId });
  }

  const activeSalesperson = salespeople.find((sp) => sp.id === state.salespersonId);
  const folioPreview = useMemo(
    () => computeFolioPreview(activeSalesperson?.prefix, activeSalesperson?.sequence_current, state.orderDate),
    [activeSalesperson, state.orderDate]
  );

  const missingFields = useMemo(() => {
    const customMissing = getMissingRequiredCustomFields(customFieldDefinitions, state.businessUnitId, state.items);
    // THÖREN 8D (gap final) — requisito CORE (Proveedor), no un custom
    // field: se combina en la misma lista de faltantes, nunca en un
    // mensaje aparte. La autoridad real de este chequeo vive en el
    // servidor (fn_get_missing_required_before_order_fields, 0062); esto
    // es solo la capa de UX.
    const requiresSupplier = !!requireSupplierBeforeOrderByBusinessUnit[state.businessUnitId];
    if (requiresSupplier && !state.supplierName.trim()) {
      return ["Proveedor", ...customMissing];
    }
    return customMissing;
  }, [customFieldDefinitions, state.businessUnitId, state.items, state.supplierName, requireSupplierBeforeOrderByBusinessUnit]);

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

    if (status === "pedido" && missingFields.length > 0) {
      toast.error(`No puedes continuar. Completa los campos requeridos: ${missingFields.join(", ")}`);
      setTab("revisar");
      return;
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
      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="no-print">
        <TabsList className="mb-6 w-full sm:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="datos">
          <DatosGeneralesSection
            state={state}
            salespeople={salespeople}
            businessUnits={businessUnits}
            productTypes={productTypes}
            onChange={patch}
            onBusinessUnitChange={tryChangeBusinessUnit}
            folioPreview={folioPreview}
            locked={!!folio}
            canChooseSalesperson={canChooseSalesperson}
          />
        </TabsContent>

        <TabsContent value="productos">
          <ProductosSection
            orderId={orderId}
            businessUnitId={state.businessUnitId}
            items={state.items}
            catalogProducts={catalogProducts}
            customFieldDefinitions={customFieldDefinitions}
            onChange={(items) => patch({ items })}
          />
        </TabsContent>

        <TabsContent value="imagenes">
          <ImagenesSection
            orderId={orderId}
            images={state.images}
            files={state.files}
            onImagesChange={(images) => patch({ images })}
            onFilesChange={(files) => patch({ files })}
          />
        </TabsContent>

        <TabsContent value="observaciones">
          <ObservacionesSection
            value={state.vendorNotes}
            onChange={(vendorNotes) => patch({ vendorNotes })}
            valueEn={state.vendorNotesEn}
            onChangeEn={(vendorNotesEn) => patch({ vendorNotesEn })}
          />
        </TabsContent>

        <TabsContent value="revisar">
          <RevisarSection
            state={state}
            salespeople={salespeople}
            productTypes={productTypes}
            customFieldDefinitions={customFieldDefinitions}
            missingFields={missingFields}
            editableStatus={isEdit}
            onStatusChange={(status) => patch({ status })}
          />
        </TabsContent>
      </Tabs>

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
