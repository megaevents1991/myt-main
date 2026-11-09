"use client";

import { Button } from "@/components/ui/button";
import { CLUB_COPY } from "@/lib/club/copy";

/**
 * The permanent MEGA CLUB row under the coupon field (spec §5.2): a returning member never depends on idling 22
 * seconds. Three faces: join / already a member; "swap to the member price" while another coupon holds the slot and
 * this device knows its member; nothing while the member price is applied (the coupon line says so).
 */
export function ClubRow({
  memberPriceApplied,
  otherCouponApplied,
  rememberedMember,
  onOpen,
  onSwap,
}: {
  memberPriceApplied: boolean;
  otherCouponApplied: boolean;
  rememberedMember: boolean;
  onOpen(mode: "join" | "member"): void;
  onSwap(): void;
}) {
  if (memberPriceApplied) return null;
  return (
    <div
      dir="rtl"
      className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-accent px-3 py-2.5 text-accent-foreground"
    >
      <p className="min-w-0 text-[13px] leading-tight">
        <span dir="ltr" className="font-extrabold tracking-[0.15em] text-forest dark:text-glow">
          {CLUB_COPY.rowTitle}
        </span>
        <span className="mx-1.5 text-muted-foreground" aria-hidden>
          ·
        </span>
        <span>{CLUB_COPY.rowSub}</span>
      </p>
      {otherCouponApplied && rememberedMember ? (
        <Button type="button" size="sm" className="h-10 shrink-0 px-4 font-bold" onClick={onSwap}>
          {CLUB_COPY.swap}
        </Button>
      ) : (
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" className="h-10 px-4 font-bold" onClick={() => onOpen("join")}>
            {CLUB_COPY.rowJoin}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-10 px-4 font-bold" onClick={() => onOpen("member")}>
            {CLUB_COPY.rowMember}
          </Button>
        </div>
      )}
    </div>
  );
}
