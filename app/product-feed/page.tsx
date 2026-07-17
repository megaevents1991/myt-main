import type { Metadata } from "next";

import { getFeedUser } from "@/lib/feed/feedAuth";
import { getFeedItems } from "@/lib/feed/feedData";
import { FEED_SITE_ORIGIN } from "@/lib/feed/metaCatalog";
import { CopyButton } from "./CopyButton";

/**
 * Internal admin page for the Meta product feed — live counts and a row
 * preview of exactly what /feeds/meta-catalog.xml serves, plus the CSV
 * export. Gated by the SAME login as the backoffice (Supabase Auth Google
 * SSO + staff role in the shared user_profiles table). Not linked from the
 * site, noindexed.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Product Feed - Mega Events",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  oauth: "ההתחברות נכשלה. נסו שוב.",
  "no-account": "אין לחשבון הזה הרשאת צוות. יש להתחבר עם משתמש הבקאופיס.",
  credentials: "אימייל או סיסמה שגויים.",
  missing: "יש למלא אימייל וסיסמה.",
};

export default async function ProductFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getFeedUser();

  if (!user) {
    return (
      <div dir="rtl" className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-card">
          <h1 className="mb-2 font-display text-2xl font-extrabold text-foreground">
            Product Feed
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            עמוד פנימי לניהול פיד המוצרים למטא. כניסה עם משתמש הבקאופיס בלבד.
          </p>
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {ERRORS[error] ?? "שגיאה. נסו שוב."}
            </p>
          )}
          {/* Same backoffice credentials — Supabase Auth email+password */}
          <form method="post" action="/api/feed-auth/login" className="space-y-3">
            <input
              name="email"
              type="email"
              required
              placeholder="אימייל"
              dir="ltr"
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm"
            />
            <input
              name="password"
              type="password"
              required
              placeholder="סיסמה"
              dir="ltr"
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-main px-4 py-3 font-bold text-white transition-opacity hover:opacity-90"
            >
              כניסה
            </button>
          </form>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            או
            <span className="h-px flex-1 bg-border" />
          </div>
          <a
            href="/api/feed-auth/google"
            className="inline-block w-full rounded-xl border border-border bg-white px-4 py-3 font-bold text-foreground transition-colors hover:bg-gray-50"
          >
            התחברות עם Google
          </a>
        </div>
      </div>
    );
  }

  const { items, skipped } = await getFeedItems();
  const inStock = items.filter((i) => i.availability === "in stock").length;
  const xmlUrl = `${FEED_SITE_ORIGIN}/feeds/meta-catalog.xml`;

  return (
    <div dir="rtl" className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-foreground">
            Meta Product Feed
          </h1>
          <p className="text-sm text-muted-foreground">
            מחובר: {user.display_name || user.email} ({user.role})
          </p>
        </div>
        <a
          href="/api/feed-auth/logout"
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-gray-50"
        >
          התנתקות
        </a>
      </div>

      {/* Feed URL + exports */}
      <div className="mb-6 rounded-2xl border border-border bg-white p-5 shadow-card">
        <h2 className="mb-3 text-lg font-bold text-foreground">כתובת הפיד (למטא)</h2>
        <div className="flex flex-wrap items-center gap-3">
          <code
            dir="ltr"
            className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-foreground"
          >
            {xmlUrl}
          </code>
          <CopyButton text={xmlUrl} />
          <a
            href="/feeds/meta-catalog.xml"
            target="_blank"
            rel="noopener"
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
          >
            פתח XML
          </a>
          <a
            href="/feeds/meta-catalog.csv"
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
          >
            הורד CSV
          </a>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          הפיד נבנה חי מה־DB בכל בקשה. במטא: Commerce Manager ← Data Sources ←
          Scheduled Feed, רענון שעתי.
        </p>
      </div>

      {/* Counts */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: "פריטים בפיד", value: items.length },
          { label: "במלאי (in stock)", value: inStock },
          { label: "אזל (out of stock)", value: items.length - inStock },
          { label: "עם קריאייטיב קמפיין", value: items.filter((i) => i.has_campaign).length },
          { label: "לא נכנסו לפיד", value: skipped.length },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-white p-4 text-center shadow-card"
          >
            <div className="text-3xl font-extrabold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Skipped events — fix these in the backoffice */}
      {skipped.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="mb-2 text-lg font-bold text-amber-900">
            אירועים שלא נכנסו לפיד
          </h2>
          <ul className="list-inside list-disc text-sm text-amber-900">
            {skipped.map((s) => (
              <li key={s.id}>
                #{s.id} {s.name} — {s.reason === "no image" ? "חסרה תמונה" : "אין מחיר"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-gray-50 text-right text-xs text-muted-foreground">
              <th className="px-3 py-2">id</th>
              <th className="px-3 py-2">title</th>
              <th className="px-3 py-2">price</th>
              <th className="px-3 py-2">availability</th>
              <th className="px-3 py-2">expiration</th>
              <th className="px-3 py-2">product_type</th>
              <th className="px-3 py-2">labels</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-border/50 align-top">
                <td className="px-3 py-2">
                  <a
                    href={it.link}
                    target="_blank"
                    rel="noopener"
                    className="font-semibold text-main hover:underline"
                    dir="ltr"
                  >
                    {it.id}
                  </a>
                </td>
                <td className="max-w-[320px] px-3 py-2">{it.title}</td>
                <td className="whitespace-nowrap px-3 py-2" dir="ltr">
                  {it.price}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span
                    className={
                      it.availability === "in stock"
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800"
                        : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800"
                    }
                  >
                    {it.availability}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2" dir="ltr">
                  {it.expiration_date}
                </td>
                <td className="max-w-[200px] px-3 py-2" dir="ltr">
                  {it.product_type || "—"}
                </td>
                <td className="max-w-[220px] px-3 py-2" dir="ltr">
                  {it.custom_labels.filter(Boolean).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            אין פריטים בפיד.
          </p>
        )}
      </div>
    </div>
  );
}
