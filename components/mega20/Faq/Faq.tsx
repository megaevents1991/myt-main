import { Accordion, Text, Title, Group } from "@mantine/core";
import Image from "next/image";
import Icon1 from "./icons/1.svg";
import Icon2 from "./icons/2.svg";
import Icon3 from "./icons/3.svg";
import Icon4 from "./icons/4.svg";
import Icon5 from "./icons/5.svg";

export interface FaqItem {
  question: string;
  answer: string;
  iconNumber?: number;
}

export interface FaqProps {
  items: FaqItem[];
  title?: string;
  defaultValue?: string;
}

const iconMap: Record<number, string> = {
  1: Icon1,
  2: Icon2,
  3: Icon3,
  4: Icon4,
  5: Icon5,
};

export function Faq({ items, title, defaultValue }: FaqProps) {
  return (
    <>
      {title && (
        <Title order={2} mb="lg" ta="center">
          {title}
        </Title>
      )}
      <Accordion
        defaultValue={defaultValue}
        variant="separated"
        radius="lg"
        styles={{
          item: {
            border: "1px solid #e9ecef",
            marginBottom: "0.5rem",
            backgroundColor: "white",
          },
        }}
      >
        {items.map((item, index) => (
          <Accordion.Item key={index} value={`item-${index}`}>
            <Accordion.Control>
              <Group gap="sm">
                {item.iconNumber && iconMap[item.iconNumber] && (
                  <div style={{ display: "flex", minWidth: "24px" }}>
                    <Image
                      src={iconMap[item.iconNumber]}
                      alt={`Icon ${item.iconNumber}`}
                      width={24}
                      height={24}
                    />
                  </div>
                )}
                <Text fw={700}>{item.question}</Text>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="dimmed">
                {item.answer}
              </Text>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </>
  );
}
