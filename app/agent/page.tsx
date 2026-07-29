import { requirePartner } from "@/lib/partner-auth";
import { getCachedEvents } from "@/lib/eventsData";
import { computePackagePrice, isEventSoldOut } from "@/lib/events/price";
import { AgentSearch, type AgentEvent } from "./agent-search";

export const dynamic = "force-dynamic";

export default async function AgentHomePage() {
  // The middleware already redirected an unauthenticated request; this is the
  // server-side backstop so the page can never render without a partner.
  const session = await requirePartner();

  // Reuses the site's own event source — the whole point of the partner area
  // living here rather than in the backoffice. `getEvents` already filters
  // soft-deleted and past events and is the same ISR-cached reader the site
  // itself uses, so it cannot drift from what a customer sees.
  const { events } = await getCachedEvents();

  const rows: AgentEvent[] = events.map((event) => ({
    id: event.id,
    name: event.name,
    date: event.date ?? null,
    location: event.location?.name ?? null,
    // Sold out is isEventSoldOut, not a null price: an event tagged "Sold" can
    // still have tickets, and would otherwise render as bookable.
    price: isEventSoldOut(event) ? null : computePackagePrice(event),
  }));

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">חיפוש חבילות</h1>
        <p className="text-sm text-gray-500">
          כל חבילה שתבנו מכאן משויכת אליכם אוטומטית.
        </p>
      </div>
      <AgentSearch events={rows} trackingCode={session.partner_code} />
    </main>
  );
}
