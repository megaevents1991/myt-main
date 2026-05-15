import * as React from "react";

import { cn } from "@/lib/utils";

export interface FilterPillProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/** Category filter pill — outline by default, filled when active. */
export const FilterPill = React.forwardRef<
  HTMLButtonElement,
  FilterPillProps
>(({ active = false, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-pressed={active}
    className={cn(
      "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      active
        ? "border-foreground bg-foreground text-background"
        : "border-border bg-transparent text-foreground hover:bg-accent",
      className
    )}
    {...props}
  />
));
FilterPill.displayName = "FilterPill";
