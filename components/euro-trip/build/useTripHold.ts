"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { loadTripEventsFresh } from "@/app/euro-trip/build/actions";
import { asFullRow, forgetFullRow, goneIds } from "@/lib/itinerary/adapter";
import {
  confirmFailureAction,
  escalatePriceChange,
  holdAttempt,
  holdSignature,
  isHeldAnswer,
  submissionFromState,
  tripKey,
  type HoldAction,
  type HoldAttempt,
} from "@/lib/itinerary/confirm";
import { livePrice } from "@/lib/itinerary/progress";
import type { TravellersInput } from "@/lib/itinerary/travellers";
import { getUTMParams } from "@/lib/mixpanel";
import { useItinerary } from "./ItineraryProvider";

/** The words the tickets step uses for an event that left the catalog. */
const GONE = "האירוע כבר לא זמין";

/** The visit's utm_source as the live summary reads it (`getUTMParams`); "" when there is none. */
function utmSource(): string {
  try {
    const source = (getUTMParams() as { source?: unknown }).source;
    return typeof source === "string" ? source : "";
  } catch {
    return "";
  }
}

/**
 * The summary's "שמרו לי ל-24 שעות": POST /api/itinerary/confirm with the whole trip.
 *
 * - The group id (`itinerary_group`, the idempotency key) is kept only for a retry of the
 *   IDENTICAL trip (`holdAttempt` over `holdSignature`: the trip, its picks and its price): a
 *   double click, a retry after an error or a lost answer sends the SAME group, and the server
 *   answers the rows it already wrote. Any change - the customer went back and edited the trip
 *   after a lost answer - gets a new group: the old one would be answered with the old trip's
 *   rows. A refusal that sends the customer back to change the trip also drops it.
 * - One request at a time (a ref, so even two clicks in one frame send one).
 * - Success: `markHeld` (closes the draft; the summary shows the confirmation, its clock stops)
 *   and any earlier notice goes.
 * - A refusal the customer fixes on an earlier step (price changed, route changed, a ticket, a
 *   hotel): the notice says why and the flow goes there - the event's or the city's tab open.
 *   After "the price / a ticket changed" the route's rows are first read FRESH from the database
 *   (`loadTripEventsFresh`, the rows the server priced with - not the hour-cached catalog) and put
 *   in marked whole, so the tickets step does not read the cached catalog over them; an event
 *   gone meanwhile leaves the route. If that read fails, the rows are un-marked and the tickets
 *   step reads them again (cached). Anything else (a server error, no answer) stays on the
 *   summary as `failure`.
 */
export function useTripHold(): {
  submit: (travellers: TravellersInput) => Promise<void>;
  sending: boolean;
  failure: Extract<HoldAction, { kind: "stay" }> | null;
} {
  const api = useItinerary();
  // The latest provider for the async answer (its actions dispatch; its state is read on landing).
  const latest = useRef(api);
  useLayoutEffect(() => {
    latest.current = api;
  });
  const attempt = useRef<HoldAttempt | null>(null);
  const inFlight = useRef(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<Extract<HoldAction, { kind: "stay" }> | null>(null);

  /** The route's rows as the server priced them; true when an event left the route. */
  const reloadFresh = useCallback(async (): Promise<boolean> => {
    const asked = latest.current.state.route;
    const ids = asked.map((e) => e.id);
    try {
      const rows = await loadTripEventsFresh(ids);
      for (const row of rows) latest.current.setEventData(asFullRow(row));
      const gone = goneIds(ids, rows, ids);
      for (const id of gone) latest.current.removeEvent(id);
      return gone.length > 0;
    } catch (err) {
      console.error("[EuroTrip] Fresh rows after the hold's refusal failed - the tickets step reads them again:", err);
      for (const e of asked) latest.current.setEventData(forgetFullRow(e));
      return false;
    }
  }, []);

  const submit = useCallback(async (travellers: TravellersInput) => {
    const a = latest.current;
    if (inFlight.current || a.held || !a.state.flight) return;
    const price = livePrice(a.state, a.settings);
    if (!price) return;
    inFlight.current = true;
    setSending(true);
    setFailure(null);
    // The same group only for a retry of the identical trip (picks and price included).
    attempt.current = holdAttempt(attempt.current, holdSignature(a.state, price.total));
    // The trip this attempt is for: a "the price changed" counts as "again" only for the same one.
    const key = tripKey(a.state);
    try {
      const body = submissionFromState(a.state, travellers, attempt.current.group, price, { utmSource: utmSource() });
      const res = await fetch("/api/itinerary/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json: unknown = await res.json().catch(() => null);
      if (res.ok && isHeldAnswer(json)) {
        // An earlier refusal's notice ("המחיר עודכן") is over: the trip is held.
        latest.current.countPriceChange(false, key);
        latest.current.dismissNotice();
        latest.current.markHeld({
          group: json.group,
          ids: json.ids,
          reference: json.reference ?? null,
          ...(typeof json.emailed === "boolean" ? { emailed: json.emailed } : {}),
        });
        return;
      }
      const now = latest.current;
      const refusal = confirmFailureAction(res.status, json, now.state);
      // A second "the price changed" in a row FOR THE SAME TRIP (already re-priced on fresh rows):
      // said here, with a refresh and the WhatsApp contact - no second bounce through the steps.
      const action = escalatePriceChange(refusal, now.countPriceChange(refusal.code === "PRICE_CHANGED", key));
      if (action.kind === "stay") {
        setFailure(action);
        return;
      }
      attempt.current = null;
      if (action.reloadRows && (await reloadFresh())) {
        // An event left the catalog meanwhile: the route changed - the build step says so, and the
        // trip that comes back from it is another one.
        latest.current.countPriceChange(false, key);
        latest.current.showNotice(GONE);
        latest.current.goStep("build");
        return;
      }
      if (action.eventIndex !== undefined) now.setActiveEvent(action.eventIndex);
      if (action.stayIndex !== undefined) now.setActiveStay(action.stayIndex);
      now.showNotice(action.message);
      now.goStep(action.step);
    } catch (err) {
      console.error("[EuroTrip] The hold request failed:", err);
      // No answer at all: a server error, said on the summary - and no "price changed in a row".
      latest.current.countPriceChange(false, key);
      const action = confirmFailureAction(0, null, latest.current.state);
      setFailure(action.kind === "stay" ? action : { kind: "stay", code: "SERVER_ERROR", message: action.message });
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }, [reloadFresh]);

  return { submit, sending, failure };
}
