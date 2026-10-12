import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Placeholder for one card while its data loads. */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-4 rounded-xl border bg-card p-5", className)} aria-hidden>
      <Skeleton className="h-5 w-2/5" />
      <div className="space-y-2.5">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className={cn("h-4", index === lines - 1 ? "w-3/5" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

/** Generic page placeholder (header, a row of stats, cards). Used by loading.tsx files. */
export function PageSkeleton({ stats = 4, cards = 2 }: { stats?: number; cards?: number }) {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2.5 pb-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {stats > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: stats }, (_, index) => (
            <div key={index} className="space-y-3 rounded-xl border bg-card p-4 sm:p-5" aria-hidden>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-7 w-2/3" />
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: cards }, (_, index) => (
          <CardSkeleton key={index} lines={4} />
        ))}
      </div>
    </div>
  );
}
