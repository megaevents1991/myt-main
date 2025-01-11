import { ReactNode } from "react";

type CardWrapperProps = {
  isSelected: boolean;
  onClick: () => void;
  children: ReactNode;
};

export const CardWrapper = ({
  isSelected,
  onClick,
  children,
}: CardWrapperProps) => {
  return (
    <div
      onClick={onClick}
      dir="rtl"
      className={`flex cursor-pointer flex-row items-center justify-between px-6 py-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:shadow-xl hover:border-main ${
        isSelected ? "border-main border-2" : ""
      }`}
    >
      {children}
    </div>
  );
};
