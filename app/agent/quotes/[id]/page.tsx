import { notFound } from "next/navigation";
import { getPartnerProfile, getPartnerSession } from "@/lib/partner-auth";
import { getMyQuote } from "@/lib/quote-actions";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function QuoteViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quoteId = Number(id);
  if (!Number.isFinite(quoteId)) notFound();

  // getMyQuote() itself calls requireAgent() and returns null for a quote
  // that isn't this agent's — same 404-for-both-cases posture as the
  // backoffice's PDF route, so a guessed id can't confirm it exists.
  const quote = await getMyQuote(quoteId);
  if (!quote) notFound();

  const session = await getPartnerSession();
  const profile = session ? await getPartnerProfile(session.sub) : null;

  return (
    <main className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-gray-500">
          לשמירה כ-PDF: Ctrl+P (או ⌘+P) ← &quot;שמור כ-PDF&quot;
        </p>
        <PrintButton />
      </div>

      <div className="rounded-lg border p-8 print:border-0 print:p-0" dir="rtl">
        <div className="mb-6 flex items-start justify-between border-b pb-4">
          <div>
            {profile?.logo_url && (
              // Agent's own agency logo — plain <img>, this is a one-off
              // print document rather than a Next/Image-optimized page.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logo_url} alt="" className="mb-2 h-12 w-auto" />
            )}
            <p className="font-bold">{profile?.display_name || session?.display_name}</p>
            {profile?.email && <p className="text-sm text-gray-500">{profile.email}</p>}
          </div>
          <div className="text-left text-sm text-gray-500">
            <p>הצעה #{quote.id}</p>
            <p>{new Date(quote.created_at).toLocaleDateString("he-IL")}</p>
            {quote.valid_until && (
              <p>בתוקף עד {new Date(quote.valid_until).toLocaleDateString("he-IL")}</p>
            )}
          </div>
        </div>

        <h1 className="mb-1 text-xl font-bold">{quote.title || "הצעת מחיר"}</h1>
        <p className="mb-6 text-sm text-gray-600">עבור: {quote.customer_name}</p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-right">
              <th className="pb-2 font-medium">תיאור</th>
              <th className="pb-2 font-medium">כמות</th>
              <th className="pb-2 font-medium">מחיר יחידה</th>
              <th className="pb-2 font-medium">סה&quot;כ</th>
            </tr>
          </thead>
          <tbody>
            {(quote.line_items || []).map((item, i) => (
              <tr key={i} className="border-b">
                <td className="py-2">{item.label}</td>
                <td className="py-2">{item.qty}</td>
                <td className="py-2">${item.unit_price.toLocaleString()}</td>
                <td className="py-2">${(item.qty * item.unit_price).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <p className="text-lg font-bold">
            סה&quot;כ: ${(quote.total ?? 0).toLocaleString()}
          </p>
        </div>

        {quote.notes && (
          <div className="mt-6 border-t pt-4 text-sm text-gray-600">
            <p className="font-medium">הערות:</p>
            <p>{quote.notes}</p>
          </div>
        )}
      </div>
    </main>
  );
}
