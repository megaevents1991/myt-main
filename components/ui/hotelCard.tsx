import { Hotel, HotelInfoClient, Rate, Room } from "@/lib/hotel.type";
import { CardWrapper } from "./cardWrapper";
import { ChevronUp, ChevronDown, Hotel as HotelSVG } from "lucide-react";
import { Collapse, ScrollArea, Skeleton } from "@mantine/core";
import { Carousel, Embla } from "@mantine/carousel";

import { useEffect, useState } from "react";
import { RoomCard } from "./roomCard";
import Image from "next/image";
import { OrderHotel } from "@/lib/app.types";
import { HotelCardHeader } from "./HotelCardHeader";
import { Amenities } from "./Amenities";
import { formatPrice } from "@/lib/price.utils";

export const HotelCard = ({
  hotelRates,
  handleSelect,
  isSelected,
  hotelInfo,
  handleSelectedRate,
  distanceFromCenter,
  isLoading,
  minPrice,
  days,
  persons,
}: {
  hotelRates: Hotel["rates"];
  handleSelect: () => void;
  isSelected: boolean;
  hotelInfo: HotelInfoClient;
  handleSelectedRate: (orderHotel: Omit<OrderHotel, "guests">) => void;
  distanceFromCenter: number;
  isLoading: boolean;
  minPrice: number;
  days: number;
  persons: number;
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
      setSelectedRoomInfo(null);
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

  const selectedPrice =
    +(selectedRoom || hotelRates[0]).payment_options.payment_types[0]
      .show_amount /
    (persons * days);

  const priceToShowFull =
    formatPrice(selectedPrice - minPrice) !== 0 ? (
      formatPrice(selectedPrice - minPrice)
    ) : (
      <span className="text-[16px]">כלול במחיר החבילה</span>
    );

  const hotelImages = [
    ...(selectedRoomInfo?.images || ""),
    ...(hotelInfo?.general.images || ""),
  ];

  return (
    <Skeleton visible={isLoading}>
      <CardWrapper isSelected={isSelected} onClick={handleSelect}>
        <div className="w-full flex flex-col items-right gap-2">
          <div className="flex flex-col lg:flex-row lg:content-between gap-2">
            <div className="flex flex-col lg:w-4/5 items-right gap-2">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col-reverse lg:flex-row gap-2">
                  <div className="w-full lg:w-[280px]">
                    {!!hotelImages.length && (
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
                        {hotelImages.map((image, i) => (
                          <Carousel.Slide key={i} style={{ height: "210px" }}>
                            {image ? (
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
                            ) : (
                              <HotelSVG className="m-auto" size={100} />
                            )}
                          </Carousel.Slide>
                        ))}
                      </Carousel>
                    )}
                  </div>
                  <div className="w-full lg:w-2/3">
                    <HotelCardHeader
                      distanceFromCenter={distanceFromCenter}
                      hotelName={hotelInfo.metadata.hotelName}
                      meals={!!selectedRoom?.meal_data.has_breakfast}
                      rating={hotelInfo.metadata.rating}
                      roomName={selectedRoom?.room_data_trans.main_name || ""}
                    />
                    <div className="w-full text-center lg:hidden p-1 mb-2 border-main border rounded-lg bg-gray-200">
                      {priceToShowFull}
                    </div>
                    <div className="w-full flex flex-col justify-between lg:items-right mb-2">
                      <div
                        className="w-fit flex-row flex items-center text-center lg:text-right cursor-pointer rounded-lg bg-gray-200 px-2"
                        onClick={() => setOpened((prev) => !prev)}
                      >
                        <div className="flex w-full items-center justify-center lg:justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {hotelRates.length}
                            <span>סוגי חדרים נוספים</span>
                          </div>
                          {opened ? (
                            <ChevronUp className="m-auto" color="black" />
                          ) : (
                            <ChevronDown color="black" />
                          )}
                        </div>
                      </div>
                      <Collapse
                        in={opened}
                        className="mt-2 w-full rounded-lg bg-gray-200 px-2"
                      >
                        {isSelected && (
                          <ScrollArea className="w-full h-32" scrollbarSize={0}>
                            <div className="flex flex-col gap-2">
                              {hotelRates.map((room) => (
                                <RoomCard
                                  persons={persons}
                                  minDailyPrice={minPrice}
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
                    <div className="hidden lg:block">
                      <Amenities
                        roomAmenities={selectedRoomInfo?.amenities || []}
                        hotelAmenities={hotelInfo.general.amenities}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden text-2xl font-bold lg:flex lg:w-1/5 lg:justify-center lg:text-center lg:items-center lg:border-r lg:pr-2">
              {priceToShowFull}
            </div>
            <div className="block lg:hidden">
              <Amenities
                roomAmenities={selectedRoomInfo?.amenities || []}
                hotelAmenities={hotelInfo.general.amenities}
              />
            </div>
          </div>
        </div>
      </CardWrapper>
    </Skeleton>
  );
};
