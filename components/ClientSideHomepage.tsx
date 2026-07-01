"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useAffiliate, orderStage } from "../app/hooks/Affiliate";
import dayjs from "dayjs";
import { useMediaQuery } from "@mantine/hooks";
import { useState, useEffect, useRef, useMemo } from "react";
import { type Event, FootballTeam, Artist } from "@/lib/app.types";
import { Combobox, Modal, useCombobox } from "@mantine/core";
import { Carousel } from "@mantine/carousel";
import { ArrowLeftIcon, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { HeroSearch } from "@/components/HeroSearch";
import { TicketOnlyBadge } from "@/components/TicketOnlyBadge";
import { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MYT } from "./ui/myt";
import { MYTMark } from "./ui/mytMark";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import Fuse from "fuse.js";
import { multiTermSearch } from "@/lib/search";
import { ContactUs } from "@/components/ui/ContactUs";
import { trackEvent } from "@/lib/mixpanel";
import { ElfsightWidget } from "@/components/ui/elfReviews";
import { computePackagePrice, isEventSoldOut } from "@/lib/events/price";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import { HeroCarousel } from "@/components/HeroCarousel";
import { TrustBadges } from "@/components/ui/TrustBadges";
import { Aurora } from "@/components/ui/Aurora";
import { EventArt } from "@/components/ui/EventArt";
import { PackageIcons } from "@/components/ui/PackageIcons";

const fuseOptions = {
  keys: ["name", "location.name", "name_english"], // Fields to search in
  threshold: 0.3, // Lower = stricter match, Higher = more flexible
  findAllMatches: true, // Finds multiple matches
  ignoreLocation: true, // Ignore where the match is found in the string
};
interface Props {
  initialEvents: Event[];
  footballTeams: FootballTeam[];
  // Full football team catalog (for collide/strip matching). `footballTeams`
  // above is only the carousel subset, so club teams like Arsenal would never
  // match without this.
  allFootballTeams?: FootballTeam[];
  artists: Artist[];
  carouselArtists?: Artist[];
}

const SearchCombobox = React.forwardRef<HTMLInputElement, {
  setSearchValue: Dispatch<SetStateAction<string>>;
  events: Event[];
  footballTeams: FootballTeam[];
  artists: Artist[];
  searchValue: string;
  inline?: boolean;
  onOpenFeedbackModal: () => void;
  mobile?: boolean;
}>(({
  searchValue,
  setSearchValue,
  events,
  footballTeams,
  artists,
  inline,
  onOpenFeedbackModal,
}, ref) => {
  const router = useRouter();
  const combobox = useCombobox();

  // Filter out sold-out events from search (both tagged as "Sold" and those with no available tickets)
  const NonSoldOutEvents4Search = useMemo(
    () => events.filter(event => !isEventSoldOut(event)),
    [events]
  );

  // Memoize Fuse instance to prevent recreation on every render
  const fuse = useMemo(() => new Fuse(NonSoldOutEvents4Search, fuseOptions), [NonSoldOutEvents4Search]);

  // Create Fuse instances for teams and artists with appropriate search fields
  const teamsFuse = useMemo(() => new Fuse(footballTeams, {
    keys: ["fields.name", "fields.nameDBenglish"],
    threshold: 0.3,
    findAllMatches: true,
    ignoreLocation: true,
    minMatchCharLength: 2, // Require at least 2 characters to match
  }), [footballTeams]);

  const artistsFuse = useMemo(() => new Fuse(artists, {
    keys: ["fields.name", "fields.nameDBenglish"],
    threshold: 0.3,
    findAllMatches: true,
    ignoreLocation: true,
    minMatchCharLength: 2, // Require at least 2 characters to match
  }), [artists]);

  const value = searchValue.toLowerCase().trim();
  
  const filteredOptions = value ? multiTermSearch(fuse, value) : events;

  const filteredTeams = value ? multiTermSearch(teamsFuse, value) : [];

  const filteredArtists = value ? multiTermSearch(artistsFuse, value) : [];

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

  // Add team options
  const teamOptions = filteredTeams.map((team) => {
    const teamName = team.fields.name;
    
    const displayText = `-- לכל המשחקים של ${teamName} לחצו כאן --`;
    
    return (
      <Combobox.Option
        value={`team-${team.sys.id}`}
        key={`team-${team.sys.id}`}
        style={{ textAlign: "right" }}
        onClick={() =>
          trackEvent("buttonClick", {
            buttonTag: "search-option-team",
            buttonName: team.fields.name || team.fields.nameDBenglish || "",
          })
        }
      >
        <span className="text-lg font-bold">{displayText}</span>
      </Combobox.Option>
    );
  });

  // Add artist options
  const artistOptions = filteredArtists.map((artist) => {
    const artistName = artist.fields.name;
    
    const displayText = `-- לכל ההופעות של ${artistName} לחצו כאן --`;
    
    return (
      <Combobox.Option
        value={`artist-${artist.sys.id}`}
        key={`artist-${artist.sys.id}`}
        style={{ textAlign: "right" }}
        onClick={() =>
          trackEvent("buttonClick", {
            buttonTag: "search-option-artist",
            buttonName: artist.fields.name || artist.fields.nameDBenglish || "",
          })
        }
      >
        <span className="text-lg font-bold">{displayText}</span>
      </Combobox.Option>
    );
  });

  return (
    <Combobox
      onOptionSubmit={(optionValue) => {
        if (optionValue === "feedback") {
          onOpenFeedbackModal();
        } else if (optionValue.startsWith("team-")) {
          // Handle team click - navigate to football team page using sys.id
          const teamId = optionValue.replace("team-", "");
          const selectedTeam = footballTeams.find((team) => team.sys.id === teamId);
          if (selectedTeam) {
            setSearchValue(selectedTeam.fields.name || selectedTeam.fields.nameDBenglish || "");
            router.push(`/football/${teamId}`);
          }
        } else if (optionValue.startsWith("artist-")) {
          // Handle artist click - navigate to artist page using sys.id
          const artistId = optionValue.replace("artist-", "");
          const selectedArtist = artists.find((artist) => artist.sys.id === artistId);
          if (selectedArtist) {
            setSearchValue(selectedArtist.fields.name || selectedArtist.fields.nameDBenglish || "");
            router.push(`/artists/${artistId}`);
          }
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
              eventPrice: computePackagePrice(selectedEvent),
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
            "w-full bg-card text-foreground border border-input",
            inline ? "rounded-r-none rounded-l-lg" : "rounded-lg",
            "p-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
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
          aria-label="חיפוש אירועים"
          aria-describedby="search-instructions"
          role="combobox"
          aria-expanded={combobox.dropdownOpened}
          aria-controls="search-dropdown"
          aria-autocomplete="list"
        />
      </Combobox.Target>
      <Combobox.Dropdown
        id="search-dropdown"
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
          {teamOptions}
          {artistOptions}
          <Combobox.Option
            value="feedback"
            style={{
              textAlign: "right",
              fontSize: "16px",
              backgroundColor: "hsl(var(--muted))",
              borderTop: "1px solid hsl(var(--border))",
              marginTop: "4px",
              paddingTop: "12px",
              paddingBottom: "12px"
            }}
          >
            לא מצאתם מה שחיפשתם? לחצו כאן ודברו איתנו
          </Combobox.Option>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
});

SearchCombobox.displayName = "SearchCombobox";

const MobileCarousel = ({ events, allEvents, artists, footballTeams }: { events: Event[]; allEvents?: Event[]; artists?: Artist[]; footballTeams?: FootballTeam[] }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || events.length === 0) {
    return null;
  }

  return (
    <Carousel
      withIndicators={false}
      withControls={events.length > 1}
      slideSize="100%"
      slideGap="16px"
      height="auto"
      align="start"
      dragFree={false}
      containScroll="trimSnaps"
      nextControlIcon={<ChevronLeft size={22} />}
      previousControlIcon={<ChevronRight size={22} />}
      classNames={{
        root: "",
        control: "data-[inactive]:!opacity-0",
        container: "py-[4px]",
        slide: "transition-transform duration-300 ease-out",
        controls: "!-left-6 !-right-6",
      }}
      styles={{
        viewport: {
          // Improve scroll performance
          willChange: "transform",
          backfaceVisibility: "hidden",
          perspective: "1000px",
        },
        container: {
          // Hardware acceleration for smoother scrolling
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        },
        control: {
          transition: "all 0.2s ease-in-out",
          width: "32px",
          height: "32px",
          minWidth: "32px",
          minHeight: "32px",
          backgroundColor: "hsl(var(--surface-inverse))",
          borderRadius: "50%",
          border: "none",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
          color: "hsl(var(--surface-inverse-foreground))",
          '&[dataInactive]': {
            opacity: 0,
            cursor: 'default',
          },
          '&:not([dataInactive]):hover': {
            backgroundColor: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
          },
        },
      }}
    >
      {events.map((event) => (
        <Carousel.Slide key={event.id}>
          <div className="transition-transform duration-300 ease-out">
            <EventCard event={event} allEvents={allEvents} artists={artists} footballTeams={footballTeams} />
          </div>
        </Carousel.Slide>
      ))}
    </Carousel>
  );
};

// Compact Event Card for Sports Section
function CompactEventCard({ event }: { event: Event }) {
  const computedSold = isEventSoldOut(event);
  const packagePrice = computePackagePrice(event);
  
  return (
    <Link
      href={computedSold ? "#no-op" : `/order/${event.id}`}
      className={`${computedSold ? "cursor-default" : "cursor-pointer"}`}
      key={event.id}
      aria-label={`${event.name} - ${event.date} ב${event.location.name}${computedSold ? " - אזלו הכרטיסים" : ""}`}
      aria-disabled={computedSold}
      onClick={(e) => {
        trackEvent("eventSelected", {
          eventId: event.id,
          eventName: event.name,
          eventDate: event.date,
          eventType: event.type,
          eventLocation: event.location.name,
          eventTags: event.tags,
          eventPrice: packagePrice,
        });
  if (computedSold) {
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
        className="rounded-2xl border border-border shadow-card hover:shadow-card-hover transition-shadow flex flex-col bg-card w-full h-full sm:w-[240px] sm:min-w-[240px] sm:max-w-[240px]"
        style={{
          height: "245px",
        }}
      >
        <div className="relative group overflow-hidden rounded-t-2xl flex-1">
          <div className="absolute top-2 right-2 z-10">
            <EventStatusBadge event={event} />
          </div>
          {event.skip_flight && event.tags !== "Sold" && (
            <TicketOnlyBadge />
          )}
          {/* Brand swoosh background behind the artist image (color + shape per event) */}
          <EventArt
            id={event.id}
            imageUrl={event.art_image_url || event.card_image_url}
            alt={`תמונת האירוע ${event.name} שמתקיים ב${event.location.name} בתאריך ${event.date}`}
            variant={event.art_image_url ? "blob" : "photo"}
            colorIndex={event.art_color_index ?? undefined}
            shapeIndex={event.art_shape_index ?? undefined}
            className="h-full w-full"
          />
        </div>
        <div className="p-3 text-center flex-shrink-0">
          {/* Accessibility: Added semantic heading for event name */}
          <h3
            className="text-sm font-bold"
            style={{ lineHeight: "1.2" }}
            title={event.name}
          >
            {event.name}
          </h3>
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
      // Mondial pages hard-redirect to an external subdomain in middleware;
      // RSC prefetch hits CORS and logs an error on every home load.
      prefetch={false}
      className="block hover:opacity-90 transition-opacity"
      key={team.sys.id}
      aria-label={`עמוד קבוצת כדורגל ${team.fields.name || "לא ידוע"}`}
    >
      <div
        className="rounded-2xl border border-border shadow-card hover:shadow-card-hover transition-shadow flex flex-col bg-card w-full h-full sm:w-[240px] sm:min-w-[240px] sm:max-w-[240px]"
        style={{
          height: "245px",
        }}
      >
        <div className="relative group overflow-hidden rounded-t-2xl flex-1">
          {/* Accessibility: Enhanced alt text with descriptive team information */}
          {team.fields.heroBanner?.fields?.file?.url && (
            <Image
              src={"https:" + team.fields.heroBanner.fields.file.url}
              alt={`לוגו של קבוצת כדורגל ${team.fields.name || "לא ידוע"} - לחצו לצפייה באירועים של הקבוצה`}
              priority={true}
              width={240}
              height={180}
              style={{
                objectPosition: 'center top' // or 'center center', '20% 30%', etc.
              }}
              className="object-cover w-full h-full transition-transform group-hover:scale-105"
            />
          )}
          {/* Dark bottom-edge gradient — grounds the image against the white name
              panel in light mode (matches the קטגוריות CategoryCard treatment). */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
        <div className="p-3 text-center flex-none">
          {/* Accessibility: Added semantic heading for team name */}
          <h3
            className="font-bold text-md text-foreground line-clamp-2 mb-1"
            style={{ lineHeight: "1.2" }}
            title={team.fields.name || ""}
          >
            {team.fields.name || ""}
          </h3>
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
      aria-label={`עמוד האומן ${artist.fields.name || "לא ידוע"}`}
    >
      <div
        className="rounded-2xl border border-border shadow-card hover:shadow-card-hover transition-shadow flex flex-col bg-card w-full h-full sm:w-[240px] sm:min-w-[240px] sm:max-w-[240px]"
        style={{
          height: "245px",
        }}
      >
        <div className="relative group overflow-hidden rounded-t-2xl flex-1">
          {/* Brand blob behind the artist cut-out (color + shape per artist),
              falling back to the flat hero photo when no blob art is set. */}
          <EventArt
            id={artist.sys.id}
            imageUrl={
              artist.fields.artImageUrl ||
              (artist.fields.heroBanner?.fields?.file?.url
                ? "https:" + artist.fields.heroBanner.fields.file.url
                : undefined)
            }
            alt={`תמונה של האומן ${artist.fields.name || "לא ידוע"} - לחצו לצפייה באירועים של האומן`}
            variant={artist.fields.artImageUrl ? "blob" : "photo"}
            colorIndex={artist.fields.artColorIndex ?? undefined}
            shapeIndex={artist.fields.artShapeIndex ?? undefined}
            priority
            className="h-full w-full"
          />
          {/* Dark bottom-edge gradient — grounds the art against the white name
              panel in light mode (matches the קטגוריות CategoryCard treatment). */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
        <div className="p-3 text-center flex-none">
          {/* Accessibility: Added semantic heading for artist name */}
          <h3
            className="font-bold text-md text-foreground line-clamp-2 mb-1"
            style={{ lineHeight: "1.2" }}
            title={artist.fields.name || ""}
          >
            {artist.fields.name || ""}
          </h3>
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const items = teams || artists || events || [];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || items.length === 0) {
    return null;
  }

  // Native horizontal scroll with RTL-aware arrows. (Mantine/Embla mis-scrolled
  // in RTL and froze, so we use plain overflow scrolling + custom controls.)
  const perView = variant === "compact" ? 5 : 4;
  const showArrows = items.length > perView;
  const scrollRow = (dir: "next" | "prev") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.8);
    // RTL: "next" reveals content to the left (negative scrollLeft).
    el.scrollBy({ left: dir === "next" ? -amount : amount, behavior: "smooth" });
  };
  const itemWidth =
    variant === "compact"
      ? "w-[44%] shrink-0 sm:w-auto"
      : "w-[85%] shrink-0 sm:w-[300px]";
  const arrowBtn =
    "absolute top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-main text-main-foreground shadow-card transition-all hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex";

  return (
    <div className="relative">
      {showArrows && (
        <>
          <button
            type="button"
            onClick={() => scrollRow("next")}
            aria-label="הבא"
            className={cn(arrowBtn, "left-0")}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scrollRow("prev")}
            aria-label="הקודם"
            className={cn(arrowBtn, "right-0")}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </>
      )}
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory scroll-smooth gap-4 overflow-x-auto pb-2 [scrollbar-width:none] sm:gap-6"
      >
        {items.map((item) => {
          let key: string;
          if (teams) {
            key = (item as FootballTeam).sys.id;
          } else if (artists) {
            key = (item as Artist).sys.id;
          } else {
            key = (item as Event).id.toString();
          }

          return (
            <div key={key} className={cn("snap-start", itemWidth)}>
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
          );
        })}
      </div>
    </div>
  );
};

export function ClientSideHomepage({ initialEvents, footballTeams, allFootballTeams, artists, carouselArtists }: Props) {
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
  // Mobile shows 5 events up-front; desktop bumps to 20 on mount (below).
  const [visibleMusicCount, setVisibleMusicCount] = useState(5);

  useEffect(() => {
    setIsMounted(true);
    // Scroll to top when component mounts (page load/navigation)
    window.scrollTo(0, 0);
  }, []);

  // Desktop starts with a fuller grid (20); mobile keeps the compact 5.
  useEffect(() => {
    if (window.innerWidth >= 640) setVisibleMusicCount((c) => (c < 20 ? 20 : c));
  }, []);

  const handleSearchModalOpen = () => {
    setShowSearchModal(true);
    setTimeout(() => {
      mobileComboboxRef.current?.focus();
    }, 100);
  };

  // The header's search button dispatches myt:open-search; HeroSearch (the
  // single search experience) listens and takes focus.

  const handleSearchPromptClick = () => {
    // On mobile, just open the search modal directly
    if (!matches) {
      handleSearchModalOpen();
    } else {
      // On desktop: scroll to top, focus search, and highlight it
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      setTimeout(() => {
        // Find the search input - it's inside the SearchCombobox component
        const searchInput = document.querySelector('[role="combobox"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select(); // Highlight the text if any
          
          // Add a temporary highlight effect to the parent container
          const searchContainer = searchInput.closest('form') as HTMLElement;
          if (searchContainer) {
            searchContainer.style.transition = 'box-shadow 0.3s ease-in-out';
            searchContainer.style.boxShadow = '0 0 0 4px rgba(255, 193, 7, 0.6)';
            searchContainer.style.borderRadius = '0.375rem';
            
            // Remove highlight after 1 second
            setTimeout(() => {
              searchContainer.style.boxShadow = '';
            }, 1000);
          }
        }
      }, 500); // Wait for scroll to complete
    }
  };

  const handleSearchModalClose = () => {
    setShowSearchModal(false);
    // Return focus to the trigger button when modal closes
    setTimeout(() => {
      const searchButton = document.querySelector('[aria-label="התחל לחפש אירועים"]') as HTMLElement;
      searchButton?.focus();
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

  // The slide-in Header owns the search once the user scrolls, so the hero
  // search no longer needs to re-stick to the top (avoids a double search bar).
  useEffect(() => {
    setIsSticky(false);
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

  // Prevent hydration mismatches by showing a loading state instead of null
  if (!isMounted) {
    return (
      <div style={{ minHeight: '60vh' }}>
        {/* Basic layout structure to prevent content jump */}
        <section className="bg-main relative overflow-hidden">
          <div className="container mx-auto flex flex-col lg:flex-row items-center justify-between py-12 px-4 md:px-8 min-h-[400px]">
            <div className="w-full h-full flex items-center justify-center">
              <div className="animate-pulse bg-main-foreground/20 h-8 w-64 rounded"></div>
            </div>
          </div>
        </section>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-6 bg-muted rounded w-48"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-64 bg-muted rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Separate VIP events
  // const vipEvents = initialEvents.filter((event) => event.tags === "VIP");

  // Collapse events that have a dedicated page (artist OR football team) down to
  // a single representative card, so the homepage shows one card + "see all"
  // strip per artist/team. Football collapses by HOME team — home games only.
  const filterEventsFromArtistsWithPages = (events: Event[]) => {
    const hasArtistPages = !!artists && artists.length > 0;
    const teamsForGrouping = allFootballTeams && allFootballTeams.length > 0 ? allFootballTeams : [];
    if (!hasArtistPages && teamsForGrouping.length === 0) return events;

    // Build list of artist identifiers that have pages
    const artistIdentifiersWithPages = new Set(
      (artists ?? [])
        .map(artist => artist.fields.nameDBenglish)
        .filter(Boolean)
        .map(name => normalizeName(name)) // Trim + lowercase
    );

    // Best representative for a collapsed group (prefer a real tag, then earliest date)
    const pickRepresentative = (groupEvents: Event[]) =>
      [...groupEvents].sort((a, b) => {
        const aHasTag = a.tags && a.tags !== "Sold";
        const bHasTag = b.tags && b.tags !== "Sold";
        if (aHasTag && !bHasTag) return -1;
        if (!aHasTag && bHasTag) return 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      })[0];

    // 1) Group by artist (exact english-name match)
    const eventsByArtist = new Map<string, Event[]>();
    const afterArtistGrouping: Event[] = [];

    events.forEach(event => {
      if (isEventSoldOut(event)) return; // Skip sold-out events entirely

      const eventArtistName = normalizeName(event.name_english);
      if (eventArtistName && artistIdentifiersWithPages.has(eventArtistName)) {
        if (!eventsByArtist.has(eventArtistName)) eventsByArtist.set(eventArtistName, []);
        eventsByArtist.get(eventArtistName)!.push(event);
      } else {
        afterArtistGrouping.push(event);
      }
    });

    // 2) Group the rest by football HOME team (away games are left as-is)
    const eventsByTeam = new Map<string, Event[]>();
    const nonGroupedEvents: Event[] = [];

    afterArtistGrouping.forEach(event => {
      const team = findEventHomeTeam(event, teamsForGrouping);
      if (team) {
        const key = team.sys.id;
        if (!eventsByTeam.has(key)) eventsByTeam.set(key, []);
        eventsByTeam.get(key)!.push(event);
      } else {
        nonGroupedEvents.push(event);
      }
    });

    const collapsedArtistEvents = [...eventsByArtist.values()].map(pickRepresentative);
    const collapsedTeamEvents = [...eventsByTeam.values()].map(pickRepresentative);

    return [...nonGroupedEvents, ...collapsedArtistEvents, ...collapsedTeamEvents];
  };

  // Get prioritized events for "המבוקשים ביותר" section (including VIP if prioritized)
  const prioritized_events = (() => {
    // Filter out sold-out events from the start
    const availableEvents = initialEvents.filter(event => !isEventSoldOut(event));
    
    const prioritizedEvents = availableEvents.filter(
      (event) => event.is_prioritized === true
    );
    const nonPrioritizedEvents = availableEvents.filter(
      (event) =>
        event.is_prioritized === false &&
        event.tags !== "VIPevent" &&
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
      // Filter out duplicate events for artists with pages before using them to fill slots
      const filteredNonPrioritizedEvents = filterEventsFromArtistsWithPages(nonPrioritizedEvents);
      
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

  // Get music events (only music types, excluding VIPevent and already used prioritized events)
  const musicEvents = (() => {
    const usedEventIds = new Set(prioritized_events.map((event) => event.id));
    const remainingEvents = initialEvents.filter(
      (event) =>
        !isEventSoldOut(event) && // Exclude sold-out events
        (event.type === 'music_live_event_dynamic' || event.type === "music_event" || (event.type === "tx_event" && !event.name.startsWith("מונדיאל 2026"))) &&
        event.tags !== "VIPevent" &&
        !usedEventIds.has(event.id)
    );

    // Filter out duplicate events for artists with pages (keeping only one per artist)
    const filteredEvents = filterEventsFromArtistsWithPages(remainingEvents);

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
  //const sortedVipEvents = vipEvents.sort((a, b) => {
  //  return new Date(a.date).getTime() - new Date(b.date).getTime();
  //});

  return (
    <>
      {/* Accessibility: Live region for dynamic content announcements */}
      <div 
        id="live-region" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
        role="status"
      ></div>
      
      {/* Accessibility: Enhanced skip link for keyboard navigation */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground p-3 rounded-lg z-50 font-bold">
        דלג לתוכן הראשי
      </a>
      {!matches && (
        <Modal
          closeButtonProps={{
            icon: <ArrowLeftIcon />,
            style: { position: "absolute", left: "1rem", top: "1rem", zIndex: 100 },
            "aria-label": "סגור את חלון החיפוש וחזור לעמוד הראשי"
          }}
          opened={showSearchModal}
          fullScreen
          onClose={handleSearchModalClose}
          title={
            <div className="flex flex-col items-center justify-center w-full py-3 bg-main">
              <div className="w-[180px] mb-2">
                <MYT className="text-main-foreground" />
              </div>
              <h2 className="text-white text-2xl font-bold">חיפוש אירועים</h2>
            </div>
          }
          aria-labelledby="search-modal-title"
          aria-describedby="search-modal-description"
          styles={{
            header: {
              backgroundColor: "hsl(var(--surface-inverse))",
              padding: 0,
              marginBottom: "1rem",
              position: "relative",
            },
            title: {
              width: "100%",
              textAlign: "center",
              paddingLeft: "3.5rem", // Compensate for close button (1rem left + ~2.5rem button width)
              paddingRight: "3.5rem", // Equal padding on right to truly center
            },
            body: {
              paddingTop: "0.5rem",
            }
          }}
          // Accessibility: Enhanced modal with proper focus management
          trapFocus
          returnFocus
        >
          {/* Accessibility: Screen reader instructions for search functionality */}
          <div id="search-modal-description" className="sr-only">
            השתמש בשדה החיפוש למציאת אירועים לפי שם, מיקום או תאריך. הקלד לפחות 2 תווים כדי לראות הצעות.
          </div>
          <SearchCombobox
            ref={mobileComboboxRef}
            events={initialEvents}
            footballTeams={footballTeams}
            artists={artists}
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            onOpenFeedbackModal={() => {
              setfeedbackInSearchModal(true);
              setShowFeedbackModal(true);
            }}
            mobile={true}
          />
          <div id="search-instructions" className="sr-only">
            הקלד לפחות 2 תווים כדי לראות הצעות חיפוש. השתמש בחצי למעלה ולמטה לניווט ובאנטר לבחירה.
          </div>
        </Modal>
      )}
      <Modal
        opened={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        title="ספרו לנו לאן תרצו לטוס"
        dir="rtl"
        // Accessibility: Enhanced feedback modal with proper focus management
        trapFocus
        returnFocus
        aria-labelledby="feedback-modal-title"
        aria-describedby="feedback-modal-description"
      >
        {/* Accessibility: Screen reader description for feedback modal */}
        <div id="feedback-modal-description" className="sr-only">
          טופס בקשה לאירועים נוספים. מלא את הפרטים והגש בקשה.
        </div>
        {showSuccessMessage ? (
          <div className="text-center" role="status" aria-live="polite">
            <h2 className="text-2xl font-bold mb-4">תודה על שיתוף הפעולה!</h2>
            <p>האירוע נשלח בהצלחה.</p>
          </div>
        ) : (
          /* Accessibility: Enhanced form with proper fieldset, legend, and form validation */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              if (form.checkValidity()) {
                handleMoreEventsSubmit(e);
                setShowSuccessMessage(true);
              }
            }}
            noValidate
          >
            <fieldset className="border border-border rounded-lg p-4 mb-4">
              <legend className="px-2 font-bold text-lg">פרטי הבקשה</legend>
              <div className="mb-4">
                <label
                  className="block text-foreground text-sm font-bold mb-2"
                  htmlFor="event"
                >
                  מה שם האומן/משחק והאם יש העדפה למקום? <span className="text-destructive" aria-label="שדה חובה">*</span>
                </label>
                <input
                  id="event"
                  name="event"
                  type="text"
                  required
                  aria-required="true"
                  aria-describedby="event-help"
                  className="appearance-none border border-input bg-card rounded-lg w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="ביונסה בפריז"
                />
                <div id="event-help" className="text-xs text-muted-foreground mt-1">
                  לדוגמה: שם האומן או שם הקבוצה והעיר המועדפת
                </div>
              </div>
              <div className="mb-4">
                <label
                  className="block text-foreground text-sm font-bold mb-2"
                  htmlFor="email"
                >
                  שנחזור אליכם עם הצעה? <span className="text-destructive" aria-label="שדה חובה">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="text"
                  required
                  aria-required="true"
                  aria-describedby="email-help"
                  className="appearance-none border border-input bg-card rounded-lg w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="טלפון או אימייל"
                />
                <div id="email-help" className="text-xs text-muted-foreground mt-1">
                  מספר טלפון או כתובת אימייל ליצירת קשר
                </div>
              </div>
            </fieldset>
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="שלח בקשה להצעת מחיר לאירוע"
            >
              שלח בקשה
            </button>
          </form>
        )}
      </Modal>
      <section className="w-full flex min-h-[92dvh] flex-col justify-center gap-3 py-8 md:py-10 px-4 md:px-6 text-white bg-main relative overflow-hidden" role="banner">
        <Aurora intensity={0.5} />
        {/* Soft ambient fill across the mid-hero so the Aurora-lit top and the
            carousel glow below read as one continuous wash (no dark mid-band). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(70% 55% at 50% 46%, hsl(160 55% 28% / 0.32), transparent 72%)",
          }}
        />
        {/* Logo centered at the hero top (per Figma); visible while the header is hidden */}
        <div className="container relative z-20 mx-auto mb-4 md:mb-5 flex justify-center">
          <Link href="/" aria-label="MegaEvents — דף הבית">
            <MYT className="h-9 w-auto text-main-foreground md:h-11" />
          </Link>
        </div>
        <div className="container relative z-10 mx-auto max-w-3xl text-center">
          {/* Accessibility: Proper main heading hierarchy */}
          <h1 className="font-display text-2xl font-bold sm:text-3xl md:text-4xl mb-2 lg:mb-3">
            {/* Mobile: האירועים first, then במקום */}
            <span className="inline-block whitespace-nowrap md:hidden">האירועים הכי שווים בעולם</span>
            <span className="text-secondary whitespace-nowrap text-3xl md:hidden">
              {" "}
              במקום אחד
            </span>
            {/* Desktop: במקום first, then האירועים */}
            <span className="text-secondary whitespace-nowrap text-4xl hidden md:inline-block">
              במקום אחד
            </span>
            {" "}
            <span className="inline-block whitespace-nowrap hidden md:inline-block">האירועים הכי שווים בעולם</span>
            <span className="block mt-1.5 text-xl sm:text-2xl md:text-3xl">
              בחרו, הרכיבו וטוסו ליהנות{" "}
            </span>
          </h1>
        </div>
        {/* The single search experience — assembles a package live as you type */}
        <div className="relative z-20 mt-6 md:mt-7">
          <HeroSearch events={initialEvents} artists={artists} />
        </div>
        {/* Trust row — sits under the gallery, per Dor's layout note */}
        <TrustBadges className="relative z-10 mt-3 md:mt-8 justify-center text-main-foreground/80" />
        {/* Hero gallery — tilted colorful cards linking to artist pages */}
        <div className="relative z-10 mt-1 sm:mt-2">
          <HeroCarousel artists={carouselArtists ?? artists} />
        </div>
      </section>

      <section className="w-full py-10 lg:py-14 bg-background px-4 md:px-6" role="main">
        <div className="container mx-auto">
          {/* Mobile trust bar removed — the hero already carries the trust row. */}
          <div className="hidden" aria-hidden>
            <section>
              <h2 className="sr-only">היתרונות שלנו</h2>
              <div
                className="flex justify-around items-center text-right container mb-4"
                dir="rtl"
                role="list"
                aria-label="רשימת היתרונות והאחריות שלנו"
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
                          aria-hidden="true"
                        >
                          <path
                            d="M32.6768 4.03516C33.047 4.03522 33.3457 4.32524 33.3457 4.68945V10.9434C33.3456 11.8852 33.0311 12.7547 32.4863 13.4561V29.0029C32.4863 30.6431 31.1174 31.9648 29.4375 31.9648H6.56445C4.88458 31.9648 3.51562 30.6431 3.51562 29.0029V13.4561C2.98141 12.7559 2.65536 11.8866 2.65527 10.9434V4.68945C2.65527 4.32335 2.9673 4.03516 3.3252 4.03516H32.6768ZM25.3389 13.1885C24.5721 14.3701 23.2178 15.1533 21.6699 15.1533C20.131 15.1533 18.7763 14.3699 18.001 13.1885C17.2342 14.3701 15.8799 15.1532 14.332 15.1533C12.7931 15.1533 11.4384 14.3699 10.6631 13.1885C9.8963 14.3701 8.54204 15.1532 6.99414 15.1533C6.21927 15.1533 5.48793 14.9533 4.85352 14.6045V29.0029C4.85352 29.9117 5.62326 30.6572 6.56445 30.6572H29.4375C30.3886 30.6572 31.1475 29.9123 31.1475 29.0029V14.6064C30.5207 14.9542 29.7898 15.1533 29.0078 15.1533C27.4689 15.1533 26.1142 14.3699 25.3389 13.1885ZM3.99414 10.9434C3.99435 12.5425 5.34031 13.8467 6.99414 13.8467C8.65802 13.8465 9.99296 12.5427 9.99316 10.9434V5.34277H3.99414V10.9434ZM11.332 10.9434C11.3322 12.5425 12.6782 13.8467 14.332 13.8467C15.9959 13.8466 17.3308 12.5428 17.3311 10.9434V5.34277H11.332V10.9434ZM18.6699 10.9434C18.6701 12.5425 20.0161 13.8467 21.6699 13.8467C23.3338 13.8466 24.6687 12.5428 24.6689 10.9434V5.34277H18.6699V10.9434ZM26.0078 10.9434C26.008 12.5425 27.354 13.8467 29.0078 13.8467C30.6717 13.8466 32.0066 12.5428 32.0068 10.9434V5.34277H26.0078V10.9434Z"
                            fill="#5BFF95"
                            stroke="#5BFF95"
                            strokeWidth="0.290446"
                          />
                          <path
                            d="M17.5413 17.4809C17.6862 17.0349 18.3172 17.0349 18.4621 17.4809L19.4145 20.4123C19.4793 20.6118 19.6652 20.7468 19.8749 20.7468H22.9572C23.4262 20.7468 23.6211 21.3469 23.2418 21.6225L20.7481 23.4342C20.5785 23.5575 20.5075 23.776 20.5723 23.9754L21.5248 26.9069C21.6697 27.3529 21.1592 27.7237 20.7798 27.4481L18.2862 25.6364C18.1165 25.5131 17.8868 25.5131 17.7171 25.6364L15.2235 27.4481C14.8441 27.7237 14.3337 27.3529 14.4786 26.9069L15.4311 23.9754C15.4959 23.776 15.4249 23.5575 15.2552 23.4342L12.7616 21.6225C12.3822 21.3469 12.5772 20.7468 13.0461 20.7468H16.1284C16.3381 20.7468 16.524 20.6118 16.5888 20.4123L17.5413 17.4809Z"
                            fill="#5BFF95"
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
                            aria-label="חפש ביקורות של מגה תיירות בגוגל - נפתח בחלון חדש"
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
                          fill="#5BFF95"
                          stroke="#5BFF95"
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
                        aria-hidden="true"
                      >
                        <path
                          d="M31.8005 34.829V31.2806C31.7983 30.2139 31.3846 29.1893 30.6455 28.4201C29.9064 27.651 28.8989 27.1968 27.8332 27.1522C28.439 26.4702 28.8347 25.6277 28.9728 24.726C29.111 23.8243 28.9856 22.9019 28.6117 22.0699C28.2379 21.2378 27.6315 20.5315 26.8657 20.036C26.0998 19.5405 25.207 19.2769 24.2949 19.2769C23.3827 19.2769 22.4899 19.5405 21.724 20.036C20.9582 20.5315 20.3518 21.2378 19.978 22.0699C19.6042 22.9019 19.4787 23.8243 19.6169 24.726C19.755 25.6277 20.1507 26.4702 20.7565 27.1522C19.6845 27.1972 18.6725 27.6598 17.9371 28.4411C17.2166 27.7195 16.2691 27.2685 15.2547 27.1643C15.8641 26.4835 16.2634 25.6408 16.4043 24.738C16.5453 23.8352 16.4219 22.9109 16.049 22.0767C15.6761 21.2425 15.0697 20.5341 14.303 20.037C13.5363 19.5399 12.6421 19.2754 11.7284 19.2754C10.8147 19.2754 9.92048 19.5399 9.15379 20.037C8.3871 20.5341 7.78071 21.2425 7.40784 22.0767C7.03496 22.9109 6.91155 23.8352 7.0525 24.738C7.19345 25.6408 7.59274 26.4835 8.20215 27.1643C7.11039 27.275 6.09857 27.787 5.36266 28.601C4.62675 29.4151 4.21913 30.4732 4.21875 31.5706V34.829C4.21875 35.0427 4.30362 35.2476 4.45469 35.3986C4.60576 35.5497 4.81065 35.6346 5.02429 35.6346H30.9949C31.2086 35.6346 31.4135 35.5497 31.5646 35.3986C31.7156 35.2476 31.8005 35.0427 31.8005 34.829ZM24.2928 20.9052C24.9102 20.9052 25.5137 21.0883 26.027 21.4313C26.5404 21.7743 26.9405 22.2618 27.1767 22.8322C27.413 23.4026 27.4748 24.0302 27.3543 24.6357C27.2339 25.2412 26.9366 25.7974 26.5001 26.2339C26.0635 26.6705 25.5073 26.9678 24.9018 27.0882C24.2963 27.2087 23.6687 27.1468 23.0983 26.9106C22.5279 26.6743 22.0404 26.2742 21.6974 25.7609C21.3544 25.2476 21.1714 24.6441 21.1714 24.0267C21.1714 23.1989 21.5002 22.4049 22.0856 21.8195C22.671 21.2341 23.465 20.9052 24.2928 20.9052ZM11.7103 20.9052C12.3278 20.9044 12.9317 21.0868 13.4456 21.4294C13.9594 21.7719 14.3601 22.2591 14.597 22.8294C14.8339 23.3997 14.8963 24.0274 14.7763 24.6332C14.6563 25.239 14.3593 25.7956 13.923 26.2325C13.4866 26.6695 12.9304 26.9671 12.3248 27.0879C11.7191 27.2087 11.0913 27.1471 10.5207 26.911C9.9501 26.6748 9.46235 26.2747 9.11918 25.7613C8.77601 25.2479 8.59284 24.6443 8.59284 24.0267C8.5939 23.1999 8.92256 22.4071 9.50685 21.8221C10.0911 21.2371 10.8834 20.9074 11.7103 20.9052ZM17.5988 34.0235H5.81372V31.5746C5.81372 30.8269 6.11076 30.1098 6.6395 29.581C7.16824 29.0523 7.88537 28.7552 8.63312 28.7552H14.7794C15.5271 28.7552 16.2443 29.0523 16.773 29.581C17.3018 30.1098 17.5988 30.8269 17.5988 31.5746V34.0235ZM30.1975 34.0235H19.2099V31.5746C19.2096 30.975 19.0877 30.3817 18.8514 29.8306C19.0836 29.499 19.3922 29.2282 19.7511 29.041C20.11 28.8538 20.5088 28.7558 20.9136 28.7552H27.6681C28.3375 28.7563 28.9792 29.0227 29.4526 29.4961C29.926 29.9695 30.1924 30.6112 30.1934 31.2806L30.1975 34.0235Z"
                          fill="#5BFF95"
                        />
                        <path
                          d="M17.5833 1.64705C17.7144 1.24375 18.285 1.24375 18.416 1.64705L19.2773 4.29798C19.3359 4.47835 19.504 4.60046 19.6937 4.60046H22.481C22.9051 4.60046 23.0814 5.14311 22.7383 5.39237L20.4833 7.03073C20.3299 7.1422 20.2657 7.33979 20.3243 7.52015L21.1856 10.1711C21.3167 10.5744 20.8551 10.9098 20.512 10.6605L18.257 9.02214C18.1035 8.91067 17.8958 8.91067 17.7424 9.02214L15.4873 10.6605C15.1443 10.9098 14.6827 10.5744 14.8137 10.1711L15.675 7.52015C15.7337 7.33979 15.6695 7.1422 15.516 7.03073L13.261 5.39237C12.9179 5.14311 13.0943 4.60046 13.5183 4.60046H16.3057C16.4953 4.60046 16.6634 4.47835 16.7383 4.29798L17.5833 1.64705Z"
                          fill="#5BFF95"
                        />
                        <path
                          d="M27.9544 6.36141C28.0855 5.9581 28.656 5.9581 28.7871 6.36141L29.6484 9.01234C29.707 9.1927 29.8751 9.31482 30.0648 9.31482H32.8521C33.2762 9.31482 33.4525 9.85747 33.1094 10.1067L30.8544 11.7451C30.701 11.8566 30.6368 12.0541 30.6954 12.2345L31.5567 14.8854C31.6878 15.2887 31.2262 15.6241 30.8831 15.3749L28.6281 13.7365C28.4746 13.625 28.2669 13.625 28.1135 13.7365L25.8584 15.3749C25.5154 15.6241 25.0538 15.2887 25.1848 14.8854L26.0461 12.2345C26.1047 12.0541 26.0405 11.8566 25.8871 11.7451L23.6321 10.1067C23.289 9.85746 23.4653 9.31482 23.8894 9.31482H26.6768C26.8664 9.31482 27.0345 9.1927 27.0931 9.01234L27.9544 6.36141Z"
                          fill="#5BFF95"
                        />
                        <path
                          d="M7.21224 6.36141C7.34328 5.9581 7.91386 5.9581 8.0449 6.36141L8.90624 9.01234C8.96484 9.1927 9.13292 9.31482 9.32257 9.31482H12.1099C12.534 9.31482 12.7103 9.85747 12.3672 10.1067L10.1122 11.7451C9.95878 11.8566 9.89458 12.0541 9.95319 12.2345L10.8145 14.8854C10.9456 15.2887 10.484 15.6241 10.1409 15.3749L7.88588 13.7365C7.73245 13.625 7.52469 13.625 7.37127 13.7365L5.11625 15.3749C4.77318 15.6241 4.31157 15.2887 4.44262 14.8854L5.30396 12.2345C5.36256 12.0541 5.29836 11.8566 5.14493 11.7451L2.88992 10.1067C2.54684 9.85746 2.72316 9.31482 3.14723 9.31482H5.93457C6.12422 9.31482 6.2923 9.1927 6.3509 9.01234L7.21224 6.36141Z"
                          fill="#5BFF95"
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
                    role="listitem"
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
            </section>
          </div>
          {/* Accessibility: Enhanced section headings with proper hierarchy */}
          <div className="flex flex-row mb-4 lg:mb-6 justify-start items-stretch">
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
            <div>
              <h2 className="font-display text-2xl font-extrabold text-foreground tracking-tight sm:text-4xl text-center mx-2">
                המבוקשים ביותר
              </h2>
            </div>
          </div>
          {/* Accessibility: Enhanced prioritized events section with semantic structure */}
          <section aria-labelledby="prioritized-events-heading">
            <div id="prioritized-events-heading" className="sr-only">
              <h2>המבוקשים ביותר</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8" 
                 role="list" 
                 aria-label="רשימת האירועים המבוקשים ביותר">
              {prioritized_events.map((event) => (
                <div key={event.id} role="listitem">
                  <EventCard event={event} allEvents={initialEvents} artists={artists} footballTeams={allFootballTeams} />
                </div>
              ))}
            </div>
          </section>
          {/* Elfsight Google reviews. Renders near-black text in the light DOM
              (no iframe/shadow); in dark mode we recolor it via the
              `.dark .es-embed-root` rules in globals.css so it blends into the
              dark page instead of sitting on a forced white island. */}
          <div>
            <ElfsightWidget
              widgetId="58ddc878-9ffa-4f89-b892-04ed7ec54eb7"
              lazy="first-activity"
            />
          </div>

          {/* Sports Section */}
          {footballTeams && footballTeams.length > 0 && (
            <section aria-labelledby="football-section-heading">
              <div className="flex flex-row justify-start mt-2 mb-4 lg:mb-6 items-stretch">
                <div
                  className="bg-secondary mx-1"
                  style={{ height: 40, width: 23 }}
                  aria-hidden="true"
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 23 }}
                  aria-hidden="true"
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 46 }}
                  aria-hidden="true"
                />
                <div>
                  <h2 id="football-section-heading" className="font-display text-2xl font-extrabold text-foreground tracking-tight sm:text-4xl text-center mx-2">
                    כדורגל
                  </h2>
                </div>
              </div>
              {/* Mobile carousel for Sports events */}
              <div className="block sm:hidden mb-8">
                <UniversalCarousel teams={footballTeams} variant="compact" />
              </div>
              {/* Desktop carousel for Sports events */}
              <div className="hidden sm:block mb-8">
                <UniversalCarousel teams={footballTeams} variant="compact" />
              </div>
            </section>
          )}

          {/* Artists Section */}
          {carouselArtists && carouselArtists.length > 0 && (
            <section aria-labelledby="artists-section-heading">
              <div className="flex flex-row justify-start mt-2 mb-4 lg:mb-6 items-stretch">
                <div
                  className="bg-secondary mx-1"
                  style={{ height: 40, width: 23 }}
                  aria-hidden="true"
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 23 }}
                  aria-hidden="true"
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 46 }}
                  aria-hidden="true"
                />
                <div>
                  <h2 id="artists-section-heading" className="font-display text-2xl font-extrabold text-foreground tracking-tight sm:text-4xl text-center mx-2">
                    אמנים מובילים
                  </h2>
                </div>
              </div>
              {/* Mobile carousel for Artists */}
              <div className="block sm:hidden mb-8">
                <UniversalCarousel artists={carouselArtists} variant="compact" />
              </div>
              {/* Desktop carousel for Artists */}
              <div className="hidden sm:block mb-8">
                <UniversalCarousel artists={carouselArtists} variant="compact" />
              </div>
            </section>
          )}

          {/* Music Section (renamed from "האירועים שלנו") */}
          {musicEvents.length > 0 && (
            <section aria-labelledby="music-events-heading">
              {/* Cube to the right of the heading (RTL: first child = right) */}
              <div className="flex flex-row justify-start mt-2 mb-4 lg:mb-6 items-stretch">
                <div
                  className="bg-secondary mx-1"
                  style={{ height: 40, width: 23 }}
                  aria-hidden="true"
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 23 }}
                  aria-hidden="true"
                />
                <div
                  className="bg-secondary mx-1 hidden sm:block"
                  style={{ height: 40, width: 46 }}
                  aria-hidden="true"
                />
                <div>
                  <h2 id="music-events-heading" className="font-display text-2xl font-extrabold text-foreground tracking-tight sm:text-4xl text-center mx-2">
                    הופעות נוספות
                  </h2>
                </div>
              </div>
              {/* Stacked list — one column on mobile, grid on desktop. Minimal
                  no-image cards (same as the search page). No carousel. */}
              <div className="grid gap-4 grid-cols-1 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8"
                   role="list"
                   aria-label="רשימת הופעות נוספות">
                {musicEvents.slice(0, visibleMusicCount).map((event) => (
                  <div key={event.id} role="listitem">
                    <EventCard event={event} allEvents={initialEvents} artists={artists} footballTeams={allFootballTeams} />
                  </div>
                ))}
                {/* Search-prompt card — smaller, same design, appended at the end */}
                <div
                  className="rounded-lg shadow-lg flex flex-col hover:shadow-xl hover:outline hover:outline-main dark:hover:outline-foreground/40 cursor-pointer"
                  onClick={handleSearchPromptClick}
                  role="button"
                  tabIndex={0}
                  aria-label="פתח חיפוש אירועים"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSearchPromptClick();
                    }
                  }}
                >
                  {/* Animated brand card — same breathe glow + sheen sweep +
                      wordmark⇄mark morph as the hero carousel's logo card. */}
                  <div className="relative group overflow-hidden rounded-t-lg w-full bg-main h-40 flex items-center justify-center">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(160_84%_39%/0.45),transparent_70%)] blur-2xl motion-safe:animate-[logo-breathe_6s_ease-in-out_infinite]"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 -left-1/2 -right-1/2 motion-reduce:hidden"
                    >
                      <span className="block h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-md motion-safe:animate-[logo-sheen_4.5s_ease-in-out_infinite]" />
                    </span>
                    <div className="relative grid place-items-center">
                      <MYT className="col-start-1 row-start-1 w-28 text-main-foreground sm:w-32 motion-safe:animate-[logo-swap_7s_ease-in-out_infinite]" />
                      <MYTMark className="col-start-1 row-start-1 w-14 text-main-foreground opacity-0 motion-safe:animate-[logo-swap_7s_ease-in-out_infinite] motion-safe:[animation-delay:-3.5s]" />
                    </div>
                  </div>
                  <div
                    className="p-4 text-center text-main dark:text-foreground text-sm font-bold flex items-center justify-center min-h-[56px]"
                    dir="rtl"
                  >
                    לא מצאתם מה שחיפשתם? לחצו כאן לחיפוש בכל האירועים
                  </div>
                </div>
              </div>
              {/* Floating contact button — mobile only (was nested in the old carousel) */}
              <div
                className="fixed left-3 z-50 sm:hidden"
                style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
              >
                <ContactUs inHeader={false} />
              </div>
              {visibleMusicCount < musicEvents.length && (
                <div className="flex justify-center mb-8">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleMusicCount(
                        (c) => c + (typeof window !== "undefined" && window.innerWidth >= 640 ? 20 : 5)
                      )
                    }
                    className="px-8 py-3 rounded-lg border-2 border-main text-main dark:border-foreground/60 dark:text-foreground font-bold hover:bg-main hover:text-main-foreground dark:hover:bg-foreground dark:hover:text-background transition-colors"
                    dir="rtl"
                  >
                    הצג עוד אירועים
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </section>
    </>
  );
}

// Normalize a name for case/whitespace-insensitive comparison.
const normalizeName = (s?: string | null) => (s ?? "").trim().toLowerCase();

// Escape a string for safe use inside a RegExp.
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whole-word match of `id` inside the already-normalized `haystack`. Returns the
// RegExp match (with `.index`) or null. Prevents "Milan" matching "Milano".
const wholeWordMatch = (haystack: string, id: string) =>
  id ? haystack.match(new RegExp(`(^|[^a-z0-9])${escapeRegExp(id)}([^a-z0-9]|$)`, "i")) : null;

// Identify the HOME team of a fixture. Football collide is home-only: "Arsenal"
// collects a match only when Arsenal hosts it ("Arsenal FC vs X"), never its away
// games ("X vs Arsenal"). The home team is the side named to the LEFT of the
// "vs"/"-" separator; we take the rightmost match within that side so competition
// prefixes like "Champions League: Arsenal vs ..." still resolve to Arsenal.
const findEventHomeTeam = (event: Event, teams?: FootballTeam[]): FootballTeam | null => {
  if (!teams || teams.length === 0) return null;
  const full = normalizeName(event.name_english) || normalizeName(event.name);
  if (!full) return null;
  const sep = full.match(/\s(?:vs\.?|v\.?|[-–—])\s/i);
  const homeSide = sep && sep.index !== undefined ? full.slice(0, sep.index) : full;
  let best: FootballTeam | null = null;
  let bestIndex = -1;
  for (const team of teams) {
    const match = wholeWordMatch(homeSide, normalizeName(team.fields.nameDBenglish));
    if (match && match.index !== undefined && match.index > bestIndex) {
      bestIndex = match.index;
      best = team;
    }
  }
  return best;
};

function EventCard({ event, allEvents, artists, footballTeams }: { event: Event; allEvents?: Event[]; artists?: Artist[]; footballTeams?: FootballTeam[] }) {
  const [isMounted, setIsMounted] = useState(false);
  const { isMobile } = useIsMobile();
  const computedSold = isEventSoldOut(event);
  const packagePrice = computePackagePrice(event);
  const router = useRouter();

  // Match a dedicated ARTIST page by exact english name.
  const matchingArtist = useMemo(() => {
    if (!artists || !event.name_english) return null;
    const eventIdentifier = normalizeName(event.name_english);
    return artists.find(artist => normalizeName(artist.fields.nameDBenglish) === eventIdentifier) ?? null;
  }, [event, artists]);

  // If it's not an artist, match a FOOTBALL TEAM page by HOME team (home games only).
  const matchingTeam = useMemo(() => {
    if (matchingArtist) return null;
    return findEventHomeTeam(event, footballTeams);
  }, [event, footballTeams, matchingArtist]);

  // Unified "see all events" target — artist page or football team page.
  const collideTarget = useMemo(() => {
    if (matchingArtist) {
      return { kind: "artist" as const, id: matchingArtist.sys.id, href: `/artists/${matchingArtist.sys.id}`, label: event.name };
    }
    if (matchingTeam) {
      return { kind: "team" as const, id: matchingTeam.sys.id, href: `/football/${matchingTeam.sys.id}`, label: matchingTeam.fields.name || event.name };
    }
    return null;
  }, [matchingArtist, matchingTeam, event.name]);

  // Show the strip only when the destination page would list more than one (non-sold-out) event.
  const hasMultipleDates = useMemo(() => {
    if (!allEvents || !collideTarget) return false;

    if (matchingArtist) {
      // Artists: exact name match (these acts share one identical name).
      const eventIdentifier = normalizeName(event.name_english) || normalizeName(event.name);
      return allEvents.filter(
        e => (normalizeName(e.name_english) || normalizeName(e.name)) === eventIdentifier && !isEventSoldOut(e)
      ).length > 1;
    }

    // Teams: count this team's HOME games only.
    const teamId = matchingTeam?.sys.id;
    return allEvents.filter(
      e => !isEventSoldOut(e) && findEventHomeTeam(e, footballTeams)?.sys.id === teamId
    ).length > 1;
  }, [event, allEvents, collideTarget, matchingArtist, matchingTeam, footballTeams]);

  const handleStripClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!collideTarget) return;

    // Track analytics
    trackEvent("artistStripClicked", {
      eventId: event.id,
      eventName: event.name,
      eventDate: event.date,
      eventLocation: event.location.name,
      eventTags: computedSold ? "Sold" : event.tags,
      eventPrice: packagePrice,
      artistId: collideTarget.kind === "artist" ? collideTarget.id : undefined,
      teamId: collideTarget.kind === "team" ? collideTarget.id : undefined,
      artistName: collideTarget.label,
      source: "homepage_eventCard",
    });

    // Navigate to the artist / football team page
    router.push(collideTarget.href);
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="flex flex-col">
      <Link
        href={computedSold ? "#no-op" : `/order/${event.id}`}
        className={`${computedSold ? "cursor-default" : "cursor-pointer"}`}
        key={event.id}
        aria-label={`${event.name} - ${dayjs(event.date).format("DD/MM/YYYY")} ב${event.location.name}${computedSold ? " - אזלו הכרטיסים" : ""}`}
        aria-disabled={computedSold}
        onClick={(e) => {
          trackEvent("eventSelected", {
            eventId: event.id,
            eventName: event.name,
            eventDate: event.date,
            eventType: event.type,
            eventLocation: event.location.name,
            eventTags: computedSold ? "Sold" : event.tags,
            eventPrice: packagePrice,
          });
          if (computedSold) {
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
        {/* Accessibility: Enhanced event card with proper semantic structure */}
        <article className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover ${hasMultipleDates ? 'rounded-b-none' : ''}`}>
          {/* Image — neon blob + cut-out for artists, full photo for sports */}
          <div className="relative">
            {event.skip_flight && !computedSold && <TicketOnlyBadge />}
            <EventArt
              id={event.id}
              imageUrl={event.art_image_url || event.card_image_url}
              alt={`תמונת האירוע ${event.name} שמתקיים ב${event.location.name} בתאריך ${dayjs(event.date).format("DD/MM/YYYY")}`}
              variant={event.art_image_url ? "blob" : "photo"}
              colorIndex={event.art_color_index ?? undefined}
              shapeIndex={event.art_shape_index ?? undefined}
              className="h-52 w-full sm:h-56"
            />
          </div>

          {/* Body */}
          <div className="flex flex-1 flex-col p-4 text-right" dir="rtl">
            <h3
              className="line-clamp-2 text-xl font-bold leading-tight"
              title={event.name}
            >
              {event.name}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <span className="font-bold text-foreground">
                {dayjs(event.date).format("DD/MM/YY")}
              </span>
              <span className="mx-1.5" aria-hidden="true">•</span>
              {event.location.name}
            </p>

            <div className="mt-2 min-h-[28px]">
              <EventStatusBadge event={event} />
            </div>

            {/* Price on the right, package icons on the left (per mock) */}
            <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
              <div className="text-right">
                {packagePrice !== null ? (
                  <div className="text-2xl font-extrabold leading-none tabular-nums">
                    ${packagePrice.toLocaleString("en-US")}
                  </div>
                ) : (
                  <div className="text-lg font-extrabold text-destructive">
                    אזלו הכרטיסים
                  </div>
                )}
                <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
                  לנוסע · כולל טיסה, מלון וכרטיס
                </p>
              </div>
              <PackageIcons cycle />
            </div>

            <div className="mt-4 w-full rounded-full bg-main py-3 text-center text-sm font-bold text-main-foreground transition-colors group-hover:bg-secondary group-hover:text-black group-active:bg-secondary group-active:text-black dark:bg-foreground dark:text-background dark:group-hover:bg-foreground/90 dark:group-hover:text-background dark:group-active:bg-foreground/90 dark:group-active:text-background">
              {computedSold ? "אזל מהמלאי" : "לפרטים והזמנה"}
            </div>
          </div>
        </article>
    </Link>
    {/* Strip for multiple dates - MOVED OUTSIDE Link to prevent navigation conflict */}
    {hasMultipleDates && (
      <div
        data-strip-click="true"
        className="w-full bg-main text-main-foreground text-center py-3.5 px-3 rounded-b-2xl cursor-pointer hover:bg-secondary hover:text-black active:bg-secondary active:text-black transition-colors duration-200 shadow-card dark:hover:bg-main/90 dark:hover:text-main-foreground dark:active:bg-main/90 dark:active:text-main-foreground"
        role="button"
        aria-label={`לחץ כדי לראות את כל האירועים של ${collideTarget?.label ?? event.name}`}
        onClick={handleStripClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleStripClick(e as unknown as React.MouseEvent<HTMLDivElement>);
          }
        }}
        tabIndex={0}
      >
        <span className="block truncate text-sm font-bold">
          לכל האירועים של {collideTarget?.label ?? event.name} לחצו כאן
        </span>
      </div>
    )}
    </div>
  );
}

