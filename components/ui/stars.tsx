import { Star } from "lucide-react";

export const Stars = ({ rating }: { rating: number }) => {
  return (
    <div className="flex gap-[2px] items-center">
      {[...Array(rating)].map((_, i) => (
        <Star
          key={i}
          size={16}
          fill="currentColor"
          className="text-[#05203C] dark:text-foreground"
        />
      ))}
    </div>
  );
};
