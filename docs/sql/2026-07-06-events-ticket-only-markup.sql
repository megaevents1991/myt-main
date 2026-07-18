-- Events: ticket-only override markup (nullable, USD per ticket).
-- When set AND the customer skips BOTH flight and hotel, the main app charges
-- exactly ticket_cost + ticket_only_markup — no global markup, no
-- event_additional_markup, no skip fees, no component markups. Every other
-- package combination is untouched. NULL = no override (default).

alter table events
  add column if not exists ticket_only_markup numeric;

-- sanity check
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'events' and column_name = 'ticket_only_markup';
