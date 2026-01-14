import { Box, Title } from "@mantine/core";

export const BlockContainer = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  return (
    <Box w="100%" style={{ overflow: "hidden" }}>
      <Title order={2} ta="right" mb="md">
        {title}
      </Title>
      {children}
    </Box>
  );
};
