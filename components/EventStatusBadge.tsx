import { Badge } from "@/components/ui/Badge";
import { Event } from "@/lib/app.types";
import { isEventSoldOut } from "@/lib/events/price";
import { getEventTagInfo } from "@/lib/eventTags";
import { cn } from "@/lib/utils";

/** The "last tickets" look (per mock): a soft outlined pill with a pulsing dot,
 *  distinct from the solid urgent badges. Shared by every scarcity tag. */
const LastTicketsTag = ({
  label,
  className,
}: {
  label: string;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border border-badge-urgent/40 bg-badge-urgent/10 px-2.5 py-1 text-xs font-bold leading-none text-badge-urgent",
      className
    )}
  >
    <span
      aria-hidden
      className="inline-block size-1.5 rounded-full bg-badge-urgent"
      style={{ animation: "tag-dot 1.4s ease-in-out infinite" }}
    />
    {label}
  </span>
);

/** Maps an event's tags / sold-out state to the right semantic Badge. */
export const EventStatusBadge = ({
  event,
  className,
}: {
  event: Event;
  className?: string;
}) => {
  if (isEventSoldOut(event)) {
    return (
      <Badge variant="soldout" className={className}>
        SOLD OUT
      </Badge>
    );
  }
  const tag = getEventTagInfo(event.tags);
  if (!tag) return null;
  // "Sold" as a manual tag on an event that still has inventory is a backoffice
  // typo more often than a real state — sold-out is decided by isEventSoldOut
  // above, so ignore it here rather than hiding a bookable event.
  if (tag.style === "soldout") return null;
  if (tag.style === "lastTickets") {
    return <LastTicketsTag label={tag.label} className={className} />;
  }
  return (
    <Badge variant={tag.style} className={className}>
      {tag.label}
    </Badge>
  );
};
