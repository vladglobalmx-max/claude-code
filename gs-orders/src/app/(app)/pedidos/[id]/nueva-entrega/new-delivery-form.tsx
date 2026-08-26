"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/utils/format";
import { DELIVERY_TYPE_LABELS } from "@/types/domain";
import type { DeliveryType } from "@/types/domain";
import type { CreateDeliveryPayload } from "@/lib/validations/delivery";
import { createDelivery } from "../../../entregas/actions";
import type { DeliverableItem } from "./page";

interface SelectedItem {
  selected: boolean;
  quantity: number;
}

/**
 * THÖREN Fase 6P — selecciona una o varias partidas ya SURTIDAS del Pedido
 * origen para entregarlas. El tope de cada partida es `pendingToDeliver`
 * (surtido - ya entregado en otras Entregas no canceladas), NUNCA la
 * cantidad pedida — ver rpc_order_delivery_progress (0039).
 */
export function NewDeliveryForm({ deliveryId, orderId, items }: { deliveryId: string; orderId: string; items: DeliverableItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("entrega");
  const [scheduledDate, setScheduledDate] = useState("");
  const [actualDatetime, setActualDatetime] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [installerName, setInstallerName] = useState("");
  const [installationDatetime, setInstallationDatetime] = useState("");
  const [installationNotes, setInstallationNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [selection, setSelection] = useState<Record<string, SelectedItem>>(() =>
    Object.fromEntries(items.map((item) => [item.catalogProductId, { selected: false, quantity: item.pendingToDeliver }]))
  );

  const isInstallation = deliveryType === "instalacion" || deliveryType === "entrega_instalacion";
  const deliverableItems = items.filter((item) => item.pendingToDeliver > 0);

  function toggleItem(productId: string, selected: boolean) {
    setSelection((prev) => ({ ...prev, [productId]: { selected, quantity: prev[productId]?.quantity ?? 1 } }));
  }

  function setQuantity(productId: string, quantity: number) {
    setSelection((prev) => ({ ...prev, [productId]: { selected: prev[productId]?.selected ?? false, quantity } }));
  }

  function handleSubmit() {
    const selectedItems = deliverableItems.filter((item) => selection[item.catalogProductId]?.selected);
    if (selectedItems.length === 0) {
      toast.error("Selecciona al menos una partida");
      return;
    }
    for (const item of selectedItems) {
      const quantity = selection[item.catalogProductId]?.quantity ?? 0;
      if (!(quantity > 0)) {
        toast.error(`La cantidad a entregar de "${item.model}" debe ser mayor a cero`);
        return;
      }
      if (quantity > item.pendingToDeliver) {
        toast.error(`No puedes entregar más de lo surtido pendiente de "${item.model}" (${item.pendingToDeliver})`);
        return;
      }
    }

    const payload: CreateDeliveryPayload = {
      order_id: orderId,
      details: {
        delivery_type: deliveryType,
        scheduled_date: scheduledDate || undefined,
        actual_datetime: actualDatetime || undefined,
        address: address || undefined,
        contact_name: contactName || undefined,
        contact_phone: contactPhone || undefined,
        responsible_name: responsibleName || undefined,
        installer_name: isInstallation ? installerName || undefined : undefined,
        installation_datetime: isInstallation ? installationDatetime || undefined : undefined,
        installation_notes: isInstallation ? installationNotes || undefined : undefined,
        notes: notes || undefined,
        received_by_name: undefined,
        customer_observations: undefined,
      },
      items: selectedItems.map((item) => ({
        catalog_product_id: item.catalogProductId,
        quantity_delivered: selection[item.catalogProductId]?.quantity ?? 0,
      })),
    };

    startTransition(async () => {
      const result = await createDelivery(deliveryId, payload);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      router.push(`/pedidos/${orderId}`);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="delivery_type">Tipo</Label>
        <Select id="delivery_type" value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}>
          {Object.entries(DELIVERY_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="scheduled_date">Fecha programada</Label>
          <Input id="scheduled_date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="actual_datetime">Fecha/hora real (opcional)</Label>
          <Input
            id="actual_datetime"
            type="datetime-local"
            value={actualDatetime}
            onChange={(e) => setActualDatetime(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="address">Dirección/lugar (opcional)</Label>
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="responsible_name">Responsable interno (opcional)</Label>
          <Input id="responsible_name" value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="contact_name">Contacto en sitio (opcional)</Label>
          <Input id="contact_name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="contact_phone">Teléfono de contacto (opcional)</Label>
          <Input id="contact_phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
      </div>

      {isInstallation && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Instalación</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="installer_name">Técnico/responsable (opcional)</Label>
              <Input id="installer_name" value={installerName} onChange={(e) => setInstallerName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="installation_datetime">Fecha/hora de instalación (opcional)</Label>
              <Input
                id="installation_datetime"
                type="datetime-local"
                value={installationDatetime}
                onChange={(e) => setInstallationDatetime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="installation_notes">Notas de instalación (opcional)</Label>
            <Textarea id="installation_notes" rows={2} value={installationNotes} onChange={(e) => setInstallationNotes(e.target.value)} />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div>
        <Label>Partidas surtidas pendientes de entregar</Label>
        {deliverableItems.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">Este Pedido no tiene partidas surtidas pendientes de entregar.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {deliverableItems.map((item) => (
              <div key={item.catalogProductId} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                  checked={selection[item.catalogProductId]?.selected ?? false}
                  onChange={(e) => toggleItem(item.catalogProductId, e.target.checked)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{item.model}</p>
                  {item.description && <p className="text-xs text-ink-faint">{item.description}</p>}
                  <p className="text-xs text-ink-faint">
                    Pedido: {formatNumber(item.ordered)} · Surtido: {formatNumber(item.fulfilled)} · Ya entregado:{" "}
                    {formatNumber(item.delivered)} · Pendiente: {formatNumber(item.pendingToDeliver)}
                    {item.unit ? ` ${item.unit}` : ""}
                  </p>
                </div>
                <div className="w-24 shrink-0">
                  <Label htmlFor={`qty-${item.catalogProductId}`} className="text-xs">
                    A entregar
                  </Label>
                  <Input
                    id={`qty-${item.catalogProductId}`}
                    type="number"
                    min={1}
                    max={item.pendingToDeliver}
                    value={selection[item.catalogProductId]?.quantity ?? item.pendingToDeliver}
                    disabled={!selection[item.catalogProductId]?.selected}
                    onChange={(e) => setQuantity(item.catalogProductId, Number(e.target.value))}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" loading={isPending} disabled={isPending || deliverableItems.length === 0} onClick={handleSubmit}>
          Crear entrega
        </Button>
      </div>
    </div>
  );
}
