import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PageHeader } from "./PageHeader";

const meta = {
  title: "Redesign/PageHeader",
  component: PageHeader,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
