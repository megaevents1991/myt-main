"use client";

import { Anchor, Flex, em } from "@mantine/core";
import { Text } from "../Text/Text";
import logo from "./mega.svg";
import Image from "next/image";
import { useMediaQuery } from "@mantine/hooks";
import { Carousel } from "@mantine/carousel";
import AutoScroll from "embla-carousel-auto-scroll";
import { useRef } from "react";

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterProps {
  description: string;
  links: FooterLink[];
  copyright: string;
}

function LogoMarquee() {
  const logoCount = 10;
  const autoScroll = useRef(
    AutoScroll({ speed: 1, stopOnInteraction: false, stopOnFocusIn: false })
  );

  return (
    <Carousel
      dir="ltr"
      loop
      slideSize="auto"
      withControls={false}
      slideGap="xl"
      align="start"
      plugins={[autoScroll.current]}
      withIndicators={false}
      height={58}
      bg="#5BFF95"
      w="100%"
    >
      {[...Array(logoCount)].map((_, i) => (
        <Carousel.Slide
          key={i}
          style={{ display: "flex", alignItems: "center" }}
        >
          <Image src={logo} alt="Mega Logo" height={40} />
        </Carousel.Slide>
      ))}
    </Carousel>
  );
}

export function Footer({ description, links, copyright }: FooterProps) {
  const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

  return (
    <>
      <LogoMarquee />
      <Flex
        component="footer"
        bg="#0A1A14"
        justify="center"
        align={isMobile ? "flex-start" : "center"}
        direction="column"
        gap="xl"
        p="xl"
        ta={isMobile ? "right" : "center"}
        style={{ overflow: "hidden", maxWidth: "100vw" }}
      >
        <Text size="16px" c="dimmed">
          {description}
        </Text>
        <Flex gap="md" direction={isMobile ? "column" : "row"}>
          {links.map((link) => (
            <Anchor key={link.href} href={link.href} size="14px" c="white">
              {link.label}
            </Anchor>
          ))}
        </Flex>
        <Text size="14px" c="dimmed">
          {copyright}
        </Text>
      </Flex>
    </>
  );
}
