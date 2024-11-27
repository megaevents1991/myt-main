import { ReactNode } from "react";
import { LoadingOverlay, Box, Loader } from "@mantine/core";

export const LoaderWrapper = ({
  children,
  isLoading,
}: {
  children: ReactNode;
  isLoading: boolean;
}) => {
  return (
    <>
      <Box pos="relative">
        <LoadingOverlay
          visible={isLoading}
          loaderProps={{ children: <Loader /> }}
        />
        {children}
      </Box>
    </>
  );
};
