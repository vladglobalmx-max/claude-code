import { Skeleton } from "@/components/ui/skeleton";

export default function PersonaDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Skeleton className="mb-6 h-4 w-24" />
      <div className="space-y-5">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
