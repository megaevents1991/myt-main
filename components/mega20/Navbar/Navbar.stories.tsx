import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Box } from "@mantine/core";

import { Navbar } from "./Navbar";

const meta = {
  title: "Redesign/Navbar",
  component: Navbar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: ["אריאנה גרנדה", "לונדון 15.08.25"],
  },
  decorators: [
    (Story) => (
      <Box>
        <Story />
        <Box h={2000} bg="gray.2" p="xl">
          Scroll down to see sticky navbar behavior
        </Box>
      </Box>
    ),
  ],
};
