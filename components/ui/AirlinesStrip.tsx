import Image from "next/image";

/**
 * Airline partners band — "עובדים עם חברות התעופה המובילות בעולם" (per Figma).
 * One wide strip image (public/airlines/airlines.png); scrolls horizontally on
 * small screens, fits centered on desktop.
 */
export const AirlinesStrip = () => (
  <section
    aria-label="חברות התעופה שאנחנו עובדים איתן"
    className="w-full bg-background px-4 py-10 md:px-6"
  >
    <div className="container mx-auto text-center">
      <p className="mb-6 text-sm font-medium text-muted-foreground">
        עובדים עם חברות התעופה המובילות בעולם
      </p>
      <div className="overflow-x-auto [scrollbar-width:none]" dir="ltr">
        <Image
          src="/airlines/airlines.png"
          alt="לוגואים של חברות התעופה: LOT, Aegean, Brussels Airlines, Swiss, ITA Airways, אל על, Lufthansa, ישראייר, Austrian, ארקיע, Iberia"
          width={2879}
          height={116}
          className="mx-auto h-8 w-auto max-w-none opacity-80 md:h-9"
        />
      </div>
    </div>
  </section>
);
