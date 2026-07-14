-- Events: per-event component markups (run once in the Supabase SQL editor).
--
-- Full markup control per event. All columns NULLABLE — when none of the
-- three component markups is set, pricing behaves EXACTLY as today
-- (global $175 markup + env hotel-skip fee + skip_flight_markup).
--
-- When any component markup is set, the event switches to composed pricing:
--   full pack     : ticket + markup_ticket + markup_flight + markup_hotel + bases
--   skip hotel    : ticket + markup_ticket + markup_flight + base_flight + skip_hotel_markup
--   ticket only   : ticket + markup_ticket + skip_flight_markup + skip_hotel_markup
--   skip flight   : ticket + markup_ticket + markup_hotel + base_hotel + skip_flight_markup
-- (event_additional_markup still adds on top in both modes; skip fees can be
--  any value including 1.)

alter table events
  add column if not exists markup_ticket numeric,
  add column if not exists markup_flight numeric,
  add column if not exists markup_hotel numeric,
  add column if not exists skip_hotel_markup numeric;

-- sanity check — columns exist, everything NULL (legacy mode) by default
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'events'
  and column_name in ('markup_ticket','markup_flight','markup_hotel','skip_hotel_markup','skip_flight_markup');
