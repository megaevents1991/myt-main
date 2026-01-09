import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Faq } from "./Faq";

const meta = {
  title: "Redesign/Faq",
  component: Faq,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Faq>;

export default meta;
type Story = StoryObj<typeof meta>;

const hebrewFaqItems = [
  {
    question: "מה שעות הפעילות שלכם?",
    answer:
      "אנחנו פתוחים בימים א'-ה' בין השעות 9:00-18:00. בימי שישי אנחנו פתוחים עד 14:00. בשבת ומועדים אנחנו סגורים.",
    iconNumber: 1,
  },
  {
    question: "איך אפשר להזמין כרטיסים?",
    answer:
      "ניתן להזמין כרטיסים דרך האתר שלנו, באפליקציה הנייחת, או בטלפון לשירות הלקוחות. התשלום מאובטח ואתם מקבלים אישור מיידי.",
    iconNumber: 2,
  },
  {
    question: "מה מדיניות הביטולים?",
    answer:
      "ניתן לבטל הזמנה עד 48 שעות לפני האירוע ולקבל החזר מלא. ביטול בתוך 48 השעות האחרונות כרוך בעמלת ביטול של 20%.",
    iconNumber: 3,
  },
  {
    question: "האם יש הנחות לקבוצות?",
    answer:
      "כן! אנחנו מציעים הנחות מיוחדות להזמנות של 10 כרטיסים ומעלה. צרו איתנו קשר לפרטים נוספים ולקבלת הצעת מחיר מותאמת אישית.",
    iconNumber: 4,
  },
];

export const Default: Story = {
  args: {
    items: hebrewFaqItems,
    title: "שאלות נפוצות",
  },
};
