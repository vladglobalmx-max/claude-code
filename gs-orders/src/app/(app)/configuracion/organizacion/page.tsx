import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { isToggleableModuleKey, type ToggleableModuleKey } from "@/lib/organization-modules";
import { OrganizationSettingsForm } from "./organization-settings-form";
import { OrganizationModulesForm } from "./organization-modules-form";
import { updateOrganizationSettings } from "./actions";

export const dynamic = "force-dynamic";

/**
 * THÖREN 0084 — Configuración → Organización. Admin-only (layout.tsx de
 * este subárbol). Datos de la organización (trade_name/tax_id/currency/
 * timezone) y módulos habilitados/deshabilitados, ambos vía las RPC
 * dedicadas — nunca una escritura directa a `organizations`/
 * `organization_modules` (ninguna de las dos tiene policy de escritura,
 * ver 0084_organization_modules.sql).
 */
export default async function OrganizacionPage() {
  const supabase = createSupabaseServerClient();

  const { data: organizationId } = await supabase.rpc("current_user_organization_id");

  const { data: organization } = organizationId
    ? await supabase
        .from("organizations")
        .select("name, trade_name, tax_id, currency, timezone")
        .eq("id", organizationId)
        .single()
    : { data: null };

  const { data: disabledRows } = organizationId
    ? await supabase.from("organization_modules").select("module_key").eq("organization_id", organizationId).eq("enabled", false)
    : { data: [] };

  const disabledModules: ToggleableModuleKey[] = (disabledRows ?? [])
    .map((row) => row.module_key)
    .filter(isToggleableModuleKey);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PageHeader
        title="Organización"
        description="Datos comerciales y módulos habilitados de tu organización."
      />

      <Card>
        <CardHeader>
          <CardTitle>Datos de la organización</CardTitle>
        </CardHeader>
        <CardContent>
          <OrganizationSettingsForm
            action={updateOrganizationSettings}
            organizationName={organization?.name ?? "—"}
            initialTradeName={organization?.trade_name ?? ""}
            initialTaxId={organization?.tax_id ?? ""}
            initialCurrency={organization?.currency ?? "MXN"}
            initialTimezone={organization?.timezone ?? "America/Monterrey"}
          />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Módulos habilitados</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-ink-faint">
            Desactivar un módulo lo oculta del menú y bloquea el acceso directo por URL. Ningún dato se elimina —
            reactivarlo restaura el acceso normalmente.
          </p>
          <OrganizationModulesForm initialDisabledModules={disabledModules} />
        </CardContent>
      </Card>
    </div>
  );
}
