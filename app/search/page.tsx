import type { Metadata } from "next";

import { getCachedEvents } from "@/lib/eventsData";
import { SearchResults, type SearchInitial } from "@/components/SearchResults";

// Dynamic so ?q=&city=&from= deep links render server-side with the right
// initial state. Event data itself stays ISR-cached via getCachedEvents().
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "חיפוש אירועים | Mega Events",
  description:
    "חפשו אירועי ספורט ומוזיקה בעולם, סננו לפי עיר, תאריך ומחיר והרכיבו חבילה.",
  alternates: { canonical: "https://www.mega-events.co.il/search" },
};

// Pick the first value when a query param arrives repeated (?cat=a&cat=b).
const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { events } = await getCachedEvents().catch(() => ({ events: [] }));

  const cat = one(sp.cat);
  const sort = one(sp.sort);
  const initial: SearchInitial = {
    q: one(sp.q),
    cat:
      cat === "music" || cat === "sports" || cat === "all" ? cat : undefined,
    city: one(sp.city),
    from: one(sp.from),
    sold: one(sp.sold),
    ticket: one(sp.ticket),
    sort:
      sort === "price-asc" ||
      sort === "price-desc" ||
      sort === "date-asc" ||
      sort === "relevance"
        ? sort
        : undefined,
  };

  return (
    <main className="min-h-dvh">
      <h1 className="sr-only">חיפוש אירועים</h1>
      <SearchResults events={events} initial={initial} />
    </main>
  );
}
