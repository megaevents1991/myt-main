import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Stack } from "@mantine/core";

import { ArtistCard } from "./ArtistCard";
import { ImageCard } from "./ImageCard";

const meta = {
  title: "Redesign/ArtistCard",
  component: ArtistCard,

  parameters: {
    layout: "centered",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/BvH75hTCzmOqn6pSigovci/MegaEvents-2.0?node-id=1-1705&m=dev",
    },
  },
  tags: ["autodocs"],
  argTypes: {
    badgeVariant: {
      control: "select",
      options: ["pink", "red", "blue", "green", "yellow", "gray"],
    },
  },
} satisfies Meta<typeof ArtistCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    eventDate: "March 15, 2026",
    eventPlace: "Madison Square Garden, NYC",
    price: "1250.99",
    badgeText: "Hot Sale",
    badgeVariant: "red",
  },
};

export const WithImageCard: Story = {
  args: {
    eventDate: "March 15, 2026",
    eventPlace: "Madison Square Garden, NYC",
    price: "1250.99",
    badgeText: "Hot Sale",
    badgeVariant: "red",
  },
  render: (args) => (
    <Stack w={350}>
      <ImageCard
        title="Taylor Swift"
        description="The Eras Tour"
        imageUrl="https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/images/bg-8.png"
      />
      <ArtistCard {...args} />
    </Stack>
  ),
};

export const WithoutBadge: Story = {
  args: {
    eventDate: "April 20, 2026",
    eventPlace: "Wembley Stadium, London",
    price: "180",
  },
};

export const SoldOut: Story = {
  args: {
    eventDate: "May 5, 2026",
    eventPlace: "MetLife Stadium, NJ",
    price: "350",
    badgeText: "Sold Out",
    badgeVariant: "gray",
  },
};

export const OnSale: Story = {
  args: {
    eventDate: "June 10, 2026",
    eventPlace: "Rose Bowl, LA",
    price: "150",
    badgeText: "On Sale",
    badgeVariant: "green",
  },
};

export const LastChance: Story = {
  args: {
    eventDate: "July 22, 2026",
    eventPlace: "SoFi Stadium, LA",
    price: "200.99",
    badgeText: "Last Chance",
    badgeVariant: "yellow",
  },
};
