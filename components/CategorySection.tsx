import { CategoryCard } from "@/components/CategoryCard";

export type HomeCategory = {
  slug: string;
  name: string;
  subtitle?: string;
  tag?: string;
  imageUrl?: string;
  sport?: string;
  linkUrl?: string;
  artImageUrl?: string;
  artColorIndex?: number;
  artShapeIndex?: number;
};

/** Homepage section of category banner cards. Renders nothing until at least
 *  one `categoryTemplate` entry exists in Contentful. */
export const CategorySection = ({
  categories,
}: {
  categories: HomeCategory[];
}) => {
  if (categories.length === 0) return null;

  return (
    <section
      aria-labelledby="categories-heading"
      className="w-full bg-background px-4 py-8 md:px-6 lg:py-10"
      dir="rtl"
    >
      <div className="container mx-auto">
        <div className="mb-4 flex flex-row items-stretch justify-start lg:mb-6">
          <div className="mx-1 bg-secondary" style={{ height: 40, width: 23 }} />
          <div className="mx-1 hidden bg-secondary sm:block" style={{ height: 40, width: 46 }} />
          <h2
            id="categories-heading"
            className="mx-2 text-center font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          >
            קטגוריות
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <CategoryCard
              key={c.slug}
              slug={c.slug}
              name={c.name}
              subtitle={c.subtitle}
              tag={c.tag}
              imageUrl={c.imageUrl}
              linkUrl={c.linkUrl}
              artImageUrl={c.artImageUrl}
              artColorIndex={c.artColorIndex}
              artShapeIndex={c.artShapeIndex}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
