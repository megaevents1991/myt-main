import { Lock, MessageCircle, Star } from "lucide-react";

const pillars = [
  {
    Icon: Lock,
    title: "כרטיסים רשמיים בלבד",
    desc: "אתם בידיים טובות — כל הכרטיסים מאושרים",
  },
  {
    Icon: MessageCircle,
    title: "שירות זמין לכל שאלה",
    desc: "הצוות שלנו מלווה אתכם לאורך כל הדרך",
  },
  {
    Icon: Star,
    title: "10,000+ לקוחות מרוצים",
    desc: "מצטרפים מדי שנה לשירותי מגה תיירות",
  },
];

/** "החוויה שלכם — בידיים בטוחות" — trust pillars on cream. */
export const TrustSection = () => (
  <section
    className="bg-background px-4 py-16 md:px-6"
    aria-labelledby="trust-heading"
  >
    <div className="container mx-auto text-center">
      <h2
        id="trust-heading"
        className="font-display text-3xl font-extrabold text-foreground sm:text-4xl"
      >
        החוויה שלכם — בידיים בטוחות
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
        אנחנו מלווים אתכם לכל אורך הדרך — מבחירת האירוע ועד קבלת הכרטיסים
        והרכיבים של החבילה.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {pillars.map(({ Icon, title, desc }) => (
          <div
            key={title}
            className="flex flex-col items-center gap-3 rounded-2xl bg-main p-8 text-main-foreground"
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Icon className="size-7" aria-hidden />
            </div>
            <h3 className="font-display text-lg font-bold">{title}</h3>
            <p className="text-sm text-main-foreground/80">{desc}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 font-bold text-foreground">
        אנחנו כאן כדי שתיהנו מהחוויה שלכם — בשקט נפשי ובאמינות מלאה.
      </p>
    </div>
  </section>
);
