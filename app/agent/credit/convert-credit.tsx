"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { convertCreditToCoupon } from "@/lib/agent-credit-actions";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

/** Mirrors MIN_CONVERT_USD in lib/agent-credit-actions.ts. */
const MIN_CONVERT_USD = 1;

export function ConvertCredit({ balanceUsd }: { balanceUsd: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(String(balanceUsd));
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ code: string; amountUsd: number } | null>(null);

  const amountNumber = Number(amount);
  const amountInvalid =
    !Number.isFinite(amountNumber) || amountNumber < MIN_CONVERT_USD || amountNumber > balanceUsd;

  const handleConvert = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await convertCreditToCoupon({
        amountUsd: amountNumber,
        code: name || null,
      });
      if (!result.ok) {
        // Keep the dialog open so the amount and name can be corrected.
        setError(result.error);
        return;
      }
      setIssued({ code: result.code, amountUsd: result.amountUsd });
      setOpen(false);
      setName("");
      router.refresh();
    } catch (err) {
      console.error("convertCreditToCoupon:", err);
      setError("אירעה שגיאה. נסו שוב.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {issued && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <p className="text-sm text-gray-500">הקופון שלכם מוכן</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-wider">{issued.code}</p>
          <p className="mt-1 text-sm text-gray-500">
            בשווי {usd.format(issued.amountUsd)}. אם תשתמשו רק בחלק ממנו, ההפרש יחזור לצבירה שלכם.
          </p>
        </div>
      )}

      {/* Below the minimum the dialog could only ever refuse, so don't open it. */}
      <Button
        disabled={balanceUsd < MIN_CONVERT_USD}
        onClick={() => {
          setAmount(String(balanceUsd));
          setError(null);
          setOpen(true);
        }}
      >
        המרה לקופון
      </Button>
      {balanceUsd > 0 && balanceUsd < MIN_CONVERT_USD && (
        <p className="text-xs text-gray-500">
          צריך לפחות {usd.format(MIN_CONVERT_USD)} בצבירה כדי להפיק קופון.
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>המרת צבירה לקופון</DialogTitle>
            <DialogDescription>
              יש לכם {usd.format(balanceUsd)} להמרה. אפשר להמיר הכל או חלק - מה שלא תמירו נשאר
              בצבירה.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="credit-amount">סכום להמרה ($)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="credit-amount"
                  type="number"
                  min={MIN_CONVERT_USD}
                  max={balanceUsd}
                  // Cents, not whole dollars - a balance can be $62.50.
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={() => setAmount(String(balanceUsd))}>
                  הכל
                </Button>
              </div>
              {amountInvalid && (
                <p className="text-xs text-red-600">
                  יש להזין סכום בין {usd.format(MIN_CONVERT_USD)} ל-{usd.format(balanceUsd)}.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="credit-name">שם לקופון (אופציונלי)</Label>
              <Input
                id="credit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: SUMMER-TRIP"
                dir="ltr"
              />
              <p className="text-xs text-gray-500">
                אותיות באנגלית, ספרות ומקפים. אם תשאירו ריק, ניצור קוד אוטומטית.
              </p>
            </div>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button disabled={busy || amountInvalid} onClick={handleConvert}>
              {busy ? "ממיר..." : "צרו קופון"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
