import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlaneHotelTicket } from "./PlaneHotelTicket";

const meta = {
  title: "Redesign/PlaneHotelTicket",
  component: PlaneHotelTicket,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    animate: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof PlaneHotelTicket>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    animate: false,
  },
};

export const Animated: Story = {
  args: {
    animate: true,
  },
};
