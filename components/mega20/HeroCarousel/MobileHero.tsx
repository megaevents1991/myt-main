"use client";

import { Box, Flex } from "@mantine/core";
import Image, { StaticImageData } from "next/image";
import { useState } from "react";

import image1 from "./images/Property 1=image 1.svg";
import image2 from "./images/Property 1=image 2.svg";
import image3 from "./images/Property 1=image 3.svg";
import image4 from "./images/Property 1=image 4.svg";
import image5 from "./images/Property 1=image 5.svg";
import image6 from "./images/Property 1=image 6.svg";
import logo from "./images/Property 1=video.svg";

// Left: two stacked in front (closer to center), one in back (on edge)
const leftFront = [image1, image2];
const leftBack = image3;

// Right: two stacked in front (closer to center), one in back (on edge)
const rightFront = [image5, image6];
const rightBack = image4;

type Position = { x: string; top: string; rotate: number };

const scatteredPositions = {
  leftBack: { x: "-180%", top: "-20%", rotate: -15 },
  leftFront: [
    { x: "-200%", top: "-60%", rotate: 20 },
    { x: "-50%", top: "-40%", rotate: -10 },
  ],
  rightFront: [
    { x: "0%", top: "-80%", rotate: 15 },
    { x: "50%", top: "-10%", rotate: -20 },
  ],
  rightBack: { x: "120%", top: "-40%", rotate: 25 },
};

const organizedPositions = {
  leftBack: { x: "-250%", top: "35%", rotate: 8 },
  leftFront: [
    { x: "-180%", top: "20%", rotate: -12 },
    { x: "-180%", top: "50%", rotate: 12 },
  ],
  rightFront: [
    { x: "80%", top: "20%", rotate: 12 },
    { x: "80%", top: "50%", rotate: -12 },
  ],
  rightBack: { x: "150%", top: "35%", rotate: -8 },
};

function AnimatedImage({
  src,
  position,
  zIndex,
  alt,
}: {
  src: StaticImageData;
  position: Position;
  zIndex: number;
  alt: string;
}) {
  return (
    <Box
      pos="absolute"
      style={{
        left: "50%",
        top: position.top,
        zIndex,
        transform: `translateX(${position.x}) rotate(${position.rotate}deg)`,
        transition: "transform 0.3s ease-out, top 0.3s ease-out",
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={80}
        height={80}
        style={{ objectFit: "contain" }}
      />
    </Box>
  );
}

export function MobileHero() {
  const [isOrganized, setIsOrganized] = useState(false);
  const positions = isOrganized ? organizedPositions : scatteredPositions;

  return (
    <Flex
      justify="center"
      align="center"
      pos="relative"
      h={300}
      w="100%"
      onClick={() => setIsOrganized(!isOrganized)}
      style={{ cursor: "pointer" }}
    >
      <AnimatedImage
        src={leftBack}
        position={positions.leftBack}
        zIndex={1}
        alt="Hero image left back"
      />
      {leftFront.map((src, i) => (
        <AnimatedImage
          key={`left-front-${i}`}
          src={src}
          position={positions.leftFront[i]}
          zIndex={5}
          alt={`Hero image left front ${i + 1}`}
        />
      ))}

      <Box
        pos="absolute"
        style={{ left: "50%", zIndex: 10, transform: "translateX(-50%)" }}
      >
        <Image
          src={logo}
          alt="Hero center"
          width={160}
          height={160}
          style={{ objectFit: "contain" }}
        />
      </Box>

      {rightFront.map((src, i) => (
        <AnimatedImage
          key={`right-front-${i}`}
          src={src}
          position={positions.rightFront[i]}
          zIndex={5}
          alt={`Hero image right front ${i + 1}`}
        />
      ))}
      <AnimatedImage
        src={rightBack}
        position={positions.rightBack}
        zIndex={1}
        alt="Hero image right back"
      />
    </Flex>
  );
}
