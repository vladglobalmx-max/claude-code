import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback de Suspense solo para /inicio (Next.js App Router: loading.tsx
 * vive dentro del segmento de esta ruta, no afecta a /pedidos, /vendedores
 * ni /configuracion). Primer uso real de <Skeleton> en el proyecto — hasta
 * THÖREN Experience 1B existía pero ningún route lo usaba.
 */
export default function InicioLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>

      <Skeleton className="mt-6 h-64 w-full" />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
