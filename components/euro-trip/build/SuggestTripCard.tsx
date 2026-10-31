"use client";

import { useState, type ChangeEvent } from "react";
import { Check, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUGGEST_TITLE_MAX } from "@/lib/itinerary/suggestion";

/**
 * The summary's "רוצים שנציע את הטיול שלכם גם לאחרים?" (lib/itinerary/suggestion.ts): a tick and,
 * once ticked, an optional name for the trip and its own button, "שלחו לבדיקה של הצוות" (Dor 31.10).
 * Nothing in the order changes and no hold is needed. Shown only on a trip the customer built (mode
 * "custom") - a ready trip is already on the site. Sent once; a failure is said, and the button stays.
 */
export function SuggestTripCard({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (title: string) => Promise<{ ok: boolean }>;
}) {
  const [on, setOn] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const send = async () => {
    if (status === "sending" || status === "sent") return;
    setStatus("sending");
    setStatus((await onSend(title).catch(() => ({ ok: false }))).ok ? "sent" : "failed");
  };

  if (status === "sent") {
    return (
      <Card className="overflow-hidden bg-card text-card-foreground shadow-lg" dir="rtl">
        <div role="status" className="flex items-start gap-3 px-8 py-6 text-start">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden>
            <Check className="size-4" />
          </span>
          <p className="m-0 text-base font-bold">תודה! הטיול נשלח לבדיקה של הצוות שלנו.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden bg-card text-card-foreground shadow-lg" dir="rtl">
      <div className="flex flex-col gap-4 px-8 py-6 text-start">
        <div className="flex items-start gap-3">
          <Checkbox
            id="trip-suggest"
            className="mt-1"
            checked={on}
            disabled={disabled}
            aria-describedby="trip-suggest-help"
            onCheckedChange={(checked) => setOn(checked === true)}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <Label htmlFor="trip-suggest" className="text-base font-bold">
              רוצים שנציע את הטיול שלכם גם לאחרים?
            </Label>
            <p id="trip-suggest-help" className="m-0 text-sm text-muted-foreground">
              נבנה ממנו טיול מוכן באתר, עם השם שתבחרו. זה לא משנה כלום בהזמנה שלכם.
            </p>
          </div>
        </div>

        {on && (
          <div className="flex flex-col gap-1 ps-7">
            <Label htmlFor="trip-suggest-title" className="text-sm font-medium">
              איך לקרוא לטיול? (לא חובה)
            </Label>
            <Input
              id="trip-suggest-title"
              className="h-11 text-start"
              maxLength={SUGGEST_TITLE_MAX}
              placeholder="לדוגמה: סופ״ש פריז-לונדון"
              autoComplete="off"
              disabled={disabled}
              aria-describedby="trip-suggest-title-help"
              value={title}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            />
            <p id="trip-suggest-title-help" className="m-0 text-xs text-muted-foreground">
              הצוות שלנו עובר על כל הצעה לפני שהיא עולה לאתר.
            </p>
            <button
              type="button"
              onClick={() => void send()}
              disabled={disabled || status === "sending"}
              aria-busy={status === "sending"}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-main text-sm font-bold text-main-foreground transition-colors hover:bg-main/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit sm:px-6 dark:bg-glow dark:text-forest dark:hover:bg-glow/90"
            >
              {status === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden />}
              שלחו לבדיקה של הצוות
            </button>
            {status === "failed" && (
              <p role="alert" className="m-0 mt-1 text-sm font-semibold text-destructive">
                לא הצלחנו לשלוח - נסו שוב בעוד רגע.
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
