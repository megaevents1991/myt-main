"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { Event, ItineraryFlight, OrderHotel, OrderTicket } from "@/lib/app.types";
import { sameRouteIds, type HeldTicket } from "@/lib/itinerary/draft";
import { readItineraryDraft, writeItineraryDraft } from "@/lib/itinerary/draftStorage";
import { describeCompat } from "@/lib/itinerary/rules";
import type { ItinerarySettings } from "@/lib/itinerary/settings";
import {
  INITIAL_ITINERARY_STATE,
  fitRoute,
  itineraryReducer,
  type ItineraryMode,
  type ItineraryState,
  type ItineraryStep,
} from "@/lib/itinerary/state";
import { emptyTravellers, type TravellersInput } from "@/lib/itinerary/travellers";
import type { TripDates } from "@/lib/itinerary/types";
import { eventsParamValue, parseEventsParam, reconcileRoute } from "@/lib/itinerary/url";

const EVENTS_PARAM = "events";

/** Said once over the tickets step when a refresh brought back a trip that was past it. */
const RESTORED_NOTICE =
  "החזרנו את הטיול שלכם. כדי שהמחירים יהיו עדכניים בודקים שוב את הכרטיסים, ואחריהם בוחרים מחדש טיסה ומלונות.";

/** Runs before the first paint on the client (no flash of the empty builder on a route link). */
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type ItineraryApi = {
  state: ItineraryState;
  /** Every event a trip may hold (eligible, server-filtered). */
  catalog: Event[];
  byId: Map<number, Event>;
  settings: ItinerarySettings;
  /** Set once the page's `?events=` was read - before that the builder shows its empty state. */
  urlApplied: boolean;
  /** Reads `?events=` into the state - once per mount; later calls do nothing. */
  applyUrl: () => void;
  /** A message about the route the link opened (an event that is gone, or does not fit). */
  notice: string | null;
  dismissNotice: () => void;
  /** Shows a message about the route above the step (e.g. an event the tickets step found gone). */
  showNotice: (message: string) => void;
  addEvent: (e: Event) => void;
  removeEvent: (id: number) => void;
  setMode: (m: ItineraryMode) => void;
  setDates: (d: TripDates) => void;
  setPax: (n: number) => void;
  setTicket: (eventId: number, t: OrderTicket | undefined) => void;
  setEventData: (e: Event) => void;
  toggleTrain: (key: string) => void;
  setFlight: (f: ItineraryFlight | null) => void;
  setHotel: (stayKey: string, h: OrderHotel | undefined) => void;
  /** Drops the flight and every hotel (searched for another party). */
  clearTravel: () => void;
  goStep: (step: ItineraryStep) => void;
  setActiveEvent: (i: number) => void;
  setActiveStay: (i: number) => void;
  /**
   * The category each event's tab reopens on after a refresh (the draft, lib/itinerary/draft.ts):
   * no price - the ticket step prices it again. Read by a tab only while the event has no ticket.
   */
  heldTickets: Record<number, HeldTicket>;
  /** The summary's travellers form - here, so it survives a visit to an earlier step (and a refresh). */
  travellers: TravellersInput;
  setTravellers: (t: TravellersInput) => void;
  termsAccepted: boolean;
  setTermsAccepted: (v: boolean) => void;
};

const ItineraryContext = createContext<ItineraryApi | null>(null);

/**
 * "Build Your Euro Trip" - the builder's state (one reducer, `lib/itinerary/state.ts`).
 *
 * The page is cached and never reads the URL on the server, so the first render is always the
 * empty self-build (what the server printed). Right after it, the route in `?events=` is read
 * from `window.location`, matched against the catalog and fitted with the rules; from then on
 * every change of the route is written back to `?events=` (replaceState), so a refresh or a
 * shared link reopens the same trip. A refresh in the same tab also brings back the rest of its
 * shape - dates, party, train moves, the held categories, the travellers' form - from the
 * tab's draft (sessionStorage, lib/itinerary/draft.ts), read in that same once-per-mount step.
 */
export function ItineraryProvider({
  catalog,
  settings,
  children,
}: {
  catalog: Event[];
  settings: ItinerarySettings;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(itineraryReducer, INITIAL_ITINERARY_STATE);
  const [urlApplied, setUrlApplied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [heldTickets, setHeldTickets] = useState<Record<number, HeldTicket>>({});
  const [travellers, setTravellers] = useState<TravellersInput>(() => emptyTravellers(INITIAL_ITINERARY_STATE.pax));
  const [termsAccepted, setTermsAccepted] = useState(false);
  const byId = useMemo(() => new Map(catalog.map((e) => [e.id, e])), [catalog]);

  // Read ?events= once. Called by `useItineraryUrl` from inside the page's Suspense boundary:
  // run from here (outside it) the update reached the flow before it hydrated - a mismatch.
  // Exactly once per mount: the layout effect runs again on a Suspense re-reveal or a Fast
  // Refresh, and a second `load` would send a customer mid-trip back to the build step.
  const urlRead = useRef(false);
  const applyUrl = useCallback(() => {
    if (urlRead.current) return;
    urlRead.current = true;
    const ids = parseEventsParam(new URLSearchParams(window.location.search).get(EVENTS_PARAM), settings.maxEvents);
    const { route: found, dropped } = reconcileRoute(ids, byId);
    const { route, refused } = fitRoute(found, settings);
    if (ids.length) dispatch({ type: "load", route, mode: route.length ? "route" : "custom" });
    // The trip this tab held before a refresh (lib/itinerary/draft.ts) - only for the trip the
    // URL names: a link to another route wins, and the draft is left alone (the next save
    // replaces it). It brings back the trip's shape and the travellers' form; prices never - the
    // flow reopens on the tickets step at most, each tab on the category it held.
    const draft = route.length ? readItineraryDraft(byId) : null;
    const restored = draft && sameRouteIds(draft.route, route) ? draft : null;
    if (restored) {
      dispatch({ type: "setMode", mode: restored.mode });
      for (const key of restored.train) dispatch({ type: "toggleTrain", key });
      dispatch({ type: "setDates", dates: restored.dates });
      dispatch({ type: "setPax", pax: restored.pax });
      dispatch({ type: "goStep", step: restored.step });
      setHeldTickets(restored.held);
      if (restored.form) {
        setTravellers(restored.form.travellers);
        setTermsAccepted(restored.form.termsAccepted);
      }
    }
    const pastTickets = !!restored && ["flights", "hotels", "summary"].includes(restored.savedStep);
    const messages = [
      ...(dropped.length ? ["האירוע כבר לא זמין"] : []),
      ...refused.map((r) => `${r.event.name} לא נכנס למסלול: ${describeCompat(r.compat)}`),
      ...(pastTickets ? [RESTORED_NOTICE] : []),
    ];
    setNotice(messages.length ? messages.join(" · ") : null);
    setUrlApplied(true);
  }, [byId, settings]);

  // Keep ?events= in step with the route (other parameters - utm_source etc. - stay as they are).
  const value = eventsParamValue(state.route);
  useEffect(() => {
    if (!urlApplied) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(EVENTS_PARAM) === value) return;
    if (value === null) url.searchParams.delete(EVENTS_PARAM);
    else url.searchParams.set(EVENTS_PARAM, value);
    // Commas stay readable (`?events=618,702`, as the hub's links write it).
    window.history.replaceState(null, "", url.pathname + url.search.replace(/%2C/gi, ",") + url.hash);
  }, [urlApplied, value]);

  // Mirror the trip into the tab's draft on every change - only once the URL (and the draft) was
  // read, so the first renders never overwrite the trip a refresh is about to bring back.
  useEffect(() => {
    if (!urlApplied) return;
    writeItineraryDraft(state, { held: heldTickets, form: { travellers, termsAccepted } });
  }, [urlApplied, state, heldTickets, travellers, termsAccepted]);

  const api = useMemo<ItineraryApi>(
    () => ({
      state,
      catalog,
      byId,
      settings,
      urlApplied,
      applyUrl,
      notice,
      dismissNotice: () => setNotice(null),
      showNotice: (message) => setNotice(message),
      addEvent: (event) => dispatch({ type: "addEvent", event, settings }),
      removeEvent: (id) => dispatch({ type: "removeEvent", id }),
      setMode: (mode) => dispatch({ type: "setMode", mode }),
      setDates: (dates) => dispatch({ type: "setDates", dates }),
      setPax: (pax) => dispatch({ type: "setPax", pax }),
      setTicket: (eventId, ticket) => dispatch({ type: "setTicket", eventId, ticket }),
      setEventData: (event) => dispatch({ type: "setEventData", event }),
      toggleTrain: (key) => dispatch({ type: "toggleTrain", key }),
      setFlight: (flight) => dispatch({ type: "setFlight", flight }),
      setHotel: (stayKey, hotel) => dispatch({ type: "setHotel", stayKey, hotel }),
      clearTravel: () => dispatch({ type: "clearTravel" }),
      goStep: (step) => dispatch({ type: "goStep", step }),
      setActiveEvent: (index) => dispatch({ type: "setActiveEvent", index }),
      setActiveStay: (index) => dispatch({ type: "setActiveStay", index }),
      heldTickets,
      travellers,
      setTravellers,
      termsAccepted,
      setTermsAccepted,
    }),
    [state, catalog, byId, settings, urlApplied, applyUrl, notice, heldTickets, travellers, termsAccepted],
  );

  return <ItineraryContext.Provider value={api}>{children}</ItineraryContext.Provider>;
}

/** The builder's state and actions. Only inside `ItineraryProvider`. */
export function useItinerary(): ItineraryApi {
  const api = useContext(ItineraryContext);
  if (!api) throw new Error("useItinerary must be used inside ItineraryProvider");
  return api;
}

/**
 * Opens the route in `?events=` once the flow is hydrated. Call it from a component inside the
 * page's Suspense boundary (ItineraryFlow): a layout effect, so a client-side visit from a route
 * card never paints the empty builder first.
 */
export function useItineraryUrl(): void {
  const { applyUrl } = useItinerary();
  useBrowserLayoutEffect(() => {
    applyUrl();
    // Once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
