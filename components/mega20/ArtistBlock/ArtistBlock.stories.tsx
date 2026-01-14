import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArtistBlock } from "./ArtistBlock";
import ContainerImage from "./Container.svg";
import { MobileArtistBlock } from "./MobileArtistBlock";

const meta = {
  title: "Redesign/ArtistBlock",
  component: ArtistBlock,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ArtistBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleCards = [
  {
    eventDate: "March 15, 2026",
    eventPlace: "לונדון, בריטניה",
    price: "1250",
    badgeText: "Hot Sale",
    badgeVariant: "red",
  },
  {
    eventDate: "March 18, 2026",
    eventPlace: 'ברוקלין, ארה"ב',
    price: "980",
    badgeText: "On Sale",
    badgeVariant: "green",
  },
  {
    eventDate: "March 22, 2026",
    eventPlace: "יונייטד סנטר, שיקגו",
    price: "1100",
    badgeText: "Last Chance",
    badgeVariant: "yellow",
  },
  {
    eventDate: "March 25, 2026",
    eventPlace: "סידני, אוסטרליה",
    price: "1500",
  },
];

export const Default: Story = {
  render: (args) => (
    <div style={{ width: 1400, padding: 20 }}>
      <ArtistBlock {...args} />
    </div>
  ),
  parameters: {
    layout: "fullscreen",
  },
  args: {
    title: "Taylor Swift - The Eras Tour",
    imageUrl: ContainerImage,
    imageAlt: "Taylor Swift",
    cards: sampleCards,
  },
};

export const Mobile: Story = {
  render: (args) => (
    <div style={{ padding: 10 }}>
      <MobileArtistBlock {...args} />
    </div>
  ),
  parameters: {
    layout: "fullscreen",
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  args: {
    title: "Taylor Swift - The Eras Tour",
    imageUrl: ContainerImage,
    imageAlt: "Taylor Swift",
    cards: sampleCards,
  },
};
