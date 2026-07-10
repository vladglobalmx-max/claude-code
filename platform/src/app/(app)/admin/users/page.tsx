import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InviteUserForm } from "@/components/admin/invite-user-form";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: users } = user
    ? await supabase.from("users").select("id, full_name, email, status, roles(name)").eq("company_id", user.companyId)
    : { data: [] };

  const { data: roles } = user
    ? await supabase.from("roles").select("id, name").or(`company_id.eq.${user.companyId},company_id.is.null`)
    : { data: [] };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invitar usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteUserForm roles={roles ?? []} />
        </CardContent>
      </Card>

      <Table>
        <Thead>
          <tr>
            <Th>Nombre</Th>
            <Th>Correo</Th>
            <Th>Rol</Th>
            <Th>Estatus</Th>
          </tr>
        </Thead>
        <Tbody>
          {(users ?? []).map((u) => (
            <Tr key={u.id}>
              <Td className="font-medium text-ink">{u.full_name}</Td>
              <Td>{u.email}</Td>
              <Td>{(u as any).roles?.name}</Td>
              <Td>
                <Badge tone={u.status === "active" ? "success" : u.status === "invited" ? "warning" : "neutral"}>
                  {u.status}
                </Badge>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
