// The customer's ticket page: `/ticket/<token>`. The token is the booking's own random key (never an order id), so
// the page is the link itself: no login, no index, never cached. It shows the tickets only once they were released
// to the customer. Rules + tests: lib/tixstock-booking/ticket-page.ts.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deliveryDay } from "@/lib/tixstock-booking/sandbox-ticket";
import { loadTicketPage, type TicketPageData, type TicketPageFile } from "@/lib/tixstock-booking/ticket-page";
import { realTicketPageDeps } from "@/lib/tixstock-booking/ticket-page-deps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "הכרטיסים שלכם - מגה איבנטס",
  robots: { index: false, follow: false },
};

const eventDay = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("he-IL", { timeZone: "UTC" });
};

const fileLabel = (file: TicketPageFile, index: number): string => {
  if (file.kind === "additional") return "הנחיות מהמוכר";
  const seat = [file.row ? `שורה ${file.row}` : "", file.seat ? `מושב ${file.seat}` : ""].filter(Boolean).join(", ");
  return seat ? `כרטיס ${index + 1} - ${seat}` : `כרטיס ${index + 1}`;
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <p className="flex flex-wrap gap-x-2">
    <strong>{label}</strong>
    <span>
      <bdi>{value}</bdi>
    </span>
  </p>
);

function Tickets({ page, token }: { page: TicketPageData; token: string }) {
  if (page.externalTransfer) {
    return <p className="font-bold">הכרטיסים מועברים אליך ישירות על ידי הספק - בדקו את תיבת המייל</p>;
  }
  if (!page.released || page.files.length === 0) {
    const day = deliveryDay(page.deliveryDate);
    return (
      <p className="font-bold">
        {day ? `הכרטיסים יישלחו אליכם עד ${day}` : "הכרטיסים יופיעו כאן ברגע שהספק ישלח אותם"}
      </p>
    );
  }
  const tickets = page.files.filter((f) => f.kind !== "additional");
  const letters = page.files.filter((f) => f.kind === "additional");
  return (
    <ul className="space-y-2">
      {[...tickets, ...letters].map((file) => (
        <li key={file.id}>
          <a
            className="font-bold underline underline-offset-4"
            href={file.url ?? `/api/ticket-file/${token}/${file.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {fileLabel(file, tickets.indexOf(file))}
            {file.kind === "mobile_link" ? " (פתיחה בנייד)" : ""}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let page: TicketPageData | null = null;
  try {
    page = await loadTicketPage(token, realTicketPageDeps());
  } catch (e) {
    console.error("[ticket-page] failed:", e instanceof Error ? e.message : String(e));
  }
  if (!page) notFound();

  const where = [page.section ? `אזור ${page.section}` : "", page.row ? `שורה ${page.row}` : ""].filter(Boolean).join(", ");
  const delivery = deliveryDay(page.deliveryDate);
  return (
    <main className="container mx-auto max-w-2xl p-6" dir="rtl">
      <h1 className="mb-1 text-3xl font-bold">{page.eventName}</h1>
      {eventDay(page.eventDate) && <p className="mb-6 text-muted-foreground">{eventDay(page.eventDate)}</p>}

      <section className="mb-6 space-y-2 rounded-lg border border-border p-4" aria-label="פרטי הכרטיסים">
        <Row label="קטגוריה:" value={page.category} />
        {where && <Row label="מיקום:" value={where} />}
        {page.ticketType && <Row label="סוג כרטיס:" value={page.ticketType} />}
        <Row label="כמות:" value={String(page.quantity)} />
        {delivery && <Row label="מועד מסירה:" value={delivery} />}
        {page.restrictions.length > 0 && (
          <div>
            <strong>הגבלות והטבות:</strong>
            <ul className="list-disc ps-5">
              {page.restrictions.map((line) => (
                <li key={line}>
                  <bdi>{line}</bdi>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border p-4" aria-label="הכרטיסים">
        <h2 className="mb-3 text-xl font-bold">הכרטיסים</h2>
        <Tickets page={page} token={token} />
      </section>
    </main>
  );
}
