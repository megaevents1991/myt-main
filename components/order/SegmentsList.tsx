"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Checkbox, Loader, Modal, ScrollArea, Skeleton, TextInput } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { DollarSign, MapPin, Search, Star } from "lucide-react";
import dayjs from "dayjs";
import type { Event, OrderHotel, SortOptions } from "@/lib/app.types";
import { hotelSort } from "@/lib/hotelFilter";
import { cn } from "@/lib/utils";
import { StarsGroup } from "@/components/ui/StarsGroup";
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
 * same HotelCard as the main list, under the hotel step's own controls - sort,
 * stars, breakfast, name search (Alon 24.09: "יותר דומה לעמוד בחירת מלון
 * המקורי"). Picking a card replaces the segment's hotel and closes the modal.
 */
const SORTS: { key: SortOptions; label: string; Icon: typeof DollarSign }[] = [
  { key: "price_asc", label: "הזול ביותר", Icon: DollarSign },
  { key: "rating", label: "כוכבים", Icon: Star },
  { key: "distance_asc", label: "הקרוב ביותר", Icon: MapPin },
];
const NO_STARS = [false, false, false, false, false];
const MODAL_MAX_CARDS = 40;

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
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  // HotelCard reports its rate only while it is the selected card, and it
  // does so for the already-selected one on mount too - so selection is local
  // here, and only a card the customer actually tapped may replace + close.
  const tappedRef = useRef<string | null>(null);
  const [pickId, setPickId] = useState<string | undefined>(selectedHotelId);
  const [sort, setSort] = useState<SortOptions>("price_asc");
  const [stars, setStars] = useState<boolean[]>(NO_STARS);
  const [breakfast, setBreakfast] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => {
    if (opened) {
      setPickId(selectedHotelId);
      tappedRef.current = null;
      setName("");
    }
  }, [opened, selectedHotelId]);

  const all = search?.data?.data?.hotels;
  const info = search?.hotelsInfo;
  const shown = useMemo(() => {
    if (!all || !info) return [];
    const anyStar = stars.some(Boolean);
    const q = name.trim().toUpperCase();
    const kept = all.filter((h) => {
      const meta = info[h.id]?.metadata;
      if (!meta) return false;
      if (anyStar && !stars[Math.round(meta.rating ?? 0) - 1]) return false;
      if (breakfast && !h.rates.some((r) => r.meal_data?.has_breakfast)) return false;
      if (q && !(meta.hotelName ?? "").toUpperCase().includes(q)) return false;
      return true;
    });
    return hotelSort(kept, sort, info);
  }, [all, info, stars, breakfast, name, sort]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size="xl"
      centered
      fullScreen={!isDesktop}
      scrollAreaComponent={ScrollArea.Autosize}
      styles={{ title: { fontWeight: 700, fontSize: 18 } }}
    >
      <div className="flex flex-col gap-4" dir="rtl">
        <div className="sticky top-0 z-10 -mx-1 flex flex-col gap-3 bg-[var(--mantine-color-body)] px-1 pb-3">
          <div className="flex flex-wrap items-stretch gap-2">
            <div
              role="tablist"
              aria-label="מיון מלונות"
              className="flex min-w-0 flex-1 gap-[2px] rounded-md border border-border bg-card p-[3px]"
            >
              {SORTS.map(({ key, label, Icon }) => {
                const isActive = sort === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSort(key)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded px-2 py-2 text-[12px] font-bold leading-tight transition-colors",
                      isActive ? "bg-main text-white dark:bg-foreground dark:text-background" : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.8} aria-hidden="true" />
                    <span className="whitespace-nowrap">{label}</span>
                  </button>
                );
              })}
            </div>
            <TextInput
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="חיפוש לפי שם המלון"
              leftSection={<Search size={14} />}
              className="w-full sm:w-56"
              size="sm"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StarsGroup value={stars} onChange={setStars} className="justify-start gap-1.5" />
            <Checkbox
              checked={breakfast}
              onChange={(e) => setBreakfast(e.currentTarget.checked)}
              label="עם ארוחת בוקר"
              size="sm"
              color="hsl(var(--brand-accent))"
              iconColor="hsl(var(--brand-accent-foreground))"
            />
            {all && (
              <span className="text-[12px] text-muted-foreground">
                {`${shown.length} מתוך ${all.length} מלונות`}
              </span>
            )}
          </div>
        </div>
        {loading && <Skeleton visible className="h-40" />}
        {!loading && search && (all?.length ?? 0) === 0 && (
          <OrderIssueState
            className="min-h-40"
            title="לא מצאנו מלונות בעיר הזו לתאריכים האלה"
            subtitle="נסו פיצול אחר, או לינה בעיר אחת."
            whatsAppText="היי, אני מחפש מלון ללינה מפוצלת באתר ולא מצאתי תוצאות. אשמח לעזרה :)"
          />
        )}
        {!loading && (all?.length ?? 0) > 0 && shown.length === 0 && (
          <p className="py-8 text-center text-[14px] text-muted-foreground">
            אין מלונות שמתאימים למסננים - נסו לשחרר כוכבים או ארוחת בוקר.
          </p>
        )}
        {!loading &&
          info &&
          shown.slice(0, MODAL_MAX_CARDS).map(
            (hotel) =>
              info[hotel.id] && (
                <HotelCard
                  key={hotel.id}
                  persons={persons}
                  minPrice={minPrice}
                  isLoading={false}
                  selectedHotelId={pickId}
                  hotelId={hotel.id}
                  hotelRates={hotel.rates}
                  hotelInfo={info[hotel.id]}
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
