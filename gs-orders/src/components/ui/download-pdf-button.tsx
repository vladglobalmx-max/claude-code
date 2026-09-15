import { Download } from "lucide-react";
import { buttonVariants, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * THÖREN 0078 — botón único "Descargar PDF" para los 7 documentos
 * operativos. Un simple <a href="/api/pdf/{docType}/{id}" download> —
 * sin JS de cliente: el navegador dispara la descarga directo contra el
 * endpoint, que es quien realmente decide (RLS +, para comisiones,
 * can_manage_commissions) si el usuario puede ver ese documento. Ocultar
 * o mostrar este botón en la UI es solo cortesía visual, nunca la
 * autorización real.
 */
export function DownloadPdfButton({
  docType,
  id,
  size = "sm",
  className,
}: {
  docType: "sales-order" | "requisition" | "purchase-order" | "goods-receipt" | "fulfillment" | "invoice" | "commission";
  id: string;
  size?: ButtonProps["size"];
  className?: string;
}) {
  return (
    <a href={`/api/pdf/${docType}/${id}`} download className={cn(buttonVariants({ variant: "outline", size }), className)}>
      <Download className="h-3.5 w-3.5" />
      Descargar PDF
    </a>
  );
}
