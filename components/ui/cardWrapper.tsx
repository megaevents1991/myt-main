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
};

export const CardWrapper = ({
  isSelected,
  onClick,
  children,
  className,
  onMouseEnter,
  onMouseLeave,
}: CardWrapperProps) => {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      dir="rtl"
      tabIndex={-1}
      style={{ WebkitTapHighlightColor: "transparent" }}
      className={cn(
        "flex cursor-pointer flex-row items-center justify-between px-4 py-2 bg-white rounded-lg shadow-lg relative border border-2 border-gray-200",
        "hover:shadow-xl hover:outline-2 hover:outline-main hover:outline-offset-[-2px] hover:outline-solid hover:outline",
        "focus:outline-none focus:ring-0",
        "active:outline-none active:ring-0",
        "[&:focus-visible]:outline-none [&:focus-visible]:ring-0",
        !isSelected && "focus:border-gray-200 active:border-gray-200",
        isSelected &&
          "border-secondary bg-[#277E890D] focus:border-secondary active:border-secondary",
        className
      )}
    >
      {children}
    </div>
  );
};
