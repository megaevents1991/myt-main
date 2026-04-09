export interface FAQItem {
  question: string;
  answer: string;
  hasRichText?: boolean;
}

export type FAQItems = FAQItem[];
