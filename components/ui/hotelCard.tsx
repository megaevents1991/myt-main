import { Hotel, HotelInfoClient, Rate, Room } from "@/lib/hotel.type";
import { CardWrapper } from "./cardWrapper";
import { Hotel as HotelSVG } from "lucide-react";
import { Skeleton } from "@mantine/core";
import { Carousel, Embla } from "@mantine/carousel";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { OrderHotel } from "@/lib/app.types";
import { HotelCardHeader } from "./HotelCardHeader";
import { Amenities } from "./Amenities";
import { formatPrice } from "@/lib/price.utils";
// import { isMobile } from "react-device-detect";

export const HotelCard = ({
  hotelRates,
  handleSelect,
  isSelected,
  hotelInfo,
  handleSelectedRate,
  isLoading,
  minPrice,
  persons,
}: {
  hotelRates: Hotel["rates"];
  handleSelect: () => void;
  isSelected: boolean;
  hotelInfo: HotelInfoClient;
  handleSelectedRate: (
    orderHotel: Omit<OrderHotel, "guests" | "checkin" | "checkout">
  ) => void;
  isLoading: boolean;
  minPrice: number;
  persons: number;
}) => {
  // const [opened, setOpened] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Rate | null>(null);
  const [selectedRoomInfo, setSelectedRoomInfo] = useState<Room | null>(null);
  const [embla, setEmbla] = useState<Embla | null>(null);

  const handleRoomSelect = useCallback(
    (room: Rate, isSelected = false) => {
      const roomName = `${room.room_data_trans.main_name}${
        room.room_data_trans.bedding_type
          ? " " + room.room_data_trans.bedding_type
          : ""
      }`;

      setSelectedRoom(room);
      setSelectedRoomInfo(hotelInfo?.rooms[roomName]);

      if (isSelected) {
        handleSelectedRate({
          rate: room,
          address: hotelInfo.metadata.address,
          name: hotelInfo.metadata.hotelName,
          id: hotelInfo.metadata.id,
          price: room.payment_options.payment_types[0].show_amount,
        });
      }
    },
    [hotelInfo, handleSelectedRate]
  );

  useEffect(() => {
    embla?.scrollTo(0);
  }, [selectedRoom]);

  useEffect(() => {
    handleRoomSelect(hotelRates[0], isSelected);
  }, [isSelected, hotelRates]);

  const selectedPrice =
    +(selectedRoom || hotelRates[0]).payment_options.payment_types[0]
      .show_amount / persons;

  const priceToShowFull = useMemo(() => {
    const styledPrice = formatPrice(selectedPrice - minPrice);

    const priceOutsidePackBoundries =
      Math.abs(selectedPrice - minPrice) > 4 ? true : false;
    return priceOutsidePackBoundries ? (
      <div>
        <span className="text-lg lg:text-2xl">{styledPrice}</span>
        {selectedPrice - minPrice < 0 ? (
          <span className="whitespace-nowrap text-lg inline pr-2 lg:block lg:pr-0">
            {"חסכון לכל אורח"}
          </span>
        ) : (
          <span className="whitespace-nowrap text-lg inline pr-2 lg:block lg:pr-0">
            {"תוספת לכל אורח"}
          </span>
        )}
      </div>
    ) : (
      <span className="text-xl">כלול במחיר</span>
    );
  }, [selectedPrice, minPrice]);

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
                        loop
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
                      distanceFromCenter={Math.ceil(
                        hotelInfo.metadata.distanceFromCenter
                      )}
                      hotelName={hotelInfo.metadata.hotelName}
                      meals={!!selectedRoom?.meal_data.has_breakfast}
                      rating={hotelInfo.metadata.rating}
                      roomName={selectedRoom?.room_data_trans.main_name || ""}
                    />
                    <div className="w-full text-center lg:hidden p-1 mb-2 mt-2 border-main border rounded-lg bg-gray-200">
                      {priceToShowFull}
                    </div>
                    {/* {hotelRates.length > 1 && (
                      <div className="w-full flex flex-col justify-between lg:items-right mt-2 mb-2">
                        <div
                          className="w-full lg:w-fit flex-row flex items-center text-center lg:text-right cursor-pointer rounded-lg bg-gray-200 px-2"
                          onClick={() => setOpened((prev) => !prev)}
                        >
                          <div className="flex w-full items-center justify-center lg:justify-between gap-2">
                            {isSelected ? (
                              <div className="flex items-center gap-2">
                                {hotelRates.length - 1}
                                <span>סוגי חדרים נוספים</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {hotelRates.length}
                                <span>סוגי חדרים</span>
                              </div>
                            )}
                            {opened ? (
                              <ChevronUp color="black" />
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
                            <ScrollArea
                              className="w-full h-32"
                              scrollbarSize={0}
                            >
                              <div className="flex flex-col">
                                {hotelRates.map((room) => (
                                  <RoomCard
                                    persons={persons}
                                    minPrice={minPrice}
                                    key={room.match_hash}
                                    room={room}
                                    isSelected={
                                      selectedRoom?.match_hash ===
                                      room.match_hash
                                    }
                                    onRoomSelect={(room) => {
                                      handleRoomSelect(room);
                                      setOpened((prev) => !prev);
                                    }}
                                  />
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </Collapse>
                      </div>
                    )} */}
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
            <div className="hidden lg:flex text-2xl font-bold w-1/5 justify-center text-center items-center border-r pr-2">
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
