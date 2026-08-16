import { Skeleton } from "@/components/ui/skeleton";

export default function CotizacionDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-56" />
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-24 w-full" />
        <Skeleton className="mt-4 h-40 w-full" />
        <Skeleton className="mt-4 h-32 w-full" />
      </div>
    </div>
  );
}
