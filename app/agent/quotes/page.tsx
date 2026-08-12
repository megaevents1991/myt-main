import Link from "next/link";
import { requireAgent } from "@/lib/partner-auth";
import { getMyQuotes } from "@/lib/quote-actions";

export const dynamic = "force-dynamic";

export default async function AgentQuotesPage() {
  // Nav already hides this tab from an influencer; this is the real gate -
  // requireAgent() throws for anyone whose role isn't exactly "agent".
  await requireAgent();
  const quotes = await getMyQuotes();

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">הצעות מחיר</h1>
          <p className="text-sm text-gray-500">
            הצעה שנשלחת ללקוח לא חושפת מה נגבה בפועל במערכת שלנו.
          </p>
        </div>
        <Link
          href="/agent/quotes/new"
          className="rounded-md bg-main px-4 py-2 text-sm font-medium text-main-foreground hover:bg-main/90"
        >
          הצעה חדשה
        </Link>
      </div>

      {quotes.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
          עדיין לא יצרתם הצעות מחיר.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-right">
              <tr>
                <th className="px-3 py-2 font-medium">תאריך</th>
                <th className="px-3 py-2 font-medium">לקוח</th>
                <th className="px-3 py-2 font-medium">כותרת</th>
                <th className="px-3 py-2 font-medium">סה&quot;כ</th>
                <th className="px-3 py-2 font-medium">בתוקף עד</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id} className="border-t">
                  <td className="px-3 py-2 text-gray-500">
                    {new Date(quote.created_at).toLocaleDateString("he-IL")}
                  </td>
                  <td className="px-3 py-2">{quote.customer_name || "-"}</td>
                  <td className="px-3 py-2">{quote.title || "-"}</td>
                  <td className="px-3 py-2 font-medium">
                    {quote.total != null ? `$${quote.total.toLocaleString()}` : "-"}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {quote.valid_until
                      ? new Date(quote.valid_until).toLocaleDateString("he-IL")
                      : "-"}
                  </td>
                  <td className="px-3 py-2 text-left">
                    <Link
                      href={`/agent/quotes/${quote.id}`}
                      className="font-medium text-main hover:underline"
                    >
                      צפייה
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
