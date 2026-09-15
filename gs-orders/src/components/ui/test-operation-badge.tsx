import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * THÖREN 0077 — Test Data / Purga de operaciones de prueba. Badge estándar
 * para marcar visualmente cualquier documento derivado de una Sales Order
 * is_test=true (la propia SO, requisición, Purchase Order, recepción,
 * surtido, factura, comisión) — mismo componente en todos los detalles
 * para consistencia visual. No renderiza nada si isTest es false, así que
 * los llamadores pueden usarlo incondicionalmente sin un `if` propio.
 */
export function TestOperationBadge({ isTest }: { isTest: boolean }) {
  if (!isTest) return null;
  return (
    <Badge variant="warning">
      <FlaskConical className="h-3 w-3" />
      PRUEBA
    </Badge>
  );
}
