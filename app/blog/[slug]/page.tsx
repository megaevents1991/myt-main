import { getBlogPostBySlug, getBlogPostSlugs } from "@/lib/blog";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { BLOCKS, INLINES, MARKS, Document } from "@contentful/rich-text-types";
import {
  documentToReactComponents,
  Options,
} from "@contentful/rich-text-react-renderer";
import { ReactNode } from "react";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const post = await getBlogPostBySlug(slug);
    if (!post?.fields?.title) {
      return { title: "Blog Post Not Found - MYT" };
    }

    const { title, previewText, seoTitleTag, metaDescription, metaTags, heroBanner } = post.fields;
    const seoT = String(seoTitleTag || "") || `${title} | מגה איבנטס`;
    const description = String(metaDescription || previewText || "") || String(title);
    const keywords = metaTags || `${title}, בלוג, מגה איבנטס`;
    const imageUrl = heroBanner?.fields?.file?.url
      ? `https:${heroBanner.fields.file.url}`
      : undefined;

    return {
      title: seoT,
      description,
      keywords,
      alternates: {
        canonical: `https://www.mega-events.co.il/blog/${slug}`,
      },
      openGraph: {
        title: seoT,
        description,
        ...(imageUrl && {
          images: [{ url: imageUrl, width: 800, height: 600, alt: String(title) }],
        }),
      },
    };
  } catch {
    return { title: "Blog Post Not Found - MYT" };
  }
}

export async function generateStaticParams() {
  try {
    const slugs = await getBlogPostSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch (error) {
    console.error('Error generating static params for blog:', error);
    return [];
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const timestamp = Date.now();

  try {
    const post = await getBlogPostBySlug(slug);

    if (!post || !post.fields) {
      notFound();
    }

    const { title, byWho, heroBanner, mainContent } = post.fields;

    if (!title) {
      console.error('Blog post missing required title:', { slug });
      notFound();
    }

    const bodyDocument = mainContent as Document;

    const Bold = ({ children }: { children: ReactNode }) => (
      <span className="font-bold">{children}</span>
    );

    const Text = ({ children }: { children: ReactNode }) => (
      <p className="my-4 leading-relaxed">{children}</p>
    );

    // Explicit block styling: Tailwind preflight resets headings/lists/links
    // to plain text and the `prose` classes are inert (no typography plugin),
    // so without these every heading and link rendered as body copy.
    const heading = (className: string, Tag: "h2" | "h3" | "h4") =>
      function Heading(_node: unknown, children: ReactNode): ReactNode {
        return <Tag className={className}>{children}</Tag>;
      };
    const isExternal = (uri: string) =>
      /^https?:\/\//i.test(uri) && !/mega-events\.co\.il/i.test(uri);

    const options: Options = {
      renderMark: {
        [MARKS.BOLD]: (text: ReactNode): ReactNode => <Bold>{text}</Bold>,
        [MARKS.ITALIC]: (text: ReactNode): ReactNode => <em>{text}</em>,
      },
      renderNode: {
        [BLOCKS.PARAGRAPH]: (_node: unknown, children: ReactNode): ReactNode => (
          <Text>{children}</Text>
        ),
        // The post title is the page <h1>; body heading-1 renders as an h2.
        [BLOCKS.HEADING_1]: heading("mt-10 mb-4 text-2xl sm:text-3xl font-bold leading-tight", "h2"),
        [BLOCKS.HEADING_2]: heading("mt-10 mb-4 text-2xl sm:text-3xl font-bold leading-tight", "h2"),
        [BLOCKS.HEADING_3]: heading("mt-8 mb-3 text-xl sm:text-2xl font-bold leading-snug", "h3"),
        [BLOCKS.HEADING_4]: heading("mt-6 mb-2 text-lg font-bold", "h4"),
        [BLOCKS.UL_LIST]: (_node: unknown, children: ReactNode): ReactNode => (
          <ul className="my-4 list-disc ps-6 space-y-1">{children}</ul>
        ),
        [BLOCKS.OL_LIST]: (_node: unknown, children: ReactNode): ReactNode => (
          <ol className="my-4 list-decimal ps-6 space-y-1">{children}</ol>
        ),
        [BLOCKS.LIST_ITEM]: (_node: unknown, children: ReactNode): ReactNode => (
          <li className="[&>p]:my-0">{children}</li>
        ),
        [BLOCKS.QUOTE]: (_node: unknown, children: ReactNode): ReactNode => (
          <blockquote className="my-6 border-s-4 border-secondary ps-4 italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        [INLINES.HYPERLINK]: (node, children: ReactNode): ReactNode => {
          const uri = String((node.data as { uri?: string })?.uri ?? "");
          const external = isExternal(uri);
          return (
            <a
              href={uri}
              className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-sky-300 dark:hover:text-sky-200"
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {children}
            </a>
          );
        },
      },
    };

    const heroUrl = heroBanner?.fields?.file?.url
      ? "https:" + heroBanner.fields.file.url
      : null;

    return (
      <main dir="rtl" className="container mx-auto py-8 px-4 max-w-4xl">
        <div id="page-timestamp" data-timestamp={timestamp} style={{ display: 'none' }} />
        {heroUrl && (
          <div className="relative w-full aspect-[21/9] mb-8 rounded-xl overflow-hidden shadow-lg">
            <Image
              src={heroUrl}
              alt={`תמונה לבלוג ${String(title)}`}
              priority={true}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              style={{ objectPosition: 'center' }}
              className="object-cover"
            />
          </div>
        )}
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 leading-tight">{String(title)}</h1>
          {byWho && (
            <p className="text-sm text-gray-500">מאת {String(byWho)}</p>
          )}
        </header>
        <section className="prose prose-lg max-w-none" aria-labelledby="blog-body">
          <h2 id="blog-body" className="sr-only">תוכן הבלוג</h2>
          {documentToReactComponents(bodyDocument, options)}
        </section>
      </main>
    );
  } catch (error) {
    console.error('Error fetching blog post:', error);
    notFound();
  }
}
