-- Partners: disable-affiliate flag (run once in the Supabase SQL editor).
-- Adds an is_active switch (default true = nothing changes for existing
-- partners) and turns OFF the affiliate "michaela" (Hazani122@gmail.com).
--
-- Effect once the deployed code sees is_active = false:
--   * her tracking link behaves like an unknown code (no discount, no attribution)
--   * her partner login is rejected
--   * her row + the 56 historical reservations stay intact for reporting

alter table partners
  add column if not exists is_active boolean not null default true;

update partners
  set is_active = false
  where partner_tracking_code = 'michaela';

-- sanity check — expect one row, is_active = false
select partner_tracking_code, name_hebrew, email, is_active
from partners
where partner_tracking_code = 'michaela';
