import Link from "next/link";
import { Plus, Users as UsersIcon } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { USER_ROLE_LABELS, type UserAccessRow } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.rpc("admin_list_user_profiles");
  const users = (data ?? []) as UserAccessRow[];

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Usuarios y accesos</h1>
          <p className="mt-0.5 text-sm text-ink-faint">Administra quién puede ingresar a GS Orders y qué permisos tiene.</p>
        </div>
        <Link href="/configuracion/usuarios/nuevo">
          <Button>
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        </Link>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={UsersIcon}
            title="Todavía no hay usuarios"
            description="Crea el primer acceso para que un vendedor pueda entrar a GS Orders."
            action={
              <Link href="/configuracion/usuarios/nuevo">
                <Button>
                  <Plus className="h-4 w-4" />
                  Nuevo usuario
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table>
            <Thead>
              <Tr>
                <Th>Usuario</Th>
                <Th>Vendedor</Th>
                <Th>Rol</Th>
                <Th>Estado</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {users.map((u) => (
                <Tr key={u.user_id}>
                  <Td>
                    <p className="font-medium text-ink">{u.name}</p>
                    <p className="text-xs text-ink-faint">{u.email}</p>
                  </Td>
                  <Td className="text-ink-soft">
                    {u.salesperson_name ? `${u.salesperson_name} (${u.salesperson_prefix})` : "—"}
                  </Td>
                  <Td>
                    <Badge variant={u.role === "admin" ? "accent" : "neutral"}>{USER_ROLE_LABELS[u.role]}</Badge>
                  </Td>
                  <Td>
                    <Badge variant={u.active ? "success" : "neutral"}>{u.active ? "Activo" : "Inactivo"}</Badge>
                  </Td>
                  <Td className="text-right">
                    <Link href={`/configuracion/usuarios/${u.user_id}/editar`} className="text-sm text-accent hover:underline">
                      Editar
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
