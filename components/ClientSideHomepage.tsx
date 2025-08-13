"use client";

import Image from "next/image";
import Link from "next/link";
import { useAffiliate, orderStage } from "../app/hooks/Affiliate";
import dayjs from "dayjs";
import { useMediaQuery } from "@mantine/hooks";
import { useState, useEffect, useRef, useMemo } from "react";
import { type Event, FootballTeam, Artist } from "@/lib/app.types";
import { Combobox, Modal, useCombobox } from "@mantine/core";
import { Carousel } from "@mantine/carousel";
import { ArrowLeftIcon } from "lucide-react";
import { Dispatch, RefObject, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MYT } from "./ui/myt";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import Fuse from "fuse.js";
import { ContactUs } from "@/components/ui/ContactUs";
import { trackEvent } from "@/lib/mixpanel";
import { ElfsightWidget } from "@/components/ui/elfReviews";

const fuseOptions = {
  keys: ["name", "location.name", "name_english"], // Fields to search in
  threshold: 0.3, // Lower = stricter match, Higher = more flexible
  findAllMatches: true, // Finds multiple matches
  ignoreLocation: true, // Ignore where the match is found in the string
};
interface Props {
  initialEvents: Event[];
  footballTeams: FootballTeam[];
  artists: Artist[];
}

const SearchCombobox = ({
  searchValue,
  setSearchValue,
  events,
  ref,
  inline,
  onOpenFeedbackModal,
}: {
  setSearchValue: Dispatch<SetStateAction<string>>;
  events: Event[];
  searchValue: string;
  ref?: RefObject<HTMLInputElement>;
  inline?: boolean;
  onOpenFeedbackModal: () => void;
  mobile?: boolean;
}) => {
  const router = useRouter();
  const combobox = useCombobox();

  // Memoize Fuse instance to prevent recreation on every render
  const fuse = useMemo(() => new Fuse(events, fuseOptions), [events]);

  const value = searchValue.toLowerCase().trim();
  const filteredOptions = value
    ? fuse.search(value).map((result) => result.item)
    : events;

  const options = filteredOptions.map((item) => (
    <Combobox.Option
      value={item.id.toString()}
      key={item.id}
      style={{ textAlign: "right" }}
      onClick={() =>
        trackEvent("buttonClick", {
          buttonTag: "search-option",
          buttonName: item.name,
        })
      }
    >
      <span className="font-bold text-lg">{item.name}</span>
      <br />
      <span className="text-lg">
        {item.date} | {item.location.name}
      </span>
    </Combobox.Option>
  ));

  return (
    <Combobox
      onOptionSubmit={(optionValue) => {
        if (optionValue === "feedback") {
          onOpenFeedbackModal();
        } else {
          const selectedEvent = events.find((item) => item.id.toString() === optionValue);
          if (selectedEvent) {
            // Track event selection from search
            trackEvent("eventSelected", {
              eventId: selectedEvent.id,
              eventName: selectedEvent.name,
              eventDate: selectedEvent.date,
              eventType: selectedEvent.type,
              eventLocation: selectedEvent.location.name,
              eventTags: selectedEvent.tags,
              eventPrice:
                selectedEvent.base_flight_price +
                selectedEvent.base_hotel_price +
                Math.min(...selectedEvent.tickets_and_rates.map((ticket) => ticket.price)) +
                Number(process.env.NEXT_PUBLIC_MARKUP || "175"),
            });
            
            orderStage("EVENT_SELECTED", {
              data: {
                event: selectedEvent.name,
                eventDate: selectedEvent.date,
                eventLocation: selectedEvent.location.name,
              },
            });
            
            const gtmIdnts =
              document.cookie
                .split("; ")
                .find((row) => row.startsWith("gtmIdnts="))
                ?.split("=")[1] || "";

            fetch("/api/events-info", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                eventData: {
                  id: selectedEvent.id,
                  name: selectedEvent.name,
                },
                gtmIdnts,
                eventType: "select_item",
              }),
            }).catch((error) => {
              console.error("Analytics tracking failed:", error);
            });
            
            setSearchValue(selectedEvent.name);
            router.push(`/order/${optionValue}`);
          }
        }
      }}
      store={combobox}
    >
      <Combobox.Target>
        <input
          ref={ref}
          className={cn(
            "w-full bg-white",
            inline ? "rounded-r" : "rounded border-secondary",
            "p-2 text-main border",
            "placeholder-black"
          )}
          dir="rtl"
          placeholder="חפש אירוע..."
          value={searchValue}
          onChange={(event) => {
            setSearchValue(event.currentTarget.value);
            if (event.currentTarget.value.length > 1) {
              combobox.openDropdown();
            } else {
              combobox.closeDropdown();
            }
            combobox.updateSelectedOptionIndex();
          }}
          onClick={() => {
            trackEvent("buttonClick", { buttonTag: "search-bar" });
            if (searchValue.length > 1) combobox.openDropdown();
          }}
          onFocus={() => searchValue.length > 1 && combobox.openDropdown()}
          onBlur={() => combobox.closeDropdown()}
        />
      </Combobox.Target>
      <Combobox.Dropdown
        styles={{
          dropdown: {
            maxHeight: "30vh",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          },
        }}
      >
        <Combobox.Options>
          {options}
          <Combobox.Option
            value="feedback"
            style={{ textAlign: "right", fontSize: "16px" }}
          >
            לא מצאתם מה שחיפשתם? ספרו לנו
          </Combobox.Option>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
};

const MobileCarousel = ({ events }: { events: Event[] }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || events.length === 0) {
    return null;
  }

  return (
    <Carousel
      withIndicators={events.length > 1}
      withControls={events.length > 1}
      slideSize="100%"
      slideGap="md"
      align="start"
      dragFree
      loop
      classNames={{
        root: "mx-[-8px]",
        control:
          "bg-black bg-opacity-50 text-white border-none hover:bg-opacity-70",
        indicator: "bg-gray-300 data-[active]:bg-secondary",
        indicators: "gap-2 mt-4",
        container: "py-[4px] px-[8px]",
      }}
    >
      {events.map((event) => (
        <Carousel.Slide key={event.id}>
          <EventCard event={event} />
        </Carousel.Slide>
      ))}
    </Carousel>
  );
};

// Compact Event Card for Sports Section
function CompactEventCard({ event }: { event: Event }) {
  return (
    <Link
      href={event.tags === "Sold" ? "#no-op" : `/order/${event.id}`}
      className={`${
        event.tags === "Sold" ? "cursor-default" : "cursor-pointer"
      }`}
      key={event.id}
      onClick={(e) => {
        trackEvent("eventSelected", {
          eventId: event.id,
          eventName: event.name,
          eventDate: event.date,
          eventType: event.type,
          eventLocation: event.location.name,
          eventTags: event.tags,
          eventPrice:
            event.base_flight_price +
            event.base_hotel_price +
            Math.min(...event.tickets_and_rates.map((ticket) => ticket.price)) +
            Number(process.env.NEXT_PUBLIC_MARKUP || "175"),
        });
        if (event.tags === "Sold") {
          e.preventDefault();
          return;
        }
        orderStage("EVENT_SELECTED", {
          data: {
            event: event.name,
            eventDate: event.date,
            eventLocation: event.location.name,
          },
        });
        const gtmIdnts =
          document.cookie
            .split("; ")
            .find((row) => row.startsWith("gtmIdnts="))
            ?.split("=")[1] || "";

        fetch("/api/events-info", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventData: {
              id: event.id,
              name: event.name,
            },
            gtmIdnts,
            eventType: "select_item",
          }),
        }).catch((error) => {
          console.error("Analytics tracking failed:", error);
        });
      }}
    >
      <div
        className="rounded-lg shadow-lg hover:shadow-xl hover:outline hover:outline-main flex flex-col bg-white w-full h-full sm:w-[240px] sm:min-w-[240px] sm:max-w-[240px]"
        style={{
          height: "245px",
        }}
      >
        <div
          className="relative group overflow-hidden rounded-t-lg flex-1"
          dir="rtl"
        >
          {event.tags === "LastTickets" && (
            <div className="absolute top-0 left-0 w-32 h-6 bg-secondary text-white font-bold text-xs transform -translate-x-8 translate-y-3 rotate-[-45deg] flex items-center justify-center z-10 pr-3">
              כרטיסים אחרונים!
            </div>
          )}
          {event.tags === "Popular" && (
            <div className="absolute top-0 left-0 w-32 h-6 bg-secondary text-white font-bold text-xs transform -translate-x-8 translate-y-3 rotate-[-45deg] flex items-center justify-center z-10 pr-3">
              נמכר במהירות!
            </div>
          )}
          {event.tags === "Restock" && (
            <div className="absolute top-0 left-0 w-32 h-6 bg-[#52C4A3] text-white font-bold text-xs transform -translate-x-8 translate-y-3 rotate-[-45deg] flex items-center justify-center z-10 pr-3">
              חזר למלאי!
            </div>
          )}
          {event.tags === "VIP" && (
            <div className="absolute top-0 left-0 w-32 h-6 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-bold text-xs transform -translate-x-8 translate-y-3 rotate-[-45deg] flex items-center justify-center z-10 pr-3">
              אירוח VIP
            </div>
          )}
          {event.tags === "Sold" && (
            <div className="absolute top-0 left-0 w-32 h-6 bg-[#d63a59] text-white font-bold text-xs transform -translate-x-8 translate-y-3 rotate-[-45deg] flex items-center justify-center z-10 pr-3">
              אזלו הכרטיסים
            </div>
          )}
          <Image
            src={event.card_image_url}
            alt={event.name}
            priority={true}
            width={240}
            height={180}
            className="object-cover w-full h-full transition-transform group-hover:scale-105"
          />
        </div>
        <div className="p-3 text-center flex-shrink-0">
          <div
            className="text-sm font-bold"
            style={{ lineHeight: "1.2" }}
            title={event.name}
          >
            {event.name}
          </div>
        </div>
      </div>
    </Link>
  );
}

// Compact Team Card for Football Section
function CompactTeamCard({ team }: { team: FootballTeam }) {
  return (
    <Link
      href={`/football/${team.sys?.id}`}
      className="block hover:opacity-90 transition-opacity"
      key={team.sys.id}
    >
      <div
        className="rounded-lg shadow-lg hover:shadow-xl hover:outline hover:outline-main flex flex-col bg-white w-full h-full sm:w-[240px] sm:min-w-[240px] sm:max-w-[240px]"
        style={{
          height: "245px",
        }}
      >
        <div className="relative group overflow-hidden rounded-t-lg flex-1">
          {team.fields.heroBanner?.fields?.file?.url && (
            <Image
              src={"https:" + team.fields.heroBanner.fields.file.url}
              alt={team.fields.name || "Football team"}
              priority={true}
              width={240}
              height={180}
              className="object-cover w-full h-full transition-transform group-hover:scale-105"
            />
          )}
        </div>
        <div className="p-3 text-center flex-none">
          <div
            className="font-bold text-md text-gray-800 line-clamp-2 mb-1"
            style={{ lineHeight: "1.2" }}
            title={team.fields.name || ""}
          >
            {team.fields.name || ""}
          </div>
        </div>
      </div>
    </Link>
  );
}

// Compact Artist Card for Artists Section
function CompactArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link
      href={`/artists/${artist.sys?.id}`}
      className="block hover:opacity-90 transition-opacity"
      key={artist.sys.id}
    >
      <div
        className="rounded-lg shadow-lg hover:shadow-xl hover:outline hover:outline-main flex flex-col bg-white w-full h-full sm:w-[240px] sm:min-w-[240px] sm:max-w-[240px]"
        style={{
          height: "245px",
        }}
      >
        <div className="relative group overflow-hidden rounded-t-lg flex-1">
          {artist.fields.heroBanner?.fields?.file?.url && (
            <Image
              src={"https:" + artist.fields.heroBanner.fields.file.url}
              alt={artist.fields.name || "Artist"}
              priority={true}
              width={240}
              height={180}
              className="object-cover w-full h-full transition-transform group-hover:scale-105"
            />
          )}
        </div>
        <div className="p-3 text-center flex-none">
          <div
            className="font-bold text-md text-gray-800 line-clamp-2 mb-1"
            style={{ lineHeight: "1.2" }}
            title={artist.fields.name || ""}
          >
            {artist.fields.name || ""}
          </div>
        </div>
      </div>
    </Link>
  );
}

const UniversalCarousel = ({
  events,
  teams,
  artists,
  variant = "default",
}: {
  events?: Event[];
  teams?: FootballTeam[];
  artists?: Artist[];
  variant?: "default" | "compact";
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const { isMobile } = useIsMobile();

  const items = teams || artists || events || [];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || items.length === 0) {
    return null;
  }

  // Calculate how many slides to show based on variant and screen size
  let slideSize: string;
  let slidesToScroll: number;

  if (variant === "compact") {
    if (isMobile) {
      slideSize = "50%"; // 2 cards on mobile
      slidesToScroll = 2;
    } else {
      slideSize = "240px"; // Fixed width for desktop instead of percentage
      slidesToScroll = 1;
    }
  } else {
    slideSize = isMobile ? "100%" : "25%"; // 1 on mobile, 4 on desktop
    slidesToScroll = 1;
  }

  const showControls =
    items.length >
    (variant === "compact" ? (isMobile ? 2 : 5) : isMobile ? 1 : 4);
  const showIndicators = variant === "default" && isMobile && items.length > 1;

  return (
    <Carousel
      withIndicators={showIndicators}
      withControls={showControls}
      slideSize={slideSize}
      slideGap={variant === "compact" ? "md" : "sm"}
      align="start"
      dragFree
      loop={false}
      slidesToScroll={slidesToScroll}
      classNames={{
        container: "py-[2px]",
        control:
          variant === "compact" && !isMobile
            ? "w-8 h-8 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-600"
            : "bg-black bg-opacity-50 text-white border-none hover:bg-opacity-70",
        indicator: "bg-gray-300 data-[active]:bg-secondary",
        indicators: "gap-2 mt-4",
        viewport: variant === "compact" && !isMobile ? "h-[245px]" : "",
      }}
      styles={{
        control: {
          fontSize: variant === "compact" && !isMobile ? "16px" : "20px",
        },
      }}
    >
      {items.map((item) => {
        // Determine the type of item and generate appropriate key
        let key: string;
        if (teams) {
          key = (item as FootballTeam).sys.id;
        } else if (artists) {
          key = (item as Artist).sys.id;
        } else {
          key = (item as Event).id.toString();
        }

        return (
          <Carousel.Slide key={key}>
            <div
              className={
                variant === "compact"
                  ? isMobile 
                    ? "px-2 flex justify-center"
                    : "flex justify-center w-[240px] min-w-[240px] max-w-[240px]" // Fixed width for desktop slides
                  : ""
              }
            >
              {variant === "compact" ? (
                teams ? (
                  <CompactTeamCard team={item as FootballTeam} />
                ) : artists ? (
                  <CompactArtistCard artist={item as Artist} />
                ) : (
                  <CompactEventCard event={item as Event} />
                )
              ) : (
                <EventCard event={item as Event} />
              )}
            </div>
          </Carousel.Slide>
        );
      })}
    </Carousel>
  );
};

export function ClientSideHomepage({ initialEvents, footballTeams, artists }: Props) {
  const [isMounted, setIsMounted] = useState(false);
  const matches = useMediaQuery("(min-width: 1024px)");
  const [searchValue, setSearchValue] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [feedbackInSearchModal, setfeedbackInSearchModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const mobileComboboxRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [errorDebug, setErrorDebug] = useState(Object);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSearchModalOpen = () => {
    setShowSearchModal(true);
    setTimeout(() => {
      mobileComboboxRef.current?.focus();
    }, 100);
  };

  useEffect(() => {
    window.onerror = function (message, source, lineno, colno, error) {
      // Filter out benign ResizeObserver errors
      if (
        typeof message === "string" &&
        message.includes(
          "ResizeObserver loop completed with undelivered notifications"
        )
      ) {
        return true; // Suppress this error
      }

      setErrorDebug({ message, error });
      console.error("Global error caught:", message, error);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.querySelector("section.bg-main");
      if (heroSection && searchContainerRef.current) {
        const heroBottom = heroSection.getBoundingClientRect().bottom;
        setIsSticky(heroBottom < 0);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useAffiliate();

  const handleMoreEventsSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const event = formData.get("event");
    const email = formData.get("email");

    try {
      const response = await fetch("/api/more-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event, email }),
      });

      if (response.ok) {
      } else {
        console.error("Failed to submit event");
      }
      setShowFeedbackModal(false);
      setShowSuccessMessage(false);
      if (feedbackInSearchModal) {
        setSearchValue("");
        setShowSearchModal(false);
      }
    } catch (error) {
      setShowFeedbackModal(false);
      setShowSuccessMessage(false);
      if (feedbackInSearchModal) {
        setSearchValue("");
        setShowSearchModal(false);
      }
      console.error("Error submitting event:", error);
    }
  };

  if (errorDebug.error) {
    return (
      <div className="container mx-auto">
        <h1>אופס! קרתה תקלה</h1>
        <p>אנא נסו שוב מאוחר יותר</p>
        <p>{errorDebug.message}</p>
        <p>{errorDebug.error}</p>
      </div>
    );
  }

  // Prevent hydration mismatches by only rendering after client mount
  if (!isMounted) {
    return null;
  }

  // Separate VIP events
  const vipEvents = initialEvents.filter((event) => event.tags === "VIP");

  // Function to filter events from artists that appear in the carousel
  // Keep only one event per artist (preferably with a tag)
  const filterEventsFromCarouselArtists = (events: Event[]) => {
    if (!artists || artists.length === 0) return events;

    // Get list of artist names that appear in the carousel
    const carouselArtistNames = new Set(
      artists
        .map(artist => artist.fields.nameDBenglish)
        .filter(Boolean)
        .map(name => name!.trim().toLowerCase()) // Trim whitespaces before lowercasing
    );

    // Group events by artist
    const eventsByArtist = new Map<string, Event[]>();
    const nonArtistEvents: Event[] = [];

    events.forEach(event => {
      const eventArtistName = event.name_english?.trim().toLowerCase(); // Trim whitespaces before lowercasing
      if (eventArtistName && carouselArtistNames.has(eventArtistName)) {
        if (!eventsByArtist.has(eventArtistName)) {
          eventsByArtist.set(eventArtistName, []);
        }
        eventsByArtist.get(eventArtistName)!.push(event);
      } else {
        nonArtistEvents.push(event);
      }
    });

    // For each artist, keep only one event (preferably with a tag)
    const filteredArtistEvents: Event[] = [];
    eventsByArtist.forEach(artistEvents => {
      // Sort events to prioritize those with tags (except "Sold")
      const sortedEvents = artistEvents.sort((a, b) => {
        const aHasTag = a.tags && a.tags !== "Sold";
        const bHasTag = b.tags && b.tags !== "Sold";
        
        if (aHasTag && !bHasTag) return -1;
        if (!aHasTag && bHasTag) return 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      
      // Keep only the first (best) event for this artist
      filteredArtistEvents.push(sortedEvents[0]);
    });

    return [...nonArtistEvents, ...filteredArtistEvents];
  };

  // Get prioritized events for "המבוקשים ביותר" section (including VIP if prioritized)
  const prioritized_events = (() => {
    const prioritizedEvents = initialEvents.filter(
      (event) => event.is_prioritized === true
    );
    const nonPrioritizedEvents = initialEvents.filter(
      (event) =>
        event.is_prioritized === false &&
        event.tags !== "VIP" &&
        event.type !== "sports_event"
    );

    // Ensure we always have exactly 8 events for "המבוקשים ביותר"
    if (prioritizedEvents.length >= 8) {
      return prioritizedEvents.slice(0, 8).sort((a, b) => {
        // Sort events with tags first, then by date
        if (a.tags && !b.tags) return -1;
        if (!a.tags && b.tags) return 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
    } else {
      // Filter out events from carousel artists before using them to fill slots
      const filteredNonPrioritizedEvents = filterEventsFromCarouselArtists(nonPrioritizedEvents);
      
      // Fill remaining slots with filtered non-prioritized non-VIP non-sports events
      const combined = [
        ...prioritizedEvents,
        ...filteredNonPrioritizedEvents.slice(0, 8 - prioritizedEvents.length),
      ];
      return combined.slice(0, 8).sort((a, b) => {
        // Sort events with tags first, then by date
        if (a.tags && !b.tags) return -1;
        if (!a.tags && b.tags) return 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
    }
  })();

  // Get music events (only music_event type, excluding VIP and already used prioritized events)
  const musicEvents = (() => {
    const usedEventIds = new Set(prioritized_events.map((event) => event.id));
    const remainingEvents = initialEvents.filter(
      (event) =>
        event.type === "music_event" &&
        event.tags !== "VIP" &&
        !usedEventIds.has(event.id)
    );

    // Filter out events from carousel artists (keeping only one per artist)
    const filteredEvents = filterEventsFromCarouselArtists(remainingEvents);

    return filteredEvents.sort((a, b) => {
      // Sort events with tags first (except "Sold"), then by date
      const aHasPriorityTag = a.tags && a.tags !== "Sold";
      const bHasPriorityTag = b.tags && b.tags !== "Sold";

      if (aHasPriorityTag && !bHasPriorityTag) return -1;
      if (!aHasPriorityTag && bHasPriorityTag) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  })();

  // Sort VIP events by date
  const sortedVipEvents = vipEvents.sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <>
      {!matches && (
        <Modal
          closeButtonProps={{
            icon: <ArrowLeftIcon />,
            style: { position: "absolute" },
          }}
          opened={showSearchModal}
          fullScreen
          onClose={() => setShowSearchModal(false)}
        >
          <SearchCombobox
            ref={mobileComboboxRef}
            events={initialEvents}
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            onOpenFeedbackModal={() => {
              setfeedbackInSearchModal(true);
              setShowFeedbackModal(true);
            }}
            mobile={true}
          />
        </Modal>
      )}
      <Modal
        opened={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        title="ספרו לנו לאן תרצו לטוס"
        dir="rtl"
      >
        {showSuccessMessage ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">תודה על שיתוף הפעולה!</h2>
            <p>האירוע נשלח בהצלחה.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              if (form.checkValidity()) {
                handleMoreEventsSubmit(e);
                setShowSuccessMessage(true);
              }
            }}
          >
            <div className="mb-4">
              <label
                className="block text-gray-700 text-sm font-bold mb-2"
                htmlFor="event"
              >
                מה שם האומן/משחק והאם יש העדפה למקום? *
              </label>
              <input
                id="event"
                name="event"
                type="text"
                required
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="ביונסה בפריז"
              />
              <label
                className="block text-gray-700 text-sm font-bold mt-6 mb-2"
                htmlFor="email"
              >
                שנחזור אליכם עם הצעה? *
              </label>
              <input
                id="email"
                name="email"
                type="text"
                required
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="טלפון או אימייל"
              />
            </div>
            <button
              type="submit"
              className="bg-secondary hover:bg-secondary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              שלח
            </button>
          </form>
        )}
      </Modal>
      <section className="w-full py-1 lg:py-6 px-4 md:px-6 text-white bg-main relative">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl mb-1 lg:mb-4">
            האירועים השווים בחו״ל
            <span className="text-secondary whitespace-nowrap text-5xl">
              {" "}
              במקום אחד
            </span>
            <span className="block mt-2 text-3xl sm:text-4xl md:text-5xl mb-8">
              בהתאמה אישית משתלמת{" "}
            </span>
          </h1>
        </div>
        <div
          ref={searchContainerRef}
          className={`w-full max-w-sm px-4 lg:max-w-xl mx-auto space-y-2 ${
            isSticky
              ? "fixed top-0 left-0 right-0 z-50 bg-white py-4 shadow-md transition-all duration-300"
              : "absolute bottom-0 left-0 right-0 transform translate-y-1/2"
          } min-w-70`}
        >
          <form
            className={`flex center shadow-md ${
              isSticky ? "max-w-xl mx-auto" : ""
            }`}
            dir="rtl"
          >
            {!matches ? (
              <input
                onFocus={(e) => {
                  handleSearchModalOpen();
                  e.target.blur();
                }}
                onChange={(e) => setSearchValue(e.target.value)}
                value={searchValue}
                placeholder="חפש אירוע..."
                type="text"
                className={`w-2/3 rounded-r rounded-l-none p-2 text-main border bg-white ${
                  isSticky ? "border-secondary" : ""
                }`}
              />
            ) : (
              <SearchCombobox
                inline
                events={initialEvents}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                ref={ref}
                onOpenFeedbackModal={() => setShowFeedbackModal(true)}
              />
            )}
            <button
              className="w-1/3 bg-secondary text-white font-bold rounded-l"
              onClick={(e) => {
                e.preventDefault();
                if (!matches) {
                  handleSearchModalOpen();
                } else {
                  ref.current?.focus();
                }
              }}
            >
              התחילו לתכנן!
            </button>
          </form>
        </div>
      </section>
      <section className="w-full py-10 lg:py-14 bg-gray-100 dark:bg-gray-800 px-4 md:px-6">
        <div className="container mx-auto">
          <div className="sm:hidden py-1">
            <div
              className="flex justify-around items-center text-right container mb-4"
              dir="rtl"
            >
              {(() => {
                const garuarntees = [
                  {
                    svg: (
                      <svg
                        width="36"
                        height="36"
                        viewBox="0 0 36 36"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M32.6768 4.03516C33.047 4.03522 33.3457 4.32524 33.3457 4.68945V10.9434C33.3456 11.8852 33.0311 12.7547 32.4863 13.4561V29.0029C32.4863 30.6431 31.1174 31.9648 29.4375 31.9648H6.56445C4.88458 31.9648 3.51562 30.6431 3.51562 29.0029V13.4561C2.98141 12.7559 2.65536 11.8866 2.65527 10.9434V4.68945C2.65527 4.32335 2.9673 4.03516 3.3252 4.03516H32.6768ZM25.3389 13.1885C24.5721 14.3701 23.2178 15.1533 21.6699 15.1533C20.131 15.1533 18.7763 14.3699 18.001 13.1885C17.2342 14.3701 15.8799 15.1532 14.332 15.1533C12.7931 15.1533 11.4384 14.3699 10.6631 13.1885C9.8963 14.3701 8.54204 15.1532 6.99414 15.1533C6.21927 15.1533 5.48793 14.9533 4.85352 14.6045V29.0029C4.85352 29.9117 5.62326 30.6572 6.56445 30.6572H29.4375C30.3886 30.6572 31.1475 29.9123 31.1475 29.0029V14.6064C30.5207 14.9542 29.7898 15.1533 29.0078 15.1533C27.4689 15.1533 26.1142 14.3699 25.3389 13.1885ZM3.99414 10.9434C3.99435 12.5425 5.34031 13.8467 6.99414 13.8467C8.65802 13.8465 9.99296 12.5427 9.99316 10.9434V5.34277H3.99414V10.9434ZM11.332 10.9434C11.3322 12.5425 12.6782 13.8467 14.332 13.8467C15.9959 13.8466 17.3308 12.5428 17.3311 10.9434V5.34277H11.332V10.9434ZM18.6699 10.9434C18.6701 12.5425 20.0161 13.8467 21.6699 13.8467C23.3338 13.8466 24.6687 12.5428 24.6689 10.9434V5.34277H18.6699V10.9434ZM26.0078 10.9434C26.008 12.5425 27.354 13.8467 29.0078 13.8467C30.6717 13.8466 32.0066 12.5428 32.0068 10.9434V5.34277H26.0078V10.9434Z"
                          fill="#277E89"
                          stroke="#287E89"
                          strokeWidth="0.290446"
                        />
                        <path
                          d="M17.5413 17.4809C17.6862 17.0349 18.3172 17.0349 18.4621 17.4809L19.4145 20.4123C19.4793 20.6118 19.6652 20.7468 19.8749 20.7468H22.9572C23.4262 20.7468 23.6211 21.3469 23.2418 21.6225L20.7481 23.4342C20.5785 23.5575 20.5075 23.776 20.5723 23.9754L21.5248 26.9069C21.6697 27.3529 21.1592 27.7237 20.7798 27.4481L18.2862 25.6364C18.1165 25.5131 17.8868 25.5131 17.7171 25.6364L15.2235 27.4481C14.8441 27.7237 14.3337 27.3529 14.4786 26.9069L15.4311 23.9754C15.4959 23.776 15.4249 23.5575 15.2552 23.4342L12.7616 21.6225C12.3822 21.3469 12.5772 20.7468 13.0461 20.7468H16.1284C16.3381 20.7468 16.524 20.6118 16.5888 20.4123L17.5413 17.4809Z"
                          fill="#277E89"
                        />
                      </svg>
                    ),
                    title: "אלפי לקוחות מרוצים",
                    subtitle: (
                      <span>
                        <a
                          href="https://www.google.com/search?q=%D7%9E%D7%92%D7%94+%D7%AA%D7%99%D7%99%D7%A8%D7%95%D7%AA"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          מבית מגה תיירות
                        </a>
                        <br />
                        30 שנות ניסיון
                      </span>
                    ),
                  },
                  {
                    svg: (
                      <svg
                        width="37"
                        height="36"
                        viewBox="0 0 37 36"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M18.4414 0.953613C18.5016 0.960015 18.5604 0.975324 18.6162 0.998535L18.6973 1.03955L19.4385 1.46924C23.1727 3.56357 27.3254 4.81291 31.6025 5.12451L31.7188 5.14404C31.8322 5.17452 31.9357 5.23648 32.0166 5.32373C32.1244 5.43999 32.1846 5.59292 32.1846 5.75146L32.1904 6.49463C32.2031 7.32219 32.2326 8.38995 32.2656 9.58154L32.3535 13.0562C32.3789 14.2587 32.3977 15.4781 32.3984 16.6294C32.3997 18.6393 32.3477 20.4554 32.1865 21.6167L32.1113 22.0728C31.6341 24.4489 30.3662 26.6866 28.3506 28.7319L27.9375 29.1382C25.7149 31.2612 22.6006 33.2304 18.6875 34.9946V34.9937C18.6062 35.0304 18.5179 35.0503 18.4287 35.0503C18.384 35.0503 18.3394 35.045 18.2959 35.0356L18.1699 34.9937C14.7429 33.4452 11.9187 31.7157 9.77148 29.8442L9.35059 29.4683C7.26685 27.554 5.82294 25.4444 5.05957 23.1909L4.91602 22.7388C4.8052 22.3635 4.73124 21.7241 4.68262 20.894C4.63373 20.0593 4.60996 19.0177 4.60352 17.8286C4.59062 15.45 4.6485 12.4743 4.71777 9.37158L4.7627 7.24072L4.78418 5.64111C4.7848 5.48853 4.84137 5.34141 4.94238 5.22705C5.04348 5.11272 5.18261 5.03839 5.33398 5.01904L6.39258 4.87549C11.5969 4.12077 15.498 2.83633 18.0127 1.06494L18.0898 1.01807C18.1705 0.977123 18.2595 0.95419 18.3506 0.950684L18.4414 0.953613ZM18.3984 2.32178C15.6135 4.15941 11.455 5.4582 6.03711 6.19482C6.03234 6.59022 6.02487 7.04917 6.01465 7.55615L5.97559 9.40088C5.92367 11.7161 5.85864 14.6207 5.8584 17.1216C5.85828 18.3722 5.87415 19.5209 5.91602 20.4429C5.95818 21.3712 6.02553 22.0525 6.12305 22.3823L6.25293 22.7905C7.67452 26.9824 11.7506 30.6659 18.4297 33.73C25.8158 30.3507 29.9743 26.3403 30.8779 21.8296C31.0812 20.8127 31.1444 18.8409 31.1406 16.5718C31.1387 15.4399 31.12 14.2383 31.0947 13.0513L31.0088 9.61768C30.9732 8.33482 30.9417 7.19119 30.9307 6.32959C26.5109 5.92394 22.2337 4.55632 18.3984 2.32178ZM18.4443 4.75342C18.5466 4.75275 18.6475 4.77656 18.7383 4.82373H18.7393C21.7736 6.40464 25.0399 7.4933 28.416 8.04834L28.5215 8.07568C28.6238 8.11151 28.716 8.1737 28.7881 8.25635C28.884 8.36655 28.9386 8.50678 28.9424 8.65283L29.001 10.6782L29.0469 12.2202C29.0612 12.7383 29.0735 13.2585 29.083 13.7739L29.1025 14.9126C29.1133 15.6841 29.1193 16.4772 29.1143 17.2788L29.0977 18.4849L29.0928 18.7192C29.0993 19.6255 29.0316 20.5309 28.8916 21.4263L28.8906 21.4321C28.1567 25.0975 24.6998 28.4307 18.708 31.3589V31.3579C18.6219 31.4002 18.5275 31.4223 18.4316 31.4224C18.3597 31.4224 18.2882 31.4103 18.2207 31.3862L18.1543 31.3579C12.5668 28.6111 9.1572 25.4201 8.08105 21.856V21.855C8.07558 21.8366 8.07115 21.8187 8.06738 21.8013L8.06445 21.7915V21.7905C7.94401 20.9658 7.89066 20.1327 7.9043 19.2993L7.89941 18.9263L7.88574 17.7056C7.87872 16.4794 7.89177 15.2195 7.91406 13.7896L7.9834 10.5688V10.5679L8.03223 8.46631L8.04297 8.35791C8.06356 8.25174 8.11154 8.15197 8.18262 8.06885C8.27759 7.95787 8.40885 7.88307 8.55273 7.85791L9.28418 7.7251C12.8935 7.04315 15.7983 6.09353 18.1504 4.82861L18.2197 4.79639C18.2911 4.76849 18.3673 4.75395 18.4443 4.75342ZM18.4512 6.08936C15.9784 7.37007 12.9682 8.32585 9.27832 9.00439L9.24023 10.5981L9.1709 13.8071C9.14157 15.7025 9.12833 17.2954 9.15723 18.9019L9.16211 19.2847V19.2876C9.15032 20.0343 9.1944 20.7809 9.29395 21.521C10.2473 24.632 13.3009 27.5202 18.4326 30.0894C23.9528 27.344 27.0254 24.3427 27.6582 21.1841C27.7829 20.361 27.8415 19.5292 27.835 18.6968V18.6929L27.9854 18.6958L27.8359 18.6929L27.8398 18.4575L27.8564 17.2671C27.8613 16.4755 27.8554 15.6908 27.8447 14.9263L27.8262 13.7974C27.8073 12.7746 27.7754 11.7289 27.7441 10.7173L27.7432 10.7163C27.7282 10.2191 27.7124 9.70867 27.6982 9.19971C24.4807 8.61919 21.3656 7.57149 18.4512 6.08936ZM21.4365 14.4331C21.5677 14.429 21.6983 14.4522 21.8203 14.5005C21.9422 14.5488 22.0528 14.6216 22.1455 14.7144C22.2382 14.807 22.3111 14.9177 22.3594 15.0396C22.4077 15.1615 22.4308 15.2923 22.4268 15.4233C22.4226 15.5545 22.3918 15.6835 22.3359 15.8022C22.3086 15.8603 22.2754 15.9151 22.2373 15.9663L22.2471 15.9731L22.1104 16.1089C21.4162 16.8031 20.7139 17.5127 20.0352 18.1987L17.96 20.2866C17.7799 20.4665 17.5358 20.5679 17.2812 20.5679C17.0586 20.5678 16.8437 20.4909 16.6729 20.3511L16.6025 20.2866C16.29 19.9741 15.972 19.6154 15.6387 19.2378V19.2388C15.2837 18.839 14.9198 18.431 14.542 18.0513L14.5381 18.0474V18.0464C14.3689 17.8644 14.2769 17.624 14.2812 17.3755C14.2857 17.1267 14.3865 16.8894 14.5625 16.7134C14.7385 16.5375 14.9758 16.4365 15.2246 16.4321C15.4422 16.4283 15.6538 16.4983 15.8252 16.6294L15.8965 16.6899L17.123 17.9165L17.1729 17.9575C17.1906 17.9694 17.2097 17.9796 17.2295 17.9878C17.2694 18.0043 17.3123 18.0122 17.3555 18.0122C17.3986 18.0122 17.4416 18.0043 17.4814 17.9878C17.5212 17.9713 17.5574 17.947 17.5879 17.9165L20.7529 14.7515C20.8385 14.6563 20.9417 14.5785 21.0576 14.5239C21.1763 14.4681 21.3054 14.4372 21.4365 14.4331Z"
                          fill="#277E89"
                          stroke="#287E89"
                          strokeWidth="0.3"
                        />
                      </svg>
                    ),
                    title: "100% אחריות",
                    subtitle: "אנחנו משווקים רק כרטיסים רשמיים!",
                  },
                  {
                    svg: (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="36"
                        height="36"
                        viewBox="0 0 36 36"
                        fill="none"
                      >
                        <path
                          d="M31.8005 34.829V31.2806C31.7983 30.2139 31.3846 29.1893 30.6455 28.4201C29.9064 27.651 28.8989 27.1968 27.8332 27.1522C28.439 26.4702 28.8347 25.6277 28.9728 24.726C29.111 23.8243 28.9856 22.9019 28.6117 22.0699C28.2379 21.2378 27.6315 20.5315 26.8657 20.036C26.0998 19.5405 25.207 19.2769 24.2949 19.2769C23.3827 19.2769 22.4899 19.5405 21.724 20.036C20.9582 20.5315 20.3518 21.2378 19.978 22.0699C19.6042 22.9019 19.4787 23.8243 19.6169 24.726C19.755 25.6277 20.1507 26.4702 20.7565 27.1522C19.6845 27.1972 18.6725 27.6598 17.9371 28.4411C17.2166 27.7195 16.2691 27.2685 15.2547 27.1643C15.8641 26.4835 16.2634 25.6408 16.4043 24.738C16.5453 23.8352 16.4219 22.9109 16.049 22.0767C15.6761 21.2425 15.0697 20.5341 14.303 20.037C13.5363 19.5399 12.6421 19.2754 11.7284 19.2754C10.8147 19.2754 9.92048 19.5399 9.15379 20.037C8.3871 20.5341 7.78071 21.2425 7.40784 22.0767C7.03496 22.9109 6.91155 23.8352 7.0525 24.738C7.19345 25.6408 7.59274 26.4835 8.20215 27.1643C7.11039 27.275 6.09857 27.787 5.36266 28.601C4.62675 29.4151 4.21913 30.4732 4.21875 31.5706V34.829C4.21875 35.0427 4.30362 35.2476 4.45469 35.3986C4.60576 35.5497 4.81065 35.6346 5.02429 35.6346H30.9949C31.2086 35.6346 31.4135 35.5497 31.5646 35.3986C31.7156 35.2476 31.8005 35.0427 31.8005 34.829ZM24.2928 20.9052C24.9102 20.9052 25.5137 21.0883 26.027 21.4313C26.5404 21.7743 26.9405 22.2618 27.1767 22.8322C27.413 23.4026 27.4748 24.0302 27.3543 24.6357C27.2339 25.2412 26.9366 25.7974 26.5001 26.2339C26.0635 26.6705 25.5073 26.9678 24.9018 27.0882C24.2963 27.2087 23.6687 27.1468 23.0983 26.9106C22.5279 26.6743 22.0404 26.2742 21.6974 25.7609C21.3544 25.2476 21.1714 24.6441 21.1714 24.0267C21.1714 23.1989 21.5002 22.4049 22.0856 21.8195C22.671 21.2341 23.465 20.9052 24.2928 20.9052ZM11.7103 20.9052C12.3278 20.9044 12.9317 21.0868 13.4456 21.4294C13.9594 21.7719 14.3601 22.2591 14.597 22.8294C14.8339 23.3997 14.8963 24.0274 14.7763 24.6332C14.6563 25.239 14.3593 25.7956 13.923 26.2325C13.4866 26.6695 12.9304 26.9671 12.3248 27.0879C11.7191 27.2087 11.0913 27.1471 10.5207 26.911C9.9501 26.6748 9.46235 26.2747 9.11918 25.7613C8.77601 25.2479 8.59284 24.6443 8.59284 24.0267C8.5939 23.1999 8.92256 22.4071 9.50685 21.8221C10.0911 21.2371 10.8834 20.9074 11.7103 20.9052ZM17.5988 34.0235H5.81372V31.5746C5.81372 30.8269 6.11076 30.1098 6.6395 29.581C7.16824 29.0523 7.88537 28.7552 8.63312 28.7552H14.7794C15.5271 28.7552 16.2443 29.0523 16.773 29.581C17.3018 30.1098 17.5988 30.8269 17.5988 31.5746V34.0235ZM30.1975 34.0235H19.2099V31.5746C19.2096 30.975 19.0877 30.3817 18.8514 29.8306C19.0836 29.499 19.3922 29.2282 19.7511 29.041C20.11 28.8538 20.5088 28.7558 20.9136 28.7552H27.6681C28.3375 28.7563 28.9792 29.0227 29.4526 29.4961C29.926 29.9695 30.1924 30.6112 30.1934 31.2806L30.1975 34.0235Z"
                          fill="#287E89"
                        />
                        <path
                          d="M17.5833 1.64705C17.7144 1.24375 18.285 1.24375 18.416 1.64705L19.2773 4.29798C19.3359 4.47835 19.504 4.60046 19.6937 4.60046H22.481C22.9051 4.60046 23.0814 5.14311 22.7383 5.39237L20.4833 7.03073C20.3299 7.1422 20.2657 7.33979 20.3243 7.52015L21.1856 10.1711C21.3167 10.5744 20.8551 10.9098 20.512 10.6605L18.257 9.02214C18.1035 8.91067 17.8958 8.91067 17.7424 9.02214L15.4873 10.6605C15.1443 10.9098 14.6827 10.5744 14.8137 10.1711L15.675 7.52015C15.7337 7.33979 15.6695 7.1422 15.516 7.03073L13.261 5.39237C12.9179 5.14311 13.0943 4.60046 13.5183 4.60046H16.3057C16.4953 4.60046 16.6634 4.47835 16.722 4.29798L17.5833 1.64705Z"
                          fill="#277E89"
                        />
                        <path
                          d="M27.9544 6.36141C28.0855 5.9581 28.656 5.9581 28.7871 6.36141L29.6484 9.01234C29.707 9.1927 29.8751 9.31482 30.0648 9.31482H32.8521C33.2762 9.31482 33.4525 9.85747 33.1094 10.1067L30.8544 11.7451C30.701 11.8566 30.6368 12.0541 30.6954 12.2345L31.5567 14.8854C31.6878 15.2887 31.2262 15.6241 30.8831 15.3749L28.6281 13.7365C28.4746 13.625 28.2669 13.625 28.1135 13.7365L25.8584 15.3749C25.5154 15.6241 25.0538 15.2887 25.1848 14.8854L26.0461 12.2345C26.1047 12.0541 26.0405 11.8566 25.8871 11.7451L23.6321 10.1067C23.289 9.85746 23.4653 9.31482 23.8894 9.31482H26.6768C26.8664 9.31482 27.0345 9.1927 27.0931 9.01234L27.9544 6.36141Z"
                          fill="#277E89"
                        />
                        <path
                          d="M7.21224 6.36141C7.34328 5.9581 7.91386 5.9581 8.0449 6.36141L8.90624 9.01234C8.96484 9.1927 9.13292 9.31482 9.32257 9.31482H12.1099C12.534 9.31482 12.7103 9.85747 12.3672 10.1067L10.1122 11.7451C9.95878 11.8566 9.89458 12.0541 9.95319 12.2345L10.8145 14.8854C10.9456 15.2887 10.484 15.6241 10.1409 15.3749L7.88588 13.7365C7.73245 13.625 7.52469 13.625 7.37127 13.7365L5.11625 15.3749C4.77318 15.6241 4.31157 15.2887 4.44262 14.8854L5.30396 12.2345C5.36256 12.0541 5.29836 11.8566 5.14493 11.7451L2.88992 10.1067C2.54684 9.85746 2.72316 9.31482 3.14723 9.31482H5.93457C6.12422 9.31482 6.2923 9.1927 6.3509 9.01234L7.21224 6.36141Z"
                          fill="#277E89"
                        />
                      </svg>
                    ),
                    title: "צוות מקצועי",
                    subtitle: "שילווה אתכם גם כשאתם בחו”ל",
                  },
                ];

                return garuarntees.map((g, i) => (
                  <div
                    key={i}
                    className="flex flex-col justify-center items-center text-center w-1/3"
                  >
                    {g.svg}
                    <span className="font-bold text-[13px]">{g.title}</span>
                    <span className="text-[12px] leading-tight whitespace-pre-wrap">
                      {g.subtitle}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
          <div className="flex flex-row mb-4 lg:mb-6 justify-end items-stretch">
            <div>
              <h2 className="text-2xl font-bold text-secondary tracking-tighter sm:text-4xl text-center mx-2">
                המבוקשים ביותר
              </h2>
            </div>
            <div
              className="bg-secondary mx-1"
              style={{ height: 40, width: 23 }}
            />
            <div
              className="bg-secondary mx-1 hidden sm:block"
              style={{ height: 40, width: 23 }}
            />
            <div
              className="bg-secondary mx-1 hidden sm:block"
              style={{ height: 40, width: 46 }}
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {prioritized_events.map((event) => (
              <EventCard event={event} key={event.id} />
            ))}
          </div>
          <ElfsightWidget
            widgetId="58ddc878-9ffa-4f89-b892-04ed7ec54eb7"
            lazy="first-activity"
          />

          {/* Sports Section */}
          {footballTeams && footballTeams.length > 0 && (
            <>
              <div className="flex flex-row justify-end mt-2 mb-4 lg:mb-6 items-stretch">
                <div>
                  <h2 className="text-2xl font-bold text-secondary tracking-tighter sm:text-4xl text-center mx-2">
                    כדורגל
                  </h2>
                </div>
                <div
                  className="bg-secondary mx-1"
                  style={{ height: 40, width: 23 }}
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 23 }}
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 46 }}
                />
              </div>
              {/* Mobile carousel for Sports events */}
              <div className="block sm:hidden mb-8">
                <UniversalCarousel teams={footballTeams} variant="compact" />
              </div>
              {/* Desktop carousel for Sports events */}
              <div className="hidden sm:block mb-8">
                <UniversalCarousel teams={footballTeams} variant="compact" />
              </div>
            </>
          )}

          {/* Sports Section */}
          {artists && artists.length > 0 && (
            <>
              <div className="flex flex-row justify-end mt-2 mb-4 lg:mb-6 items-stretch">
                <div>
                  <h2 className="text-2xl font-bold text-secondary tracking-tighter sm:text-4xl text-center mx-2">
                    אמנים מובילים
                  </h2>
                </div>
                <div
                  className="bg-secondary mx-1"
                  style={{ height: 40, width: 23 }}
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 23 }}
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 46 }}
                />
              </div>
              {/* Mobile carousel for Artists */}
              <div className="block sm:hidden mb-8">
                <UniversalCarousel artists={artists} variant="compact" />
              </div>
              {/* Desktop carousel for Artists */}
              <div className="hidden sm:block mb-8">
                <UniversalCarousel artists={artists} variant="compact" />
              </div>
            </>
          )}

          {/* Music Section (renamed from "האירועים שלנו") */}
          {musicEvents.length > 0 && (
            <>
              <div className="flex flex-row justify-end mt-2 mb-4 lg:mb-6 items-stretch">
                <div>
                  <h2 className="text-2xl font-bold text-secondary tracking-tighter sm:text-4xl text-center mx-2">
                    הופעות
                  </h2>
                </div>
                <div
                  className="bg-secondary mx-1"
                  style={{ height: 40, width: 23 }}
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 23 }}
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 46 }}
                />
              </div>
              {/* Mobile carousel for Music events */}
              <div className="block sm:hidden mb-8">
                <MobileCarousel events={musicEvents} />
                <div className="grid gap-6 grid-cols-1 mt-6">
                  <div className="fixed bottom-20 left-2 z-50">
                    <ContactUs inHeader={false} />
                  </div>
                  <div
                    className="rounded-lg shadow-lg flex flex-col hover:shadow-xl hover:outline hover:outline-main cursor-pointer"
                    onClick={() => setShowFeedbackModal(true)}
                  >
                    <div className="relative group overflow-hidden rounded-t-lg w-full bg-main h-60 flex items-center justify-center">
                      <MYT className="" />
                    </div>
                    <div
                      className="p-4 text-center text-main text-xl font-bold h-20"
                      dir="rtl"
                    >
                      לא מצאתם מה שחיפשתם? ספרו לנו
                    </div>
                  </div>
                </div>
              </div>
              {/* Desktop grid for Music events */}
              <div className="hidden sm:grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                {musicEvents.map((event) => (
                  <EventCard event={event} key={event.id} />
                ))}
                <div
                  className="rounded-lg shadow-lg flex flex-col hover:shadow-xl hover:outline hover:outline-main cursor-pointer"
                  onClick={() => setShowFeedbackModal(true)}
                >
                  <div className="relative group overflow-hidden rounded-t-lg w-full bg-main h-60 flex items-center justify-center">
                    <MYT className="" />
                  </div>
                  <div
                    className="p-4 text-center text-main text-xl font-bold h-20"
                    dir="rtl"
                  >
                    לא מצאתם מה שחיפשתם? ספרו לנו
                  </div>
                </div>
              </div>
            </>
          )}

          {/* VIP Section */}
          {sortedVipEvents.length > 0 && (
            <>
              <div className="flex flex-row justify-end mt-2 mb-4 lg:mb-6 items-stretch">
                <div>
                  <h2 className="text-2xl font-bold text-secondary tracking-tighter sm:text-4xl text-center mx-2">
                    וכרטיסי פרימיום VIP אירוח
                  </h2>
                </div>
                <div
                  className="bg-secondary mx-1"
                  style={{ height: 40, width: 23 }}
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 23 }}
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 46 }}
                />
              </div>
              {/* Mobile carousel for VIP events */}
              <div className="block sm:hidden mb-8">
                <UniversalCarousel events={sortedVipEvents} />
              </div>
              {/* Desktop carousel for VIP events */}
              <div className="hidden sm:block mb-8">
                <UniversalCarousel events={sortedVipEvents} />
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

function EventCard({ event }: { event: Event }) {
  const [isMounted, setIsMounted] = useState(false);
  const { isMobile } = useIsMobile();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <Link
      href={event.tags === "Sold" ? "#no-op" : `/order/${event.id}`}
      className={`${
        event.tags === "Sold" ? "cursor-default" : "cursor-pointer"
      }`}
      key={event.id}
      onClick={(e) => {
        trackEvent("eventSelected", {
          eventId: event.id,
          eventName: event.name,
          eventDate: event.date,
          eventType: event.type,
          eventLocation: event.location.name,
          eventTags: event.tags,
          eventPrice:
            event.base_flight_price +
            event.base_hotel_price +
            Math.min(...event.tickets_and_rates.map((ticket) => ticket.price)) +
            Number(process.env.NEXT_PUBLIC_MARKUP || "175"),
        });
        if (event.tags === "Sold") {
          e.preventDefault();
          return;
        }
        orderStage("EVENT_SELECTED", {
          data: {
            event: event.name,
            eventDate: event.date,
            eventLocation: event.location.name,
          },
        });
        const gtmIdnts =
          document.cookie
            .split("; ")
            .find((row) => row.startsWith("gtmIdnts="))
            ?.split("=")[1] || "";

        fetch("/api/events-info", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventData: {
              id: event.id,
              name: event.name,
              date: event.date,
              category: event.type,
              location: event.location.name,
              tags: event.tags,
            },
            gtmIdnts,
            eventType: "select_item",
          }),
        }).catch((error) => {
          console.error("Analytics tracking failed:", error);
        });
      }}
    >
      <div className="rounded-lg shadow-lg flex flex-row sm:flex-col hover:shadow-xl hover:outline hover:outline-main">
        <div
          className="relative group overflow-hidden rounded-l-lg sm:rounded-t-lg sm:rounded-b-none w-[48%] sm:w-auto"
          dir="rtl"
        >
          {event.tags === "LastTickets" && (
            <div className="absolute top-0 left-0 w-64 h-10 bg-secondary text-white font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5">
              כרטיסים אחרונים!
            </div>
          )}
          {event.tags === "Popular" && (
            <div className="absolute top-0 left-0 w-64 h-10 bg-secondary text-white font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5">
              נמכר במהירות!
            </div>
          )}
          {event.tags === "Restock" && (
            <div className="absolute top-0 left-0 w-64 h-10 bg-[#52C4A3] text-white font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5">
              חזר למלאי!
            </div>
          )}
          {event.tags === "VIP" && (
            <div className="absolute top-0 left-0 w-64 h-10 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5">
              אירוח VIP
            </div>
          )}
          {event.tags === "Sold" && (
            <div className="absolute top-0 left-0 w-64 h-10 bg-[#d63a59] text-white font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5">
              אזלו הכרטיסים
            </div>
          )}
          <Image
            src={event.card_image_url}
            alt={event.name}
            priority={true}
            width={400}
            height={300}
            className="object-cover w-full h-72 transition-transform group-hover:scale-105"
          />
        </div>
        <div className="flex flex-col text-center w-[52%] sm:w-auto">
          <div className="p-2 text-2xl font-bold" style={{ lineHeight: "1.1" }}>
            {event.name}
          </div>
          <div
            className="py-1 px-2 bg-secondary text-white flex flex-wrap justify-center items-center"
            dir="rtl"
          >
            <span>{dayjs(event.date).format("DD/MM/YYYY")}</span>
            <span className="sm:inline hidden mx-2">|</span>
            <span className="w-full sm:w-auto whitespace-nowrap">
              {event.location.name}
            </span>
          </div>
          <div className="p-2 text-ceמter flex flex-col flex-grow" dir="rtl">
            <div className="text-[15px] sm:text-base">
              מחיר חבילה ממוצע לאדם
            </div>
            <div className="flex justify-center items-baseline gap-1">
              <div className="text-2xl font-extrabold">
                $
                {(
                  event.base_flight_price +
                  event.base_hotel_price +
                  Math.min(
                    ...event.tickets_and_rates.map((ticket) => ticket.price)
                  ) +
                  Number(process.env.NEXT_PUBLIC_MARKUP || "150")
                ).toLocaleString("en-US")}
              </div>
              {/*
                <div className="text-sm text-red-500 line-through mr-1">
                  ${event.usual_price.toLocaleString("en-US")}
                </div>
              */}
            </div>
            <div className="flex-grow min-h-[4px]"></div>
            <div className="text-[14px]" style={{ lineHeight: "1.1" }}>
              לנוסע, עבור טיסה, מלון וכרטיס לאירוע (בהרכב זוגי)
            </div>
            {event.tags === "Sold" ? (
              // Empty space placeholder with same height to maintain layout
              <div
                className="my-2 py-2 flex-shrink-0"
                style={{ height: isMounted && isMobile ? "40px" : "22px" }}
              ></div>
            ) : isMounted && isMobile ? (
              <div className="bg-[#002240] text-[14px] font-bold mx-1 my-2 justify-center text-white rounded-lg px-4 py-2 flex items-center">
                הוזילו או שדרגו כאן {"  >"}
              </div>
            ) : (
              <u className="my-2 flex justify-center text-[#178189] text-[14px] font-bold">
                הוזילו או שדרגו כאן {"  >"}
              </u>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
