import { Flex, Autocomplete } from "@mantine/core";
import Image from "next/image";
import logo from "./MegaEvents.svg";
import searchIcon from "./Vector.svg";

export interface NavbarProps {
  data?: string[];
}

export function Navbar({ data = [] }: NavbarProps) {
  return (
    <Flex
      bg="#0A1A14"
      component="nav"
      h={80}
      px={105}
      justify="space-between"
      align="center"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <Autocomplete
        w={300}
        h={45}
        placeholder="חיפוש אירוע"
        data={data}
        rightSection={<Image src={searchIcon} alt="search" />}
        styles={{
          input: {
            backgroundColor: "white",
            border: "none",
            height: "45px",
            fontSize: "16px",
            fontWeight: 700,
          },
        }}
      />
      <Image src={logo} alt="MegaEvents Logo" />
    </Flex>
  );
}
