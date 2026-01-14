import { Box, Grid, Flex } from "@mantine/core";
import { Carousel } from "@mantine/carousel";
import Image from "next/image";
import { ArtistCard, ArtistCardProps } from "../ArtistCard/ArtistCard";
import { BlockContainer } from "../BlockContainer/BlockContainer";

export interface ArtistBlockProps {
  title: string;
  imageUrl: string;
  imageAlt?: string;
  cards: ArtistCardProps[];
}

export function ArtistBlock({
  title,
  imageUrl,
  imageAlt = "Artist",
  cards,
}: ArtistBlockProps) {
  return (
    <BlockContainer title={title}>
      <Flex gap="md" justify="center" align="stretch">
        <Image
          src={imageUrl}
          alt={imageAlt}
          style={{ borderRadius: "16px", objectFit: "cover", maxWidth: 490 }}
        />

        <Grid gutter="md">
          {cards.slice(0, 4).map((card, index) => (
            <Grid.Col key={index} span={6}>
              <ArtistCard {...card} />
            </Grid.Col>
          ))}
        </Grid>
      </Flex>
    </BlockContainer>
  );
}
