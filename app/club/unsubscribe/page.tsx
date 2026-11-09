import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { CLUB_UNSUBSCRIBE_COPY as C } from "@/lib/club/copy";
import { maskEmail } from "@/lib/club/rules";
import { CLUB_DB_DEADLINE_MS } from "@/lib/club/settings-server";
import { UnsubscribeButton } from "./UnsubscribeButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "הסרה מהעדכונים - MEGA CLUB",
  robots: { index: false, follow: false },
};

const TOKEN_RE = /^[a-f0-9]{16,64}$/i;

/** The masked address of the token's member, or null (unknown token, unreadable DB). Never the whole email. */
async function maskedFor(token: string): Promise<{ masked: string; unsubscribed: boolean } | null> {
  if (!TOKEN_RE.test(token)) return null;
  try {
    const { data, error } = await supabase
      .from("club_members")
      .select("email, marketing")
      .eq("unsubscribe_token", token)
      .abortSignal(AbortSignal.timeout(CLUB_DB_DEADLINE_MS))
      .maybeSingle();
    if (error || !data) return null;
    return { masked: maskEmail(String(data.email)), unsubscribed: data.marketing === "unsubscribed" };
  } catch {
    return null;
  }
}

export default async function ClubUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : "";
  const member = await maskedFor(token);
  return (
    <main dir="rtl" className="mx-auto flex min-h-[60vh] max-w-lg flex-col gap-5 px-4 py-16 text-right">
      <div
        className="w-fit rounded-xl px-4 py-2 text-lg font-bold tracking-widest text-[#0A1A14]"
        style={{ background: "linear-gradient(135deg,#5BFF95 0%,#25D3B0 100%)" }}
        dir="ltr"
      >
        MEGA CLUB
      </div>
      <h1 className="text-2xl font-bold text-[#0A1A14]">{C.title}</h1>
      {!member ? (
        <p className="text-base text-gray-700">{C.notFound}</p>
      ) : member.unsubscribed ? (
        <p className="text-lg font-semibold text-[#0A1A14]">{C.done}</p>
      ) : (
        <>
          <p className="text-base text-gray-700">{C.lead(member.masked)}</p>
          <UnsubscribeButton token={token} />
        </>
      )}
    </main>
  );
}
