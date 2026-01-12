import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Footer } from "./Footer";

const meta = {
  title: "Redesign/Footer",
  component: Footer,
  parameters: {
    layout: "fullscreen",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/BvH75hTCzmOqn6pSigovci/MegaEvents-2.0?node-id=346-16926&m=dev",
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    description:
      "לידיעתך, באתר זה נעשה שימוש בקבצי Cookies. המשך גלישה באתר מהווה הסכמה לשימוש זה. למידע נוסף ניתן לעיין במדיניות הפרטיות של האתר.",
    links: [
      { label: "ביטול הזמנה", href: "/cancel" },
      { label: "הצהרות נגישות", href: "/accessibility" },
      { label: "מדיניות פרטיות", href: "/privacy" },
      { label: "תנאי שימוש", href: "/terms" },
      { label: "הקבוצות שלנו", href: "/teams" },
      { label: "האמנים שלנו", href: "/artists" },
      { label: "שאלות נפוצות", href: "/faq" },
      { label: "אודותינו", href: "/about" },
    ],
    copyright: "© 2025 מגה איבנטס מבית מגה תיירות. כל הזכויות שמורות.",
  },
};
