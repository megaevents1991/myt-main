import { ReactNode } from "react";
import { LoadingOverlay, Box, Loader } from "@mantine/core";

export const LoaderWrapper = ({
  children,
  isLoading,
  height,
}: {
  children: ReactNode;
  isLoading: boolean;
  height?: string;
}) => {
  return (
    <>
      <Box pos="relative" style={{ height }}>
        <LoadingOverlay
          overlayProps={{ radius: "sm", blur: 2 }}
          visible={isLoading}
          loaderProps={{ children: <Loader /> }}
        />
        {children}
      </Box>
    </>
  );
};
