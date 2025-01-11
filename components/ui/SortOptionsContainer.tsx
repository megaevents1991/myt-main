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
    <div className="flex w-full flex-col items-center ">
      <div dir="rtl" className="mt-4 w-screen bg-gray-200">
        <div className="w-full">
          <div className="px-6 py-4 m-auto max-w-5xl">
            <div className="w-full flex text-center justify-between">
              <div className="flex items-center gap-2">{sortOptions}</div>
              {!matches && <div className="flex items-center">{settings}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
