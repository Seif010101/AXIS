import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-24 sm:px-6" aria-busy="true">
      <Skeleton className="mx-auto h-6 w-48" />
      <Skeleton className="mx-auto h-12 w-full max-w-xl" />
      <Skeleton className="mx-auto h-5 w-full max-w-lg" />
      <Skeleton className="mx-auto h-11 w-40" />
    </div>
  );
}
