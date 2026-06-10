import { contentfulClient } from "@/lib/contentful";
import { BlogTemplateFields } from "@/lib/app.types";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { BLOCKS, MARKS, Document } from "@contentful/rich-text-types";
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
    const post = await contentfulClient.getEntry<BlogTemplateFields>(slug);
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
    const { items } = await contentfulClient.getEntries({
      content_type: "blogTemplate",
    });

    return items.map((item) => ({
      slug: item.sys.id,
    }));
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
    const post = await contentfulClient.getEntry<BlogTemplateFields>(slug);

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
      <p className="align-center">{children}</p>
    );

    const options: Options = {
      renderMark: {
        [MARKS.BOLD]: (text: ReactNode): ReactNode => <Bold>{text}</Bold>,
      },
      renderNode: {
        [BLOCKS.PARAGRAPH]: (_node: unknown, children: ReactNode): ReactNode => (
          <Text>{children}</Text>
        ),
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
