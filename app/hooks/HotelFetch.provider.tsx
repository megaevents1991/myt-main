import { HotelResponse, HotelsInfoClient } from "@/lib/hotel.type";
import {
  createContext,
  useCallback,
  useRef,
  useState,
  useTransition,
} from "react";
import { fetchHotels, FetchHotelsParams } from "../order/fetchHotels";

export type HotelsData = {
  data: HotelResponse;
  hotelsInfo: HotelsInfoClient;
};

type HotelFetch = {
  getHotels: (params: FetchHotelsParams) => Promise<HotelsData>;
  isFetching: boolean;
  hotelsData: HotelsData;
};

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

  const getHotels = useCallback(
    (params: FetchHotelsParams): Promise<HotelsData> => {
      // Cancel any existing debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      return new Promise((resolve) => {
        setIsFetching(true);

        debounceTimeoutRef.current = setTimeout(async () => {
          // Abort previous fetch
          if (abortControllerRef.current) {
            abortControllerRef.current.abort("another request is has started");
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
            // newer request now owns `isFetching`, so just stop quietly.
            if (controller.signal.aborted) return;
            // A real failure — surface it and clear the loading state so
            // the UI isn't stuck on the spinner.
            console.error("Hotel fetch failed:", err);
            setIsFetching(false);
          }
        }, 1000); // debounce delay in ms
      });
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
