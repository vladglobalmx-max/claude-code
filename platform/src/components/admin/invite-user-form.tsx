"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect } from "react";
import { toast } from "sonner";
import { FormField, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { inviteUserAction, type InviteUserState } from "@/app/(app)/admin/users/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} size="sm">
      Invitar
    </Button>
  );
}

export function InviteUserForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState<InviteUserState, FormData>(inviteUserAction, {});

  useEffect(() => {
    if (state.success) toast.success("Invitación enviada");
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <FormField label="Nombre completo" htmlFor="full_name">
        <Input id="full_name" name="full_name" required className="w-48" />
      </FormField>
      <FormField label="Correo" htmlFor="email">
        <Input id="email" name="email" type="email" required className="w-56" />
      </FormField>
      <FormField label="Rol" htmlFor="role_id">
        <select
          id="role_id"
          name="role_id"
          required
          className="h-9 w-44 rounded-md border border-border bg-surface-2 px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </FormField>
      <SubmitButton />
    </form>
  );
}
