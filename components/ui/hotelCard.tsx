import { Hotel, HotelInfoClient, Rate, Room } from "@/lib/hotel.type";
import { CardWrapper } from "./cardWrapper";
import { formatHotelName } from "@/lib/formatHotelName";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Collapse, ScrollArea } from "@mantine/core";
import { Carousel } from "@mantine/carousel";

import { useEffect, useState } from "react";
import { RoomCard } from "./roomCard";
import Image from "next/image";
import { Stars } from "./stars";
import { cn } from "@/lib/utils";
import { OrderHotel } from "@/lib/app.types";

export const HotelCard = ({
  hotelRates,
  handleSelect,
  isSelected,
  hotelInfo,
  handleSelectedRate,
}: {
  hotelRates: Hotel["rates"];
  handleSelect: () => void;
  isSelected: boolean;
  hotelInfo: HotelInfoClient;
  handleSelectedRate: (orderHotel: OrderHotel) => void;
}) => {
  const [opened, setOpened] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Rate | null>(null);
  const [selectedRoomInfo, setSelectedRoomInfo] = useState<Room | null>(null);
  const [showHotelData, setShowHotelData] = useState(false);

  useEffect(() => {
    if (hotelRates.length) {
      const firstRoom = hotelRates[0];
      const roomName =
        firstRoom.room_data_trans.main_name +
        " " +
        firstRoom.room_data_trans.bedding_type;
      setSelectedRoom(hotelRates[0]);
      setSelectedRoomInfo(hotelInfo?.rooms[roomName]);
    }
  }, []);

  useEffect(() => {
    if (!isSelected && opened) {
      setOpened(false);
    }
  }, [isSelected]);

  const handleRoomSelect = (room: Rate) => {
    const roomName = `${room.room_data_trans.main_name}${
      room.room_data_trans.bedding_type
        ? " " + room.room_data_trans.bedding_type
        : ""
    }`;
    setSelectedRoom(room);
    setSelectedRoomInfo(hotelInfo?.rooms[roomName]);
    handleSelectedRate({
      rate: room,
      address: hotelInfo.metadata.address,
      name: hotelInfo.metadata.hotelName,
      id: hotelInfo.metadata.id,
      price: room.payment_options.payment_types[0].show_amount,
    });
  };

  return (
    <CardWrapper isSelected={isSelected} onClick={handleSelect}>
      <div className="px-2 w-full flex flex-col items-right gap-2">
        <div className="flex flex-col md:flex-row md:content-between  gap-2">
          <div className="flex flex-col md:w-4/5 items-right gap-2">
            <div className="flex flex-row justify-start items-center gap-2">
              <div className="font-bold text-lg">
                {formatHotelName(hotelInfo.metadata.hotelName)}
              </div>
              <Stars rating={hotelInfo.metadata.rating} />
            </div>
            <div className="flex flex-row gap-2">
              <Carousel
                initialSlide={0}
                withIndicators
                className="w-1/3"
                dir="ltr"
                styles={{
                  indicators: {
                    maxWidth: "90%",
                    justifySelf: "center",
                  },
                }}
              >
                {[
                  ...(hotelInfo?.general.images || ""),
                  ...(selectedRoomInfo?.images || ""),
                ].map((image, i) => {
                  return image ? (
                    <Carousel.Slide key={i}>
                      <Image
                        className="border rounded-lg"
                        width={240}
                        height={240}
                        src={image.replace("{size}", "240x240")}
                        alt="image"
                      />
                    </Carousel.Slide>
                  ) : null;
                })}
              </Carousel>
              {/* <HotelIcon className="border rounded-lg" size={150} /> */}
              <div className="w-2/3">
                <div>{selectedRoom?.room_data_trans.main_name}</div>
                <button
                  onClick={() => setShowHotelData(true)}
                  className={cn(
                    showHotelData && "bg-main text-white",
                    "px-1 border rounded-md mr-1"
                  )}
                >
                  שירותי המלון
                </button>
                <button
                  onClick={() => setShowHotelData(false)}
                  className={cn(
                    !showHotelData && "bg-main text-white",
                    "px-1 border rounded-md mr-1"
                  )}
                >
                  פרטי חדר
                </button>
                <br />
                {(!showHotelData
                  ? selectedRoomInfo
                  : hotelInfo?.general
                )?.amenities.map((amenity) => (
                  <span
                    style={{ display: "inline-block" }}
                    className="bg-gray-200 rounded-md text-xs px-1 py-0.5 m-1"
                    key={amenity}
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex md:w-1/5 md:justify-center md:items-center md:border-r md:pr-6">
            מחיר לחדר{" "}
            {selectedRoom?.payment_options.payment_types[0].show_amount}&#8364;
          </div>
        </div>
        <div className="w-full flex flex-col justify-between items-center rounded-lg md:items-right">
          <div
            className="w-full items-center pt-2 text-center border-t md:border-none border-main md:text-right cursor-pointer"
            onClick={() => setOpened((prev) => !prev)}
          >
            {opened ? (
              <ChevronUp className="m-auto" color="black" />
            ) : (
              <div className="flex items-center justify-center gap-2">
                {hotelRates.length}
                <span>סוגי חדרים נוספים</span>
                <ChevronDown color="black" />
              </div>
            )}
          </div>
          <Collapse in={opened} className="mt-4 w-full">
            {isSelected && (
              <ScrollArea className="w-full h-96" scrollbarSize={0}>
                <div className="flex flex-col gap-2">
                  {hotelRates.map((room) => (
                    <RoomCard
                      key={room.match_hash}
                      room={room}
                      isSelected={selectedRoom?.match_hash === room.match_hash}
                      onRoomSelect={handleRoomSelect}
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
