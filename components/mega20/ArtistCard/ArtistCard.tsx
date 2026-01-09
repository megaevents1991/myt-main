import {
  Card,
  Text,
  Badge,
  Button,
  Group,
  NumberFormatter,
} from "@mantine/core";
import dayjs from "dayjs";
import { PlaneHotelTicket } from "../PlaneHotelTicket/PlaneHotelTicket";

export interface ArtistCardProps {
  eventPlace: string;
  eventDate: Date | string;
  price: string;
  badgeText?: string;
  badgeVariant?: string | "sold_out";
}

export function ArtistCard({
  eventPlace,
  eventDate,
  price,
  badgeText,
  badgeVariant = "pink",
}: ArtistCardProps) {
  return (
    <Card shadow="sm" padding="16px" radius="lg" withBorder h={168}>
      <Group justify="space-between" align="center" mb="xs">
        <Text size="22px" fw={700}>
          {dayjs(eventDate).format("DD/MM/YY")}
        </Text>
        <Text size="22px" fw={700}>
          <NumberFormatter prefix="$" value={price} thousandSeparator="," />
        </Text>
      </Group>

      <Group justify="space-between" align="center">
        <Text size="22px">{eventPlace}</Text>
        {badgeText && (
          <Badge radius="null" color={badgeVariant}>
            {badgeText}
          </Badge>
        )}
      </Group>

      <Group justify="space-between" align="center" mt="auto">
        <PlaneHotelTicket />
        <Button color="black" radius="md">
          <Text size="16px">בחרו תאריך</Text>
        </Button>
      </Group>
    </Card>
  );
}
