import { contentfulClient } from "@/lib/contentful";
import { FootballFields } from "@/lib/app.types";
import { notFound } from "next/navigation";
import { BLOCKS, MARKS, Document } from "@contentful/rich-text-types";
import {
  documentToReactComponents,
  Options,
} from "@contentful/rich-text-react-renderer";
import { ReactNode } from "react";
import { getEventsByName } from "@/lib/eventsData";
import ClientTracker from "@/components/ClientTracker";
import Mondial2026MultiEventSelector from "@/components/Mondial2026MultiEventSelector";

export const revalidate = 3600;

export default async function Mondial2026Page() {
  const timestamp = Date.now();

  try {
    const { items } = await contentfulClient.getEntries<FootballFields>({
      content_type: "footballTeamTemplate",
      query: "מונדיאל 2026",
      limit: 5,
    });

    const team = items?.find((item) => item?.fields?.name === "מונדיאל 2026");
    if (!team || !team.fields) notFound();

    const { name, nameDBenglish, bio } = team.fields;
    if (!name || !nameDBenglish) notFound();

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
        [BLOCKS.PARAGRAPH]: (
          _node: unknown,
          children: ReactNode
        ): ReactNode => <Text>{children}</Text>,
      },
    };

    return (
      <main dir="rtl" className="container mx-auto pt-8 px-4">
        <ClientTracker />
        <div
          id="page-timestamp"
          data-timestamp={timestamp}
          style={{ display: "none" }}
        />
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-4">{name}</h1>
          <section className="prose max-w-none" aria-labelledby="team-bio">
            <h2 id="team-bio" className="sr-only">
              מידע על האירוע
            </h2>
            {documentToReactComponents(bioDocument, options)}
          </section>
        </header>

        <section className="mt-12" aria-labelledby="upcoming-matches">
          {events.length > 0 ? (
            <Mondial2026MultiEventSelector events={events} />
          ) : (
            <p
              className="text-center text-gray-500"
              role="status"
              aria-live="polite"
            >
              אין אירועים קרובים
            </p>
          )}
        </section>
      </main>
    );
  } catch (error) {
    console.error("Error fetching Mondial 2026 page:", error);
    notFound();
  }
}
