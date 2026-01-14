import type { Preview } from "@storybook/nextjs-vite";
import { INITIAL_VIEWPORTS } from "storybook/viewport";
import React from "react";
import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/carousel/styles.css";

const theme = createTheme({
  colors: {
    forestBlack: [
      "#e6f0ed",
      "#cde1db",
      "#9bc3b7",
      "#69a593",
      "#37876f",
      "#0A1A14",
      "#081612",
      "#06120f",
      "#040e0b",
      "#020a08",
    ],
  },
});

const preview: Preview = {
  parameters: {
    viewport: {
      options: INITIAL_VIEWPORTS,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
  initialGlobals: {
    viewport: { value: "ipad", isRotated: false },
  },
  decorators: [
    (Story) => (
      <MantineProvider theme={theme}>
        <div dir="rtl">
          <Story />
        </div>
      </MantineProvider>
    ),
  ],
};

export default preview;
