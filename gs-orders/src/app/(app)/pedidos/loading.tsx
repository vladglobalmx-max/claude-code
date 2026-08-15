import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback de Suspense solo para /pedidos (no afecta /inicio, /vendedores
 * ni /configuracion — ver convención documentada en inicio/loading.tsx).
 */
export default function PedidosLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="mt-2 h-4 w-72" />

      <Skeleton className="mt-6 h-10 w-full" />

      <div className="mt-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
