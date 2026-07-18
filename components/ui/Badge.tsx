import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        urgent: "bg-badge-urgent text-badge-foreground", // כרטיסים אחרונים
        new: "bg-badge-new text-badge-foreground", // תאריך חדש
        vip: "bg-badge-vip text-badge-foreground", // חבילת VIP
        soldout: "bg-badge-soldout text-white", // SOLD OUT
        recommended: "bg-primary text-primary-foreground", // הבחירה שלנו
        neutral: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
