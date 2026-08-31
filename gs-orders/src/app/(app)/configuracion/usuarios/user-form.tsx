"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import { USER_ROLE_LABELS, type UserAccessRow, type UserRole } from "@/types/domain";
import type { UserAccessFormState } from "./actions";
import { resetUserPassword, createUserAccessLink, generatePasswordResetLink } from "./actions";

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

/**
 * Muestra el enlace generado por generateLink (invite o recovery) para que
 * el ADMIN lo copie y lo envíe manualmente. GS Orders nunca lo guarda: solo
 * vive en el estado de este componente mientras la pantalla está abierta.
 */
function GeneratedLinkBox({
  actionLink,
  email,
  onDismiss,
}: {
  actionLink: string;
  email: string;
  onDismiss: () => void;
}) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(actionLink);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.");
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
      <p className="text-sm font-medium text-ink">Enlace de acceso para {email}</p>
      <p className="text-xs text-ink-faint">
        Cópialo y envíalo por WhatsApp o correo. Es de un solo uso y no queda guardado en THÖREN — si se pierde,
        genera uno nuevo.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={actionLink} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
        <Button type="button" variant="outline" onClick={handleCopy}>
          Copiar enlace
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onDismiss} className="text-xs text-ink-faint hover:underline">
          Cerrar
        </button>
        <Link href="/configuracion/usuarios" className="text-xs text-accent hover:underline">
          Volver a Usuarios y accesos
        </Link>
      </div>
    </div>
  );
}

export function UserAccessForm({
  action,
  user,
  availableSalespeople,
  submitLabel,
  canChooseRole = true,
}: {
  action: (state: UserAccessFormState, formData: FormData) => Promise<UserAccessFormState>;
  user?: UserAccessRow;
  availableSalespeople: SalespersonOption[];
  submitLabel: string;
  /**
   * THÖREN 6R.1B-4B — false para un titular de can_manage_users (no admin):
   * el role queda fijo en "vendedor", sin selector visible, y se manda un
   * input oculto para que el payload siga incluyendo `role` como siempre
   * espera el schema/servidor. El guard TS real (que un no-admin nunca
   * puede mandar otro role) vive en actions.ts — esto es solo UX, nunca la
   * única barrera.
   */
  canChooseRole?: boolean;
}) {
  const [state, formAction] = useFormState(action, undefined);
  const [role, setRole] = useState<UserRole>(canChooseRole ? user?.role ?? "vendedor" : "vendedor");
  const [isResetPending, startReset] = useTransition();
  const [isLinkPending, startLink] = useTransition();
  const [linkResult, setLinkResult] = useState<{ actionLink: string; email: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isEdit = !!user;

  // Un envío nuevo de "Enviar invitación por correo" invalida cualquier
  // enlace mostrado antes, para no dejar dos mensajes contradictorios en
  // pantalla a la vez.
  useEffect(() => {
    if (state !== undefined) {
      setLinkResult(null);
      setLinkError(null);
    }
  }, [state]);

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

  function handleGenerateLink() {
    setLinkError(null);
    setLinkResult(null);

    if (isEdit) {
      startLink(async () => {
        const result = await generatePasswordResetLink(user.email);
        if ("error" in result) {
          setLinkError(result.error);
          toast.error(result.error);
          return;
        }
        setLinkResult({ actionLink: result.actionLink, email: result.email });
      });
      return;
    }

    if (!formRef.current || !formRef.current.reportValidity()) return;
    const formData = new FormData(formRef.current);
    startLink(async () => {
      const result = await createUserAccessLink(formData);
      if ("error" in result) {
        setLinkError(result.error);
        toast.error(result.error);
        return;
      }
      setLinkResult({ actionLink: result.actionLink, email: result.email });
    });
  }

  const visibleError = linkResult ? null : linkError ?? state?.error;

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
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
            El correo no se puede cambiar aquí. Usa &ldquo;Restablecer contraseña&rdquo; o &ldquo;Generar nuevo
            enlace de acceso&rdquo; si el usuario perdió acceso. Ninguna de las dos crea una cuenta nueva ni toca su
            vendedor asociado.
          </p>
        </div>
      ) : (
        <div>
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" required placeholder="karla@globalsuppliermty.com" />
          <p className="mt-1 text-xs text-ink-faint">
            &ldquo;Enviar invitación por correo&rdquo; manda un enlace automático. Si el envío de correo está
            limitado temporalmente, usa &ldquo;Generar enlace de acceso&rdquo; para compartirlo tú mismo. THÖREN
            nunca guarda ni muestra contraseñas.
          </p>
        </div>
      )}

      {canChooseRole ? (
        <div>
          <Label htmlFor="role">Rol</Label>
          <Select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="vendedor">VENDEDOR</option>
            <option value="admin">ADMIN</option>
          </Select>
        </div>
      ) : (
        <div>
          <Label>Rol</Label>
          <p className="flex h-9 items-center rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink-soft">
            {USER_ROLE_LABELS.vendedor}
          </p>
          <input type="hidden" name="role" value="vendedor" />
        </div>
      )}

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

      {visibleError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{visibleError}</p>}
      {linkResult && (
        <GeneratedLinkBox
          actionLink={linkResult.actionLink}
          email={linkResult.email}
          onDismiss={() => setLinkResult(null)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <SubmitButton label={submitLabel} />
        {!isEdit && (
          <Button
            type="button"
            variant="outline"
            loading={isLinkPending}
            disabled={isLinkPending}
            onClick={handleGenerateLink}
          >
            Generar enlace de acceso
          </Button>
        )}
        <Link href="/configuracion/usuarios" className={cn(buttonVariants({ variant: "outline" }))}>
          Cancelar
        </Link>
        {isEdit && (
          <>
            <Button
              type="button"
              variant="ghost"
              loading={isResetPending}
              disabled={isResetPending}
              onClick={handleResetPassword}
            >
              Restablecer contraseña
            </Button>
            <Button
              type="button"
              variant="ghost"
              loading={isLinkPending}
              disabled={isLinkPending}
              onClick={handleGenerateLink}
            >
              Generar nuevo enlace de acceso
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
