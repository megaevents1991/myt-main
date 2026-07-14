-- Coupons: customer-facing discount codes (run once in the Supabase SQL editor).
-- STATUS: already executed by Dor on 2026-07-06 — kept as schema documentation.
--
-- Backoffice creates coupons; the main app validates a code on the order
-- summary (step 4) and applies the discount. Discounts do NOT stack with the
-- affiliate discount — the bigger single discount wins (client + server both
-- enforce). Spec: docs/superpowers/specs/2026-07-06-coupons-design.md
--
--   discount_type 'percent' : discount_value = % off the package total (e.g. 5)
--   discount_type 'fixed'   : discount_value = USD off the package total (e.g. 50)
--   event_id NULL           : coupon valid on every event
--   valid_until NULL        : never expires
--   max_uses NULL           : unlimited uses (times_used still counted)

create table if not exists coupons (
  id bigint generated always as identity primary key,
  code text not null unique,               -- stored UPPERCASE, matched case-insensitively
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric not null check (discount_value > 0),
  event_id bigint references events (id),  -- null = global
  valid_until date,                        -- null = never expires
  max_uses int,                            -- null = unlimited
  times_used int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Reservation reporting: which coupon was used and how much it took off (USD).
alter table reservations
  add column if not exists coupon_code text,
  add column if not exists coupon_discount_usd numeric;

-- sanity check
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'coupons'
order by ordinal_position;
