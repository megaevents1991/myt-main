import { Box, Flex } from "@mantine/core";
import Image from "next/image";

export interface ImageStripProps {
  images: {
    src: string;
    alt?: string;
  }[];
}

const getZIndex = (index: number, total: number) => {
  const middle = Math.floor(total / 2);
  return total - Math.abs(index - middle);
};

const getRotation = (index: number, total: number) => {
  const middle = Math.floor(total / 2);
  if (index === middle) return "rotate(-9deg)";
  if (index === middle - 1 || index === middle + 1) return "rotate(8deg)";
  return "rotate(0deg)";
};

const getScale = (index: number, total: number) => {
  const middle = Math.floor(total / 2);
  if (index === middle) return "scale(1.2)";
  return "scale(1)";
};

export const ImageStrip = ({ images }: ImageStripProps) => {
  const visibleImages = images.slice(0, 5);
  return (
    <Flex wrap="nowrap" w="100%" dir="ltr">
      {visibleImages.map((image, index) => (
        <Box
          key={index}
          style={{
            position: "relative",
            flex: 1,
            aspectRatio: "1/1",
            marginLeft: index === 0 ? 0 : -50,
            zIndex: getZIndex(index, visibleImages.length),
          }}
        >
          <Image
            src={image.src}
            alt={image.alt || `Image ${index + 1}`}
            fill
            style={{
              borderRadius: "16px",
              objectFit: "cover",
              transform: `${getRotation(
                index,
                visibleImages.length
              )} ${getScale(index, visibleImages.length)}`,
            }}
          />
        </Box>
      ))}
    </Flex>
  );
};
