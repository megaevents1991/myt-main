import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

export const StarsGroup = ({
  onChange,
  value,
  className,
}: {
  onChange: (value: boolean[]) => void;
  value: boolean[];
  className?: string;
}) => {
  const handleOnChange = (index: number) => {
    const newValue = [...value];

    newValue[index] = !newValue[index];

    onChange(newValue);
  };

  return (
    <div className={cn("flex justify-between gap-1", className)}>
      {[...Array(5)].reverse().map((_, i) => {
        const isSelected = value[i];
        return (
          <div
            key={i}
            className={cn(
              "flex  cursor-pointer border border-gray shadow-md rounded-md px-2  py-1 items-center flex-col",
              isSelected ? "bg-main text-white" : "bg-white"
            )}
            onClick={() => handleOnChange(i)}
          >
            <div>
              <Star size={24} fill={isSelected ? "white" : "#05203C"} />
            </div>
            <div className="text-[0.5rem]">{i + 1}</div>
          </div>
        );
      })}
    </div>
  );
};
