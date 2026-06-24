import Link from "next/link";
import Image from "next/image";

type Banner = { image_url?: string; link_url?: string; title?: string };

/**
 * #20 — promo banners on an artist / team page. Backoffice-managed (Supabase
 * `banners` jsonb). Renders nothing when empty.
 */
export const ArtistBanners = ({ banners }: { banners?: Banner[] }) => {
  const items = (banners ?? []).filter((b) => b.image_url);
  if (items.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-6" dir="rtl" aria-label="באנרים">
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible">
        {items.map((b, i) => {
          const inner = (
            <div className="relative h-40 w-[88vw] shrink-0 snap-start overflow-hidden rounded-2xl border border-border shadow-card sm:h-48 sm:w-auto">
              <Image
                src={b.image_url as string}
                alt={b.title ?? ""}
                fill
                sizes="(max-width: 640px) 88vw, 600px"
                className="object-cover transition-transform duration-300 hover:scale-105"
              />
              {b.title && (
                <>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
                  <h3 className="absolute inset-x-4 bottom-3 text-right text-xl font-extrabold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
                    {b.title}
                  </h3>
                </>
              )}
            </div>
          );
          return b.link_url ? (
            <Link key={i} href={b.link_url} className="block">
              {inner}
            </Link>
          ) : (
            <div key={i}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
};
