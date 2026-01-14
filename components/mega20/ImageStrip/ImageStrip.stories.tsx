import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ImageStrip } from "./ImageStrip";

import image1 from "./images/Property 1=image 1.svg";
import image2 from "./images/Property 1=image 2.svg";
import image3 from "./images/Property 1=image 3.svg";
import image4 from "./images/Property 1=image 4.svg";
import image5 from "./images/Property 1=image 5.svg";

const meta = {
  title: "Redesign/ImageStrip",
  component: ImageStrip,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ImageStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleImages = [
  { src: image1, alt: "Image 1" },
  { src: image2, alt: "Image 2" },
  { src: image3, alt: "Image 3" },
  { src: image4, alt: "Image 4" },
  { src: image5, alt: "Image 5" },
];

export const Default: Story = {
  render: (args) => (
    <div
      style={{
        width: "100%",
        padding: 20,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <ImageStrip {...args} />
    </div>
  ),
  args: {
    images: sampleImages,
  },
};

export const ThreeImages: Story = {
  render: (args) => (
    <div style={{ width: "100%", padding: 20 }}>
      <ImageStrip {...args} />
    </div>
  ),
  args: {
    images: sampleImages.slice(0, 3),
  },
};
