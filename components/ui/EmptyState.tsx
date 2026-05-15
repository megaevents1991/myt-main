import * as React from "react";
import { SearchX } from "lucide-react";

import { cn } from "@/lib/utils";

/** Reusable "no results" / empty placeholder. */
export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center",
      className
    )}
  >
    <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
      {icon ?? <SearchX className="size-7" aria-hidden />}
    </div>
    <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
    {description && (
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    )}
    {action && <div className="mt-1">{action}</div>}
  </div>
);
