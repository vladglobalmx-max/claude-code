import { getRoleDashboardData } from "@/components/dashboard/get-role-dashboard-data";
import { RoleDashboardView } from "@/components/dashboard/role-dashboard-view";

export const dynamic = "force-dynamic";

export default async function InicioPage() {
  const data = await getRoleDashboardData();
  return <RoleDashboardView data={data} />;
}
