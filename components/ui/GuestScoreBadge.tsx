// RateHawk guest review score (0–10). NOT TripAdvisor — labelled generically as
// a guest rating. Renders nothing when there is no score.
//
// NOTE: the reviews dump exposes the aggregate `rating` but no reliable total
// review count (only a small sample of recent reviews per hotel), so we show the
// score alone. `reviewCount` is rendered only when a real count is supplied
// (e.g. a manual override on an offline hotel).
const scoreWord = (rating: number) => {
  if (rating >= 9) return "מצוין";
  if (rating >= 8) return "טוב מאוד";
  if (rating >= 7) return "טוב";
  if (rating >= 6) return "סביר";
  return "";
};

export const GuestScoreBadge = ({
  rating,
  reviewCount,
}: {
  rating?: number;
  reviewCount?: number;
}) => {
  if (!rating || rating <= 0) return null;

  return (
    <div className="flex items-center gap-1.5" dir="ltr">
      {scoreWord(rating) && (
        <span className="text-xs font-semibold text-emerald-700">
          {scoreWord(rating)}
        </span>
      )}
      {!!reviewCount && reviewCount > 1 && (
        <span className="text-[11px] text-gray-500">
          {reviewCount} ביקורות
        </span>
      )}
      <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-sm font-bold text-white">
        {rating.toFixed(1)}
      </span>
    </div>
  );
};
