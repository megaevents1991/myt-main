"use client";

import type { ReactNode } from "react";
import { Check, CircleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CatalogKind } from "@/lib/itinerary/builder";
import { describeCompat } from "@/lib/itinerary/rules";
import type { Compat } from "@/lib/itinerary/types";

/** A builder panel: the site's card surface. */
export const PANEL = "rounded-2xl border border-border bg-card p-4 shadow-card md:p-5";

/** Rows shown before "הצג עוד" - a long list stays fast on a phone. */
export const LIST_PAGE = 24;

export function PanelTitle({ children }: { children: ReactNode }) {
  return <h2 className="m-0 font-display text-[19px] font-extrabold leading-tight">{children}</h2>;
}

/** The dark CTA of the site's cards and continue bar, small. */
export const ADD_BUTTON =
  "whitespace-nowrap rounded-md bg-main px-3.5 py-2 text-xs font-semibold text-main-foreground transition-colors hover:bg-secondary hover:text-black dark:bg-foreground dark:text-background dark:hover:bg-foreground/90 dark:hover:text-background disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground dark:disabled:bg-muted dark:disabled:text-muted-foreground";

/** How an event fits the route, as a soft pill (the site's tag look) - the reason in words. */
export function CompatChip({ compat, className }: { compat: Compat; className?: string }) {
  const s = compat.status;
  const Icon = s === "blocked" ? X : s === "warn" ? CircleAlert : Check;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold leading-snug",
        s === "best" && "border-primary/50 bg-primary/15 text-forest dark:text-primary",
        (s === "same" || s === "ok") && "border-border bg-accent text-foreground",
        s === "warn" && "border-badge-vip/60 bg-badge-vip/20 text-foreground",
        s === "blocked" && "border-badge-urgent/40 bg-badge-urgent/10 text-badge-urgent",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {describeCompat(compat)}
    </span>
  );
}

const KINDS: { value: CatalogKind; label: string }[] = [
  { value: "all", label: "הכל" },
  { value: "football", label: "כדורגל" },
  { value: "music", label: "הופעות" },
];

/** הכל / כדורגל / הופעות - the hub's segmented sort control. */
export function KindTabs({ value, onChange }: { value: CatalogKind; onChange: (k: CatalogKind) => void }) {
  return (
    <div
      className="flex h-11 items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm"
      role="group"
      aria-label="סוג האירוע"
    >
      {KINDS.map((k) => (
        <button
          key={k.value}
          type="button"
          onClick={() => onChange(k.value)}
          aria-pressed={value === k.value}
          className={cn(
            "h-full flex-1 rounded-lg px-4 text-sm font-bold transition-colors",
            value === k.value
              ? "bg-main text-main-foreground dark:bg-foreground dark:text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}

/** "הצג עוד (N)" under a long list. */
export function ShowMore({ hidden, onClick }: { hidden: number; onClick: () => void }) {
  if (hidden <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto mt-4 flex h-12 items-center rounded-xl border border-border bg-card px-6 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-foreground/[0.03]"
    >
      הצג עוד ({hidden})
    </button>
  );
}

/** "לילה אחד" / "N לילות". */
export const nightsLabel = (n: number): string => (n === 1 ? "לילה אחד" : `${n} לילות`);

/** "יום אחד" / "N ימים". */
export const daysLabel = (n: number): string => (n === 1 ? "יום אחד" : `${n} ימים`);
