import { contentfulClient } from "@/lib/contentful";
import { FootballFields } from "@/lib/app.types";
import { notFound } from "next/navigation";
import Image from "next/image";
import { BLOCKS, MARKS, Document } from "@contentful/rich-text-types";
import {
  documentToReactComponents,
  Options,
} from "@contentful/rich-text-react-renderer";
import { ReactNode } from "react";
import dayjs from "dayjs";
import Link from "next/link";
import { getEventsByName } from "@/app/api/eventsData";

export const revalidate = 3600;

export async function generateStaticParams() {
  const { items } = await contentfulClient.getEntries({
    content_type: "footballTeamTemplate",
  });

  return items.map((item) => ({
    slug: item.sys.id,
  }));
}

export default async function FootballPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await contentfulClient.getEntry<FootballFields>(slug);

  if (!team) {
    notFound();
  }

  const { name, nameDBenglish, bio, heroBanner } = team.fields;
  const bioDocument = bio as Document;

  const { events } = await getEventsByName(String(nameDBenglish));

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
      {/* Event Card Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-secondary mb-6">
          אירועים קרובים
        </h2>
        {events.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/order?eventId=${event.id}`}
                className="cursor-pointer"
              >
                <div className="rounded-lg shadow-lg flex flex-row sm:flex-col hover:shadow-xl hover:outline hover:outline-main">
                  <div className="relative group overflow-hidden rounded-l-lg sm:rounded-t-lg sm:rounded-b-none w-[48%] sm:w-auto">
                    <Image
                      src={event.card_image_url}
                      alt={name}
                      priority={true}
                      width={400}
                      height={300}
                      className="object-cover w-full h-60 transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-col text-center w-[52%] sm:w-auto">
                    <div
                      className="p-2 text-2xl font-bold"
                      style={{ lineHeight: "1.1" }}
                    >
                      {event.name}
                    </div>
                    <div className="py-1 px-2 bg-secondary text-white flex flex-wrap justify-center items-center">
                      <span>
                        {event.date
                          ? dayjs(event.date).format("DD/MM/YYYY")
                          : "תאריך יפורסם בקרוב"}
                      </span>
                      <span className="sm:inline hidden mx-2">|</span>
                      <span className="w-full sm:w-auto whitespace-nowrap">
                        {event.location.name}
                      </span>
                    </div>
                    <div className="p-2 text-right flex flex-col flex-grow">
                      <div>מחיר ממוצע לחבילה</div>
                      <div className="text-2xl font-extrabold">
                        $
                        {(
                          event.base_flight_price +
                          event.base_hotel_price +
                          Math.min(
                            ...event.tickets_and_rates.map(
                              (ticket) => ticket.price
                            )
                          ) +
                          Number(process.env.NEXT_PUBLIC_MARKUP || "150")
                        ).toLocaleString("en-US")}
                      </div>
                      <div className="flex-grow min-h-[4px]"></div>
                      <div
                        className="text-[14px]"
                        style={{ lineHeight: "1.1" }}
                      >
                        לנוסע, עבור טיסה, מלון וכרטיס לאירוע (בהרכב זוגי)
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">אין אירועים קרובים</p>
        )}
      </div>
    </div>
  );
}
