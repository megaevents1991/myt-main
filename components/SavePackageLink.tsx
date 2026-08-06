"use client";

import { useState } from "react";
import { savePreparedPackage } from "@/lib/agent-package-actions";
import type { Flight, OrderHotel, OrderTicket } from "@/lib/app.types";

/**
 * Lets a signed-in partner (agent or influencer — this is still fundamentally
 * "give a link", same as a plain tracking link, just pre-filled) save the
 * exact ticket/flight/hotel combination they just picked and get a link that
 * lands a follower directly on it instead of an empty search page.
 *
 * Only rendered when `partnerSession` is a real, cookie-verified session
 * (checked by the caller) — never gated on the unauthenticated
 * agentCommission/localStorage signal AgentMode uses.
 */
export function SavePackageLink({
  eventId,
  ticket,
  numberOfEventTickets,
  flight,
  flightSkipped,
  hotel,
  hotelSkipped,
}: {
  eventId: number;
  ticket: OrderTicket;
  numberOfEventTickets: number;
  flight?: Flight;
  flightSkipped: boolean;
  hotel?: OrderHotel;
  hotelSkipped: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await savePreparedPackage({
        eventId,
        ticket,
        numberOfEventTickets,
        flight: flightSkipped ? null : flight,
        flightSkipped,
        hotel: hotelSkipped ? null : hotel,
        hotelSkipped,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLink(result.link);
    } catch {
      setError("שגיאת רשת — נסו שוב.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4 mb-4" dir="rtl">
      <h3 className="font-bold mb-1">שמירת החבילה הזו כלינק לשיתוף</h3>
      <p className="text-sm text-gray-600 mb-3">
        שומר את הכרטיס, הטיסה והמלון שבחרתם כאן, ונותן לינק שמוביל את העוקב/הלקוח
        ישר לחבילה הזו — במקום לחפש מההתחלה.
      </p>

      {link ? (
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700"
            dir="ltr"
          />
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* clipboard unavailable — the field above can be selected manually */
              }
            }}
            className="shrink-0 rounded-md bg-main px-4 py-2 text-sm font-medium text-main-foreground hover:bg-main/90"
          >
            {copied ? "הועתק ✓" : "העתקה"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-main px-4 py-2 text-sm font-medium text-main-foreground hover:bg-main/90 disabled:opacity-50"
        >
          {saving ? "שומר..." : "שמירה וקבלת לינק"}
        </button>
      )}
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
