"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Loader, Modal, Skeleton } from "@mantine/core";
import dayjs from "dayjs";
import type { Event, OrderHotel } from "@/lib/app.types";
import { cityName, StaySegment } from "@/lib/events/lodging";
import { formatPrice } from "@/lib/price.utils";
import { Stars } from "@/components/ui/stars";
import { HotelCard } from "@/components/ui/hotelCard";
import { OrderIssueState } from "@/components/ui/OrderIssueState";
import type { HotelsData } from "@/app/hooks/HotelFetch.provider";

const fmt = (iso: string) => dayjs(iso).format("DD.MM");

/**
 * Split stay: one block per stay segment instead of the hotel list - the
 * auto-picked hotel and a "החלפת מלון" button. Between two blocks a train
 * reminder, unless the event's own lodging_note already says it.
 */
export const SegmentsList = ({
  event,
  segments,
  hotels,
  loading,
  error,
  minPrice,
  persons,
  onSwap,
}: {
  event: Event;
  segments: StaySegment[];
  /** One hotel per segment, in the same order; null while picking. */
  hotels: OrderHotel[] | null;
  loading: boolean;
  error?: string | null;
  /** event.base_hotel_price - per person for the WHOLE stay. */
  minPrice: number;
  persons: number;
  onSwap: (index: number) => void;
}) => {
  const totalNights = segments.reduce((n, s) => n + s.nights, 0) || 1;

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      {error && !loading && (
        <OrderIssueState
          className="min-h-40"
          title="לא הצלחנו להרכיב את הלינה המפוצלת"
          subtitle={error}
          whatsAppText="היי, ניסיתי להזמין לינה מפוצלת באתר ולא נמצאו מלונות. אשמח לעזרה :)"
        />
      )}
      {segments.map((seg, i) => {
        const hotel = hotels?.[i];
        // A segment's share of the package's hotel base: pro rata by nights,
        // so the per-block deltas add up to the summary's one hotel delta.
        const segBase = (minPrice * seg.nights) / totalNights;
        const perGuest = hotel ? +hotel.price / (persons || 1) : 0;
        const delta = perGuest - segBase;
        const stars = Math.max(0, Math.round(hotel?.hotelInformation?.stars ?? 0));
        return (
          <Fragment key={seg.checkin}>
            {i > 0 && !event.lodging_note && (
              <p className="text-[12px] text-muted-foreground">
                {`רכבת ${cityName(event, segments[i - 1].city)} ← ${cityName(event, seg.city)}, לא כלול`}
              </p>
            )}
            <div className="rounded-xl border border-border bg-card p-3 lg:p-4">
              <div className="mb-2 text-[15px] font-bold">
                {`${cityName(event, seg.city)} · `}
                <span dir="ltr" className="tabular-nums">
                  {`${fmt(seg.checkin)}–${fmt(seg.checkout)}`}
                </span>
                {` · ${seg.nights} לילות`}
              </div>
              {loading || !hotel ? (
                // The segment searches run one after another (RateHawk 10/min) and a cold
                // city takes 10-20 s - say so; a bare skeleton is invisible on the dark theme.
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Loader size="xs" color="var(--mantine-color-myColor-4)" />
                    {`מחפשים מלון ב${cityName(event, seg.city)}…`}
                  </p>
                  <Skeleton visible className="h-10" />
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold" dir="ltr">
                        {hotel.name}
                      </span>
                      {stars > 0 && <Stars rating={stars} />}
                    </div>
                    <div className="text-[13px] text-muted-foreground" dir="ltr">
                      {hotel.rate?.room_data_trans?.main_name ||
                        hotel.hotelInformation?.roomName}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[13px]">
                      {Math.abs(delta) > 4 ? (
                        <>
                          <span className="text-lg">{formatPrice(delta)}</span>{" "}
                          <span className="whitespace-nowrap">
                            {delta < 0 ? "חסכון לכל אורח" : "תוספת לכל אורח"}
                          </span>
                        </>
                      ) : (
                        <span>כלול במחיר</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSwap(i)}
                      className="rounded-lg border border-forest px-3 py-1.5 text-[13px] font-bold text-forest transition-colors hover:bg-forest/5 dark:border-glow dark:text-glow dark:hover:bg-glow/10"
                    >
                      החלפת מלון
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
};

/**
 * "החלפת מלון" for one segment: that segment's own search rendered with the
 * same HotelCard as the main list. Picking a card replaces the segment's hotel
 * and closes the modal.
 */
export const SegmentHotelModal = ({
  opened,
  onClose,
  title,
  search,
  loading,
  minPrice,
  persons,
  selectedHotelId,
  onPick,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  search: HotelsData | null;
  loading: boolean;
  minPrice: number;
  persons: number;
  selectedHotelId?: string;
  onPick: (
    hotel: Omit<OrderHotel, "guests" | "checkin" | "checkout">
  ) => void;
}) => {
  // HotelCard reports its rate only while it is the selected card, and it
  // does so for the already-selected one on mount too - so selection is local
  // here, and only a card the customer actually tapped may replace + close.
  const tappedRef = useRef<string | null>(null);
  const [pickId, setPickId] = useState<string | undefined>(selectedHotelId);
  useEffect(() => {
    if (opened) {
      setPickId(selectedHotelId);
      tappedRef.current = null;
    }
  }, [opened, selectedHotelId]);
  const hotels = search?.data?.data?.hotels ?? [];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size="xl"
      centered
      styles={{ title: { fontWeight: 700, fontSize: 18 } }}
    >
      <div className="grid grid-cols-1 gap-4" dir="rtl">
        {loading && (
          <Skeleton visible className="h-40" />
        )}
        {!loading && search && hotels.length === 0 && (
          <OrderIssueState
            className="min-h-40"
            title="לא מצאנו מלונות בעיר הזו לתאריכים האלה"
            subtitle="נסו פיצול אחר, או לינה בעיר אחת."
            whatsAppText="היי, אני מחפש מלון ללינה מפוצלת באתר ולא מצאתי תוצאות. אשמח לעזרה :)"
          />
        )}
        {!loading &&
          hotels.slice(0, 30).map(
            (hotel) =>
              search?.hotelsInfo[hotel.id] && (
                <HotelCard
                  key={hotel.id}
                  persons={persons}
                  minPrice={minPrice}
                  isLoading={false}
                  selectedHotelId={pickId}
                  hotelId={hotel.id}
                  hotelRates={hotel.rates}
                  hotelInfo={search.hotelsInfo[hotel.id]}
                  handleSelect={() => {
                    tappedRef.current = hotel.id;
                    setPickId(hotel.id);
                  }}
                  handleSelectedRate={(orderHotel) => {
                    if (tappedRef.current !== orderHotel.id) return;
                    tappedRef.current = null;
                    onPick(orderHotel);
                    onClose();
                  }}
                />
              )
          )}
      </div>
    </Modal>
  );
};
