import { Modal as MantineModal } from "@mantine/core";
import React from "react";
import { InfoIcon, Clock9 } from "lucide-react";

// Function to wrap icons with a styled background
const IconWithBackground = ({ children }: { children: React.ReactNode }) => (
  <div className="flex mt-4 items-center justify-center w-16 h-16 rounded-lg bg-[#DBE8EA]">
    {children}
  </div>
);

const iconStyles = {
  Info: <InfoIcon size={32} fill="grey" color="white" />,
  Clock9: (
    <IconWithBackground>
      <Clock9 size={32} color="black" />
    </IconWithBackground>
  ),
};

// Type for supported icon types
type IconType = keyof typeof iconStyles;

export const Modal = ({
  title,
  description,
  action,
  opened,
  iconType = "Info",
  customIcon,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
  opened: boolean;
  iconType?: IconType;
  customIcon?: React.ReactNode;
}) => {
  // If custom icon is provided, wrap it with the background
  const displayIcon = customIcon ? (
    <IconWithBackground>{customIcon}</IconWithBackground>
  ) : (
    iconStyles[iconType]
  );

  return (
    <MantineModal
      title={displayIcon}
      centered
      styles={{
        header: {
          justifyContent: "center",
          alignItems: "center",
        },
      }}
      withCloseButton={false}
      opened={opened}
      onClose={() => void 0}
    >
      <div
        className="flex flex-col items-center justify-center gap-3 text-center"
        dir="rtl"
      >
        <h1 className="font-bold text-lg">{title}</h1>
        <p className="text-md mb-4">{description}</p>
        {action}
      </div>
    </MantineModal>
  );
};
