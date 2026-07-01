"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* Brand tokens (mirrors the mockup): forest = dark surface/button,
   mint = light-green fill, deep = dark-green icon/check. */
const FOREST = "#0A1A14";
const MINT = "#5BFF95";
const DEEP = "#0f7a3d";

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

const SlotIcon = ({ type }: { type: ContinueSlot["icon"] }) => {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "shrink-0",
  };
  if (type === "ticket")
    return (
      <svg {...common}>
        <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z" />
        <path d="M9 7v10" />
      </svg>
    );
  if (type === "flight")
    return (
      <svg {...common}>
        <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M3 21V7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v14M16 11h3a2 2 0 0 1 2 2v8M7 9h2M7 13h2M7 17h2" />
    </svg>
  );
};

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke={DEEP}
    strokeWidth={2.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4 shrink-0"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
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
    <div dir="rtl" className="mx-auto w-full max-w-5xl px-2 py-3">
      <style>{`
        @keyframes ocb-pop { from { opacity:0; transform:scale(.4) } to { opacity:1; transform:scale(1) } }
      `}</style>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_44px_-24px_rgba(10,26,20,.35)]">
        {/* Slots */}
        <div className="flex gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
          {slots.map((s) => (
            <div
              key={s.label}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-xl border-[1.5px] px-2.5 py-2 transition-colors duration-300",
                s.filled
                  ? "border-[#5BFF95]/60 bg-[#5BFF95]/[0.13]"
                  : "border-dashed border-border bg-card"
              )}
            >
              <span style={{ color: s.filled ? DEEP : undefined }} className={cn(!s.filled && "text-muted-foreground")}>
                <SlotIcon type={s.icon} />
              </span>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className={cn("text-[11px] font-semibold text-muted-foreground", s.filled && "text-[9.5px]")}>
                  {s.label}
                </span>
                {s.filled && (
                  <span className="truncate text-[11.5px] font-bold" style={{ color: FOREST }}>
                    {s.value}
                    {s.delta && (
                      <span className="mr-1 font-semibold text-muted-foreground">· {s.delta}</span>
                    )}
                  </span>
                )}
              </div>
              {s.filled && (
                <span className="mr-auto" style={{ animation: "ocb-pop .3s ease both" }}>
                  <CheckIcon />
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Price + actions */}
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-1" style={{ color: FOREST }}>
            <span className="text-[15px] font-bold">$</span>
            <span className="text-[23px] font-extrabold leading-none tabular-nums tracking-tight">
              {price.toLocaleString("en-US")}
            </span>
            <span className="mr-1 text-xs font-semibold text-muted-foreground">סה״כ חבילה</span>
          </div>

          {building ? (
            <div className="flex w-full flex-col gap-1.5 sm:max-w-[62%]">
              <div className="h-2 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full transition-[width] duration-[1800ms] ease-out"
                  style={{ width: "100%", background: MINT }}
                />
              </div>
              <span className="text-center text-[13px] font-extrabold" style={{ color: DEEP }}>
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
                  className="flex-1 whitespace-nowrap rounded-xl border-[1.5px] px-4 py-2.5 text-sm font-bold transition-colors hover:bg-[#0A1A14]/5 sm:flex-none"
                  style={{ borderColor: FOREST, color: FOREST }}
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
                  "flex-[1.4] whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-transform sm:flex-none",
                  primaryDisabled
                    ? "cursor-not-allowed opacity-40"
                    : "hover:-translate-y-px hover:shadow-[0_12px_26px_-12px_rgba(10,26,20,.55)]"
                )}
                style={{ background: FOREST }}
              >
                {primaryLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
