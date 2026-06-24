import { youtubeId, youtubeEmbed } from "@/lib/youtube";

type Video = { url?: string; label?: string };

/**
 * #24 — performance videos on an artist / team page. Backoffice-managed
 * (Supabase `videos` jsonb: [{ url, label }]). Lazy YouTube embeds. Renders
 * nothing when empty / no valid YouTube URLs.
 */
export const ArtistVideos = ({ videos }: { videos?: Video[] }) => {
  const items = (videos ?? [])
    .map((v) => ({ id: youtubeId(v.url), label: v.label }))
    .filter((v): v is { id: string; label: string | undefined } => v.id !== null);
  if (items.length === 0) return null;

  return (
    <section
      className="container mx-auto px-4 py-12"
      dir="rtl"
      aria-labelledby="videos-heading"
    >
      <h2
        id="videos-heading"
        className="mb-6 font-display text-2xl font-extrabold text-foreground"
      >
        מתוך ההופעות
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((v, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="relative aspect-video">
              <iframe
                src={youtubeEmbed(v.id)}
                title={v.label ?? `וידאו ${i + 1}`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
            {v.label && (
              <p className="px-4 py-3 text-right text-sm font-bold text-foreground">
                {v.label}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
