import { Hotel, HotelInfoClient, Rate, Room } from "@/lib/hotel.type";
import { CardWrapper } from "./cardWrapper";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Collapse, ScrollArea, Skeleton } from "@mantine/core";
import { Carousel, Embla } from "@mantine/carousel";

import { useEffect, useState } from "react";
import { RoomCard } from "./roomCard";
import Image from "next/image";
import { OrderHotel } from "@/lib/app.types";
import { HotelCardHeader } from "./HotelCardHeader";
import { Amenities } from "./Amenities";

export const HotelCard = ({
  hotelRates,
  handleSelect,
  isSelected,
  hotelInfo,
  handleSelectedRate,
  distanceFromCenter,
  isLoading,
}: {
  hotelRates: Hotel["rates"];
  handleSelect: () => void;
  isSelected: boolean;
  hotelInfo: HotelInfoClient;
  handleSelectedRate: (orderHotel: OrderHotel) => void;
  distanceFromCenter: number;
  isLoading: boolean;
}) => {
  const [opened, setOpened] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Rate | null>(null);
  const [selectedRoomInfo, setSelectedRoomInfo] = useState<Room | null>(null);
  const [embla, setEmbla] = useState<Embla | null>(null);

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
    embla?.scrollTo(0);
  }, [selectedRoom]);

  useEffect(() => {
    setSelectedRoom(null);
  }, [hotelRates]);

  useEffect(() => {
    if (!isSelected) {
      setSelectedRoom(null);
      if (opened) {
        setOpened(false);
      }
    }

    if (isSelected && !selectedRoom) {
      handleRoomSelect(hotelRates[0]);
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
    <Skeleton visible={isLoading}>
      <CardWrapper isSelected={isSelected} onClick={handleSelect}>
        <div className="w-full flex flex-col items-right gap-2">
          <div className="flex flex-col md:flex-row md:content-between  gap-2">
            <div className="flex flex-col md:w-4/5 items-right gap-2">
              <div className="flex flex-col gap-2">
                <HotelCardHeader
                  distanceFromCenter={distanceFromCenter}
                  hotelName={hotelInfo.metadata.hotelName}
                  meals={!!selectedRoom?.meal_data.has_breakfast}
                  rating={hotelInfo.metadata.rating}
                  roomName={selectedRoom?.room_data_trans.main_name || ""}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="w-full  md:w-1/3">
                    <Carousel
                      getEmblaApi={setEmbla}
                      slidesToScroll={1}
                      align="start"
                      slideSize={"100%"}
                      initialSlide={0}
                      withIndicators
                      dir="ltr"
                      styles={{
                        indicators: {
                          maxWidth: "90%",
                          justifySelf: "center",
                        },
                      }}
                    >
                      {[
                        ...(selectedRoomInfo?.images || ""),
                        ...(hotelInfo?.general.images || ""),
                      ].map((image, i) => {
                        return image ? (
                          <Carousel.Slide key={i} style={{ height: "180px" }}>
                            <Image
                              fill={true}
                              loading="lazy"
                              style={{
                                objectFit: "cover",
                              }}
                              className="border rounded-lg"
                              src={image.replace("{size}", "x500")}
                              alt="image"
                            />
                          </Carousel.Slide>
                        ) : null;
                      })}
                    </Carousel>
                  </div>
                  <div className="w-full md:w-2/3">
                    <Amenities
                      roomAmenities={selectedRoomInfo?.amenities || []}
                      hotelAmenities={hotelInfo.general.amenities}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex md:w-1/5 md:justify-center md:text-center md:items-center md:border-r md:pr-2">
              מחיר{" "}
              {
                (selectedRoom || hotelRates[0]).payment_options.payment_types[0]
                  .show_amount
              }
              &#8364;
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
                        isSelected={
                          selectedRoom?.match_hash === room.match_hash
                        }
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
    </Skeleton>
  );
};
