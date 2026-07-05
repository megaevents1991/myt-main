"use client";

import { useEffect, useRef, useState } from "react";
import { Ticket, Plane, Building2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* Brand palette tokens (single source of truth in globals.css).
   Foreground brand green is theme-adaptive via `text-forest dark:text-glow`
   (forest ink on light, glow-mint on dark) — the constant forest was invisible
   on the dark order-flow cards. MINT (glow) reads on both — used for fills. */
const MINT = "hsl(var(--brand-glow))";

/** Adaptive brand-green foreground: forest on light, glow-mint on dark. */
const ACCENT_FG = "text-forest dark:text-glow";

export type ContinueSlot = {
  icon: "ticket" | "flight" | "hotel";
  label: string;
  /** Slot has been resolved (picked or explicitly skipped). */
  filled: boolean;
  /** Shown once filled — the pick's name, or "ללא טיסה"/"ללא מלון". */
  value: string;
  /** Small price note, e.g. "+$120" or "כלול". Optional. */
  delta?: string;
};

type Props = {
  slots: ContinueSlot[];
  /** Package total (numeric, USD) — animated with a count-up on change. */
  total: number;
  primaryLabel: string;
  primaryDisabled: boolean;
  onPrimary: () => void;
  skip?: { label: string; onSkip: () => void };
  /** This step's actions lead into the summary — play the build animation. */
  isFinalStep: boolean;
};

/* Brand icon set — lucide-react, same faces the search bar uses
   (כרטיס→Ticket, טיסה→Plane, מלון→Building2). */
const SlotIcon = ({ type }: { type: ContinueSlot["icon"] }) => {
  const Icon = type === "ticket" ? Ticket : type === "flight" ? Plane : Building2;
  return <Icon size={17} strokeWidth={2} className="shrink-0" />;
};

const CheckIcon = () => (
  <Check size={16} strokeWidth={2.6} className="shrink-0" />
);

/** Cubic ease-out count-up between renders when `target` changes. */
function useCountUp(target: number, dur = 520) {
  const [val, setVal] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const start = prev.current;
    if (start === target) return;
    let raf = 0;
    let t0: number | null = null;
    const tick = (now: number) => {
      if (t0 === null) t0 = now;
      const p = Math.min(1, (now - t0) / dur);
      setVal(Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return val;
}

export const OrderContinueBar = ({
  slots,
  total,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  skip,
  isFinalStep,
}: Props) => {
  const price = useCountUp(total);
  const [building, setBuilding] = useState(false);
  const [buildMsg, setBuildMsg] = useState("מרכיבים את החבילה…");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    []
  );

  const finalize = (fn: () => void) => {
    if (building) return;
    setBuilding(true);
    timers.current.push(setTimeout(() => setBuildMsg("✓ החבילה מוכנה!"), 1700));
    // Advance once the progress bar has filled — the bar unmounts at step 4.
    timers.current.push(setTimeout(fn, 2200));
  };

  const handlePrimary = () => (isFinalStep ? finalize(onPrimary) : onPrimary());
  const handleSkip = () =>
    skip && (isFinalStep ? finalize(skip.onSkip) : skip.onSkip());

  return (
    <div dir="rtl" className="mx-auto w-full max-w-5xl px-2 py-2 sm:py-1.5">
      <style>{`
        @keyframes ocb-pop { from { opacity:0; transform:scale(.4) } to { opacity:1; transform:scale(1) } }
      `}</style>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_44px_-24px_rgba(10,26,20,.35)]">
        {/* Mobile: two stacked rows (slots / price+actions). Desktop (sm+):
            one inline row — slots · price · buttons — like the summary bar. */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 sm:px-3 sm:py-2">
        {/* Slots */}
        <div className="flex gap-2 border-b border-border bg-muted/40 px-3 py-2 sm:min-w-0 sm:flex-1 sm:border-b-0 sm:bg-transparent sm:p-0">
          {slots.map((s) => (
            <div
              key={s.label}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-xl border-[1.5px] px-2.5 py-2 transition-colors duration-300",
                s.filled
                  ? "border-forest/70 bg-glow/[0.13] dark:border-glow/60"
                  : "border-dashed border-border bg-card"
              )}
            >
              <span className={cn(s.filled ? ACCENT_FG : "text-muted-foreground")}>
                <SlotIcon type={s.icon} />
              </span>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className={cn("text-[11px] font-semibold text-muted-foreground", s.filled && "text-[9.5px]")}>
                  {s.label}
                </span>
                {s.filled && (
                  <span className={cn("truncate text-[11.5px] font-bold", ACCENT_FG)}>
                    {s.value}
                    {s.delta && (
                      <span className="mr-1 font-semibold text-muted-foreground">· {s.delta}</span>
                    )}
                  </span>
                )}
              </div>
              {s.filled && (
                <span className={cn("mr-auto", ACCENT_FG)} style={{ animation: "ocb-pop .3s ease both" }}>
                  <CheckIcon />
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Price + actions — `sm:contents` folds them into the desktop row. */}
        <div className="flex flex-col gap-2 px-4 py-2.5 sm:contents">
          <div className={cn("flex items-baseline gap-1 sm:shrink-0", ACCENT_FG)}>
            <span className="text-[15px] font-bold">$</span>
            <span className="text-[23px] font-extrabold leading-none tabular-nums tracking-tight">
              {price.toLocaleString("en-US")}
            </span>
            <span className="mr-1 text-xs font-semibold text-muted-foreground">סה״כ לנוסע</span>
          </div>

          {building ? (
            <div className="flex w-full flex-col gap-1.5 sm:w-64 sm:shrink-0">
              <div className="h-2 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full transition-[width] duration-[1800ms] ease-out"
                  style={{ width: "100%", background: MINT }}
                />
              </div>
              <span className={cn("text-center text-[13px] font-extrabold", ACCENT_FG)}>
                {buildMsg}
              </span>
            </div>
          ) : (
            <div className="flex w-full gap-2 sm:w-auto">
              {skip && (
                <button
                  type="button"
                  onClick={handleSkip}
                  aria-label={skip.label}
                  className="flex-1 whitespace-nowrap rounded-xl border-[1.5px] border-forest text-forest hover:bg-forest/5 dark:border-glow dark:text-glow dark:hover:bg-glow/10 px-4 py-2.5 text-sm font-bold transition-colors sm:flex-none sm:px-3.5 sm:py-1.5 sm:text-[13px]"
                >
                  {skip.label}
                </button>
              )}
              <button
                type="button"
                onClick={handlePrimary}
                disabled={primaryDisabled}
                aria-label={primaryLabel}
                className={cn(
                  // Same dark-pill CTA as the cards ("לפרטים והזמנה").
                  "flex-[1.4] whitespace-nowrap rounded-full bg-main text-main-foreground dark:bg-foreground dark:text-background px-5 py-2.5 text-sm font-semibold transition-all sm:flex-none sm:px-4 sm:py-1.5 sm:text-[13px]",
                  primaryDisabled
                    ? "cursor-not-allowed opacity-40"
                    : "hover:bg-secondary hover:text-black dark:hover:bg-foreground/90 dark:hover:text-background hover:-translate-y-px hover:shadow-[0_12px_26px_-12px_rgba(10,26,20,.55)]"
                )}
              >
                {primaryLabel}
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};
