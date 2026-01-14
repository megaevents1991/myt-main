import {
  Card,
  Text,
  Badge,
  Button,
  Stack,
  Group,
  NumberFormatter,
} from "@mantine/core";
import dayjs from "dayjs";
import { ArtistCardProps } from "./ArtistCard";

export function MobileArtistCard({
  eventPlace,
  eventDate,
  price,
  badgeText,
  badgeVariant = "pink",
}: ArtistCardProps) {
  return (
    <Card shadow="sm" padding="16px" radius="lg" withBorder dir="rtl">
      <Stack gap="xs">
        {/* Row 1: Date and Location */}
        <Group gap="xs" justify="flex-start">
          <Text size="20px" fw={700}>
            {dayjs(eventDate).format("DD/MM/YY")}
          </Text>
          <Text size="20px">{eventPlace}</Text>
        </Group>

        {/* Row 2: Badge */}
        <Badge
          radius="sm"
          color={badgeVariant}
          style={{
            alignSelf: "flex-start",
            visibility: badgeText ? "visible" : "hidden",
          }}
        >
          {badgeText || "Placeholder"}
        </Badge>

        {/* Row 3: Price */}
        <Text size="18px" fw={700}>
          <NumberFormatter prefix="$" value={price} thousandSeparator="," />
        </Text>

        {/* Row 4: Full width button */}
        <Button color="black" radius="md" fullWidth>
          <Text size="16px">בחרו תאריך</Text>
        </Button>
      </Stack>
    </Card>
  );
}
