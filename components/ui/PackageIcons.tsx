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
 * `highlight` marks the part rendered in the accent color.
 */
export const PackageIcons = ({
  highlight,
  className,
}: {
  highlight?: PackagePart;
  className?: string;
}) => (
  <ul className={cn("flex items-start gap-4", className)}>
    {parts.map(({ key, label, Icon }) => {
      const active = key === highlight;
      return (
        <li
          key={key}
          className={cn(
            "flex flex-col items-center gap-1 text-[11px] font-medium",
            active ? "text-brand-orange" : "text-muted-foreground"
          )}
        >
          <Icon
            className="size-5"
            aria-hidden
            style={
              active
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
