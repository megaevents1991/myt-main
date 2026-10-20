import { cn } from "@/lib/utils";

/**
 * "לא ניתן לביטול" on a hotel whose rate refunds nothing. The site sells such
 * a rate only within NON_REFUNDABLE_WINDOW_DAYS of check-in
 * (lib/hotelRateTerms.ts), so this tag only ever appears inside that window -
 * Dor 20.10.2026: the customer must see it before paying.
 */
export const NonRefundableTag = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-destructive/10 px-2 py-0.5 text-[12px] font-bold leading-tight text-destructive",
      className
    )}
  >
    לא ניתן לביטול
  </span>
);
