"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { loadTripEventsFresh } from "@/app/euro-trip/build/actions";
import { asFullRow, forgetFullRow, goneIds } from "@/lib/itinerary/adapter";
import {
  confirmFailureAction,
  isHeldAnswer,
  newGroupId,
  submissionFromState,
  type HoldAction,
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
 * - The group id (`itinerary_group`, the idempotency key) is made ONCE per hold attempt and kept
 *   until it goes through: a double click, a retry after an error or a lost answer sends the SAME
 *   group, and the server answers the rows it already wrote. Only a refusal that sends the
 *   customer back to change the trip starts a new one - what is sent next is another trip.
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
  const group = useRef<string | null>(null);
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
    group.current ??= newGroupId();
    try {
      const body = submissionFromState(a.state, travellers, group.current, price, { utmSource: utmSource() });
      const res = await fetch("/api/itinerary/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json: unknown = await res.json().catch(() => null);
      if (res.ok && isHeldAnswer(json)) {
        // An earlier refusal's notice ("המחיר עודכן") is over: the trip is held.
        latest.current.dismissNotice();
        latest.current.markHeld({ group: json.group, ids: json.ids, reference: json.reference ?? null });
        return;
      }
      const now = latest.current;
      const action = confirmFailureAction(res.status, json, now.state);
      if (action.kind === "stay") {
        setFailure(action);
        return;
      }
      group.current = null;
      if (action.reloadRows && (await reloadFresh())) {
        // An event left the catalog meanwhile: the route changed - the build step says so.
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
      // No answer at all: a server error, said on the summary.
      const action = confirmFailureAction(0, null, latest.current.state);
      setFailure(action.kind === "stay" ? action : { kind: "stay", code: "SERVER_ERROR", message: action.message });
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }, [reloadFresh]);

  return { submit, sending, failure };
}
