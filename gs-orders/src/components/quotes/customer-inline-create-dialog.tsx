"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Customer } from "@/types/domain";
import { createCustomerInline } from "@/app/(app)/cotizaciones/actions";

/**
 * Alta rápida de Cliente sin salir de Nueva Cotización. NO reutiliza
 * CustomerForm (Q1): ese componente usa useFormState + redirect a
 * /clientes, incompatible con un modal que debe quedarse en la página y
 * devolver el Customer recién creado para auto-seleccionarlo. Reutiliza en
 * cambio createCustomerInline (cotizaciones/actions.ts), que a su vez
 * delega en createCustomerWithOptionalContact — misma semántica aprobada
 * de Email/Teléfono que la importación Excel: si "Contacto" tiene valor,
 * Email/Teléfono se guardan en el contacto (customer_contacts), no en el
 * Customer. Cero modificaciones a clientes/actions.ts, a
 * clientes/customer-form.tsx, ni al schema/RPC de Quotes.
 */
export function CustomerInlineCreateDialog({ onCreated }: { onCreated: (customer: Customer) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setLegalName("");
    setTaxId("");
    setContactName("");
    setEmail("");
    setPhone("");
    setError(null);
  }

  function handleSubmit() {
    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createCustomerInline({
        name,
        legal_name: legalName || undefined,
        tax_id: taxId || undefined,
        contact_name: contactName || undefined,
        email: email || undefined,
        phone: phone || undefined,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.success("Cliente creado");
      onCreated(result.customer);
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="h-3.5 w-3.5" />
          Nuevo cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>Se agregará a Clientes y quedará seleccionado en esta cotización.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="inline-customer-name">Nombre</Label>
            <Input
              id="inline-customer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Constructora del Norte"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="inline-customer-legal-name">Razón social (opcional)</Label>
            <Input id="inline-customer-legal-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inline-customer-tax-id">RFC (opcional)</Label>
            <Input
              id="inline-customer-tax-id"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="font-mono uppercase"
            />
          </div>
          <div>
            <Label htmlFor="inline-customer-contact-name">Contacto (opcional)</Label>
            <Input
              id="inline-customer-contact-name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Nombre de la persona de contacto"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="inline-customer-email">Email (opcional)</Label>
              <Input id="inline-customer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="inline-customer-phone">Teléfono (opcional)</Label>
              <Input id="inline-customer-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-ink-faint">
            {contactName
              ? "Email y teléfono se guardarán como datos de este contacto."
              : "Sin un contacto capturado, email y teléfono se guardan directo en el cliente."}
          </p>
          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" loading={isPending} disabled={isPending} onClick={handleSubmit}>
            Crear cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
