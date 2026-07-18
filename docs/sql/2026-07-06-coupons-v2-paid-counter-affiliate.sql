-- Coupons v2: paid-use counter + affiliate attribution (run once in the Supabase SQL editor).
--
-- 1. times_paid — counts redemptions whose reservation actually reached
--    status 'Paid'. Incremented by a DB trigger on the status transition, so
--    it catches BOTH the CreditGuard success callback and a manual status
--    change in the backoffice, can't double-count (fires only on the
--    transition INTO 'Paid'), and increments atomically.
--    times_used stays as-is: counts every confirmed order and still enforces
--    max_uses.
--
-- 2. partner_tracking_code — links a coupon to a partner (affiliate). An
--    order redeeming the coupon is attributed to that partner ONLY when the
--    order has no affiliate of its own (existing link/utm attribution wins).

alter table coupons
  add column if not exists times_paid int not null default 0,
  add column if not exists partner_tracking_code text
    references partners (partner_tracking_code) on delete set null;

create or replace function count_coupon_paid_use()
returns trigger
language plpgsql
security definer
as $fn$
begin
  -- Count only the transition INTO 'Paid' (repeat callback hits and other
  -- status churn don't recount).
  if new.coupon_code is not null
     and new.status = 'Paid'
     and coalesce(old.status, '') <> 'Paid' then
    update coupons
      set times_paid = times_paid + 1
      where upper(code) = upper(new.coupon_code);
  end if;
  return new;
end
$fn$;

drop trigger if exists coupon_paid_counter on reservations;
create trigger coupon_paid_counter
  after update of status on reservations
  for each row execute function count_coupon_paid_use();

-- sanity check
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'coupons'
  and column_name in ('times_paid', 'partner_tracking_code');
