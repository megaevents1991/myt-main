import { Star } from "lucide-react";

export const Stars = ({ rating }: { rating: number }) => {
  return (
    <div className="flex gap-[2px] items-center">
      {[...Array(rating)].map((_, i) => (
        <Star key={i} fill="#05203C" size={16} />
      ))}
    </div>
  );
};
