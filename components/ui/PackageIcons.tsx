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
 * - `highlight` marks one part in the accent color (static).
 * - `cycle` makes the orange accent travel flight → hotel → ticket on a loop
 *   (CSS-only, staggered per item). Reduced-motion falls back to a static
 *   highlight (ticket, or `highlight` if given).
 */
export const PackageIcons = ({
  highlight,
  cycle = false,
  className,
}: {
  highlight?: PackagePart;
  cycle?: boolean;
  className?: string;
}) => {
  // The part that stays lit when motion is reduced / cycling is off.
  const staticActive = highlight ?? (cycle ? "ticket" : undefined);
  return (
    <ul className={cn("flex items-start gap-4", className)}>
      {parts.map(({ key, label, Icon }, i) => {
        const active = key === staticActive;
        return (
          <li
            key={key}
            style={cycle ? { animationDelay: `${i * 1.4}s` } : undefined}
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-medium",
              cycle
                ? "text-muted-foreground motion-safe:animate-[pkg-cycle_4.2s_ease-in-out_infinite]"
                : active
                  ? "text-brand-orange"
                  : "text-muted-foreground",
              // Reduced-motion: keep the chosen part lit (animation is suppressed).
              cycle && active && "motion-reduce:text-brand-orange"
            )}
          >
            <Icon
              className="size-5"
              aria-hidden
              style={
                !cycle && active
                  ? { animation: "icon-glow 1.8s ease-in-out infinite" }
                  : undefined
              }
            />
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
};
