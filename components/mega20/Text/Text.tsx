import { Text as MantineText, TextProps } from "@mantine/core";
import { ReactNode } from "react";

const Variants: Record<string, Record<"base" | "md", TextProps>> = {
  h2: {
    base: {
      fw: 700,
      fz: "20px",
    },
    md: {
      fz: 32,
    },
  },
  bodySm: {
    base: {
      fw: 700,
      fz: "20px",
    },
    md: {
      fz: "16px",
    },
  },
  h1: {
    base: {
      c: "#0A1A14",
      fw: 700,
      fz: "24px",
    },
    md: {
      fz: 40,
      lh: "48px",
    },
  },
  h3: {
    base: {
      fw: 700,
      fz: "18px",
    },
    md: {
      fz: 24,
    },
  },
  body: {
    base: {
      fw: 400,
      fz: "15px",
    },
    md: {
      fz: "18px",
    },
  },
  label: {
    base: {
      fw: 600,
      fz: "12px",
    },
    md: {
      fz: "16px",
    },
  },
  price: {
    base: {
      fw: 700,
      fz: "18px",
    },
    md: {
      fz: "24px",
    },
  },
  note: {
    base: {
      fw: 400,
      fz: "10px",
    },
    md: {
      fz: "14px",
    },
  },
  display: {
    base: {
      fw: 700,
      fz: "40px",
    },
    md: {
      fz: "48px",
    },
  },
};

export const Text = ({
  children,
  ...props
}: TextProps & { children?: ReactNode }) => {
  return <MantineText {...props}>{children}</MantineText>;
};
