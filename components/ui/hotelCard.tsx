import { Hotel, Rate } from "@/lib/hotel.type";
import { CardWrapper } from "./cardWrapper";
import { formatHotelName } from "@/lib/formatHotelName";
import { ArrowDownCircle, HotelIcon, CircleArrowUpIcon } from "lucide-react";
import { Collapse, ScrollArea } from "@mantine/core";
import { useState } from "react";
import { RoomCard } from "./roomCard";

export const HotelCard = ({
  hotel,
  handleSelect,
  isSelected,
}: {
  hotel: Hotel;
  handleSelect: (id: Hotel) => void;
  isSelected: boolean;
}) => {
  const hotelName = formatHotelName(hotel.id);
  const [opened, setOpened] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Rate | null>(null);

  return (
    <CardWrapper isSelected={isSelected} onClick={() => handleSelect(hotel)}>
      <div className="p-2 w-full flex flex-col items-right gap-2">
        <div className="text-2xl font-black mb-2">{hotelName}</div>
        {/* <Image src={""} alt={""} height={200} width={200} /> */}
        <HotelIcon className="border rounded-lg" size={150} />
        <div className="w-full flex flex-col justify-between items-center border border-main rounded-lg">
          <button
            className="w-full items-center p-2 text-center bg-main text-white rounded-lg"
            onClick={() => setOpened((prev) => !prev)}
          >
            {opened ? (
              <CircleArrowUpIcon className="m-auto" />
            ) : (
              <ArrowDownCircle className="m-auto" />
            )}
          </button>
          <Collapse in={opened} className="mt-4">
            {isSelected && (
              <ScrollArea className="w-full h-96" scrollbarSize={0}>
                <div className="flex flex-col gap-2">
                  {hotel.rates.map((room) => (
                    <RoomCard
                      key={room.match_hash}
                      room={room}
                      isSelected={selectedRoom?.match_hash === room.match_hash}
                      onRoomSelect={setSelectedRoom}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </Collapse>
        </div>
      </div>
    </CardWrapper>
  );
};
