import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Box } from "@mantine/core";

import { LandingPage } from "./LandingPage";

const meta = {
  title: "Redesign/LandingPage",
  component: LandingPage,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof LandingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
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
