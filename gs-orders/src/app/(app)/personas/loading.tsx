import { Skeleton } from "@/components/ui/skeleton";

export default function PersonasLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="mt-2 h-4 w-96" />

      <Skeleton className="mt-6 h-10 w-full max-w-md" />

      <div className="mt-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
