import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type CardWrapperProps = {
  isSelected: boolean;
  onClick: () => void;
  children: ReactNode;
  hasBorderColor?: string;
  className?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  disabled?: boolean;
  /** "tint" (default) = forest border + faint glow fill on select.
   *  "solid" = full dark-forest fill + white text on hover/select (tickets). */
  selectedStyle?: "tint" | "solid";
};

export const CardWrapper = ({
  isSelected,
  onClick,
  children,
  className,
  onMouseEnter,
  onMouseLeave,
  disabled = false,
  selectedStyle = "tint",
}: CardWrapperProps) => {
  const solid = selectedStyle === "solid";
  return (
    <div
      onClick={disabled ? undefined : onClick}
      onMouseEnter={disabled ? undefined : onMouseEnter}
      onMouseLeave={disabled ? undefined : onMouseLeave}
      dir="rtl"
      tabIndex={-1}
      aria-disabled={disabled}
      style={{ WebkitTapHighlightColor: "transparent" }}
      className={cn(
        "flex cursor-pointer flex-row items-center justify-between px-4 py-2 bg-card text-card-foreground rounded-lg shadow-lg relative border border-2 border-border transition-colors",
        solid
          ? // Hover previews the selected look: dark forest fill + white text.
            "hover:shadow-xl hover:border-forest hover:bg-forest hover:text-white dark:hover:border-glow"
          : "hover:shadow-xl hover:outline-2 hover:outline-forest hover:outline-offset-[-2px] hover:outline-solid hover:outline",
        "focus:outline-none focus:ring-0",
        "active:outline-none active:ring-0",
        "[&:focus-visible]:outline-none [&:focus-visible]:ring-0",
        !isSelected && "focus:border-border active:border-border",
        isSelected &&
          (solid
            ? // Selected = solid dark forest green card, white text.
              "border-forest bg-forest text-white focus:border-forest active:border-forest dark:border-glow"
            : // Selected = brand dark-green border + faint glow tint.
              "border-forest bg-glow/10 focus:border-forest active:border-forest dark:border-glow dark:bg-glow/10 dark:focus:border-glow dark:active:border-glow"),
        disabled &&
          "cursor-not-allowed border-border bg-muted opacity-60 grayscale shadow-none hover:shadow-none hover:bg-muted hover:text-card-foreground hover:border-border hover:outline-none",
        className
      )}
    >
      {children}
    </div>
  );
};
