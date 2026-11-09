"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CLUB_CONSENT_TEXT, CLUB_COPY } from "@/lib/club/copy";

export type ClubInlineState = "idle" | "waiting" | "busy" | "error" | "invalid" | "rate_limited" | "kept_better";

/**
 * D16: MEGA CLUB inside the summary, above the payment button - one box, no popup. Ticking it joins with the first
 * passenger's email and phone (at once when they are valid, else as soon as they are); the price drops in place and
 * nothing here ever blocks the payment button. "כבר חברים?" opens the lookup.
 */
export function ClubInline({
  savedUsd,
  wants,
  onWantsChange,
  state,
  otherCouponApplied,
  rememberedMember,
  onSwap,
  onMember,
}: {
  /** The member price on this order (amount x tickets); null while the amount is unknown. */
  savedUsd: number | null;
  wants: boolean;
  onWantsChange(v: boolean): void;
  state: ClubInlineState;
  otherCouponApplied: boolean;
  rememberedMember: boolean;
  onSwap(): void;
  onMember(): void;
}) {
  const busy = state === "busy";
  const note =
    state === "waiting"
      ? CLUB_COPY.inlineWaiting
      : state === "busy"
        ? CLUB_COPY.inlineBusy
        : state === "invalid"
          ? CLUB_COPY.invalid
          : state === "rate_limited"
            ? CLUB_COPY.rateLimited
            : state === "kept_better"
              ? CLUB_COPY.keptBetter
              : state === "error"
                ? CLUB_COPY.error
                : null;
  const noteIsError = state === "invalid" || state === "rate_limited" || state === "error";

  return (
    <div dir="rtl" className="mt-3 flex flex-col gap-2.5 rounded-xl bg-accent px-3.5 py-3 text-accent-foreground">
      <p className="text-[14px] font-bold leading-snug">
        <span dir="ltr" className="font-extrabold tracking-[0.15em] text-forest dark:text-glow">
          {CLUB_COPY.brand}
        </span>
        <span className="mx-1.5 text-muted-foreground" aria-hidden>
          ·
        </span>
        {savedUsd && savedUsd > 0 ? CLUB_COPY.inlineTitle(savedUsd) : CLUB_COPY.inlineTitleNoAmount}
      </p>

      {otherCouponApplied && rememberedMember ? (
        <Button type="button" size="sm" className="h-10 w-fit px-4 font-bold" onClick={onSwap}>
          {CLUB_COPY.swap}
        </Button>
      ) : (
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="club-inline-consent"
            checked={wants}
            disabled={busy}
            onCheckedChange={(v) => onWantsChange(v === true)}
            className="mt-0.5 h-5 w-5 border-foreground/50"
          />
          <label htmlFor="club-inline-consent" className="cursor-pointer text-[13px] leading-snug">
            {CLUB_CONSENT_TEXT}
          </label>
        </div>
      )}

      {note && (
        <p role={noteIsError ? "alert" : "status"} className={noteIsError ? "text-[13px] font-medium text-destructive" : "text-[13px] text-muted-foreground"}>
          {note}
        </p>
      )}

      <button
        type="button"
        onClick={onMember}
        className="w-fit text-[13px] font-semibold text-foreground underline underline-offset-4 decoration-foreground/40 hover:decoration-foreground"
      >
        {CLUB_COPY.inlineMember}
      </button>
    </div>
  );
}
