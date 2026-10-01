/**
 * sessionStorage side of the order draft - the rules are in ./draft.ts.
 *
 * Browser only, and never from a render: sessionStorage does not exist on the server
 * and the first client render must match the server's HTML. Every call is wrapped -
 * private mode, a full quota or blocked storage must never break an order.
 */
import type { Event } from "@/lib/app.types";
import {
  buildOrderDraft,
  buildOrderForm,
  isBlankForm,
  isOrderStorageKey,
  isStale,
  orderDraftKey,
  orderFormKey,
  ownedByLink,
  parseOrderDraft,
  parseOrderForm,
  resumeOrder,
  type OrderDraftState,
  type OrderFormDraft,
  type ResumedOrder,
} from "./draft";

const storage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

/** Drop every order draft / form in this tab that is past its TTL or unreadable. */
function pruneStaleOrders(store: Storage, now: number) {
  const stale: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key && isOrderStorageKey(key) && isStale(store.getItem(key), now)) stale.push(key);
  }
  stale.forEach((key) => store.removeItem(key));
}

/** The order this tab was holding for the event, checked against the event as it is now. */
export function readOrderDraft(event: Event): ResumedOrder | null {
  const store = storage();
  if (!store) return null;
  try {
    const now = Date.now();
    pruneStaleOrders(store, now);
    const draft = parseOrderDraft(store.getItem(orderDraftKey(event.id)), event.id, now);
    return draft ? resumeOrder(draft, event, now) : null;
  } catch (error) {
    console.error("Order draft could not be read:", error);
    return null;
  }
}

/**
 * True when this page load will come back onto the hotel step or the summary
 * (same reading as readOrderDraft, link-owned orders excluded like the layout does).
 */
export function storedOrderPastFlight(event: Event): boolean {
  if (typeof window === "undefined" || ownedByLink(window.location.search)) return false;
  const saved = readOrderDraft(event);
  return !!saved && saved.step >= 3 && (saved.flightSkipped || !!saved.flight);
}

export function writeOrderDraft(eventId: number, state: OrderDraftState) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(
      orderDraftKey(eventId),
      JSON.stringify(buildOrderDraft(eventId, state, Date.now())),
    );
  } catch (error) {
    // Quota / blocked storage: the order carries on in memory, as it always did.
    console.error("Order draft could not be saved:", error);
  }
}

/**
 * The summary's hold ran out ("הזמן אזל"): the composition is released, so a refresh
 * must start over like the modal's own button does. The typed travellers stay.
 */
export function forgetOrderDraft(eventId: number | undefined) {
  const store = storage();
  if (!store || !eventId) return;
  try {
    store.removeItem(orderDraftKey(eventId));
  } catch {
    /* nothing to forget */
  }
}

/** The order is done (or abandoned on purpose): forget the draft and the typed form. */
export function clearStoredOrder(eventId: number) {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(orderDraftKey(eventId));
    store.removeItem(orderFormKey(eventId));
  } catch {
    /* nothing to clear */
  }
}

export function readOrderForm(eventId: number | undefined): OrderFormDraft | null {
  const store = storage();
  if (!store || !eventId) return null;
  try {
    return parseOrderForm(store.getItem(orderFormKey(eventId)), Date.now());
  } catch {
    return null;
  }
}

export function writeOrderForm(
  eventId: number | undefined,
  form: { passengers: unknown[]; termsAccepted: boolean; coupon: string | null },
) {
  const store = storage();
  if (!store || !eventId) return;
  try {
    const draft = buildOrderForm(form, Date.now());
    if (isBlankForm(draft)) store.removeItem(orderFormKey(eventId));
    else store.setItem(orderFormKey(eventId), JSON.stringify(draft));
  } catch (error) {
    console.error("Order form could not be saved:", error);
  }
}
