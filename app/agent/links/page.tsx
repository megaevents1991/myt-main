import { requirePartner, getPartnerProfile } from "@/lib/partner-auth";
import { getQuoteEvents, type QuoteEventOption } from "@/lib/quote-actions";
import { LinkBuilder } from "./link-builder";
import { LogoSettings } from "./logo-settings";

export const dynamic = "force-dynamic";

export default async function AgentLinksPage() {
  // Shown to both agents and influencers - requirePartner() is the only
  // gate, no role check.
  const session = await requirePartner();

  // getQuoteEvents() (shared with the quote form) is requirePartner()-gated
  // too, so both roles get the full event list here. Still defensive: if it
  // ever throws for any other reason, fall back to the general link only
  // rather than erroring the whole page out.
  let events: QuoteEventOption[] = [];
  try {
    events = await getQuoteEvents();
  } catch {
    events = [];
  }

  const profile = await getPartnerProfile(session.sub);

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">קישורים ומיתוג</h1>
        <p className="text-sm text-gray-500">
          קישורי מעקב לשיתוף, והלוגו שמופיע על הצעות המחיר שלכם.
        </p>
      </div>

      <LinkBuilder trackingCode={session.partner_code} events={events} />

      <LogoSettings currentLogoUrl={profile?.logo_url ?? null} />
    </main>
  );
}
