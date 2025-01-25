import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type CardWrapperProps = {
  isSelected: boolean;
  onClick: () => void;
  children: ReactNode;
  hasBorderColor?: string;
  className?: string;
};

export const CardWrapper = ({
  isSelected,
  onClick,
  children,
  className,
}: CardWrapperProps) => {
  return (
    <div
      onClick={onClick}
      dir="rtl"
      className={cn(
        "flex cursor-pointer flex-row items-center justify-between px-4 py-2 bg-white rounded-lg shadow-lg relative border border-2 border-gray-200",
        "hover:shadow-xl hover:outline-2 hover:outline-main hover:outline-offset-[-2px] hover:outline-solid hover:outline",
        isSelected && "border-main bg-[#277E890D]",
        className
      )}
    >
      {children}
    </div>
  );
};
