import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Box, Space } from "@mantine/core";

import { MobileHero } from "./MobileHero";

const meta = {
  title: "Redesign/MobileHero",
  component: MobileHero,
  parameters: {
    layout: "fullscreen",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/BvH75hTCzmOqn6pSigovci/MegaEvents-2.0?node-id=194-8334&m=dev",
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <Box bg="#0A1A14" h="100vh">
        <Space h="300px" />
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof MobileHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
