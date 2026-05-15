import { CSSProperties, ReactNode } from "react";
import { LoadingOverlay, Box, Loader } from "@mantine/core";

export const LoaderWrapper = ({
  children,
  isLoading,
  height,
  position = "relative",
  text = "",
}: {
  children: ReactNode;
  isLoading: boolean;
  height?: string;
  position?: CSSProperties["position"];
  text?: ReactNode;
}) => {
  return (
    <>
      <Box pos={position} style={{ height }}>
        <LoadingOverlay
          overlayProps={{ radius: "sm", blur: 2 }}
          visible={isLoading}
          loaderProps={{
            children: (
              <div
                style={{
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="flex flex-col items-center justify-center gap-2 text-foreground">
                  <Loader color="var(--mantine-color-myColor-4)" />
                  {text}
                </div>
              </div>
            ),
          }}
        />
        {children}
      </Box>
    </>
  );
};
