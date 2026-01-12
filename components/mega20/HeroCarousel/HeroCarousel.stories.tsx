import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { HeroCarousel } from "./HeroCarousel";

const meta = {
  title: "Redesign/HeroCarousel",
  component: HeroCarousel,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div dir="ltr" style={{ width: 800 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HeroCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
