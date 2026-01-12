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
      <div
        style={{
          width: 1000,
          height: 400,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HeroCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
