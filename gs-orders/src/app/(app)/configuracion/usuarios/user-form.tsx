"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import type { UserAccessRow, UserRole } from "@/types/domain";
import type { UserAccessFormState } from "./actions";
import { resetUserPassword } from "./actions";

interface SalespersonOption {
  id: string;
  name: string;
  prefix: string;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {label}
    </Button>
  );
}

export function UserAccessForm({
  action,
  user,
  availableSalespeople,
  submitLabel,
}: {
  action: (state: UserAccessFormState, formData: FormData) => Promise<UserAccessFormState>;
  user?: UserAccessRow;
  availableSalespeople: SalespersonOption[];
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, undefined);
  const [role, setRole] = useState<UserRole>(user?.role ?? "vendedor");
  const [isResetPending, startReset] = useTransition();
  const isEdit = !!user;

  function handleResetPassword() {
    if (!user) return;
    startReset(async () => {
      const result = await resetUserPassword(user.email);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Correo de restablecimiento enviado a ${user.email}`);
    });
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required defaultValue={user?.name} placeholder="Karla Saucedo" />
      </div>

      {isEdit ? (
        <div>
          <Label>Correo</Label>
          <p className="flex h-9 items-center rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink-soft">
            {user.email}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            El correo no se puede cambiar aquí. Usa &ldquo;Restablecer contraseña&rdquo; si el usuario perdió acceso.
          </p>
        </div>
      ) : (
        <div>
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" required placeholder="karla@globalsuppliermty.com" />
          <p className="mt-1 text-xs text-ink-faint">
            Se enviará una invitación para que el usuario defina su propia contraseña. GS Orders nunca guarda ni
            muestra contraseñas.
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="role">Rol</Label>
        <Select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          <option value="vendedor">VENDEDOR</option>
          <option value="admin">ADMIN</option>
        </Select>
      </div>

      {role === "vendedor" && (
        <div>
          <Label htmlFor="salesperson_id">Vendedor asociado</Label>
          <Select id="salesperson_id" name="salesperson_id" defaultValue={user?.salesperson_id ?? ""} required>
            <option value="">Selecciona…</option>
            {availableSalespeople.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name} ({sp.prefix})
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-ink-faint">
            Solo se listan vendedores sin otro usuario ya asociado{isEdit ? " (además del actual, si aplica)" : ""}.
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="active"
          defaultChecked={user?.active ?? true}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
        />
        Activo
      </label>

      {state?.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <SubmitButton label={submitLabel} />
        <Link href="/configuracion/usuarios" className={cn(buttonVariants({ variant: "outline" }))}>
          Cancelar
        </Link>
        {isEdit && (
          <Button
            type="button"
            variant="ghost"
            loading={isResetPending}
            disabled={isResetPending}
            onClick={handleResetPassword}
          >
            Restablecer contraseña
          </Button>
        )}
      </div>
    </form>
  );
}
