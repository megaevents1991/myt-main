"use client";

import { useEffect, useState } from "react";
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
 * With `cycle`, the accent HOPS between the three parts (creative follow-up,
 * ROAD MAP V1 2026-08-21: "אייקון לא מקפץ - עדיין לא" - the traveling accent
 * is wanted, the earlier round misread it as "make static"). The active part
 * lights orange and lifts slightly; reduced-motion users get a static ticket
 * accent instead.
 */
export const PackageIcons = ({
  highlight,
  cycle = false,
  className,
}: {
  highlight?: PackagePart;
  /** Travel the accent flight → hotel → ticket in a loop. */
  cycle?: boolean;
  className?: string;
}) => {
  // Start on the ticket (the product's anchor part) and hop from there.
  const [step, setStep] = useState(2);

  useEffect(() => {
    if (!cycle) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setStep((s) => (s + 1) % parts.length), 1400);
    return () => clearInterval(id);
  }, [cycle]);

  const active: PackagePart | undefined =
    highlight ?? (cycle ? parts[step].key : undefined);

  return (
    <ul className={cn("flex items-start gap-4", className)}>
      {parts.map(({ key, label, Icon }) => {
        const isActive = key === active;
        return (
          <li
            key={key}
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-medium transition-colors duration-300",
              isActive ? "text-brand-orange" : "text-muted-foreground"
            )}
          >
            <Icon
              className={cn(
                "size-5 transition-transform duration-300 ease-out motion-reduce:transition-none",
                isActive && "-translate-y-0.5 scale-110"
              )}
              aria-hidden
            />
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
};
