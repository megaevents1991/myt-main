import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SportCard } from "./SportCard";

const meta = {
  title: "Redesign/SportCard",
  component: SportCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    badgeVariant: {
      control: "select",
      options: ["pink", "red", "blue", "green", "yellow", "gray"],
    },
  },
} satisfies Meta<typeof SportCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    eventDescription: "Real Madrid vs Barcelona",
    eventDate: "March 15, 2026",
    eventPlace: "Santiago Bernabeu",
    price: "450",
    badgeText: "El Clasico",
    badgeVariant: "red",
  },
};

export const WithoutBadge: Story = {
  args: {
    eventDescription: "Lakers vs Celtics",
    eventDate: "April 20, 2026",
    eventPlace: "Staples Center, LA",
    price: "280",
  },
};

export const SoldOut: Story = {
  args: {
    eventDescription: "Super Bowl LX",
    eventDate: "February 8, 2026",
    eventPlace: "Levi's Stadium, SF",
    price: "5000",
    badgeText: "Sold Out",
    badgeVariant: "gray",
  },
};

export const OnSale: Story = {
  args: {
    eventDescription: "Champions League Final",
    eventDate: "May 30, 2026",
    eventPlace: "Wembley Stadium",
    price: "750",
    badgeText: "On Sale",
    badgeVariant: "green",
  },
};

export const LastChance: Story = {
  args: {
    eventDescription: "World Cup Final",
    eventDate: "July 19, 2026",
    eventPlace: "MetLife Stadium, NJ",
    price: "1200",
    badgeText: "Last Chance",
    badgeVariant: "yellow",
  },
};
