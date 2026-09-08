import Link from "next/link";
import type { Metadata } from "next";
import {
  TERMS_CLOSING,
  TERMS_PREVIOUS_PATH,
  TERMS_SECTIONS,
  TERMS_UPDATED_LABEL,
  type TermsBlock,
} from "./terms-content";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "תנאים ומידע כללי - מגה איבנטס",
  description:
    "תנאי ההתקשרות, דמי ביטול ושינוי, אחריות ומידע כללי להזמנות באתר מגה איבנטס.",
  alternates: { canonical: "https://www.mega-events.co.il/cancellation" },
};

// Turn bare URLs / emails inside a clause into links.
const LINK_RE = /(https?:\/\/[^\s]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g;
const SITE_ORIGIN = "https://www.mega-events.co.il";

function renderText(text: string) {
  return text.split(LINK_RE).map((part, i) => {
    if (i % 2 === 0) return part;
    const isEmail = !part.startsWith("http");
    const href = isEmail ? `mailto:${part}` : part;
    const internal = part.startsWith(SITE_ORIGIN);
    const className = "text-blue-600 hover:underline break-all";
    if (internal) {
      return (
        <Link key={i} href={part.slice(SITE_ORIGIN.length)} className={className}>
          {part}
        </Link>
      );
    }
    return (
      <a
        key={i}
        href={href}
        className={className}
        dir="ltr"
        {...(isEmail ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      >
        {part}
      </a>
    );
  });
}

function Block({ block }: { block: TermsBlock }) {
  if (typeof block === "string") return <p>{renderText(block)}</p>;
  if ("sub" in block) {
    return <h3 className="mt-4 font-semibold">{block.sub}</h3>;
  }
  return (
    <ul className="list-disc pr-6">
      {block.list.map((item) => (
        <li key={item}>{renderText(item)}</li>
      ))}
    </ul>
  );
}

function UpdateNotice() {
  return (
    <aside
      role="note"
      className="mb-6 rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm leading-relaxed text-neutral-900 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-50"
    >
      <p>
        <strong>התנאים עודכנו לאחרונה בתאריך {TERMS_UPDATED_LABEL}.</strong>
      </p>
      <p className="mt-1">
        הזמנות שבוצעו עד למועד זה כפופות לנוסח התנאים שהיה בתוקף במועד ביצוע
        ההזמנה.{" "}
        <Link href={TERMS_PREVIOUS_PATH} className="font-semibold text-blue-700 underline dark:text-sky-300">
          לצפייה בנוסח הקודם של התנאים לחצו כאן
        </Link>
        .
      </p>
    </aside>
  );
}

export default function CancelPage() {
  return (
    <main className="container mx-auto p-6" dir="rtl">
      <header className="mb-6">
        <h1 className="mb-6 text-center text-3xl font-bold">תנאים ומידע כללי</h1>
      </header>

      {TERMS_SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="prose max-w-none mb-6"
          aria-labelledby={`${section.id}-title`}
        >
          <h2 id={`${section.id}-title`} className="mt-6 text-xl font-bold">
            {section.title}
          </h2>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}

      <section className="prose max-w-none mt-8 border-t pt-6">
        <p className="font-semibold">{TERMS_CLOSING}</p>
      </section>

      <UpdateNotice />
    </main>
  );
}
