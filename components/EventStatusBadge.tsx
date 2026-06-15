import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Event } from "@/lib/app.types";
import { isEventSoldOut } from "@/lib/events/price";
import { cn } from "@/lib/utils";

const tagMap: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  Popular: { variant: "urgent", label: "נמכר במהירות" },
  Restock: { variant: "new", label: "חזר למלאי" },
  VIPevent: { variant: "vip", label: "חבילת VIP" },
  VIPavailable: { variant: "vip", label: "אופציית VIP" },
};

/** The "last tickets" tag gets its own look (per mock): a soft outlined pill
 *  with a pulsing dot, distinct from the solid urgent badges. */
const LastTicketsTag = ({ className }: { className?: string }) => (
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
    כרטיסים אחרונים
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
  if (event.tags === "LastTickets") {
    return <LastTicketsTag className={className} />;
  }
  const tag = tagMap[event.tags ?? ""];
  if (!tag) return null;
  return (
    <Badge variant={tag.variant} className={className}>
      {tag.label}
    </Badge>
  );
};
