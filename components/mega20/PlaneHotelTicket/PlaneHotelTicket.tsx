import { Group, Stack, Text } from "@mantine/core";
import Image from "next/image";
import PlaneIcon from "./icons/plane.svg";
import HotelIcon from "./icons/hotel.svg";
import TicketIcon from "./icons/ticket.svg";
import "./PlaneHotelTicket.css";

export interface PlaneHotelTicketProps {
  animate?: boolean;
}

export function PlaneHotelTicket({ animate = false }: PlaneHotelTicketProps) {
  const icons = [
    { icon: TicketIcon, label: "כרטיס", alt: "Ticket" },
    { icon: HotelIcon, label: "מלון", alt: "Hotel" },
    { icon: PlaneIcon, label: "טיסה", alt: "Plane" },
  ];

  return (
    <Group gap="24px">
      {icons.map(({ icon, label, alt }, index) => (
        <Stack key={index} gap="4px" align="center">
          <Image
            src={icon}
            alt={alt}
            className={animate ? "icon-animate" : ""}
            style={
              animate
                ? {
                    animationDelay: `${index * 0.3}s`,
                  }
                : {}
            }
          />
          <Text size="10px" c="dimmed">
            {label}
          </Text>
        </Stack>
      ))}
    </Group>
  );
}
