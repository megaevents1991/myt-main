# Amadeus Production Certification — Minimal Alignment

**Date:** 2026-06-30
**Branch:** `refactor/amadeus-api`
**Scope:** Search + Price only. Mandatory checklist items only — no extras.

## Context

Amadeus sent 9 production-certification checklists (one per API) before we go to
real prod. MYT calls only **2** of those APIs:

| Amadeus API | Where | Verb / endpoint |
|---|---|---|
| Flight Offers **Search** | `app/api/flights/search/route.ts` | GET `/v2/shopping/flight-offers` |
| Flight Offers **Price** | `app/api/flights/pricing/route.ts` | POST `/v1/shopping/flight-offers/pricing` (`include=bags,detailed-fare-rules`) |

The other 7 (Create Orders, Order Issue, Order Management, Get Order by Record
Locator, Queue List, Branded Fares Upsell, Availabilities Search) are **out of
scope** — MYT does not book flights through Amadeus (booking is CreditGuard +
offline inventory). They re-enter scope only if/when Amadeus order-creation is built.

## Checklist status (both relevant APIs)

| Item | Status | Action |
|---|---|---|
| API key + Secret correct | ✅ | none (`NEW_AMADEUS_*` wired, enterprise sandbox) |
| `ama-Client-Ref` configured per booking | ❌ | **add the header — only gap** |
| Query correctly sent | ✅ Search / verify Price | live test |
| Reply read + displayed | ✅ | none |
| Errors/warnings handled | ✅ | none (Amadeus call wrapped in try/catch in both routes) |
| (Price) follows Search recommendation | ✅ | none (we price the offer returned by Search) |
| (Price) pricing options consistent | ✅ | none (`bags` + `detailed-fare-rules` fixed across the flow) |

**Entire mandatory work = add `ama-Client-Ref`.**

## The change

### 1. `amadeusClient.ts` — thread an optional client ref
- `request()` accepts an optional `clientRef?: string`.
- When present, set request header `ama-Client-Ref: <clientRef>`.
- The bearer-token auth and all existing request shapes are otherwise unchanged.

### 2. `search/route.ts`
- Build `ama-Client-Ref = MYT-{eventId}-{unixSeconds}` (eventId already in scope).
- Pass it to `flightOffersSearch.get(...)`.

### 3. `pricing/route.ts`
- Add `eventId` to the request body the client POSTs (small field add on the
  caller side too).
- Build the same `MYT-{eventId}-{unixSeconds}` and pass it to `pricing.post(...)`.
- If `eventId` is absent (defensive), fall back to `MYT-{unixSeconds}`.

### Ref format
`MYT-{eventId}-{unixSeconds}` — short, alphanumeric + hyphen, within the
`ama-Client-Ref` length limit. Ties each call to the event + time for Amadeus
support tracing.

## Validation (no code)
- Run **Search** live against the enterprise sandbox → 200 (already verified).
- Run **Price** live against the enterprise sandbox → 200 (to confirm).
- Confirm `ama-Client-Ref` is present on both outbound requests.

## Deliverable
Fill the two checklist `.docx` items (`Flight Offers Search`, `Flight Offers
Price`) as done, with evidence: request snippet showing `ama-Client-Ref`, and a
200 response.

## Out of scope (explicit)
- The other 7 Amadeus APIs / checklists.
- Error-handling rewrite (e.g. the search route's 0-byte 500 on non-Amadeus
  paths) — the Amadeus error path is already handled; broader hardening is a
  separate, non-mandatory task.
- Any change to pricing math, markup, or booking flow.
