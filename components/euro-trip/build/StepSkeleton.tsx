import { Loader2 } from "lucide-react";

/**
 * What a later step shows while its code arrives (ItineraryFlow loads the tickets / flights /
 * hotels / summary steps on demand). The step's own shape - a title line, a row of tabs, then a
 * side panel beside the rows - at about the height the step settles at, so nothing jumps when it
 * swaps in. Server-safe (no hooks): it is also what a deferred step falls back to.
 */
export function StepSkeleton({ label, side = false, tabs = true }: { label: string; side?: boolean; tabs?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[60vh] flex-col gap-3">
      <div className="h-6 w-48 animate-pulse rounded-md bg-muted" aria-hidden />
      {tabs && <div className="h-14 animate-pulse rounded-xl bg-muted" aria-hidden />}
      <div className="flex items-center justify-center gap-3 p-3 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {label}
      </div>
      <div className="flex flex-col gap-4 lg:flex-row-reverse" aria-hidden>
        {side && <div className="h-64 animate-pulse rounded-2xl bg-muted lg:h-96 lg:w-[45%]" />}
        <div className={side ? "flex flex-col gap-2 lg:w-[55%]" : "flex flex-1 flex-col gap-3"}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={side ? "h-20 animate-pulse rounded-xl bg-muted" : "h-32 animate-pulse rounded-2xl bg-muted"} />
          ))}
        </div>
      </div>
    </div>
  );
}
