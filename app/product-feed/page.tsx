import type { Metadata } from "next";

import { getFeedUser } from "@/lib/feed/feedAuth";
import { getActivityItems, getFeedItems } from "@/lib/feed/feedData";
import { FEED_SITE_ORIGIN } from "@/lib/feed/metaCatalog";
import { CopyButton } from "./CopyButton";
import { FeedTable } from "./FeedTable";

/**
 * Internal admin page for the Meta product feed - live counts and a row
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
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-gray-900">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-card">
          <h1 className="mb-2 font-display text-2xl font-extrabold text-gray-900">
            Product Feed
          </h1>
          <p className="mb-6 text-sm text-gray-500">
            עמוד פנימי לניהול פיד המוצרים למטא. כניסה עם משתמש הבקאופיס בלבד.
          </p>
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {ERRORS[error] ?? "שגיאה. נסו שוב."}
            </p>
          )}
          {/* Same backoffice credentials - Supabase Auth email+password */}
          <form method="post" action="/api/feed-auth/login" className="space-y-3">
            <input
              name="email"
              type="email"
              required
              placeholder="אימייל"
              dir="ltr"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
            />
            <input
              name="password"
              type="password"
              required
              placeholder="סיסמה"
              dir="ltr"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-main px-4 py-3 font-bold text-white transition-opacity hover:opacity-90"
            >
              כניסה
            </button>
          </form>
          <div className="my-4 flex items-center gap-3 text-xs text-gray-500">
            <span className="h-px flex-1 bg-border" />
            או
            <span className="h-px flex-1 bg-border" />
          </div>
          <a
            href="/api/feed-auth/google"
            className="inline-block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-900 transition-colors hover:bg-gray-50"
          >
            התחברות עם Google
          </a>
        </div>
      </div>
    );
  }

  // Two different feeds: the e-commerce shape below (Google Merchant) and the
  // ACTIVITIES shape Meta actually consumes. They drop different events - the
  // activities feed also drops sold-out ones and anything inside the booking
  // window - so a product can be present here and still be missing from Meta.
  const [{ items, skipped }, activities] = await Promise.all([
    getFeedItems(),
    getActivityItems(),
  ]);
  const inStock = items.filter((i) => i.availability === "in stock").length;
  const xmlUrl = `${FEED_SITE_ORIGIN}/feeds/meta-catalog.xml`;

  const REASON_LABELS: Record<string, string> = {
    "sold out": "אזלו הכרטיסים",
    "inside booking window": "בתוך חלון ההזמנה (פחות מ-3 ימים)",
    "no computable price": "אין מחיר לחישוב",
    "no campaign creative":
      "אין קריאטיב קמפיין - מוצר מתפרסם רק עם המיתוג שלנו. הרץ 'סנכרן הכל' בבקאופיס",
    "no image": "אין תמונה - לא כרטיס, לא cutout ולא קריאטיב",
  };
  const activityDrops = activities.skipped.reduce<Record<string, typeof activities.skipped>>(
    (acc, s) => {
      (acc[s.reason] ??= []).push(s);
      return acc;
    },
    {}
  );

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 text-gray-900">
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-gray-900">
            Meta Product Feed
          </h1>
          <p className="text-sm text-gray-500">
            מחובר: {user.display_name || user.email} ({user.role})
          </p>
        </div>
        <a
          href="/api/feed-auth/logout"
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
        >
          התנתקות
        </a>
      </div>

      {/* Feed URL + exports */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
        <h2 className="mb-3 text-lg font-bold text-gray-900">כתובת הפיד (למטא)</h2>
        <div className="flex flex-wrap items-center gap-3">
          <code
            dir="ltr"
            className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900"
          >
            {xmlUrl}
          </code>
          <CopyButton text={xmlUrl} />
          <a
            href="/feeds/meta-catalog.xml"
            target="_blank"
            rel="noopener"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
          >
            פתח XML
          </a>
          <a
            href="/feeds/meta-catalog.csv?excel=1"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
          >
            הורד CSV
          </a>
          <a
            href="/feeds/meta-activities.csv?excel=1"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
          >
            הורד CSV למטא (Activities)
          </a>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          הפיד נבנה חי מה־DB בכל בקשה. במטא: Commerce Manager ← Data Sources ←
          Scheduled Feed, רענון שעתי.
        </p>
      </div>

      {/* Counts - e-commerce shape (Google Merchant), NOT what Meta reads */}
      <h2 className="mb-2 text-lg font-bold text-gray-900">
        פיד ה-e-commerce (Google Merchant)
      </h2>
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
            className="rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-card"
          >
            <div className="text-3xl font-extrabold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Skipped events - fix these in the backoffice */}
      {skipped.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="mb-2 text-lg font-bold text-amber-900">
            אירועים שלא נכנסו לפיד ה-e-commerce
          </h2>
          <ul className="list-inside list-disc text-sm text-amber-900">
            {skipped.map((s) => (
              <li key={s.id}>
                #{s.id} {s.name} - {REASON_LABELS[s.reason] ?? s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What Meta actually receives - the activities feed, and everything it drops */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">
            הפיד שמטא קוראת (Activities)
          </h2>
          <a
            href="/feeds/meta-activities.csv?excel=1"
            className="text-sm font-semibold text-main hover:underline"
          >
            הורד CSV
          </a>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          זה הקובץ הרשום ב-Commerce Manager. הוא מפיל אירועים שהטבלה למטה כן
          מכילה: אזלו הכרטיסים, אירועים קרובים מדי, וכל אירוע בלי תמונה.
        </p>

        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-extrabold text-gray-900">
              {activities.items.length}
            </div>
            <div className="text-xs text-gray-500">נשלחים למטא</div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-extrabold text-gray-900">
              {activities.skipped.length}
            </div>
            <div className="text-xs text-gray-500">נופלים מהפיד</div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-extrabold text-gray-900">
              {activities.items.length + activities.skipped.length}
            </div>
            <div className="text-xs text-gray-500">אירועים שנבדקו</div>
          </div>
        </div>

        {activities.skipped.length === 0 ? (
          <p className="text-sm font-semibold text-green-700">
            כל האירועים נכנסו לפיד.
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(activityDrops)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([reason, list]) => (
                <details
                  key={reason}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                >
                  <summary className="cursor-pointer text-sm font-bold text-gray-900">
                    {REASON_LABELS[reason] ?? reason}{" "}
                    <span className="font-normal text-gray-500">({list.length})</span>
                  </summary>
                  <ul className="mt-2 space-y-0.5 text-sm text-gray-900">
                    {list.map((s) => (
                      <li key={s.id}>
                        <span className="text-gray-500" dir="ltr">
                          #{s.id}
                        </span>{" "}
                        {s.name}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
          </div>
        )}
      </div>

      {/* Preview */}
      <FeedTable items={items} />
    </div>
    </div>
  );
}
