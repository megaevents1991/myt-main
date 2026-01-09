import {
  Card,
  Image,
  Text,
  Badge,
  Button,
  Group,
  NumberFormatter,
  Box,
} from "@mantine/core";
import dayjs from "dayjs";
import { PlaneHotelTicket } from "../PlaneHotelTicket/PlaneHotelTicket";

const IMAGE_SIZE = {
  mobile: { w: 294, h: 171 },
  desktop: { w: 370, h: 228 },
};

export interface MainCardProps {
  artistName: string;
  eventDate: Date | string;
  eventPlace: string;
  price: string;
  badgeText?: string;
  badgeVariant?: string;
  imageUrl?: string;
  variant?: "mobile" | "desktop";
}

export function MainCard({
  artistName,
  eventDate,
  eventPlace,
  price,
  badgeText,
  badgeVariant = "pink",
  imageUrl = "https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/images/bg-8.png",
  variant = "desktop",
}: MainCardProps) {
  return (
    <Card shadow="sm" padding="8px" radius="lg" withBorder>
      <Card.Section>
        <Image
          radius="lg"
          p="8px"
          src={imageUrl}
          alt={artistName}
          {...IMAGE_SIZE[variant]}
        />
      </Card.Section>
      <Box p={4}>
        <Text fw={700}>{artistName}</Text>
        <Group mb="xs" align="flex-start">
          <Text size="xs" fw={700}>
            {dayjs(eventDate).format("DD/MM/YY")}
          </Text>
          <Text size="xs">{eventPlace}</Text>
        </Group>

        {badgeText && (
          <Badge radius="null" color={badgeVariant}>
            {badgeText}
          </Badge>
        )}

        <Group justify="space-between" align="center" mt="md">
          <Text size="lg" fw={700}>
            <NumberFormatter prefix="$" value={price} />
          </Text>
          <PlaneHotelTicket />
        </Group>
      </Box>
      <Button color="black" fullWidth mt="xs" radius="md">
        לפרטים והזמנה
      </Button>
    </Card>
  );
}
