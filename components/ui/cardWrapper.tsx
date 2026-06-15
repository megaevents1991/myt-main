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
};

export const CardWrapper = ({
  isSelected,
  onClick,
  children,
  className,
  onMouseEnter,
  onMouseLeave,
  disabled = false,
}: CardWrapperProps) => {
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
        "flex cursor-pointer flex-row items-center justify-between px-4 py-2 bg-card text-card-foreground rounded-lg shadow-lg relative border border-2 border-border",
        "hover:shadow-xl hover:outline-2 hover:outline-main hover:outline-offset-[-2px] hover:outline-solid hover:outline",
        "focus:outline-none focus:ring-0",
        "active:outline-none active:ring-0",
        "[&:focus-visible]:outline-none [&:focus-visible]:ring-0",
        !isSelected && "focus:border-border active:border-border",
        isSelected &&
          "border-main bg-main/[0.06] focus:border-main active:border-main dark:border-foreground dark:bg-foreground/10 dark:focus:border-foreground dark:active:border-foreground",
        disabled &&
          "cursor-not-allowed border-border bg-muted opacity-60 grayscale shadow-none hover:shadow-none hover:outline-none",
        className
      )}
    >
      {children}
    </div>
  );
};
