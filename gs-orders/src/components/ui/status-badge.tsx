import { Badge, type BadgeProps } from "@/components/ui/badge";

type BadgeVariant = BadgeProps["variant"];

/**
 * Generaliza el patrón `<Badge variant={MAP[status]}>{LABELS[status]}</Badge>`
 * que hoy usa domain.ts (ORDER_STATUS_LABELS/ORDER_STATUS_BADGE) — para que
 * People/Business Units (1D) y cualquier estado futuro lo reutilicen en vez
 * de reinventar el mapeo. No se retroalimenta a Pedidos todavía.
 */
export function StatusBadge<T extends string>({
  status,
  labels,
  variants,
  className,
}: {
  status: T;
  labels: Record<T, string>;
  variants: Record<T, BadgeVariant>;
  className?: string;
}) {
  return (
    <Badge variant={variants[status]} className={className}>
      {labels[status]}
    </Badge>
  );
}

/**
 * Caso más común del proyecto: un booleano `active` -> Activo/Inactivo
 * (Vendedores, Usuarios, y People/Business Units en 1D). Extraído para no
 * repetir `variant={x.active ? "success" : "neutral"}` en cada página.
 */
export function ActiveBadge({ active, className }: { active: boolean; className?: string }) {
  return (
    <Badge variant={active ? "success" : "neutral"} className={className}>
      {active ? "Activo" : "Inactivo"}
    </Badge>
  );
}
