import { useMediaQuery } from "@mantine/hooks";
import { ReactNode } from "react";

export const SortOptionsContainer = ({
  sortOptions,
  settings,
}: {
  sortOptions: ReactNode;
  settings: ReactNode;
}) => {
  const matches = useMediaQuery("(min-width: 768px)");

  return (
    <div className="flex flex-col items-center">
      <div dir="rtl" className="w-screen  p-4 bg-gray-200">
        <div className="justify-evenly flex flex-row sm:flex-row justify-center w-full">
          <div className="w-full md:w-2/3 flex text-center gap-2 flex-row">
            {sortOptions}
          </div>
          {!matches && settings}
        </div>
      </div>
    </div>
  );
};
