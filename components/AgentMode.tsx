import { ToggleLeft, ToggleRight, Printer, CreditCard, Wallet, TicketCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SettlementMethod } from "@/lib/app.types";

interface AgentModeProps {
  isAgentMode: boolean;
  onToggleAgentMode: () => void;
  onPrintForClient: () => void;
  settlementMethod: SettlementMethod;
  onSettlementMethodChange: (method: SettlementMethod) => void;
  agentCommissionPercent: number;
  /** True only when the agent BOTH is approved for voucher payment AND holds a
   *  live voucher (active, unspent credit-redemption coupon) — see checkCode. */
  voucherAllowed: boolean;
  /** Live voucher value in USD, shown on the voucher option. */
  voucherBalanceUsd?: number;
  /** Full package total in USD — each option shows the amount it actually
   *  charges, incl. the commission-netted agent-card figure. */
  finalPurchasePriceUsd?: number;
  settlementError?: string | null;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function SettlementMethodPicker({
  settlementMethod,
  onSettlementMethodChange,
  agentCommissionPercent,
  voucherAllowed,
  voucherBalanceUsd = 0,
  finalPurchasePriceUsd = 0,
}: {
  settlementMethod: SettlementMethod;
  onSettlementMethodChange: (method: SettlementMethod) => void;
  agentCommissionPercent: number;
  voucherAllowed: boolean;
  voucherBalanceUsd?: number;
  finalPurchasePriceUsd?: number;
}) {
  const full = finalPurchasePriceUsd;
  const netAgent =
    agentCommissionPercent > 0 ? full * (1 - agentCommissionPercent / 100) : full;

  // Radio CARDS, not bare pills: icon + who pays + the ACTUAL number each
  // method charges — the commission deduction is visible on the card itself,
  // not buried in a hint below.
  const options: Array<{
    value: SettlementMethod;
    icon: LucideIcon;
    label: string;
    /** The money line — the number this method really charges. */
    amount: React.ReactNode;
    hint: string;
    show: boolean;
  }> = [
    {
      value: "customer_card",
      icon: CreditCard,
      label: "אשראי הלקוח",
      amount: full > 0 ? <span>יחויב: <b dir="ltr">{usd(full)}</b></span> : "מחיר מלא",
      hint: "הלקוח מזין את פרטי האשראי שלו — כרגיל.",
      show: true,
    },
    {
      value: "agent_card",
      icon: Wallet,
      label: "אשראי שלי (הסוכן)",
      amount:
        full > 0 && agentCommissionPercent > 0 ? (
          <span>
            יחויב: <b dir="ltr">{usd(netAgent)}</b>{" "}
            <span className="text-gray-400 line-through" dir="ltr">
              {usd(full)}
            </span>{" "}
            <span className="font-semibold text-emerald-700">
              (−{agentCommissionPercent}% עמלה)
            </span>
          </span>
        ) : full > 0 ? (
          <span>יחויב: <b dir="ltr">{usd(full)}</b></span>
        ) : (
          "בניכוי העמלה שלך"
        ),
      hint: "אתה מזין את האשראי שלך — את הסכום המלא תגבה מהלקוח בנפרד.",
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
              <span className="font-semibold text-emerald-700">
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
                    ? "border-main bg-main/5"
                    : "border-gray-200 hover:border-main/40"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                    selected ? "border-main" : "border-gray-300"
                  }`}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-main" />}
                </span>
                <span className="min-w-0">
                  <span
                    className={`flex items-center gap-1.5 text-sm font-bold ${
                      selected ? "text-main" : "text-gray-800"
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-gray-700">{opt.amount}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{opt.hint}</span>
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
  onPrintForClient,
  settlementMethod,
  onSettlementMethodChange,
  agentCommissionPercent,
  voucherAllowed,
  voucherBalanceUsd,
  finalPurchasePriceUsd,
  settlementError,
}: AgentModeProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4" dir="rtl">
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

      {isAgentMode && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-600">
            מצב זה מאפשר להדפיס הצעת מחיר ללקוח עם לוגו משרדך ומחיר סופי ללקוח
            עפ&quot;י שיקול דעתך
          </p>
          {/* Forest-on-white, not mint — the pale green button was invisible
              against the white card. */}
          <button
            onClick={onPrintForClient}
            className="flex items-center rounded-md bg-main px-4 py-2 font-medium text-main-foreground transition-colors hover:bg-main/90"
            aria-label="Print for client"
          >
            <Printer size={16} className="ml-2" />
            <span>הדפסה ללקוח</span>
          </button>
          <SettlementMethodPicker
            settlementMethod={settlementMethod}
            onSettlementMethodChange={onSettlementMethodChange}
            agentCommissionPercent={agentCommissionPercent}
            voucherAllowed={voucherAllowed}
            voucherBalanceUsd={voucherBalanceUsd}
            finalPurchasePriceUsd={finalPurchasePriceUsd}
          />
          {settlementError && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {settlementError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default AgentMode;
