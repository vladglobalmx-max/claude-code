import { Skeleton } from "@/components/ui/skeleton";

export default function UnidadesNegocioLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="mt-2 h-4 w-72" />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
