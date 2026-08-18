import type { ReactNode } from "react";

/** The homepage section heading - secondary cubes + display type. Shared by
 * the vertical hub (/c/football) and league pages. */
export const SectionHeading = ({ id, children }: { id: string; children: ReactNode }) => (
  <div className="mb-4 mt-2 flex flex-row items-stretch justify-start lg:mb-6">
    <div className="mx-1 bg-secondary" style={{ height: 40, width: 23 }} aria-hidden />
    <div className="mx-1 hidden bg-secondary sm:block" style={{ height: 40, width: 23 }} aria-hidden />
    <div className="mx-1 hidden bg-secondary sm:block" style={{ height: 40, width: 46 }} aria-hidden />
    <h2
      id={id}
      className="mx-2 text-center font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl"
    >
      {children}
    </h2>
  </div>
);
