import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Sparkles,
  Bot,
  Wrench,
  Users,
  Target,
  CalendarClock,
  Building2,
  BookOpen,
  FileText,
  ClipboardList,
  BarChart3,
  History,
  ShieldCheck,
  Settings,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Si se define, el ítem solo aparece cuando el usuario tiene al menos uno de estos permisos. */
  requiresAnyOf?: Permission[];
}

/** Menú lateral (Instrucción Maestra §6). El filtrado por rol ocurre en <Sidebar>. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { label: "GAIOS Assistant", href: "/agents/gaios-assistant", icon: Sparkles },
  { label: "Agentes", href: "/agents", icon: Bot },
  { label: "Herramientas", href: "/tools", icon: Wrench },
  { label: "Clientes", href: "/clients", icon: Users, requiresAnyOf: ["manage_clients"] },
  { label: "Oportunidades", href: "/opportunities", icon: Target, requiresAnyOf: ["manage_opportunities", "view_pipeline"] },
  { label: "Seguimientos", href: "/followups", icon: CalendarClock },
  { label: "Unidades de negocio", href: "/business-units", icon: Building2 },
  { label: "Base de conocimiento", href: "/knowledge-base", icon: BookOpen },
  { label: "Documentos", href: "/knowledge-base?tab=documentos", icon: FileText },
  { label: "SOPs", href: "/knowledge-base?tab=sops", icon: ClipboardList },
  { label: "Dashboards", href: "/dashboard", icon: BarChart3 },
  { label: "Historial", href: "/history", icon: History },
  {
    label: "Administración",
    href: "/admin/users",
    icon: ShieldCheck,
    requiresAnyOf: ["manage_users", "manage_roles", "manage_agents", "manage_tools", "manage_prompts", "view_audit"],
  },
  { label: "Configuración", href: "/settings", icon: Settings },
];
