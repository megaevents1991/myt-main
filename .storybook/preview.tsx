import type { Preview } from "@storybook/nextjs-vite";
import { INITIAL_VIEWPORTS } from "storybook/viewport";
import React from "react";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";

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
      <MantineProvider>
        <div dir="rtl">
          <Story />
        </div>
      </MantineProvider>
    ),
  ],
};

export default preview;
