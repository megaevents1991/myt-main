"use client";

import type { ChangeEvent } from "react";

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUGGEST_TITLE_MAX } from "@/lib/itinerary/suggestion";

/**
 * The summary's "רוצים שנציע את הטיול שלכם גם לאחרים?" (lib/itinerary/suggestion.ts): a tick and,
 * once ticked, an optional name for the trip. Sent with the hold; nothing in the order changes. Shown
 * only on a trip the customer built (mode "custom") - a ready trip is already on the site.
 */
export function SuggestTripCard({
  on,
  title,
  disabled,
  onToggle,
  onTitle,
}: {
  on: boolean;
  title: string;
  disabled: boolean;
  onToggle: (on: boolean) => void;
  onTitle: (title: string) => void;
}) {
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
            onCheckedChange={(checked) => onToggle(checked === true)}
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
              onChange={(e: ChangeEvent<HTMLInputElement>) => onTitle(e.target.value)}
            />
            <p id="trip-suggest-title-help" className="m-0 text-xs text-muted-foreground">
              הצוות שלנו עובר על כל הצעה לפני שהיא עולה לאתר.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
