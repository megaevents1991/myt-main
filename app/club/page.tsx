import type { Metadata } from "next";
import { Check } from "lucide-react";
import { ClubCard } from "@/components/order/club/ClubCard";
import { CLUB_COPY } from "@/lib/club/copy";
import { ClubPage } from "./ClubPage";

export const metadata: Metadata = {
  title: "MEGA CLUB - מועדון החברים של מגה איבנטס",
  description: "מועדון החברים של מגה איבנטס: ההצטרפות בחינם, ומחיר חבר על כל הזמנה של חבילת אירוע.",
  alternates: { canonical: "https://www.mega-events.co.il/club" },
};

/** D15: the main menu's door to the club - the order's form, outside an order. The amount shows only after joining. */
export default function ClubLanding() {
  return (
    <div dir="rtl" className="mx-auto w-full max-w-5xl px-4 py-12 text-right md:py-20">
      <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:gap-14">
        <section className="flex flex-col gap-6">
          <h1 dir="ltr" className="text-right font-display text-display-md tracking-[0.08em] text-foreground md:text-display-lg">
            MEGA CLUB
          </h1>
          <p className="max-w-[38ch] text-lg leading-relaxed text-muted-foreground">{CLUB_COPY.sub}</p>
          <ul className="flex flex-col gap-3">
            {CLUB_COPY.pagePerks.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-base text-foreground">
                <Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 hidden w-full max-w-sm md:block">
            <ClubCard memberNo={null} />
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-7">
          <ClubPage />
        </section>
      </div>
    </div>
  );
}
