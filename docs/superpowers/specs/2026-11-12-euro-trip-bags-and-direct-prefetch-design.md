# Euro Trip - a suitcase per flight, and the direct pairs in the list from the start

**Status:** proposal for Dor's decision (12.11.2026). Nothing here is built.
**Source:** Alon's round of 12.11 (doc tab "יורו טריפ בן אדם"): the second note 10 - "שיביא מראש גם את
התוצאות האלה. כחלק מהפול ובסיכום הזמנה שיהיה אפשר להוסיף כבודה לכל אחת מהטיסות" - and desktop
note 5 - "אין אפשרות להוסיף מזוודה, הוא לא מציין בגדול". Dor (12.11): its own round, spec first.

## What the customer sees today

- **Flights step.** The round trip lists one search (one ticket out and home). The "טיסות ישירות
  בלבד" switch (1c11e62, 09.11) runs three non-stop searches (the round trip, the way out alone, the
  way home alone) and pairs one-ways into two-ticket cards (`lib/itinerary/directPairs.ts`). Those
  pairs appear only behind the switch, which is off by default.
- **Summary.** Each flight part is a row with its times. No baggage line, no "הוסף מזוודה" - the
  regular summary's add-on (`useBagPricing` -> `/api/flights/bag-pricing`, `Flight.added_bags`,
  El Al's Classic upgrade via `fare_upgrade`) was never wired into the trip.

## Part A - a suitcase per flight on the trip summary

### Proposal
One "הוסף מזוודה" row per flight ticket on the summary's flights group, the regular summary's own
row and price (never a pricing rule of the trip's own):

| Ticket | Priced against | Where the bag is stored |
|---|---|---|
| The way out and home (one ticket) | `flightParts.main.offer` | `flightParts.main.added_bags` |
| A pair of one-ways (direct pairs) | each one-way's own offer | `oneWays[0/1].added_bags` |
| A move flight (London -> Madrid) | that part's offer | `flightParts[moveKey].added_bags` |

- The bag amount enters the trip price through the ONE price function (`livePrice`, summary and
  server alike): `composeFlight` adds each part's `getAddedBagsTotalUsd` to `price`, as the regular
  flow adds it on top of the flight.
- The ops mail lists the bags per ticket ("Added checked bags: 2 (customer paid +$X)") - the line
  `confirm-order` already writes for one flight, once per ticket.
- El Al Classic: the regular summary upgrades the fare instead of selling a bag on El Al. The same
  rule per ticket (`FARE_UPGRADE_CARRIERS`).
- The server: the trip hold takes the client's flight object as it does today (the regular
  `confirm-order` reads `added_bags` only for the ops mail line); `checkPieces` gets a rule that a
  bag total is a number >= 0 and only on a ticket that has an offer to price (never on an offline
  flight). Re-pricing the bag on the server (one Amadeus call per ticket at hold time) is possible
  but not what the regular flow does - say if wanted.

### Cost and risk
- One `/api/flights/bag-pricing` call (Amadeus Flight Offers Pricing, include=bags) per ticket the
  customer opens the row for - not per visitor. A trip has 1-4 tickets.
- A change of party re-prices every flight; the bags follow as on the ready package (`readyWish`):
  kept as a wish and priced again for the new offer.
- Touches the price path: `composeFlight`, `livePrice`, `confirm.ts` validation, both mails.
  Needs tests per ticket shape (one ticket, a pair, a move).
- **Estimate:** 1.5-2 days with tests and a preview walk.

### Open for Dor
1. Bags on a pair of one-ways: one row per one-way (two prices), or one row that adds a bag to both?
2. "Desktop note 5" also says the summary does not *say* what each ticket includes. Show the
   included bag / trolley per ticket (from the offer, free to show) even before A is built?

## Part B - the direct pairs in the list from the start

### Proposal
When the flights step opens, run the three non-stop searches next to the regular one and merge the
pairs into the same list: a pair card ("הלוך וחזור בשני כרטיסים נפרדים") stands among the one-ticket
cards by price, and the "best" pick may be a pair. The switch stays and narrows the list to
non-stop flights only.

### Cost and risk
- **Three more Amadeus searches for every customer who leaves the planner**, on top of the one per
  part today (and again on every change of party or dates). Today: 1 search per part + pricing.
  With B: 4 searches for the round trip. Amadeus search quota and latency are shared with the
  single-event order flow.
- The wait screen (`TripQuoteWait`) waits for the slowest of four searches.
- Pairs are two tickets: two pricing calls on a pick, and two bookings for ops (the mail already
  says TWO ONE-WAY TICKETS).

### Options
1. **Prefetch for everyone** (Alon's ask) - the most direct flights on screen, the highest cost.
2. **Prefetch only when the round trip's search has no non-stop flight both ways** - the case the
   pairs exist for (DUS out / LON home had 0 direct in one search, 09.11). One extra decision per
   search, cost only where it helps.
3. **Keep the switch, make it louder** - "יש טיסות ישירות בשני כרטיסים - הצג" under the list when a
   pair would be cheaper or non-stop. No extra searches until tapped.

**Recommendation:** option 2 for B, Part A as specified. Both in one round after this one ships.
