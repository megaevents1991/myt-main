import { ToggleLeft, ToggleRight, CreditCard, Wallet, TicketCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SettlementMethod } from "@/lib/app.types";

interface AgentModeProps {
  isAgentMode: boolean;
  onToggleAgentMode: () => void;
  settlementMethod: SettlementMethod;
  onSettlementMethodChange: (method: SettlementMethod) => void;
  /** The agent's expected commission in USD for THIS order, already computed
   *  per the commission's unit (percent of sale / fixed per ticket). */
  agentCommissionUsd: number;
  /** Agent is configured for voucher settlement (partners.voucher_payment_allowed). */
  voucherAllowed: boolean;
  /** Live credit-voucher value in USD - informational only. */
  voucherBalanceUsd?: number;
  /** Full package total in USD - each option shows the amount it actually
   *  charges, incl. the commission-netted agent-card figure. */
  finalPurchasePriceUsd?: number;
  settlementError?: string | null;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function SettlementMethodPicker({
  settlementMethod,
  onSettlementMethodChange,
  agentCommissionUsd,
  voucherAllowed,
  voucherBalanceUsd = 0,
  finalPurchasePriceUsd = 0,
}: {
  settlementMethod: SettlementMethod;
  onSettlementMethodChange: (method: SettlementMethod) => void;
  agentCommissionUsd: number;
  voucherAllowed: boolean;
  voucherBalanceUsd?: number;
  finalPurchasePriceUsd?: number;
}) {
  const full = finalPurchasePriceUsd;
  const netAgent = agentCommissionUsd > 0 ? Math.max(0, full - agentCommissionUsd) : full;

  // Radio CARDS, not bare pills: icon + who pays + the ACTUAL number each
  // method charges - the commission deduction is visible on the card itself,
  // not buried in a hint below.
  const options: Array<{
    value: SettlementMethod;
    icon: LucideIcon;
    label: string;
    /** The money line - the number this method really charges. */
    amount: React.ReactNode;
    hint: string;
    show: boolean;
  }> = [
    {
      value: "customer_card",
      icon: CreditCard,
      label: "אשראי הלקוח",
      amount: full > 0 ? <span>יחויב: <b dir="ltr">{usd(full)}</b></span> : "מחיר מלא",
      hint: "הלקוח מזין את פרטי האשראי שלו - כרגיל.",
      show: true,
    },
    {
      value: "agent_card",
      icon: Wallet,
      label: "אשראי שלי (הסוכן)",
      amount:
        full > 0 && agentCommissionUsd > 0 ? (
          <span>
            יחויב: <b dir="ltr">{usd(netAgent)}</b>{" "}
            <span className="text-gray-400 line-through dark:text-gray-500" dir="ltr">
              {usd(full)}
            </span>{" "}
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              (בניכוי עמלה {usd(agentCommissionUsd)})
            </span>
          </span>
        ) : full > 0 ? (
          <span>יחויב: <b dir="ltr">{usd(full)}</b></span>
        ) : (
          "בניכוי העמלה שלך"
        ),
      hint: "אתה מזין את האשראי שלך - את הסכום המלא תגבה מהלקוח בנפרד.",
      show: true,
    },
    {
      value: "voucher",
      icon: TicketCheck,
      label: "תשלום בשובר",
      amount: (
        <span>
          ללא חיוב אשראי
          {voucherBalanceUsd > 0 && (
            <>
              {" · "}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                שובר פעיל: <b dir="ltr">{usd(voucherBalanceUsd)}</b>
              </span>
            </>
          )}
        </span>
      ),
      hint: "ההזמנה תמתין לאישור עד שהשובר ייגבה אצלנו.",
      show: voucherAllowed,
    },
  ];

  return (
    <div className="mt-3 space-y-2" dir="rtl">
      <p className="text-sm font-semibold">כיצד ברצונך לגבות את התשלום?</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup">
        {options
          .filter((opt) => opt.show)
          .map((opt) => {
            const selected = settlementMethod === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSettlementMethodChange(opt.value)}
                className={`flex items-start gap-2.5 rounded-xl border-2 p-3 text-right transition-colors ${
                  selected
                    ? "border-main bg-main/5 dark:border-glow dark:bg-glow/10"
                    : "border-gray-200 hover:border-main/40 dark:border-border dark:hover:border-glow/50"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                    selected
                      ? "border-main dark:border-glow"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {selected && (
                    <span className="h-2 w-2 rounded-full bg-main dark:bg-glow" />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={`flex items-center gap-1.5 text-sm font-bold ${
                      selected
                        ? "text-main dark:text-glow"
                        : "text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-gray-700 dark:text-gray-300">
                    {opt.amount}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {opt.hint}
                  </span>
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

function AgentMode({
  isAgentMode,
  onToggleAgentMode,
  settlementMethod,
  onSettlementMethodChange,
  agentCommissionUsd,
  voucherAllowed,
  voucherBalanceUsd,
  finalPurchasePriceUsd,
  settlementError,
}: AgentModeProps) {
  return (
    <div
      className="bg-white rounded-lg shadow p-4 mb-4 dark:border dark:border-border dark:bg-card"
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <h3 className="font-bold mr-2">מסך סוכן נסיעות</h3>
          <button
            onClick={onToggleAgentMode}
            className="flex items-center text-sm mx-2"
            aria-label={
              isAgentMode ? "Disable agent mode" : "Enable agent mode"
            }
          >
            {isAgentMode ? (
              <>
                <ToggleRight size={24} />
              </>
            ) : (
              <>
                <ToggleLeft className="text-gray-400" size={24} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* "הדפסה ללקוח" והגדרות ההדפסה (לוגו LiveEvents הישן) הוסרו -
          אלון ודור, 2026-08-06. */}
      {isAgentMode && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            הזמנה עבור הלקוח - בחרו איך נגבה את התשלום על ההזמנה הזו.
          </p>
          <SettlementMethodPicker
            settlementMethod={settlementMethod}
            onSettlementMethodChange={onSettlementMethodChange}
            agentCommissionUsd={agentCommissionUsd}
            voucherAllowed={voucherAllowed}
            voucherBalanceUsd={voucherBalanceUsd}
            finalPurchasePriceUsd={finalPurchasePriceUsd}
          />
          {settlementError && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
              {settlementError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default AgentMode;
