import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Event } from "@/lib/app.types";
import { isEventSoldOut } from "@/lib/events/price";

const tagMap: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  LastTickets: { variant: "urgent", label: "כרטיסים אחרונים" },
  Popular: { variant: "urgent", label: "נמכר במהירות" },
  Restock: { variant: "new", label: "חזר למלאי" },
  VIPevent: { variant: "vip", label: "חבילת VIP" },
  VIPavailable: { variant: "vip", label: "אופציית VIP" },
};

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
  const tag = tagMap[event.tags ?? ""];
  if (!tag) return null;
  return (
    <Badge variant={tag.variant} className={className}>
      {tag.label}
    </Badge>
  );
};
