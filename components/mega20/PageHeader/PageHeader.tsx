import { Flex, Group } from "@mantine/core";
import { Text } from "../Text/Text";
import logo from "./MegaEvents.svg";
import Image, { StaticImageData } from "next/image";
import home from "./home.svg";
import ticket from "./ticket.svg";
import secure from "./secure.svg";

const features = [
  { icon: home, text: "מבית מגה תיירות - 30 שנות ניסיון" },
  { icon: ticket, text: "כרטיסים רשמיים בלבד" },
  { icon: secure, text: "תשלום מאובטח" },
];

function FeatureItem({ icon, text }: { icon: StaticImageData; text: string }) {
  return (
    <>
      <Image src={icon} alt="" />
      <Text c="white" fz="12px">
        {text}
      </Text>
    </>
  );
}

export const PageHeader = () => {
  return (
    <Flex
      gap="30px"
      bg="#0A1A14"
      w="100%"
      direction="column"
      justify="center"
      align="center"
    >
      <Flex gap="10px" direction="column" justify="center" align="center">
        <Image src={logo} alt="Mega Events Logo" />
        <Text c="white" fz="40px" fw={700}>
          חבילות לאירועי ספורט והופעות בעולם
        </Text>
        <Text c="#D1D5DB" fz="18px">
          הופעות, כדורגל, פסטיבלים ומרוצים – חבילות מסודרות במקום אחד
        </Text>
        <Group opacity={0.7} gap="5px" align="center">
          {features.map((feature, index) => (
            <Group key={index} gap="5px" align="center">
              {index > 0 && (
                <Text c="white" fz="12px" mx="3px">
                  |
                </Text>
              )}
              <FeatureItem icon={feature.icon} text={feature.text} />
            </Group>
          ))}
        </Group>
      </Flex>
    </Flex>
  );
};
