import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MainCard } from "./MainCard";

const meta = {
  title: "Redesign/MainCard",
  component: MainCard,
  parameters: {
    layout: "centered",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/BvH75hTCzmOqn6pSigovci/MegaEvents-2.0?node-id=1-1580&m=dev",
    },
  },
  tags: ["autodocs"],
  argTypes: {
    badgeVariant: {
      control: "select",
      options: ["pink", "red", "blue", "green", "yellow", "gray"],
    },
  },
} satisfies Meta<typeof MainCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    artistName: "Taylor Swift",
    eventDate: "March 15, 2026",
    eventPlace: "Madison Square Garden, NYC",
    price: "1250.99",
    badgeText: "Hot Sale",
    badgeVariant: "red",
    variant: "desktop",
  },
};

export const WithoutBadge: Story = {
  args: {
    artistName: "Ed Sheeran",
    eventDate: "April 20, 2026",
    eventPlace: "Wembley Stadium, London",
    price: "$180",
  },
};

export const SoldOut: Story = {
  args: {
    artistName: "Beyoncé",
    eventDate: "May 5, 2026",
    eventPlace: "MetLife Stadium, NJ",
    price: "Sold Out",
    badgeText: "Sold Out",
    badgeVariant: "gray",
  },
};

export const OnSale: Story = {
  args: {
    artistName: "Coldplay",
    eventDate: "June 10, 2026",
    eventPlace: "Rose Bowl, LA",
    price: "$150",
    badgeText: "On Sale",
    badgeVariant: "green",
  },
};

export const LastChance: Story = {
  args: {
    artistName: "The Weeknd",
    eventDate: "July 22, 2026",
    eventPlace: "SoFi Stadium, LA",
    price: "200.99",
    badgeText: "Last Chance",
    badgeVariant: "yellow",
  },
};
