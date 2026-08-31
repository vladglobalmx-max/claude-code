import Link from "next/link";
import { Plus, Users as UsersIcon } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isFullAdmin } from "@/lib/auth/user-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ActiveBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { USER_ROLE_LABELS, type UserAccessRow } from "@/types/domain";
import { ADMIN_PROTECTED_ERROR } from "./constants";

export const dynamic = "force-dynamic";

interface PersonLink {
  id: string;
  name: string;
}

interface OneOrMany<T> {
  [index: number]: T;
}

function one<T>(value: T | OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : (value as T);
}

export default async function UsuariosPage({ searchParams }: { searchParams?: { error?: string } }) {
  const supabase = createSupabaseServerClient();

  // THÖREN 6R.1B-4B — un titular de can_manage_users llega aquí con el
  // mismo listado, org-scoped por RLS/RPC desde 0046 (sin cambios de
  // backend); lo único que distingue esta pantalla por actor es qué
  // ACCIÓN se ofrece por fila (ver `admin` más abajo).
  const [profile, { data: usersData }, { data: linksData }] = await Promise.all([
    getCurrentProfile(),
    supabase.rpc("admin_list_user_profiles"),
    supabase.from("user_profiles").select("user_id, people(id, name)"),
  ]);
  const admin = isFullAdmin(profile);

  // admin_list_user_profiles() (0011) no expone person_id — se complementa
  // aquí con una lectura aparte de user_profiles.person_id + people, ambas
  // ya permitidas para admin por RLS existente. Ningún cambio de backend.
  const users = (usersData ?? []) as UserAccessRow[];
  const personByUserId = new Map<string, PersonLink>();
  for (const row of (linksData ?? []) as { user_id: string; people: PersonLink | OneOrMany<PersonLink> | null }[]) {
    const person = one(row.people);
    if (person) personByUserId.set(row.user_id, person);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="Usuarios y accesos"
        description="Administra quién puede ingresar a THÖREN y qué permisos tiene."
        actions={
          <Link href="/configuracion/usuarios/nuevo">
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo usuario
            </Button>
          </Link>
        }
      />

      {searchParams?.error === ADMIN_PROTECTED_ERROR && (
        <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          No tienes autorización para modificar cuentas administradoras.
        </p>
      )}

      {users.length === 0 ? (
        <Card>
          <EmptyState
            icon={UsersIcon}
            title="Todavía no hay usuarios"
            description="Crea el primer acceso para que un vendedor pueda entrar a THÖREN."
            action={
              <Link href="/configuracion/usuarios/nuevo">
                <Button>
                  <Plus className="h-4 w-4" />
                  Nuevo usuario
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {users.map((u) => {
              const person = personByUserId.get(u.user_id);
              // THÖREN 6R.1B-4B — un titular de can_manage_users (no admin)
              // ve las cuentas admin en modo SOLO LECTURA: sin enlace a
              // Editar. El backend (0046) ya lo rechazaría de todas formas,
              // pero la UI no debe ni siquiera ofrecer el camino.
              const readOnly = !admin && u.role === "admin";
              const nameBlock = (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{u.name}</p>
                  <p className="truncate text-xs text-ink-faint">{u.email}</p>
                </div>
              );
              return (
                <Card key={u.user_id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    {readOnly ? nameBlock : (
                      <Link href={`/configuracion/usuarios/${u.user_id}/editar`} className="min-w-0">
                        {nameBlock}
                      </Link>
                    )}
                    <ActiveBadge active={u.active} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge variant={u.role === "admin" ? "accent" : "neutral"}>{USER_ROLE_LABELS[u.role]}</Badge>
                    <Badge variant="neutral">
                      {u.salesperson_name ? `Vendedor (${u.salesperson_prefix})` : "Sin perfil comercial"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    Persona:{" "}
                    {person ? (
                      <Link href={`/personas/${person.id}`} className="text-accent hover:underline">
                        {person.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </p>
                </Card>
              );
            })}
          </div>

          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Usuario</Th>
                  <Th>Persona</Th>
                  <Th>Vendedor</Th>
                  <Th>Rol</Th>
                  <Th>Estado</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {users.map((u) => {
                  const person = personByUserId.get(u.user_id);
                  return (
                    <Tr key={u.user_id}>
                      <Td>
                        <p className="font-medium text-ink">{u.name}</p>
                        <p className="text-xs text-ink-faint">{u.email}</p>
                      </Td>
                      <Td className="text-ink-soft">
                        {person ? (
                          <Link href={`/personas/${person.id}`} className="text-accent hover:underline">
                            {person.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-ink-soft">
                        {u.salesperson_name ? `${u.salesperson_name} (${u.salesperson_prefix})` : "—"}
                      </Td>
                      <Td>
                        <Badge variant={u.role === "admin" ? "accent" : "neutral"}>{USER_ROLE_LABELS[u.role]}</Badge>
                      </Td>
                      <Td>
                        <ActiveBadge active={u.active} />
                      </Td>
                      <Td className="text-right">
                        {!admin && u.role === "admin" ? (
                          <span className="text-sm text-ink-faint">Solo lectura</span>
                        ) : (
                          <Link href={`/configuracion/usuarios/${u.user_id}/editar`} className="text-sm text-accent hover:underline">
                            Editar
                          </Link>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
