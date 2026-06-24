"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@mantine/core";

import type { Event } from "@/lib/app.types";
import { HeroSearch } from "@/components/HeroSearch";

/**
 * Global search overlay — lets the header search button open the *same* search
 * experience on any page, in place, instead of routing to the homepage. The
 * homepage renders its own in-hero search, so this no-ops there. Events are
 * lazy-loaded (cached API) the first time it opens, so non-search pages pay
 * nothing for it.
 */
export const GlobalSearch = () => {
  const pathname = usePathname();
  const [opened, setOpened] = useState(false);
  const [events, setEvents] = useState<Event[] | null>(null);
  const loading = useRef(false);

  const load = () => {
    if (events || loading.current) return;
    loading.current = true;
    fetch("/api/search-events")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => (loading.current = false));
  };

  useEffect(() => {
    const onOpen = () => {
      // Homepage handles its own in-hero search — never open the modal there.
      if (window.location.pathname === "/") return;
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

  // Homepage owns its own in-place search; don't double up there.
  if (pathname === "/") return null;

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title="חיפוש אירוע"
      centered
      size="lg"
      dir="rtl"
      overlayProps={{ backgroundOpacity: 0.6, blur: 3 }}
      styles={{
        content: { backgroundColor: "hsl(var(--surface-inverse))" },
        header: {
          backgroundColor: "hsl(var(--surface-inverse))",
          color: "hsl(var(--surface-inverse-foreground))",
        },
        title: { fontWeight: 700 },
        close: { color: "hsl(var(--surface-inverse-foreground))" },
        body: { paddingBottom: "1.5rem" },
      }}
    >
      <div className="bg-main text-main-foreground">
        <HeroSearch events={events ?? []} autoFocus />
      </div>
    </Modal>
  );
};
