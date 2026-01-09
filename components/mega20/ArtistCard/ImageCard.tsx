import { Card, Text, Stack } from "@mantine/core";

export interface ImageCardProps {
  title: string;
  description: string;
  imageUrl: string;
}

export function ImageCard({ title, description, imageUrl }: ImageCardProps) {
  return (
    <Card
      shadow="sm"
      padding="16px"
      radius="lg"
      h={168}
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Stack justify="center" h="100%" gap="xs">
        <Text size="22px" fw={700} c="white">
          {title}
        </Text>
        <Text size="16px" c="white">
          {description}
        </Text>
      </Stack>
    </Card>
  );
}
