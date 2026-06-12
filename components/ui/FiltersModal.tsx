import { Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { ChevronDown } from "lucide-react";
import { ReactNode } from "react";

export const FiltersModal = ({
  children,
  show,
  onClose,
}: {
  children: ReactNode;
  show: boolean;
  onClose: () => void;
}) => {
  const matches = useMediaQuery("(min-width: 1024px)");

  return (
    !matches && (
      <Modal
        opened={show}
        fullScreen
        keepMounted
        onClose={() => onClose()}
        closeButtonProps={{
          style: { position: "absolute" },
          icon: <ChevronDown />,
        }}
      >
        <div className="bg-muted p-4 rounded-lg space-y-4">{children}</div>
      </Modal>
    )
  );
};
