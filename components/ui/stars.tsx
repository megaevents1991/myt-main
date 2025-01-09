import { Star } from "lucide-react";

export const Stars = ({ rating }: { rating: number }) => {
  return (
    <div className="flex gap-1">
      {[...Array(5)].reverse().map((_, i) => (
        <Star key={i} {...(i < rating ? { fill: "black" } : undefined)} />
      ))}
    </div>
  );
};
