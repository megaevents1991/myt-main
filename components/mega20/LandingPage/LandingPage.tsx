import { Navbar } from "../Navbar/Navbar";
import { PageHeader } from "../PageHeader/PageHeader";
import { HeroCarousel } from "../HeroCarousel/HeroCarousel";
import { Box, Space } from "@mantine/core";

export function LandingPage() {
  return (
    <Box bg="#0A1A14">
      <Navbar />
      <Space h="md" />
      <PageHeader />
      <Space h="50px" />
      <HeroCarousel />
      <Space h="50px" />
      {/* Autocomplete component */}
    </Box>
  );
}
