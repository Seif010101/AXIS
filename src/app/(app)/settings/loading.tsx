import { CardSkeleton } from "@/components/common/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6" aria-busy="true">
      <div className="space-y-2.5 pb-2">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <CardSkeleton lines={4} />
      <CardSkeleton lines={2} />
    </div>
  );
}
