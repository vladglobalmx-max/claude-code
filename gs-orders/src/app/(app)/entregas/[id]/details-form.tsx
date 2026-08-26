"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DELIVERY_TERMINAL_STATUSES } from "@/types/domain";
import type { Delivery } from "@/types/domain";
import { updateDeliveryDetails } from "../actions";

function toDateInput(value: string | null) {
  return value ?? "";
}

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  return value.slice(0, 16);
}

/**
 * THÖREN Fase 6P — edita solo cabecera (fechas/contacto/responsable/
 * instalación/notas/recepción del cliente). Bloqueado si la Entrega ya
 * está en un estado final (completada/cancelada) — rpc_update_delivery_details
 * lo rechazaría igual.
 */
export function DeliveryDetailsForm({ delivery }: { delivery: Delivery }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isFinal = DELIVERY_TERMINAL_STATUSES.includes(delivery.status);
  const isInstallation = delivery.delivery_type === "instalacion" || delivery.delivery_type === "entrega_instalacion";

  const [scheduledDate, setScheduledDate] = useState(toDateInput(delivery.scheduled_date));
  const [actualDatetime, setActualDatetime] = useState(toDateTimeInput(delivery.actual_datetime));
  const [address, setAddress] = useState(delivery.address ?? "");
  const [contactName, setContactName] = useState(delivery.contact_name ?? "");
  const [contactPhone, setContactPhone] = useState(delivery.contact_phone ?? "");
  const [responsibleName, setResponsibleName] = useState(delivery.responsible_name ?? "");
  const [installerName, setInstallerName] = useState(delivery.installer_name ?? "");
  const [installationDatetime, setInstallationDatetime] = useState(toDateTimeInput(delivery.installation_datetime));
  const [installationNotes, setInstallationNotes] = useState(delivery.installation_notes ?? "");
  const [notes, setNotes] = useState(delivery.notes ?? "");
  const [receivedByName, setReceivedByName] = useState(delivery.received_by_name ?? "");
  const [customerObservations, setCustomerObservations] = useState(delivery.customer_observations ?? "");

  function handleSave() {
    startTransition(async () => {
      const result = await updateDeliveryDetails(delivery.id, delivery.order_id, {
        delivery_type: delivery.delivery_type,
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
        received_by_name: receivedByName || undefined,
        customer_observations: customerObservations || undefined,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Cambios guardados");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="scheduled_date">Fecha programada</Label>
          <Input id="scheduled_date" type="date" disabled={isFinal} value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="actual_datetime">Fecha/hora real</Label>
          <Input
            id="actual_datetime"
            type="datetime-local"
            disabled={isFinal}
            value={actualDatetime}
            onChange={(e) => setActualDatetime(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="address">Dirección/lugar</Label>
          <Input id="address" disabled={isFinal} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="responsible_name">Responsable interno</Label>
          <Input id="responsible_name" disabled={isFinal} value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="contact_name">Contacto en sitio</Label>
          <Input id="contact_name" disabled={isFinal} value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="contact_phone">Teléfono de contacto</Label>
          <Input id="contact_phone" disabled={isFinal} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
      </div>

      {isInstallation && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Instalación</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="installer_name">Técnico/responsable</Label>
              <Input id="installer_name" disabled={isFinal} value={installerName} onChange={(e) => setInstallerName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="installation_datetime">Fecha/hora de instalación</Label>
              <Input
                id="installation_datetime"
                type="datetime-local"
                disabled={isFinal}
                value={installationDatetime}
                onChange={(e) => setInstallationDatetime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="installation_notes">Notas de instalación</Label>
            <Textarea
              id="installation_notes"
              rows={2}
              disabled={isFinal}
              value={installationNotes}
              onChange={(e) => setInstallationNotes(e.target.value)}
            />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" rows={2} disabled={isFinal} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="space-y-4 rounded-lg border border-border p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Recepción del cliente</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="received_by_name">Recibido por</Label>
            <Input id="received_by_name" disabled={isFinal} value={receivedByName} onChange={(e) => setReceivedByName(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="customer_observations">Observaciones del cliente</Label>
          <Textarea
            id="customer_observations"
            rows={2}
            disabled={isFinal}
            value={customerObservations}
            onChange={(e) => setCustomerObservations(e.target.value)}
          />
        </div>
      </div>

      {!isFinal && (
        <Button type="button" size="sm" variant="outline" loading={isPending} disabled={isPending} onClick={handleSave}>
          Guardar cambios
        </Button>
      )}
    </div>
  );
}
