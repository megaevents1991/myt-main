import { Plane, Building2, Ticket } from "lucide-react";

import { cn } from "@/lib/utils";

type PackagePart = "flight" | "hotel" | "ticket";

const parts: { key: PackagePart; label: string; Icon: typeof Plane }[] = [
  { key: "flight", label: "טיסה", Icon: Plane },
  { key: "hotel", label: "מלון", Icon: Building2 },
  { key: "ticket", label: "כרטיס", Icon: Ticket },
];

/**
 * The plane / hotel / ticket row shown on every event + date card.
 * STATIC by creative decree (ROAD MAP V1, 2026-08-20: "אייקון לא מקפץ") -
 * the traveling-accent animation is gone everywhere. `highlight` (or the old
 * `cycle`, kept so callers don't break) lights one part in the accent color.
 */
export const PackageIcons = ({
  highlight,
  cycle = false,
  className,
}: {
  highlight?: PackagePart;
  /** Legacy flag - now just means "light the ticket part". No animation. */
  cycle?: boolean;
  className?: string;
}) => {
  const staticActive = highlight ?? (cycle ? "ticket" : undefined);
  return (
    <ul className={cn("flex items-start gap-4", className)}>
      {parts.map(({ key, label, Icon }) => {
        const active = key === staticActive;
        return (
          <li
            key={key}
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-medium",
              active ? "text-brand-orange" : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
};
