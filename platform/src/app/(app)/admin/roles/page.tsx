import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_PERMISSIONS, type RoleKey } from "@/lib/auth/permissions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: roles } = user
    ? await supabase
        .from("roles")
        .select("id, key, name, description, is_system")
        .or(`company_id.eq.${user.companyId},company_id.is.null`)
    : { data: [] };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {(roles ?? []).map((role) => (
        <Card key={role.id}>
          <CardHeader>
            <CardTitle>{role.name}</CardTitle>
            {role.is_system && <Badge tone="neutral">Rol de sistema</Badge>}
          </CardHeader>
          <CardContent>
            {role.description && <p className="mb-3 text-sm text-ink-soft">{role.description}</p>}
            <div className="flex flex-wrap gap-1.5">
              {(ROLE_PERMISSIONS[role.key as RoleKey] ?? []).map((permission) => (
                <Badge key={permission} tone="accent">
                  {permission}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
