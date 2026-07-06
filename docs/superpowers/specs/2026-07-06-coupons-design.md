# Coupon Codes — Design (2026-07-06)

Customer-facing coupon codes: backoffice creates them, customer enters one on the
order summary (step 4) and gets a discount. Approved by Dor 2026-07-06.
DB migration already executed (table `coupons` + 2 `reservations` columns).

## Decisions (Dor)

- **Discount type:** both `percent` and `fixed` (USD) — explicit column, no
  affiliate-style magic-number normalization.
- **Scope:** global by default, optional restriction to a single event.
- **Limits:** `valid_until` expiry, `max_uses` counter, `is_active` kill switch.
- **Stacking:** none — best single discount wins (`max(affiliate, coupon)`).

## Not a promoCode

Existing `promoCode` in payment/confirmation routes = affiliate partner tracking
code (refer-a-friend). Coupons are a separate concept; everything new is named
`coupon*`.

## DB

See `docs/sql/2026-07-06-coupons.sql` (already run):

- `coupons`: id, code (UPPERCASE, unique), discount_type ('percent'|'fixed'),
  discount_value, event_id (null = global), valid_until (null = never),
  max_uses (null = unlimited), times_used, is_active, created_at.
- `reservations`: + coupon_code, coupon_discount_usd (reporting).

## Backoffice (`MYT_Git_Shered\myt-backoffice`)

- `lib/actions/coupon-actions.ts` — server-action CRUD (list / create / update /
  toggle active / delete) + light event-options list, pattern of
  `partner-actions.ts`.
- `app/(dashboard)/coupons/page.tsx` + `coupons-table.tsx` — table: code, type,
  value, event, expiry, uses / max, active toggle; create + edit dialog.
- Sidebar nav item "Coupons".
- `types/app.types.ts` — `Coupon` type (kept in sync with main).

## Main app (`myt-main`)

- **Security hardening (commit f506fb5):** `normalizeCouponCode` enforces
  `^[A-Z0-9_-]{1,64}$` and the ILIKE lookup escapes `_`/`%` so wildcard
  probing can't match foreign codes.
- **Validate route** `GET /api/coupons/validate?code=X&eventId=Y` — checks
  `is_active`, expiry, `max_uses`, event scope. Success →
  `{ code, discountType, discountValue }`; any failure → `{}` (generic — no
  coupon enumeration).
- **OrderReview (step 4)** — coupon input + "החל" button in the summary card
  (hidden in agent mode). Apply → validate → `couponDiscountUsd` = percent ?
  `floor(baseTotal * value / 100)` : `value` (capped at total).
- **Best one wins** — coupon applies only when it beats
  `affiliateDiscountTotalUsd`; final price = `baseTotal − couponDiscount`.
  Affiliate math untouched; coupon bypasses the 1–10 percent normalization.
- **PriceSummary / ButtonSummary** — "כולל הנחת קופון $X" when the coupon wins.
- **confirm-order** — client sends `coupon_code` + `coupon_base_total_usd`
  only; the server re-validates against the DB and recomputes the discount
  (no client-trusted discount amounts), saves `coupon_code` +
  `coupon_discount_usd` on the reservation, increments `times_used` after the
  insert. Invalid at order time → 409 `COUPON_INVALID`; the client drops the
  coupon, shows "הקופון כבר אינו בתוקף — המחיר עודכן".
- `lib/coupon.utils.ts` — pure shared helpers (usability rules, discount math,
  code normalization). `lib/coupons.ts` — server-only DB lookup + use counter.
- `lib/app.types.ts` — `Coupon` type; `OrderData` + `coupon_code`,
  `coupon_base_total_usd`.

## times_used increment

At confirm-order (simple; an abandoned unpaid order consumes a use — errs safe
on margin). Read-then-write, not atomic — max_uses is a soft marketing limit.
Alternative rejected for now: increment on payment-success callback (accurate,
but misses phone orders).

## v2 (same day): paid counter + affiliate attribution

Migration: `docs/sql/2026-07-06-coupons-v2-paid-counter-affiliate.sql`.

- **`times_paid`** — counts redemptions whose reservation reached status
  'Paid'. Incremented by DB trigger `coupon_paid_counter` on the status
  transition into 'Paid' (catches the CreditGuard callback AND manual
  backoffice status changes; atomic; no double-count on repeat callbacks).
  `times_used` unchanged — still counts all confirmed orders and enforces
  `max_uses`. Backoffice table shows both (Uses + Paid columns).
- **`coupons.partner_tracking_code`** (FK → partners, on delete set null) —
  links a coupon to an affiliate. confirm-order sets the reservation's
  `aff_partner_tracking_code` to the coupon's partner ONLY when the order has
  no affiliate of its own (existing link/utm attribution wins — Dor's call).
  Backoffice dialog: "Attribute to affiliate" dropdown; table: Affiliate
  column.
- `findValidCoupon` retries without the v2 columns on 42703 so coupons keep
  working if code deploys before the migration runs.

## Cross-project impact

Shared table `coupons` (backoffice writes / main reads), two new
`reservations` columns (main writes), `Coupon` type in both `app.types.ts`
files. `OrderData` exists only in the main app — no backoffice mirror needed.
