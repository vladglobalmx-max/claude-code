import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActiveBadge } from "@/components/ui/status-badge";
import { USER_ROLE_LABELS } from "@/types/domain";
import type { BusinessUnitRow } from "@/types/domain";

export const dynamic = "force-dynamic";

interface OneOrMany<T> {
  [index: number]: T;
}

interface PersonDetailRow {
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

function one<T>(value: T | OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : (value as T);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
      <span className="text-ink-faint">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

export default async function PersonaDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("people")
    .select(
      `id, name, email, active,
       user_profiles(user_id, role, active),
       salespeople(id, name, prefix, active),
       person_business_units(active, business_units(id, name, code, active))`
    )
    .eq("id", params.id)
    .single();

  if (!data) notFound();

  const person = data as unknown as PersonDetailRow;
  const profile = one(person.user_profiles);
  const salesperson = one(person.salespeople);
  const businessUnits = (person.person_business_units ?? [])
    .map((pbu) => ({ bu: one(pbu.business_units), active: pbu.active }))
    .filter((entry): entry is { bu: BusinessUnitRow; active: boolean } => entry.bu !== null);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/personas" className="mb-6 flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Personas
      </Link>

      <div className="space-y-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Identidad</CardTitle>
            <ActiveBadge active={person.active} />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Nombre" value={person.name} />
            <Row label="Email" value={person.email ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acceso THÖREN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Acceso" value={<Badge variant={profile ? "success" : "neutral"}>{profile ? "Con acceso" : "Sin acceso"}</Badge>} />
            {profile ? (
              <>
                <Row label="Rol" value={USER_ROLE_LABELS[profile.role as "admin" | "vendedor"]} />
                <Row label="Cuenta" value={<ActiveBadge active={profile.active} />} />
              </>
            ) : (
              <p className="pt-1 text-xs text-ink-faint">
                Esta persona no tiene una cuenta de usuario asociada — no puede iniciar sesión en THÖREN.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perfil comercial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {salesperson ? (
              <>
                <Row label="Vendedor" value={`${salesperson.name} (${salesperson.prefix})`} />
                <Row label="Estado comercial" value={<ActiveBadge active={salesperson.active} />} />
              </>
            ) : (
              <p className="text-ink-faint">Sin perfil comercial — esta persona no tiene un registro de vendedor asociado.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Units</CardTitle>
          </CardHeader>
          <CardContent>
            {businessUnits.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {businessUnits.map(({ bu, active }) => (
                  <Badge key={bu.id} variant={active ? "accent" : "neutral"}>
                    {bu.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-faint">Sin unidad asignada.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
