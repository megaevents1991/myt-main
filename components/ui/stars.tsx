import { Star } from "lucide-react";

export const Stars = ({ rating }: { rating: number }) => {
  return (
    <div className="flex gap-1 self-start pt-1">
      {[...Array(rating)].map((_, i) => (
        <Star key={i} fill="#05203C" size={20} />
      ))}
    </div>
  );
};
