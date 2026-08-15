import Link from "next/link";
import { Users as UsersIcon } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ActiveBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { USER_ROLE_LABELS } from "@/types/domain";
import type { BusinessUnitRow } from "@/types/domain";
import { PersonFilters } from "./person-filters";

export const dynamic = "force-dynamic";

interface OneOrMany<T> {
  [index: number]: T;
}

interface PersonRow {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  user_profiles: { user_id: string; role: string; active: boolean } | OneOrMany<{ user_id: string; role: string; active: boolean }> | null;
  salespeople: { id: string; name: string; prefix: string; active: boolean } | OneOrMany<{ id: string; name: string; prefix: string; active: boolean }> | null;
  person_business_units:
    | { active: boolean; business_units: BusinessUnitRow | BusinessUnitRow[] | null }[]
    | null;
}

// Supabase/PostgREST puede devolver una relación 1:1 como objeto o como
// arreglo de un elemento según cómo detecte la unicidad — ver el mismo
// patrón ya resuelto para salesperson:salespeople(...) en pedidos/page.tsx.
function one<T>(value: T | OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : (value as T);
}

export default async function PersonasPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("people")
    .select(
      `id, name, email, active,
       user_profiles(user_id, role, active),
       salespeople(id, name, prefix, active),
       person_business_units(active, business_units(id, name, code, active))`
    )
    .order("name");

  if (searchParams.q) {
    const q = searchParams.q.trim();
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data } = await query;
  const people = (data ?? []) as unknown as PersonRow[];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Personas" description="Identidad humana central de THÖREN — usuarios, vendedores y unidades de negocio, en un solo lugar." />

      <PersonFilters />

      {people.length === 0 ? (
        <Card>
          <EmptyState
            icon={UsersIcon}
            title="No hay personas que coincidan"
            description="Ajusta la búsqueda, o confirma que existan personas dadas de alta en esta organización."
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {people.map((person) => {
              const profile = one(person.user_profiles);
              const salesperson = one(person.salespeople);
              const businessUnits = (person.person_business_units ?? [])
                .map((pbu) => one(pbu.business_units))
                .filter((bu): bu is BusinessUnitRow => bu !== null);

              return (
                <Card key={person.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/personas/${person.id}`} className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{person.name}</p>
                      {person.email && <p className="truncate text-xs text-ink-faint">{person.email}</p>}
                    </Link>
                    <ActiveBadge active={person.active} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge variant={profile ? "success" : "neutral"}>{profile ? "Con acceso" : "Sin acceso"}</Badge>
                    {profile && <Badge variant="accent">{USER_ROLE_LABELS[profile.role as "admin" | "vendedor"]}</Badge>}
                    <Badge variant="neutral">{salesperson ? `Vendedor (${salesperson.prefix})` : "Sin perfil comercial"}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    {businessUnits.length > 0 ? businessUnits.map((bu) => bu.name).join(" · ") : "Sin unidad asignada"}
                  </p>
                </Card>
              );
            })}
          </div>

          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Persona</Th>
                  <Th>Email</Th>
                  <Th>Acceso</Th>
                  <Th>Rol</Th>
                  <Th>Perfil comercial</Th>
                  <Th>Business Units</Th>
                  <Th>Estado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {people.map((person) => {
                  const profile = one(person.user_profiles);
                  const salesperson = one(person.salespeople);
                  const businessUnits = (person.person_business_units ?? [])
                    .map((pbu) => one(pbu.business_units))
                    .filter((bu): bu is BusinessUnitRow => bu !== null);

                  return (
                    <Tr key={person.id}>
                      <Td>
                        <Link href={`/personas/${person.id}`} className="font-medium text-accent hover:underline">
                          {person.name}
                        </Link>
                      </Td>
                      <Td className="text-ink-soft">{person.email ?? "—"}</Td>
                      <Td>
                        <Badge variant={profile ? "success" : "neutral"}>{profile ? "Con acceso" : "Sin acceso"}</Badge>
                      </Td>
                      <Td className="text-ink-soft">{profile ? USER_ROLE_LABELS[profile.role as "admin" | "vendedor"] : "—"}</Td>
                      <Td className="text-ink-soft">{salesperson ? `Vendedor (${salesperson.prefix})` : "Sin perfil comercial"}</Td>
                      <Td className="text-ink-soft">
                        {businessUnits.length > 0 ? businessUnits.map((bu) => bu.name).join(", ") : "Sin unidad asignada"}
                      </Td>
                      <Td>
                        <ActiveBadge active={person.active} />
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
