/** Extract an 11-char YouTube video id from any common URL form. */
export const youtubeId = (url?: string | null): string | null => {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
};

/** Privacy-friendly embed URL for a YouTube id. */
export const youtubeEmbed = (
  id: string,
  opts: { autoplay?: boolean; mute?: boolean; loop?: boolean } = {}
): string => {
  const p = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
  if (opts.autoplay) p.set("autoplay", "1");
  if (opts.mute) p.set("mute", "1");
  if (opts.loop) {
    p.set("loop", "1");
    p.set("playlist", id);
  }
  return `https://www.youtube-nocookie.com/embed/${id}?${p.toString()}`;
};
