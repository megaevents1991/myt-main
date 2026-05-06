-- 2026-04-19: multi-room offline hotel allocation
-- Adds an array column so multi-row matches (e.g. Triple + Double) can be
-- recorded on the reservation without losing rows 2..N.
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS offline_hotel_ids integer[] NULL;

COMMENT ON COLUMN reservations.offline_hotel_ids IS
  'Offline hotel row IDs matched to this reservation. May repeat when a single row covers multiple requested rooms. offline_hotel_id (singular) is kept for backwards compatibility and holds offline_hotel_ids[0].';
