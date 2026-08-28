import { BadgeCheck, Wallet, TicketCheck, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SettlementMethod } from "@/lib/app.types";

interface AgentModeProps {
  /** The signed-in agent's display name (partner session). */
  agentName?: string | null;
  settlementError?: string | null;
}

/**
 * Always-on agent banner. The on/off TOGGLE was removed 2026-08-27 (V2 spec:
 * "מציג לו אוטמטי בלי טוגל") - a cookie-verified agent session IS agent mode.
 * The settlement RADIO PICKER was already removed 2026-08-21; the three
 * settlement paths live as direct action buttons in the CTA area
 * (AgentSettlementActions below, rendered from OrderReview.tsx's 3 CTA
 * spots). This panel is the connected indicator + a pointer + the settlement
 * error (the one spot common to all 3 CTA layouts).
 */
function AgentMode({ agentName, settlementError }: AgentModeProps) {
  return (
    <div
      className="bg-white rounded-lg shadow p-4 mb-4 dark:border dark:border-border dark:bg-card"
      dir="rtl"
    >
      <div className="flex items-center gap-2">
        <BadgeCheck size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
        <h3 className="font-bold">מסך סוכן נסיעות</h3>
        {agentName && (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            מחובר: {agentName}
          </span>
        )}
      </div>
      <div className="mt-2 space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          הזמנה עבור הלקוח - בחרו את אמצעי התשלום בכפתורי הפעולה בהמשך העמוד.
        </p>
        {settlementError && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
            {settlementError}
          </p>
        )}
      </div>
    </div>
  );
}

export default AgentMode;

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Three direct settlement actions for agent mode - replaces the old
 * SettlementMethodPicker (radio cards) + single label-following primary CTA
 * (2026-08-21, Dor: "שהכפתורים למטה יהיו שלם בשובר / שלם באשראי / שלח לינק
 * לתשלום ללקוח"). Each button sets settlementMethod AND submits in one
 * click - there is no separate "select, then confirm" step and therefore no
 * persistent "selected" visual state.
 *
 * Rendered directly inside OrderReview.tsx's 3 CTA spots (desktop sidebar,
 * mobile inline, sticky footer) - NOT nested inside <AgentMode>, since the
 * CTA area lives far below the agent-mode toggle on the page.
 */
export function AgentSettlementActions({
  onSettle,
  agentCommissionUsd,
  voucherAllowed,
  voucherBalanceUsd = 0,
  finalPurchasePriceUsd = 0,
  holdAllowed = true,
  disabled = false,
  compact = false,
}: {
  /** Sets settlementMethod AND submits the order - one call does both. */
  onSettle: (e: React.MouseEvent<HTMLButtonElement>, method: SettlementMethod) => void;
  /** The agent's expected commission in USD for THIS order. */
  agentCommissionUsd: number;
  /** Agent is configured for voucher settlement (partners.voucher_payment_allowed). */
  voucherAllowed: boolean;
  /** Live credit-voucher value in USD - informational only. */
  voucherBalanceUsd?: number;
  /** Full package total in USD - the agent-card button shows the amount it
   *  actually charges, net of commission. */
  finalPurchasePriceUsd?: number;
  /** 24h hold mechanism is available for this event - gates "לינק תשלום
   *  ללקוח", which IS a hold under the hood (see confirm-order/utils.ts). */
  holdAllowed?: boolean;
  disabled?: boolean;
  /** Sticky-footer rendering: short labels in a compact row instead of a
   *  full-width stack. */
  compact?: boolean;
}) {
  const full = finalPurchasePriceUsd;
  const netAgent = agentCommissionUsd > 0 ? Math.max(0, full - agentCommissionUsd) : full;

  const primaryClasses =
    "w-full bg-main text-main-foreground hover:bg-main/90 dark:bg-glow dark:text-forest dark:hover:bg-glow/90 font-bold";
  const secondaryClasses =
    "w-full border-2 border-main bg-white text-main hover:bg-main/5 dark:border-glow dark:bg-transparent dark:text-glow dark:hover:bg-glow/10 font-bold";

  return (
    <div className={compact ? "flex gap-2" : "space-y-2"} dir="rtl">
      {/* 1. payment_link - primary emphasis. Same 24h-hold gating the old
          picker used (show: holdAllowed). */}
      {holdAllowed && (
        <div className={compact ? "flex-1 min-w-0" : ""}>
          <Button
            type="button"
            onClick={(e) => onSettle(e, "payment_link")}
            disabled={disabled}
            aria-label="שליחת לינק תשלום ללקוח - ההזמנה תישמר 24 שעות"
            className={
              primaryClasses +
              (compact
                ? " h-[52px] px-2 text-[13px] leading-tight whitespace-normal break-words flex-col gap-0.5"
                : " h-[52px] text-[16px] flex items-center justify-center gap-1.5")
            }
          >
            <span className="flex items-center gap-1.5">
              <Link2 size={compact ? 14 : 16} className="shrink-0" />
              {compact ? "לינק תשלום" : "שלח לינק תשלום ללקוח"}
            </span>
            {compact && <span className="text-[10px] font-semibold opacity-90">24 שעות</span>}
          </Button>
          {!compact && (
            <p className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
              ההזמנה תישמר 24 שעות
            </p>
          )}
        </div>
      )}

      {/* 2. agent_card - always available in agent mode (unconditional, same
          as the old picker's show: true). Shows the net-of-commission charge
          figure, like the old picker card did. */}
      <div className={compact ? "flex-1 min-w-0" : ""}>
        <Button
          type="button"
          variant="link"
          onClick={(e) => onSettle(e, "agent_card")}
          disabled={disabled}
          aria-label="תשלום באשראי הסוכן"
          className={
            secondaryClasses +
            (compact
              ? " h-[52px] px-2 text-[13px] leading-tight whitespace-normal break-words flex-col gap-0.5"
              : " h-auto min-h-[52px] py-2 text-[15px] flex flex-col items-center justify-center gap-0.5")
          }
        >
          <span className="flex items-center gap-1.5">
            <Wallet size={compact ? 14 : 15} className="shrink-0" />
            {compact ? "אשראי שלי" : "שלם באשראי שלי (הסוכן)"}
          </span>
          {full > 0 && (
            <span
              className={compact ? "text-[11px] font-semibold" : "text-xs font-semibold"}
              dir="ltr"
            >
              {agentCommissionUsd > 0
                ? compact
                  ? usd(netAgent)
                  : `יחויב ${usd(netAgent)} (בניכוי עמלה ${usd(agentCommissionUsd)})`
                : `יחויב ${usd(full)}`}
            </span>
          )}
        </Button>
      </div>

      {/* 3. voucher - same voucher_payment_allowed gating the old picker
          used. */}
      {voucherAllowed && (
        <div className={compact ? "flex-1 min-w-0" : ""}>
          <Button
            type="button"
            variant="link"
            onClick={(e) => onSettle(e, "voucher")}
            disabled={disabled}
            aria-label="תשלום בשובר"
            className={
              secondaryClasses +
              (compact
                ? " h-[52px] px-2 text-[13px] leading-tight whitespace-normal break-words flex-col gap-0.5"
                : " h-auto min-h-[52px] py-2 text-[15px] flex flex-col items-center justify-center gap-0.5")
            }
          >
            <span className="flex items-center gap-1.5">
              <TicketCheck size={compact ? 14 : 15} className="shrink-0" />
              שלם בשובר
            </span>
            {voucherBalanceUsd > 0 && (
              <span
                className={
                  (compact ? "text-[11px]" : "text-xs") +
                  " font-semibold text-emerald-700 dark:text-emerald-400"
                }
                dir="ltr"
              >
                {usd(voucherBalanceUsd)}
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
