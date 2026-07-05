export default function SearchLoading() {
  return (
    <main dir="rtl" className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* Search bar */}
      <div className="h-14 w-full animate-pulse rounded-2xl bg-muted" />

      {/* Category chips */}
      <div className="mt-3 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-20 animate-pulse rounded-full bg-muted" />
        ))}
      </div>

      {/* Filters */}
      <div className="mt-3 flex flex-wrap gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 w-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>

      {/* Grid */}
      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </main>
  );
}
