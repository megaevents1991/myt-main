import { requireAgent } from "@/lib/partner-auth";
import { getMyAgentTerms, getQuoteEvents } from "@/lib/quote-actions";
import { QuoteForm } from "./quote-form";

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  await requireAgent();
  const [events, terms] = await Promise.all([getQuoteEvents(), getMyAgentTerms()]);

  return (
    <main className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">הצעת מחיר חדשה</h1>
        <p className="text-sm text-gray-500">
          ההנחה על חבילה לא יכולה לעלות על העמלה שלכם לנוסע.
        </p>
      </div>
      <QuoteForm events={events} terms={terms} />
    </main>
  );
}
