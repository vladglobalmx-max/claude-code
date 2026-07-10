import { DollarSign, Target, FileText, AlertTriangle, CalendarCheck, TrendingUp, Sparkles } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { SummaryCards, type SummaryCardData } from "@/components/dashboard/summary-cards";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { formatCurrency } from "@/lib/utils/format";
import {
  Search,
  ClipboardCheck,
  Mail,
  FileSignature,
  MessageSquare,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function getDashboardMetrics(companyId: string) {
  const supabase = createSupabaseServerClient();
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

  // Cada consulta se envuelve en try/catch: en un ambiente sin Supabase
  // configurado aún (Fase de scaffold) el dashboard debe degradar a ceros,
  // no romper la página.
  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  const wonThisMonth = await safe(async () => {
    const { data } = await supabase
      .from("opportunities")
      .select("estimated_value")
      .eq("company_id", companyId)
      .eq("stage", "cierre_ganado")
      .gte("updated_at", startOfMonth);
    return (data ?? []).reduce((sum, row) => sum + (row.estimated_value ?? 0), 0);
  }, 0);

  const openValue = await safe(async () => {
    const { data } = await supabase
      .from("opportunities")
      .select("estimated_value")
      .eq("company_id", companyId)
      .not("stage", "in", "(cierre_ganado,cierre_perdido)");
    return (data ?? []).reduce((sum, row) => sum + (row.estimated_value ?? 0), 0);
  }, 0);

  const overdueFollowups = await safe(async () => {
    const { count } = await supabase
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pendiente")
      .lt("scheduled_at", startOfDay);
    return count ?? 0;
  }, 0);

  const todayFollowups = await safe(async () => {
    const { count } = await supabase
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("scheduled_at", startOfDay)
      .lte("scheduled_at", endOfDay);
    return count ?? 0;
  }, 0);

  const openOpportunities = await safe(async () => {
    const { count } = await supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .not("stage", "in", "(cierre_ganado,cierre_perdido)");
    return count ?? 0;
  }, 0);

  const avgProbability = await safe(async () => {
    const { data } = await supabase
      .from("opportunities")
      .select("probability")
      .eq("company_id", companyId)
      .not("stage", "in", "(cierre_ganado,cierre_perdido)");
    if (!data || data.length === 0) return 0;
    return Math.round(data.reduce((sum, row) => sum + row.probability, 0) / data.length);
  }, 0);

  return { wonThisMonth, openValue, overdueFollowups, todayFollowups, openOpportunities, avgProbability };
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const companyId = user?.companyId ?? "";
  const metrics = companyId
    ? await getDashboardMetrics(companyId)
    : { wonThisMonth: 0, openValue: 0, overdueFollowups: 0, todayFollowups: 0, openOpportunities: 0, avgProbability: 0 };

  const summaryItems: SummaryCardData[] = [
    { label: "Ventas del mes", value: formatCurrency(metrics.wonThisMonth), icon: DollarSign, tone: "success" },
    { label: "Oportunidades abiertas", value: formatCurrency(metrics.openValue), icon: Target, tone: "neutral" },
    { label: "Seguimientos vencidos", value: String(metrics.overdueFollowups), icon: AlertTriangle, tone: metrics.overdueFollowups > 0 ? "danger" : "neutral" },
    { label: "Seguimientos para hoy", value: String(metrics.todayFollowups), icon: CalendarCheck, tone: "neutral" },
    { label: "Oportunidades sin cerrar", value: String(metrics.openOpportunities), icon: FileText, tone: "neutral" },
    { label: "Probabilidad promedio de cierre", value: `${metrics.avgProbability}%`, icon: TrendingUp, tone: "neutral" },
  ];

  const quickActions = [
    { label: "Analizar prospecto", href: "/tools/investigacion-prospectos", icon: Search },
    { label: "Preparar visita", href: "/tools/preparacion-visita", icon: ClipboardCheck },
    { label: "Crear seguimiento", href: "/followups", icon: CalendarCheck },
    { label: "Generar correo", href: "/tools/seguimiento-comercial", icon: Mail },
    { label: "Generar propuesta", href: "/tools/generacion-propuesta", icon: FileSignature },
    { label: "Analizar oportunidad", href: "/tools/analisis-oportunidad", icon: TrendingUp },
    { label: "Hablar con GAIOS", href: "/agents/gaios-assistant", icon: Sparkles },
    { label: "Registrar reunión", href: "/followups", icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">
          Hola{user ? `, ${user.fullName.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="text-sm text-ink-faint">Resumen ejecutivo de Global Supplier MTY.</p>
      </div>

      <SummaryCards items={summaryItems} />
      <QuickActions actions={quickActions} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentActivity items={[]} />
        <RecentActivity items={[]} />
      </div>
    </div>
  );
}
