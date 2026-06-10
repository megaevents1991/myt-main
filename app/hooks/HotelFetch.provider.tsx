import { HotelResponse, HotelsInfoClient } from "@/lib/hotel.type";
import {
  createContext,
  useCallback,
  useRef,
  useState,
  useTransition,
} from "react";
import dayjs from "dayjs";
import { fetchHotels, FetchHotelsParams } from "../order/fetchHotels";

export type HotelsData = {
  data: HotelResponse;
  hotelsInfo: HotelsInfoClient;
};

export type GetHotelsOptions = {
  // Skip the debounce — use for programmatic preloads (mount, skip-flight,
  // flight-selected, guest-correct). The debounce only makes sense for
  // user-driven filter changes (e.g. dragging the distance slider).
  immediate?: boolean;
};

type HotelFetch = {
  getHotels: (
    params: FetchHotelsParams,
    options?: GetHotelsOptions
  ) => Promise<HotelsData>;
  isFetching: boolean;
  hotelsData: HotelsData;
};

// Identity of a search request. Two calls with the same key fetch the same
// data, so we coalesce them onto one in-flight promise instead of aborting +
// restarting (which was wasting prefetches and re-triggering the debounce).
const requestKey = ({
  eventId,
  dateRange,
  radius,
  guests,
}: FetchHotelsParams): string =>
  JSON.stringify({
    eventId,
    checkin: dayjs(dateRange[0]?.toDateString()).format("YYYY-MM-DD"),
    checkout: dayjs(dateRange[1]?.toDateString()).format("YYYY-MM-DD"),
    radius,
    guests,
  });

export const HotelFetchContext = createContext<HotelFetch>({} as HotelFetch);

export const HotelFetchProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [hotels, setHotels] = useState<{
    data: HotelResponse;
    hotelsInfo: HotelsInfoClient;
  }>({ data: {} as HotelResponse, hotelsInfo: {} });

  const [isFetching, setIsFetching] = useState(false);
  const [, startTransition] = useTransition();

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // The request currently in flight, keyed by its params. A new call with the
  // same key returns this promise instead of starting a second fetch.
  const inFlightRef = useRef<{ key: string; promise: Promise<HotelsData> } | null>(
    null
  );

  const getHotels = useCallback(
    (
      params: FetchHotelsParams,
      options?: GetHotelsOptions
    ): Promise<HotelsData> => {
      const key = requestKey(params);

      // Coalesce: an identical request is already running — reuse it so racing
      // callers (mount preload, flight effects, guest-correct) don't abort and
      // restart each other.
      if (inFlightRef.current?.key === key) {
        return inFlightRef.current.promise;
      }

      // Cancel any pending debounce from a previous (different) call.
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      const promise = new Promise<HotelsData>((resolve, reject) => {
        setIsFetching(true);

        const run = async () => {
          // Params changed — abort the now-stale in-flight fetch.
          if (abortControllerRef.current) {
            abortControllerRef.current.abort("another request has started");
          }

          const controller = new AbortController();
          abortControllerRef.current = controller;

          try {
            const res = await fetchHotels(params, controller.signal);

            startTransition(() => {
              setHotels(res);
              resolve(res);
              setIsFetching(false);
            });
          } catch (err) {
            // This request was superseded by a newer one — expected, the
            // newer request now owns `isFetching`, so leave this promise
            // unsettled (same as before) to avoid surfacing abort rejections.
            if (controller.signal.aborted) return;
            // A real failure — surface it and clear the loading state so
            // the UI isn't stuck on the spinner.
            console.error("Hotel fetch failed:", err);
            setIsFetching(false);
            reject(err);
          } finally {
            if (inFlightRef.current?.key === key) {
              inFlightRef.current = null;
            }
          }
        };

        if (options?.immediate) {
          run();
        } else {
          debounceTimeoutRef.current = setTimeout(run, 1000); // debounce delay in ms
        }
      });

      inFlightRef.current = { key, promise };
      return promise;
    },
    []
  );

  return (
    <HotelFetchContext.Provider
      value={{
        getHotels,
        isFetching,
        hotelsData: {
          data: hotels.data,
          hotelsInfo: hotels.hotelsInfo,
        },
      }}
    >
      {children}
    </HotelFetchContext.Provider>
  );
};
