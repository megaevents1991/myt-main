import { contentfulClient } from "@/lib/contentful";
import { ArtistFields } from "@/lib/app.types";
import { notFound } from "next/navigation";
import Image from "next/image";
import { BLOCKS, MARKS, Document } from "@contentful/rich-text-types";
import {
  documentToReactComponents,
  Options,
} from "@contentful/rich-text-react-renderer";
import { ReactNode } from "react";

export async function generateStaticParams() {
  const { items } = await contentfulClient.getEntries({
    content_type: "artistTemplate",
  });

  return items.map((item) => ({
    slug: item.sys.id,
  }));
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artist = await contentfulClient.getEntry<ArtistFields>(slug);

  if (!artist) {
    notFound();
  }

  const { name, bio, heroBanner } = artist.fields;
  const bioDocument = bio as Document;

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

  return (
    <div dir="rtl" className="container mx-auto py-8 px-4">
      {heroBanner?.fields?.file?.url && (
        <Image
          src={`https:${heroBanner.fields.file.url}`}
          alt={name || ""}
          priority={true}
          width={heroBanner.fields.file.details?.image?.width || 1024}
          height={heroBanner.fields.file.details?.image?.height || 384}
          className="w-full h-96 object-cover rounded-lg mb-8"
        />
      )}
      <h1 className="text-4xl font-bold mb-4">{name}</h1>
      <div className="prose max-w-none">
        {documentToReactComponents(bioDocument, options)}
      </div>
    </div>
  );
}
