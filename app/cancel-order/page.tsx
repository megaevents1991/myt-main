import Link from "next/link";
import type { Metadata } from "next";
import { CancellationForm } from "./CancellationForm";

export const metadata: Metadata = {
  title: "ביטול הזמנה - מגה איבנטס",
  description:
    "טופס בקשה לביטול הזמנה באתר מגה איבנטס, בכפוף לתנאי ההזמנה ולחוק הגנת הצרכן.",
  alternates: { canonical: "https://www.mega-events.co.il/cancel-order" },
};

const OPS_EMAIL = "opsfit1@megatr.co.il";
const WHATSAPP = "054-200-2272";

export default function CancelOrderPage() {
  return (
    <main className="container mx-auto max-w-3xl p-6" dir="rtl">
      <header className="mb-6">
        <h1 className="mb-2 text-center text-3xl font-bold">ביטול הזמנה</h1>
      </header>

      <section className="prose max-w-none mb-8" aria-labelledby="intro">
        <h2 id="intro" className="text-xl font-bold">נוסעים נכבדים,</h2>
        <p>
          ניתן לבטל הזמנה שבוצעה באתר מגה איבנטס או במוקד המכירות שלנו באמצעות
          הטופס שבעמוד זה. הזמנה שבוצעה דרך סוכן נסיעות תבוטל באמצעות הסוכן בלבד.
        </p>
        <p>בנוסף ניתן לשלוח הודעת ביטול באחת הדרכים הבאות:</p>
        <ul className="list-disc pr-6">
          <li>
            בדוא&quot;ל:{" "}
            <a href={`mailto:${OPS_EMAIL}`} className="text-blue-600 hover:underline" dir="ltr">
              {OPS_EMAIL}
            </a>
          </li>
          <li>
            בוואטסאפ:{" "}
            <a
              href={`https://wa.me/972${WHATSAPP.replace(/\D/g, "").replace(/^0/, "")}`}
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
            >
              {WHATSAPP}
            </a>
          </li>
          <li>בדואר רשום: מגה תיירות בע&quot;מ, רחוב ראול ולנברג, תל אביב.</li>
        </ul>
        <p className="text-sm">
          מועד הביטול הקובע הוא מועד קבלת ההודעה במשרדי החברה בשעות הפעילות
          (א&apos;–ה&apos;, 09:00–16:00). הודעה שתתקבל מחוץ לשעות הפעילות תיחשב
          כאילו התקבלה ביום העסקים העוקב.
        </p>
      </section>

      <section className="mb-8 rounded-xl border p-5 sm:p-6" aria-labelledby="form-title">
        <h2 id="form-title" className="mb-4 text-xl font-bold">טופס בקשת ביטול</h2>
        <CancellationForm />
      </section>

      <section className="prose max-w-none text-sm" aria-labelledby="legal">
        <h2 id="legal" className="text-base font-bold">חשוב לדעת</h2>
        <p>
          ביטול הזמנה כרוך בדמי ביטול וטיפול בהתאם לתנאים שסוכמו במעמד ההזמנה,
          בכפוף לחוק הגנת הצרכן, התשמ&quot;א-1981. לאחר קבלת הפרטים תיבדק הבקשה
          מול תנאי ההזמנה ותישלח אליך הודעה בכתב עם אישור הביטול ופירוט דמי
          הביטול, ככל שחלים.
        </p>
        <p>
          כרטיסי אירועים אינם ניתנים לביטול או להחזר לאחר אישור ההזמנה, למעט
          במקרה של ביטול האירוע על ידי המפיק. הפירוט המלא ב
          <Link href="/cancellation#tickets" className="text-blue-600 hover:underline">
            תנאים ומידע כללי
          </Link>
          .
        </p>
        <p>
          לקריאה:{" "}
          <Link href="/cancellation" className="text-blue-600 hover:underline">
            תנאים ומידע כללי
          </Link>
          {" · "}
          <Link href="/terms" className="text-blue-600 hover:underline">
            תנאי שימוש באתר
          </Link>
          {" · "}
          <Link href="/privacy" className="text-blue-600 hover:underline">
            מדיניות פרטיות
          </Link>
        </p>
      </section>
    </main>
  );
}
