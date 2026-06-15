"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/mixpanel";
import { FaqShape } from "@/components/ui/FaqShape";

type FAQItem = {
  question: string;
  answer: string;
  hasRichText?: boolean;
};

export default function FAQAccordion({ items }: { items: FAQItem[] }) {
  return (
    <>
      {items.map((item, index) => (
        <FAQItem
          key={index}
          index={index}
          question={item.question}
          answer={item.answer}
          hasRichText={item.hasRichText}
        />
      ))}
    </>
  );
}

function FAQItem({
  index,
  question,
  answer,
  hasRichText = false,
}: {
  index: number;
  question: string;
  answer: string;
  hasRichText?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = `faq-content-${question.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex justify-between items-center p-4 text-right bg-muted hover:bg-accent transition-colors"
        onClick={() => {
          if (isOpen === false) {
            trackEvent("buttonClick", {
              buttonTag: "faq",
              buttonName: question,
              action: !isOpen ? "expand" : "collapse",
            });
          }
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
        aria-controls={contentId}
        type="button"
      >
        <span className="flex items-center gap-3">
          <FaqShape index={index} />
          <span className="font-bold">{question}</span>
        </span>
        <span className="text-xl font-bold text-muted-foreground" aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen && (
        <div className="p-4 bg-card text-card-foreground" id={contentId} role="region" aria-labelledby={contentId}>
          {hasRichText ? (
            <div
              dangerouslySetInnerHTML={{ __html: answer }}
              className="faq-rich-content"
            />
          ) : (
            answer
          )}
        </div>
      )}
    </div>
  );
}
