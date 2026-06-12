import { Modal as MantineModal } from "@mantine/core";
import React from "react";
import { InfoIcon, Clock9, Plane, Beer, Gift } from "lucide-react";

// Function to wrap icons with a styled background
const IconWithBackground = ({ children }: { children: React.ReactNode }) => (
  <div className="flex mt-4 items-center justify-center w-16 h-16 rounded-2xl bg-accent text-primary">
    {children}
  </div>
);

const iconStyles = {
  Info: (
    <IconWithBackground>
      <InfoIcon size={32} />
    </IconWithBackground>
  ),
  Clock9: (
    <IconWithBackground>
      <Clock9 size={32} />
    </IconWithBackground>
  ),
  Plane: (
    <IconWithBackground>
      <Plane size={32} />
    </IconWithBackground>
  ),
  Beer: (
    <IconWithBackground>
      <Beer size={32} />
    </IconWithBackground>
  ),
  Gift: (
    <IconWithBackground>
      <Gift size={32} />
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
  description: React.ReactNode;
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
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <h1 className="font-display font-bold text-lg">{title}</h1>
        <div className="text-md mb-4 text-muted-foreground">{description}</div>
        {action}
      </div>
    </MantineModal>
  );
};
