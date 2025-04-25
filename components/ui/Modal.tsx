import { Modal as MantineModal } from "@mantine/core";
import React from "react";
import { InfoIcon } from "lucide-react";

export const Modal = ({
  title,
  description,
  action,
  opened,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
  opened: boolean;
}) => {
  return (
    <MantineModal
      title={<InfoIcon size={32} fill="grey" color="white" />}
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
        <p className="text-md">{description}</p>
        {action}
      </div>
    </MantineModal>
  );
};
