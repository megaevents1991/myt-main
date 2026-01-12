"use client";

import { Carousel } from "@mantine/carousel";
import type { EmblaCarouselType } from "embla-carousel";
import Image from "next/image";
import { useRef, useState, useCallback } from "react";
import AutoScroll from "embla-carousel-auto-scroll";

import image1 from "./images/Property 1=image 1.svg";
import image2 from "./images/Property 1=image 2.svg";
import image3 from "./images/Property 1=image 3.svg";
import image4 from "./images/Property 1=image 4.svg";
import image5 from "./images/Property 1=image 5.svg";
import image6 from "./images/Property 1=image 6.svg";
import logo from "./images/Property 1=video.svg";

const images = [image1, image2, image3, logo, image4, image5, image6];

function getRotation(index: number, currentIndex: number, total: number) {
  const prev1 = (currentIndex - 1 + total) % total;
  const next1 = (currentIndex + 1) % total;
  const prev2 = (currentIndex - 2 + total) % total;
  const next2 = (currentIndex + 2) % total;
  const prev3 = (currentIndex - 3 + total) % total;
  const next3 = (currentIndex + 3) % total;

  if (index === prev1) return "rotate(2deg)";
  if (index === next1) return "rotate(-2deg)";
  if (index === prev2) return "rotate(4deg)";
  if (index === next2) return "rotate(-4deg)";
  if (index === prev3) return "rotate(7deg)";
  if (index === next3) return "rotate(-7deg)";
  return "rotate(0deg)";
}

export function HeroCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const autoScroll = useRef(
    AutoScroll({ speed: 1, stopOnInteraction: false, stopOnFocusIn: false })
  );

  const handleEmblaApi = useCallback((embla: EmblaCarouselType) => {
    const onSelect = () => {
      setCurrentIndex(embla.selectedScrollSnap());
    };
    embla.on("select", onSelect);
    onSelect();
  }, []);

  return (
    <Carousel
      slideSize="auto"
      height={300}
      slideGap={-30}
      withIndicators={false}
      withControls={false}
      loop
      plugins={[autoScroll.current]}
      getEmblaApi={handleEmblaApi}
    >
      {images.map((src, index) => (
        <Carousel.Slide
          key={index}
          style={{
            marginRight: "-30px",
            zIndex: currentIndex === index ? 10 : 1,
            position: "relative",
          }}
        >
          <Image
            src={src}
            alt={`Hero image ${index + 1}`}
            width={200}
            height={200}
            style={{
              width: "300px",
              height: "300px",
              objectFit: "contain",
              transform: getRotation(index, currentIndex, images.length),
              transition: "transform 0.3s ease",
            }}
          />
        </Carousel.Slide>
      ))}
    </Carousel>
  );
}
