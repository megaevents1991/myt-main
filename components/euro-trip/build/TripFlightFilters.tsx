"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { CustomSlider } from "@/components/ui/CustomSlider";
import { FiltersModal } from "@/components/ui/FiltersModal";
import { FlightFilters } from "@/components/ui/FlightFilters";
import type { FlightSearchCriteria } from "@/lib/app.types";
import type { TripFlightFilter } from "@/lib/itinerary/flightFilters";

type Props = {
  /** What the customer set, or the list's own limits while nothing is touched. */
  filter: TripFlightFilter;
  /** The list's own limits (the sliders' ends). */
  limits: TripFlightFilter;
  /** The cheapest party price in the list and the base every card is measured against, per traveller. */
  minPrice: number;
  /** The shortest flight in the list, hours (the duration slider's start). */
  minHours: number;
  base: number;
  pax: number;
  airlines: { value: string; label: string }[];
  onChange: (c: FlightSearchCriteria) => void;
};

/**
 * The regular flight step's filters, as that step draws them (Alon 12.11): the shared
 * `FlightFilters` with the price and duration sliders. The sliders move freely and filter when let
 * go (`onChangeEnd`), so a drag never re-picks the flight on every step.
 */
function FiltersBody({ filter, limits, minPrice, minHours, base, pax, airlines, onChange, onApply }: Props & { onApply?: () => void }) {
  const [price, setPrice] = useState(filter.maxPrice);
  const [hours, setHours] = useState(filter.flightDuration);
  return (
    <FlightFilters
      handleFlightSearchCriteriaChange={onChange}
      priceComponent={
        <CustomSlider
          variant="maxPrice"
          value={price}
          onChange={setPrice}
          onChangeEnd={onChange}
          maxValue={limits.maxPrice}
          minValue={minPrice}
          basePrice={base}
          numOfPassengers={pax}
        />
      }
      flightDurationComponent={
        <CustomSlider
          value={hours}
          onChange={setHours}
          onChangeEnd={onChange}
          maxValue={limits.flightDuration}
          minValue={Math.min(minHours, limits.flightDuration)}
        />
      }
      airlines={airlines}
      filters={{ ...filter, maxPrice: String(filter.maxPrice) }}
      onApply={onApply}
    />
  );
}

/** From 1024px: a column beside the list. */
export function TripFlightFiltersPanel(props: Props) {
  return (
    <aside aria-label="סינון טיסות" className="hidden lg:block">
      <FiltersBody {...props} />
    </aside>
  );
}

/** Below 1024px: a button beside the tabs that opens the same filters in a sheet. */
export function TripFlightFiltersButton({ active, ...props }: Props & { active: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="פתח פילטרים"
        onClick={() => setOpen(true)}
        className="relative flex w-[38px] shrink-0 items-center justify-center rounded-md border border-border bg-card transition-colors hover:border-success hover:bg-success/10 lg:hidden"
      >
        <SlidersHorizontal className="size-4 text-foreground" strokeWidth={1.8} aria-hidden />
        {active && <span className="absolute end-1 top-1 size-2 rounded-full bg-primary" aria-hidden />}
      </button>
      <FiltersModal show={open} onClose={() => setOpen(false)}>
        <FiltersBody {...props} onApply={() => setOpen(false)} />
      </FiltersModal>
    </>
  );
}
