import Image from "next/image";
import { BlockContainer } from "../BlockContainer/BlockContainer";
import { Box } from "@mantine/core";
import { Carousel } from "@mantine/carousel";
import { ArtistBlockProps } from "./ArtistBlock";
import { MobileArtistCard } from "../ArtistCard/MobileArtistCard";

export const MobileArtistBlock = ({
  title,
  imageUrl,
  imageAlt = "Artist",
  cards,
}: ArtistBlockProps) => {
  return (
    <BlockContainer title={title}>
      <Box mb="md" style={{ position: "relative", width: "100%", height: 102 }}>
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          style={{ borderRadius: "16px", objectFit: "cover" }}
        />
      </Box>
      <Carousel
        dir="ltr"
        slideSize="80%"
        slideGap="md"
        align="start"
        withControls={false}
        withIndicators
        styles={{
          indicators: {
            position: "relative",
            bottom: "auto",
            marginTop: 16,
          },
          indicator: {
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "black",
          },
        }}
      >
        {cards.map((card, index) => (
          <Carousel.Slide key={index}>
            <MobileArtistCard {...card} />
          </Carousel.Slide>
        ))}
      </Carousel>
    </BlockContainer>
  );
};
