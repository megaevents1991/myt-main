import { ToggleLeft, ToggleRight, Printer } from "lucide-react";
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
  /** Live voucher value in USD, shown in the voucher option's hint. */
  voucherBalanceUsd?: number;
  settlementError?: string | null;
}

const SETTLEMENT_OPTIONS: Array<{
  value: SettlementMethod;
  label: string;
  hint: (commissionPercent: number, voucherBalanceUsd: number) => string;
  agentOnlyFeature?: boolean;
}> = [
  {
    value: "customer_card",
    label: "אשראי הלקוח",
    hint: () => "הלקוח מזין את פרטי האשראי שלו, במחיר המלא — כרגיל.",
  },
  {
    value: "agent_card",
    label: "אשראי שלי (הסוכן)",
    hint: (p) =>
      p > 0
        ? `אתה מזין את פרטי האשראי שלך. יחויב עלות בניקוי העמלה שלך (${p}%) — את הסכום המלא תגבה מהלקוח בנפרד.`
        : "אתה מזין את פרטי האשראי שלך במחיר המלא — את הסכום תגבה מהלקוח בנפרד.",
  },
  {
    value: "voucher",
    label: "תשלום בשובר",
    hint: (_p, voucherBalanceUsd) =>
      `${
        voucherBalanceUsd > 0
          ? `יש לך שובר פעיל בסך $${Math.round(voucherBalanceUsd).toLocaleString("en-US")}. `
          : ""
      }ההזמנה תישאר ממתינה לאישור עד שהשובר ייגבה אצלנו — לא יבוצע חיוב אשראי.`,
    agentOnlyFeature: true,
  },
];

function SettlementMethodPicker({
  settlementMethod,
  onSettlementMethodChange,
  agentCommissionPercent,
  voucherAllowed,
  voucherBalanceUsd = 0,
}: {
  settlementMethod: SettlementMethod;
  onSettlementMethodChange: (method: SettlementMethod) => void;
  agentCommissionPercent: number;
  voucherAllowed: boolean;
  voucherBalanceUsd?: number;
}) {
  const options = SETTLEMENT_OPTIONS.filter(
    (opt) => !opt.agentOnlyFeature || voucherAllowed,
  );
  const active = options.find((opt) => opt.value === settlementMethod) ?? options[0];

  return (
    <div className="mt-3 space-y-2" dir="rtl">
      <p className="text-sm font-medium">כיצד ברצונך לגבות את התשלום?</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSettlementMethodChange(opt.value)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              settlementMethod === opt.value
                ? "border-main bg-main text-main-foreground"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
            aria-pressed={settlementMethod === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {active.hint(agentCommissionPercent, voucherBalanceUsd)}
      </p>
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
          <button
            onClick={onPrintForClient}
            className="flex items-center px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
            aria-label="Print for client"
          >
            <Printer size={16} className="mr-2" />
            <span>הדפסה ללקוח</span>
          </button>
          <SettlementMethodPicker
            settlementMethod={settlementMethod}
            onSettlementMethodChange={onSettlementMethodChange}
            agentCommissionPercent={agentCommissionPercent}
            voucherAllowed={voucherAllowed}
            voucherBalanceUsd={voucherBalanceUsd}
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
