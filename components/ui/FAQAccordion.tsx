"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/mixpanel";

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
          question={item.question}
          answer={item.answer}
          hasRichText={item.hasRichText}
        />
      ))}
    </>
  );
}

function FAQItem({
  question,
  answer,
  hasRichText = false,
}: {
  question: string;
  answer: string;
  hasRichText?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = `faq-content-${question.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex justify-between items-center p-4 text-right bg-gray-50 hover:bg-gray-100 transition-colors"
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
        <span className="font-bold">{question}</span>
        <span className="text-xl font-bold text-gray-500" aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen && (
        <div className="p-4 bg-white" id={contentId} role="region" aria-labelledby={contentId}>
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
