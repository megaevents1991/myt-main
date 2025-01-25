import { cn } from "@/lib/utils";
import { useMediaQuery } from "@mantine/hooks";
import { ReactNode } from "react";

export const SortOptionsContainer = ({
  sortOptions,
  settings,
}: {
  sortOptions: ReactNode;
  settings?: ReactNode;
}) => {
  const matches = useMediaQuery("(min-width: 768px)");

  return (
    <div className="flex w-full flex-col items-center" dir="rtl">
      <div className="w-full">
        <div className={cn("m-auto max-w-5xl")}>
          <div className="w-full flex text-center justify-between">
            {!matches && <div className="flex items-center">{settings}</div>}
            <div
              className={cn("flex gap-2", matches && "justify-between w-full")}
            >
              <div className="flex items-center gap-2">מיון לפי</div>
              <div className="flex items-center gap-2">{sortOptions}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
