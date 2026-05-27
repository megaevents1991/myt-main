"use client";

import { DateRange } from "@/components/ui/dateInput";
import { CustomSlider } from "@/components/ui/CustomSlider";
import {
  Event,
  Flight,
  FlightSearchCriteria,
  FlightSearchOptions,
  TimeRange,
} from "@/lib/app.types";
import { applyFiltersAndSorting } from "@/lib/flightFilter";
import { SortOptions } from "@/lib/flightSort";
import { Button, ScrollArea } from "@mantine/core";
import { Search, Star, DollarSign, ShieldCheck, SlidersHorizontal } from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { OrderContext } from "../app.context";
import { MemoizedFlightCard } from "@/components/ui/FlightCard";
import { SelectWithIcon } from "@/components/ui/inputWithIcon";
import { FlightFilters } from "@/components/ui/FlightFilters";
import { FlightLoadingTransition } from "@/components/ui/FlightLoadingTransition";
import { useMediaQuery } from "@mantine/hooks";
import { FiltersModal } from "@/components/ui/FiltersModal";
import { prepareFlightsData } from "@/lib/prepareFlightsData";
import { cn } from "@/lib/utils";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import dayjs from "dayjs";
import { getDefaultDateRange } from "@/lib/getDefaultDateRange";
import { getRoomParams } from "@/lib/getRoomParams";
import { HotelFetchContext } from "../hooks/HotelFetch.provider";
import { MONDIAL_2026_MAIN_TITLE, parseMondial2026EventName } from "@/lib/mondial2026Title";

const MAX_FLIGHT_DURATION = 30;

// "Best" flight scoring — lower is better. Cheapest per traveler, penalized for
// stops, rewarded for included baggage.
const BEST_FLIGHT_STOP_PENALTY =
  Number(process.env.NEXT_PUBLIC_BEST_FLIGHT_STOP_PENALTY) || 300;

const flightScore = (f: Flight): number =>
  f.price / f.numOfTravelers +
  f.stops * BEST_FLIGHT_STOP_PENALTY -
  (f.outbound.checkBagsIncluded ? 50 : 0) -
  (f.outbound.cabinBagsIncluded ? 10 : 0);

// The default-selected flight. Offline flight+hotel inventory is sold as a
// bundle, so an available offline flight is the default choice; otherwise the
// best-scored flight wins. Picks only from visible flights so the selection
// always lands on a card the customer can see.
const pickBestFlight = (visibleFlights: Flight[]): Flight | undefined => {
  if (!visibleFlights.length) return undefined;
  const offline = visibleFlights.filter((f) => f.isOffline);
  const pool = offline.length ? offline : visibleFlights;
  return pool.reduce((best, f) => (flightScore(f) < flightScore(best) ? f : best));
};

export const FlightSelection = () => {
  const {
    setFlight,
    flight: orderFlight,
    event = {} as Event,
    selectedEvents,
    numberOfEventTickets,
    setPlaneTickets,
    planeTickets,
    setSelectedPlaneTicketsFilters,
  } = useContext(OrderContext);
  const { getHotels, hotelsData } = useContext(HotelFetchContext);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [filteredFlights, setFilteredFlights] = useState<Flight[]>([]);
  const [filters, setFilters] = useState<{
    numOfStops: string[];
    airline: string[];
    maxPrice: string;
    luggage: string[];
  }>({
    numOfStops: ["0", "1"],
    maxPrice: "",
    airline: [],
    luggage: ["withCheckedBags", "withCabinBags"],
  });
  const [sortOption] = useState<SortOptions>("price_asc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFlightDuration, setSelectedFlightDuration] =
    useState(MAX_FLIGHT_DURATION);
  const [flightsMeta, setFlightsMeta] = useState({
    maxDuration: MAX_FLIGHT_DURATION,
    minDuration: MAX_FLIGHT_DURATION,
    maxPrice: 0,
    minPrice: 0,
    numOfPassengers: numberOfEventTickets,
  });
  const [selectedFlightPrice, setSelectedFlightPrice] = useState(0);
  const [arrivalRanges, setArrivalRanges] = useState<TimeRange[] | []>([]);
  const [departureRanges, setDepartureRanges] = useState<TimeRange[] | []>([]);
  const [isIsraeliFilter, setIsIsraeliFilter] = useState(false);

  const hasBundle = !!(selectedEvents && selectedEvents.length > 1);

  // In bundle flows, the flight-card relative price should be against the most expensive
  // base flight price among the selected events (not just the primary event).
  const bundleBaseFlightPrice = useMemo(() => {
    if (!hasBundle) return event.base_flight_price;
    return Math.max(0, ...selectedEvents.map((e) => e.base_flight_price || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBundle, event.base_flight_price, selectedEvents?.map((e) => e.id).join(",")]);

  const computeDefaultDateRange = () => {
    const fallbackStart = new Date(event.def_date_depart);
    const fallbackEnd = new Date(event.def_date_return);

    if (!hasBundle) {
      return [fallbackStart, fallbackEnd] as [Date | null, Date | null];
    }

    const events = selectedEvents;
    const departTimes = events
      .map((e) => dayjs(e.def_date_depart).valueOf())
      .filter((t) => Number.isFinite(t));
    const returnTimes = events
      .map((e) => dayjs(e.def_date_return).valueOf())
      .filter((t) => Number.isFinite(t));

    const earliestDepart = departTimes.length > 0 ? Math.min(...departTimes) : NaN;
    const latestReturn = returnTimes.length > 0 ? Math.max(...returnTimes) : NaN;

    const start = Number.isFinite(earliestDepart)
      ? new Date(earliestDepart)
      : fallbackStart;
    const end = Number.isFinite(latestReturn)
      ? new Date(latestReturn)
      : fallbackEnd;

    // Mantine expects start <= end for range highlighting
    return (start.getTime() <= end.getTime())
      ? ([start, end] as [Date | null, Date | null])
      : ([end, start] as [Date | null, Date | null]);
  };

  // For bundle events: compute first and last event by date to determine outbound/return locations
  const computeBundleFlightLocations = useMemo(() => {
    const hasBundle = !!(selectedEvents && selectedEvents.length > 1);
    if (!hasBundle) {
      return null;
    }

    // Sort events by departure date to find first and last
    const sortedEvents = [...selectedEvents].sort(
      (a, b) => dayjs(a.def_date_depart).valueOf() - dayjs(b.def_date_depart).valueOf()
    );

    const firstEvent = sortedEvents[0];
    const lastEvent = sortedEvents[sortedEvents.length - 1];

    return {
      // Outbound destination: fly into the city of the first event
      outboundDestination: firstEvent.location.city_iata,
      // Return origin: fly out from the city of the last event
      returnOrigin: lastEvent.location.city_iata,
      firstEvent,
      lastEvent,
    };
  }, [selectedEvents]);

  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(
    computeDefaultDateRange
  );
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"best" | "cheapest" | "israeli">("best");
  const matches = useMediaQuery("(min-width: 1024px)");
  const [scrollerHeight, setScrollerHeight] = useState(600);
  const [, startTransition] = useTransition();
  const [debug, setDebug] = useState<{
    departureDate: Date;
    returnDate: Date;
  }>({ departureDate: new Date(), returnDate: new Date() });

  const mondialParsed = useMemo(
    () => parseMondial2026EventName(event?.name),
    [event?.name]
  );

  const filterRef = useRef<HTMLDivElement>(null);

  // If we arrive here with a bundle, ensure the defaults reflect all events.
  useEffect(() => {
    if (!selectedEvents || selectedEvents.length <= 1) return;
    setDateRange(computeDefaultDateRange());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvents?.map((e) => e.id).join(","), event?.id]);

  // Tracks whether this step is still mounted. A live Amadeus search that
  // resolves after the customer has left the flight step (e.g. tapped
  // "skip flight") must not write its result back into the shared order
  // context — otherwise a skipped-flight order silently gets a flight.
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (filterRef.current && matches) {
      setScrollerHeight(filterRef.current.offsetHeight);
    } else if (!matches) {
      setScrollerHeight(600);
    }
  }, [matches, flights]);

  useEffect(() => {
    setPlaneTickets({ adults: numberOfEventTickets, children: 0 });
    fetchFlights({ adults: numberOfEventTickets });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch hotels when the orderFlight dates or number of adults change
  const departureDateKey = dayjs(getDefaultDateRange(event, orderFlight)[0]).format("YYYY-MM-DD");
  const returnDateKey = dayjs(getDefaultDateRange(event, orderFlight)[1]).format("YYYY-MM-DD");

  useEffect(() => {
    if (event?.location?.country_code === "US") return;
    if (orderFlight?.id) {
      getHotels({
        dateRange: getDefaultDateRange(event, orderFlight),
        guests: getRoomParams(planeTickets.adults),
        location: event.location,
        eventId: event.id,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departureDateKey, returnDateKey, planeTickets.adults]);

  // First time fetching hotels, only if no hotels are already fetched
  useEffect(() => {
    if (event?.location?.country_code === "US") return;
    if (orderFlight?.id && !hotelsData?.data?.data?.hotels) {
      getHotels({
        dateRange: getDefaultDateRange(event, orderFlight),
        guests: getRoomParams(planeTickets.adults),
        location: event.location,
        eventId: event.id,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderFlight?.id]);

  useEffect(() => {
    setSelectedPlaneTicketsFilters({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (matches) return; // Don't scroll on desktop (1024px+)
    const timer = setTimeout(() => {
      window.scrollTo({
        top: 90,
        behavior: "smooth",
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [matches]); // Add matches as dependency

  const fetchFlights = async (options: Partial<FlightSearchOptions> = {}) => {
    const directOnly = !!options.nonStop;

    setIsLoading(true);
    setError(null);
    setActiveTab("best");
    setFilters((prev) => ({
      ...prev,
      airline: [],
      directOnly,
    }));
    setDepartureRanges([]);
    setArrivalRanges([]);
    setFlight(undefined);

    try {
      const adults = options.adults || planeTickets.adults;
      const gtmIdnts =
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("gtmIdnts="))
          ?.split("=")[1] || "";
      
      // For bundle events, include outbound destination and return origin based on first/last event locations
      const bundleLocationParams = computeBundleFlightLocations
        ? {
            outboundDestination: computeBundleFlightLocations.outboundDestination,
            returnOrigin: computeBundleFlightLocations.returnOrigin,
          }
        : {};

      const res = await fetch(`/api/flights/search?eventId=${event?.id}`, {
        body: JSON.stringify({
          ...options,
          ...bundleLocationParams,
          adults,
          departureDate: dateRange[0]?.toDateString(),
          returnDate: dateRange[1]?.toDateString(),
          gtmIdnts,
        }),
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch flights");
      }
      const {
        flights,
        debug,
      }: {
        flights: Flight[];
        debug: { departureDate: string; returnDate: string };
      } = await res.json();

      // The customer may have skipped the flight (or otherwise left this
      // step) while the search was in flight — drop stale results so they
      // can't re-populate `flight` after a skip.
      if (!isMountedRef.current) return;

      const { airlines, maxDuration, minDuration, maxPrice, minPrice } =
        prepareFlightsData(flights);

      const filteredFlights = applyFiltersAndSorting(flights, {
        airline: airlines,
        sortOption,
        flightDuration: maxDuration,
        departureRanges: [],
        arrivalRanges: [],
        maxPrice,
        numOfStops: filters.numOfStops,
        luggage: filters.luggage,
      });

      const visibleFlights = filteredFlights.slice(0, 50);
      setFilteredFlights(visibleFlights);
      setSelectedFlightDuration(Math.ceil(maxDuration / 60));
      setSelectedFlightPrice(Math.ceil(maxPrice));
      setDebug({
        departureDate: new Date(debug.departureDate),
        returnDate: new Date(debug.returnDate),
      });
      setFlightsMeta({
        maxDuration: Math.ceil(maxDuration / 60),
        minDuration: Math.ceil(minDuration / 60),
        maxPrice,
        minPrice,
        numOfPassengers: adults,
      });
      setFilters((prev) => ({
        ...prev,
        airline: airlines,
        directOnly,
      }));
      setFlights(flights);
      setFlight(pickBestFlight(visibleFlights));
      return flights;
    } catch (err) {
      console.error(err);
      setError(
        "היי חברים, סליחה, יש לנו תקלה ואנחנו על זה. נסו אותנו יותר מאוחר בבקשה."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlightSearch = async () => {
    await fetchFlights();
  };
  const airlines = useMemo(
    () =>
      Array.from(
        new Map(
          flights.map((flight) => [
            flight.airline, // Use airline as the key
            { value: flight.airline, label: flight.metadata.name }, // Object as the value
          ])
        ).values() // Extract the unique values
      ),
    [flights]
  );

  // The "best" badge lands on the same flight the funnel default-selects.
  const bestFlightId = useMemo(
    () => pickBestFlight(filteredFlights)?.id ?? null,
    [filteredFlights]
  );

  const cheapestFlightId = useMemo(() => {
    // Use filteredFlights so the badge always lands on a visible card
    if (!filteredFlights.length) return null;
    const offlineBoost = Number(process.env.NEXT_PUBLIC_OFFLINE_FLIGHT_BOOST) || 60;
    const effectivePrice = (f: Flight) =>
      f.price / f.numOfTravelers - (f.isOffline ? offlineBoost : 0);
    return filteredFlights.reduce((min, f) =>
      effectivePrice(f) < effectivePrice(min) ? f : min
    ).id;
  }, [filteredFlights]);

  const handleFlightChange = useCallback(
    (value: string) => {
      setFlight(filteredFlights.find((f) => f.id === value));
    },
    [filteredFlights, setFlight]
  );

  const handleFlightSearchCriteriaChange = ({
    value,
    type,
  }: FlightSearchCriteria) => {
    setSelectedPlaneTicketsFilters((prev) => ({
      ...prev,
      [type]: value,
    }));
    switch (type) {
      case "arrivalRanges":
        setArrivalRanges(value);
        break;
      case "departureRanges":
        setDepartureRanges(value);
        break;
      case "maxPrice":
        setSelectedFlightPrice(value);
        break;
      case "flightDuration":
        setSelectedFlightDuration(value);
        break;
      case "airline":
      case "numOfStops":
      case "luggage":
        setFilters((prev) => ({ ...prev, [type]: value }));
        break;
    }

    startTransition(() => {
      setFlight(undefined);

      const filteredFlights = applyFiltersAndSorting(flights, {
        airline: filters.airline,
        sortOption,
        flightDuration: selectedFlightDuration,
        departureRanges,
        arrivalRanges,
        maxPrice: selectedFlightPrice,
        numOfStops: filters.numOfStops,
        luggage: filters.luggage,
        ...{ [type]: value },
      });
      const visibleFlights = filteredFlights.slice(0, 50);
      if (visibleFlights.length !== 0) {
        setFlight(pickBestFlight(visibleFlights));
      }
      setFilteredFlights(visibleFlights);
    });
  };
  const displayFlights = useMemo(() => {
    const pinnedId =
      activeTab === "best"
        ? bestFlightId
        : activeTab === "cheapest"
        ? cheapestFlightId
        : null;

    // Israeli tab (or no pin): offline flights first, then rest in current sort order
    if (!pinnedId) {
      const offline = filteredFlights.filter((f) => f.isOffline);
      const online = filteredFlights.filter((f) => !f.isOffline);
      return [...offline, ...online];
    }

    // Best/Cheapest: pin the selected flight to position 0, rest stay in price order
    const idx = filteredFlights.findIndex((f) => f.id === pinnedId);
    if (idx <= 0) return filteredFlights;
    const copy = [...filteredFlights];
    const [pinned] = copy.splice(idx, 1);
    copy.unshift(pinned);
    return copy;
  }, [filteredFlights, activeTab, bestFlightId, cheapestFlightId]);

  // Switch sort tab + sync israeli filter as needed
  const handleSortTabChange = useCallback(
    (next: "best" | "cheapest" | "israeli") => {
      setActiveTab(next);
      const wantIsraeli = next === "israeli";
      if (wantIsraeli !== isIsraeliFilter) {
        setIsIsraeliFilter(wantIsraeli);
        const israeliAirlines = ["LY", "6H", "IZ", "BZ", "U8"];
        handleFlightSearchCriteriaChange({
          type: "airline",
          value: wantIsraeli ? israeliAirlines : airlines.map((a) => a.value),
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isIsraeliFilter, airlines]
  );

  const flightTicketCards = useMemo(
    () =>
      displayFlights.map((flight) => {
        return (
          <MemoizedFlightCard
            minPrice={bundleBaseFlightPrice}
            isLoading={false} // We handle loading at the container level now
            key={flight.id}
            {...flight}
            price={Math.ceil(flight.price / flightsMeta.numOfPassengers)}
            flightId={flight.id}
            selectedFlightId={orderFlight?.id}
            onClick={handleFlightChange}
            isBest={flight.id === bestFlightId}
            isCheapest={flight.id === cheapestFlightId}
          />
        );
      }),
    [
      displayFlights,
      bundleBaseFlightPrice,
      flightsMeta.numOfPassengers,
      orderFlight?.id,
      handleFlightChange,
      bestFlightId,
      cheapestFlightId,
    ]
  );

  if (error) {
    return (
      <div className="text-center text-red-500">
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4" aria-label="נסה שוב לטעון טיסות">
          Try Again
        </Button>
      </div>
    );
  }

  const handleDatePopoverClose = () => {
    if (!dateRange[0] || !dateRange[1]) {
      const defaultDates: [Date, Date] = [
        new Date(event.def_date_depart),
        new Date(event.def_date_return),
      ];
      setDateRange(defaultDates);
      return;
    }

    if (
      dayjs(dateRange[0]).isSame(dayjs(debug.departureDate), "day") &&
      dayjs(dateRange[1]).isSame(dayjs(debug.returnDate), "day")
    ) {
      return;
    }

    fetchFlights();
  };

  return (
    <div className="space-y-2 lg:space-y-6">
      <div className="sr-only">
        <h1>בחירת טיסה לאירוע {event.name}</h1>
        <p>בחר טיסה, כמות נוסעים ותאריכי נסיעה עבור האירוע ב{event.location?.name}</p>
      </div>
      {!matches && (
        <FiltersModal 
          show={showFilters} 
          onClose={() => setShowFilters(false)}
          aria-labelledby="flight-filters-title"
          aria-describedby="flight-filters-description"
        >
          <div id="flight-filters-title" className="sr-only">מסנני טיסות</div>
          <div id="flight-filters-description" className="sr-only">
            השתמש במסננים כדי לחפש טיסות לפי מחיר, משך טיסה, חברת תעופה ועוד
          </div>
          <FlightFilters
            handleFlightSearchCriteriaChange={handleFlightSearchCriteriaChange}
            priceComponent={
              <CustomSlider
                onChange={setSelectedFlightPrice}
                variant="maxPrice"
                onChangeEnd={handleFlightSearchCriteriaChange}
                value={selectedFlightPrice}
                maxValue={flightsMeta.maxPrice}
                minValue={flightsMeta.minPrice}
                basePrice={bundleBaseFlightPrice}
                numOfPassengers={flightsMeta.numOfPassengers}
              />
            }
            flightDurationComponent={
              <CustomSlider
                onChangeEnd={handleFlightSearchCriteriaChange}
                value={selectedFlightDuration}
                onChange={setSelectedFlightDuration}
                maxValue={flightsMeta.maxDuration}
                minValue={flightsMeta.minDuration}
              />
            }
            airlines={airlines}
            filters={filters}
            onApply={() => setShowFilters(false)}
          />
        </FiltersModal>
      )}
      <div className="flex flex-col items-center">
        <div dir="rtl" className="w-screen px-4 py-2 lg:p-4 bg-gray-200 ">
          <div className="flex justify-between w-full max-w-7xl mx-auto gap-2 px-2 lg:px-6 flex-col lg:flex-row lg:gap-2">
            <EventDataHeader
              event={event}
              titleOverride={
                mondialParsed.isMondial2026 ? MONDIAL_2026_MAIN_TITLE : undefined
              }
              hideDateLocation={!!(selectedEvents && selectedEvents.length > 1)}
            />
            <div className="flex w-full lg:w-[60%] flex-row gap-2 text-xs justify-start lg:justify-center items-center margin-auto">
              {matches && (
                <span className="text-center text-xl">כמה טסים?</span>
              )}
              <div className="w-fit">
                <SelectWithIcon
                  value={planeTickets.adults}
                  onChange={(value) =>
                    setPlaneTickets({ adults: +(value || 0), children: 0 })
                  }
                  icon={null}
                  aria-label="בחר כמות נוסעים"
                />
              </div>
              {matches && (
                <span className="mr-6 text-center text-xl">
                  ובאיזה תאריכים?
                </span>
              )}
              <div className="flex flex-row w-min items-center">
                <DateRange
                  disabled={isLoading}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  eventDay={event?.date}
                  highlightDays={
                    selectedEvents && selectedEvents.length > 1
                      ? selectedEvents
                          .map((e) => e.date)
                          .filter((d): d is string => typeof d === "string" && d.length > 0)
                      : undefined
                  }
                  onPopoverClose={handleDatePopoverClose}
                  showTooltip={true}
                  aria-label="בחר תאריכי יציאה וחזרה"
                />
                <button
                  onClick={handleFlightSearch}
                  disabled={isLoading}
                  className="p-2 px-4 bg-secondary text-white rounded-l-lg h-[40px] flex items-center justify-center r"
                  type="button"
                  aria-label={isLoading ? "מחפש טיסות..." : "חפש טיסות"}
                >
                  <Search size={24} />
                </button>
              </div>
            </div>
            <div className="w-[15%]"></div>
          </div>
        </div>
      </div>
      {!isLoading && (bestFlightId || cheapestFlightId) && (
        <div dir="rtl" className="px-4 lg:px-6">
          {/* Desktop: 3 cards in a row */}
          <div
            className="hidden lg:grid lg:grid-cols-3 gap-3"
            role="tablist"
            aria-label="מיון טיסות"
          >
            {([
              { key: "best", title: "הטוב ביותר", sub: "ערך מיטבי לכסף", Icon: Star },
              { key: "cheapest", title: "הזול ביותר", sub: "המחיר הנמוך ביותר", Icon: DollarSign },
              { key: "israeli", title: "ישראלי", sub: "חברות תעופה ישראליות", Icon: ShieldCheck },
            ] as const).map(({ key, title, sub, Icon }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleSortTabChange(key)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md border-[1.5px] text-right transition-colors outline-none",
                    isActive
                      ? "border-secondary bg-secondary/10"
                      : "border-gray-200 bg-white hover:border-secondary"
                  )}
                >
                  <span
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                      isActive ? "bg-secondary" : "bg-gray-100"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-[18px] h-[18px] transition-colors",
                        isActive ? "text-white" : "text-gray-500"
                      )}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="flex flex-col items-end flex-1 min-w-0">
                    <span className="font-bold text-sm text-gray-900">{title}</span>
                    <span className="text-[11px] text-gray-500 mt-0.5">{sub}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mobile: filter icon + 3 sort pills in one row */}
          <div className="flex lg:hidden items-stretch gap-1.5 w-full">
            <button
              type="button"
              aria-label="פתח פילטרים"
              onClick={() => setShowFilters(true)}
              className="w-[38px] flex-shrink-0 bg-white border border-gray-200 rounded-md flex items-center justify-center hover:border-secondary hover:bg-secondary/10 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-gray-900" strokeWidth={1.8} aria-hidden="true" />
            </button>
            <div
              role="tablist"
              aria-label="מיון טיסות"
              className="flex-1 flex bg-white border border-gray-200 rounded-md p-[3px] gap-[2px] min-w-0"
            >
              {([
                { key: "best", label: "הטוב ביותר", Icon: Star },
                { key: "cheapest", label: "הזול ביותר", Icon: DollarSign },
                { key: "israeli", label: "ישראלי", Icon: ShieldCheck },
              ] as const).map(({ key, label, Icon }) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSortTabChange(key)}
                    className={cn(
                      "flex-1 px-1 py-2 rounded flex flex-col items-center justify-center gap-1 leading-tight min-w-0 transition-colors",
                      isActive ? "bg-secondary" : "hover:bg-gray-50"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-3.5 h-3.5 flex-shrink-0",
                        isActive ? "text-white" : "text-gray-500"
                      )}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        "text-[11px] font-bold whitespace-nowrap",
                        isActive ? "text-white" : "text-gray-900"
                      )}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <div
        className={cn(
          "flex lg:gap-4 flex-row-reverse justify-between items-start w-full",
          !matches && "flex-col gap-2"
        )}
      >
        <div
          className={cn("w-1/4 space-y-4", !matches && "w-full")}
          ref={filterRef}
        >
          {/* Desktop-only: filter settings button (sort moved to top 3-card bar) */}
          {matches && (
            <div className={cn(isLoading && "opacity-50 pointer-events-none")}>
              <FlightFilters
                handleFlightSearchCriteriaChange={
                  handleFlightSearchCriteriaChange
                }
                priceComponent={
                  <CustomSlider
                    onChange={setSelectedFlightPrice}
                    variant="maxPrice"
                    onChangeEnd={handleFlightSearchCriteriaChange}
                    value={selectedFlightPrice}
                    maxValue={flightsMeta.maxPrice}
                    minValue={flightsMeta.minPrice}
                    basePrice={bundleBaseFlightPrice}
                    numOfPassengers={flightsMeta.numOfPassengers}
                  />
                }
                flightDurationComponent={
                  <CustomSlider
                    onChange={setSelectedFlightDuration}
                    onChangeEnd={handleFlightSearchCriteriaChange}
                    value={selectedFlightDuration}
                    maxValue={flightsMeta.maxDuration}
                    minValue={flightsMeta.minDuration}
                  />
                }
                airlines={airlines}
                filters={filters}
              />
            </div>
          )}
        </div>
        <ScrollArea.Autosize mah={scrollerHeight} className="w-full lg:w-3/4">
          {isLoading ? (
            <FlightLoadingTransition />
          ) : (
            <div 
              className="grid grid-cols-1 py-4 lg:py-0 lg:gap-4 gap-6 items-start"
              role="region"
              aria-label="רשימת טיסות זמינות"
              aria-live="polite"
              aria-relevant="additions removals"
            >
              {flightTicketCards}
              {filteredFlights.length === 0 && (
                <div 
                  className="text-center w-full items-center lg:w-2/3 text-gray-500 min-h-64 flex"
                  role="status"
                  aria-live="polite"
                >
                  לא נמצאו טיסות התואמות לקריטריונים שלכם. אנא התאימו את המסננים.
                </div>
              )}
            </div>
          )}
        </ScrollArea.Autosize>
      </div>
    </div>
  );
};
