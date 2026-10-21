import { EventArt } from "@/components/ui/EventArt";
import type { Event } from "@/lib/app.types";
import { eventCityName } from "@/lib/events/lodging";

/**
 * An event's art exactly as the homepage card picks it (components/ClientSideHomepage.tsx):
 * crest VS crest for a match, the neon blob + cut-out for an artist, else the card photo.
 * Size and shape come from `className` (a round avatar, a card's top panel, a stop's tile).
 */
export function TripEventArt({
  event: e,
  className,
  sizes,
  priority,
  hoverZoom = false,
}: {
  event: Event;
  className: string;
  sizes: string;
  priority?: boolean;
  hoverZoom?: boolean;
}) {
  return (
    <EventArt
      id={e.id}
      imageUrl={e.match_away_logo_url ? e.match_home_logo_url : e.art_image_url || e.card_image_url}
      awayImageUrl={e.match_away_logo_url}
      alt={`תמונת האירוע ${e.name} ב${eventCityName(e)}`}
      variant={e.art_image_url ? "blob" : "photo"}
      colorIndex={e.art_color_index ?? undefined}
      shapeIndex={e.art_shape_index ?? undefined}
      imageScale={e.art_image_scale}
      bgScale={e.art_bg_scale}
      imageOffsetX={e.art_image_offset_x}
      imageOffsetY={e.art_image_offset_y}
      priority={priority}
      sizes={sizes}
      hoverZoom={hoverZoom}
      className={className}
    />
  );
}
