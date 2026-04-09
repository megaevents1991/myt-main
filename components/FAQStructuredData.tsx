import type { FAQItem } from "@/lib/faq.types";

interface FAQStructuredDataProps {
  faqItems: FAQItem[];
}

export function FAQStructuredData({ faqItems }: FAQStructuredDataProps) {
  const faqPageData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.hasRichText
          ? item.answer.replace(/<[^>]*>/g, "")
          : item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(faqPageData, null, 2),
      }}
    />
  );
}
