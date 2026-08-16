import { Skeleton } from "@/components/ui/skeleton";

export default function EditarCotizacionLoading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <Skeleton className="mb-6 h-10 w-full max-w-md" />
      <div className="rounded-xl border border-border bg-surface p-5">
        <Skeleton className="h-4 w-32" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </div>
  );
}
