import { getDashboardData } from "@/components/dashboard/get-dashboard-data";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const dynamic = "force-dynamic";

export default async function InicioPage() {
  const data = await getDashboardData();
  return <DashboardView data={data} />;
}
