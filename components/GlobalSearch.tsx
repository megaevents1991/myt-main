"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

import type { Event, Artist } from "@/lib/app.types";
import { HeroSearch } from "@/components/HeroSearch";

/**
 * Global search overlay — the header search button opens the *same* search
 * experience here, in place, on every page (including the homepage), instead of
 * routing anywhere. Events + artists are lazy-loaded (cached API) the first time
 * it opens, so pages that never search pay nothing for it.
 */
export const GlobalSearch = () => {
  const pathname = usePathname();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [opened, setOpened] = useState(false);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const loading = useRef(false);

  const load = () => {
    if (events || loading.current) return;
    loading.current = true;
    fetch("/api/search-events")
      .then((r) => r.json())
      .then((d) => {
        setEvents(d.events ?? []);
        setArtists(d.artists ?? []);
      })
      .catch(() => setEvents([]))
      .finally(() => (loading.current = false));
  };

  useEffect(() => {
    const onOpen = () => {
      load();
      setOpened(true);
    };
    window.addEventListener("myt:open-search", onOpen);
    if (new URLSearchParams(window.location.search).get("search") === "open") {
      onOpen();
    }
    return () => window.removeEventListener("myt:open-search", onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on navigation (e.g. after picking an event → /order/[id]).
  useEffect(() => setOpened(false), [pathname]);

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title="חיפוש אירוע"
      centered
      size="lg"
      fullScreen={isMobile}
      dir="rtl"
      overlayProps={{ backgroundOpacity: 0.6, blur: 3 }}
      closeButtonProps={{
        "aria-label": "סגור",
        className:
          "!text-main-foreground !bg-transparent hover:!bg-main-foreground/15 !rounded-full",
      }}
      styles={{
        // No modal scrollbars — the modal grows with its content and the
        // results lists inside HeroSearch scroll themselves.
        content: {
          backgroundColor: "hsl(var(--surface-inverse))",
          overflow: "hidden",
        },
        header: {
          backgroundColor: "hsl(var(--surface-inverse))",
          color: "hsl(var(--surface-inverse-foreground))",
        },
        title: { fontWeight: 700 },
        body: { paddingBottom: "1.5rem", overflow: "hidden" },
      }}
    >
      <div className="bg-main text-main-foreground">
        <HeroSearch events={events ?? []} artists={artists} autoFocus />
      </div>
    </Modal>
  );
};
