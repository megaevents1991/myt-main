import { cn } from "@/lib/utils";

export type EventTagType =
  | "LastTickets"
  | "Popular"
  | "Restock"
  | "VIPevent"
  | "VIPavailable"
  | "Sold";

const TAG_CONFIG: Record<
  EventTagType,
  { text: string; className: string; ariaLabel: string }
> = {
  LastTickets: {
    text: "כרטיסים אחרונים!",
    className: "bg-secondary text-white",
    ariaLabel: "כרטיסים אחרונים",
  },
  Popular: {
    text: "נמכר במהירות!",
    className: "bg-secondary text-white",
    ariaLabel: "אירוע פופולרי",
  },
  Restock: {
    text: "חזר למלאי!",
    className: "bg-[#52C4A3] text-white",
    ariaLabel: "חזר למלאי",
  },
  VIPevent: {
    text: "אירוח VIP",
    className: "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black",
    ariaLabel: "חבילת VIP זמינה",
  },
  VIPavailable: {
    text: "אופציית VIP",
    className: "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black",
    ariaLabel: "אופציית VIP זמינה",
  },
  Sold: {
    text: "אזלו הכרטיסים",
    className: "bg-[#d63a59] text-white",
    ariaLabel: "אזלו הכרטיסים",
  },
};

type EventTagBadgeProps = {
  tag: EventTagType;
};

export function EventTagBadge({ tag }: EventTagBadgeProps) {
  const config = TAG_CONFIG[tag];

  return (
    <div
      className={cn(
        "absolute top-0 left-0 w-64 h-10 font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5",
        config.className
      )}
      aria-label={config.ariaLabel}
    >
      {config.text}
    </div>
  );
}

export function isValidEventTag(tag: string | undefined): tag is EventTagType {
  return tag !== undefined && tag in TAG_CONFIG;
}
