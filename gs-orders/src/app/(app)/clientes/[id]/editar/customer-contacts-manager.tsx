"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Star, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { CustomerContact } from "@/types/domain";
import {
  addCustomerContact,
  updateCustomerContact,
  setCustomerContactActive,
  setPrimaryCustomerContact,
} from "../../actions";

function ContactRow({ customerId, contact }: { customerId: string; contact: CustomerContact }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function cancelEdit() {
    setEditing(false);
    setName(contact.name);
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    setError(null);
  }

  function handleSave() {
    setError(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("email", email);
    fd.set("phone", phone);
    startTransition(async () => {
      const result = await updateCustomerContact(customerId, contact.id, fd);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      toast.success("Contacto actualizado");
      setEditing(false);
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      const result = await setCustomerContactActive(customerId, contact.id, !contact.active);
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(contact.active ? "Contacto desactivado" : "Contacto activado");
    });
  }

  function handleSetPrimary() {
    startTransition(async () => {
      const result = await setPrimaryCustomerContact(customerId, contact.id);
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Contacto marcado como principal");
    });
  }

  if (editing) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor={`contact-name-${contact.id}`}>Nombre</Label>
            <Input id={`contact-name-${contact.id}`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`contact-email-${contact.id}`}>Email</Label>
            <Input
              id={`contact-email-${contact.id}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`contact-phone-${contact.id}`}>Teléfono</Label>
            <Input
              id={`contact-phone-${contact.id}`}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" size="sm" loading={isPending} onClick={handleSave}>
            <Check className="h-3.5 w-3.5" />
            Guardar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
            <X className="h-3.5 w-3.5" />
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-ink">{contact.name}</p>
          {contact.is_primary && contact.active && <Badge variant="accent">Principal</Badge>}
          <Badge variant={contact.active ? "success" : "neutral"}>{contact.active ? "Activo" : "Inactivo"}</Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-faint">
          {contact.email ?? "—"} · {contact.phone ?? "—"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {contact.active && !contact.is_primary && (
          <Button type="button" size="sm" variant="outline" loading={isPending} onClick={handleSetPrimary}>
            <Star className="h-3.5 w-3.5" />
            Marcar principal
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
        <Button type="button" size="sm" variant="ghost" loading={isPending} onClick={handleToggleActive}>
          {contact.active ? "Desactivar" : "Activar"}
        </Button>
      </div>
    </div>
  );
}

function AddContactForm({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setError(null);
  }

  function handleSubmit() {
    setError(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("email", email);
    fd.set("phone", phone);
    startTransition(async () => {
      const result = await addCustomerContact(customerId, fd);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      toast.success("Contacto agregado");
      reset();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Agregar contacto
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="new-contact-name">Nombre</Label>
          <Input id="new-contact-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <Label htmlFor="new-contact-email">Email (opcional)</Label>
          <Input id="new-contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="new-contact-phone">Teléfono (opcional)</Label>
          <Input id="new-contact-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" loading={isPending} onClick={handleSubmit}>
          Guardar contacto
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/**
 * Gestión de contactos del Customer (0021_core_customer_contacts.sql):
 * listar, agregar, editar, activar/desactivar, cambiar principal. Sin
 * DELETE físico — "Desactivar" es el único mecanismo, igual que el propio
 * Customer. "Marcar principal" es un solo UPDATE: el trigger
 * trg_customer_contacts_enforce_primary degrada al anterior dentro de la
 * misma transacción.
 */
export function CustomerContactsManager({ customerId, contacts }: { customerId: string; contacts: CustomerContact[] }) {
  const sorted = [...contacts].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <p className="text-sm text-ink-faint">Este cliente no tiene contactos registrados todavía.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((contact) => (
            <ContactRow key={contact.id} customerId={customerId} contact={contact} />
          ))}
        </div>
      )}
      <AddContactForm customerId={customerId} />
    </div>
  );
}
