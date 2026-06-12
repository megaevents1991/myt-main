import { Hotel, HotelInfoClient, Rate, Room } from "@/lib/hotel.type";
import { CardWrapper } from "./cardWrapper";
import { Hotel as HotelSVG } from "lucide-react";
import { Skeleton } from "@mantine/core";
import { Carousel, Embla } from "@mantine/carousel";

import { useCallback, useEffect, useMemo, useState, memo } from "react";
import Image from "next/image";
import { OrderHotel } from "@/lib/app.types";
import { HotelCardHeader } from "./HotelCardHeader";
import { Amenities } from "./Amenities";
import { formatPrice } from "@/lib/price.utils";
// import { isMobile } from "react-device-detect";
import { cn } from "@/lib/utils"; // Import cn utility
import { useMediaQuery } from "@mantine/hooks";

export const HotelCard = memo(
  ({
    hotelRates,
    handleSelect,
    selectedHotelId,
    hotelId,
    hotelInfo,
    handleSelectedRate,
    isLoading,
    minPrice,
    persons,
    isPromoted,
  }: {
    hotelRates: Hotel["rates"];
    handleSelect: () => void;
    selectedHotelId?: string;
    hotelId: string;
    hotelInfo: HotelInfoClient;
    handleSelectedRate: (
      orderHotel: Omit<OrderHotel, "guests" | "checkin" | "checkout">
    ) => void;
    isLoading: boolean;
    minPrice: number;
    persons: number;
    isPromoted?: boolean;
  }) => {
    const isSelected = selectedHotelId === hotelId;
    // const [opened, setOpened] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<Rate | null>(null);
    const [selectedRoomInfo, setSelectedRoomInfo] = useState<Room | null>(null);
    const [embla, setEmbla] = useState<Embla | null>(null);

    const isMobile = useMediaQuery("(max-width: 768px)");
    const imageSize = isMobile ? "x220" : "x500";

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
          const hotelInformation = {
            hotelName: hotelInfo.metadata.hotelName,
            roomName,
            stars: hotelInfo.metadata.rating,
            amenities: hotelInfo.general.amenities,
            distance: Math.ceil(hotelInfo.metadata.distanceFromCenter),
          };
          handleSelectedRate({
            rate: room,
            hotelInformation,
            address: hotelInfo.metadata.address,
            name: hotelInfo.metadata.hotelName,
            id: hotelInfo.metadata.id,
            price: room.payment_options?.payment_types[0]?.show_amount,
          });
        }
      },
      [hotelInfo, handleSelectedRate]
    );

    useEffect(() => {
      embla?.scrollTo(0);
    }, [selectedRoom, embla]);

    useEffect(() => {
      handleRoomSelect(hotelRates[0], isSelected);
    }, [isSelected, hotelRates, handleRoomSelect]);

    const selectedPrice =
      +(selectedRoom || hotelRates[0]).payment_options?.payment_types[0]
        .show_amount / persons;

    // Variables for mobile pricing display
    const priceDifferenceMobile = selectedPrice - minPrice;
    const displayPriceMobile = formatPrice(priceDifferenceMobile);
    const priceOutsidePackBoundariesMobile =
      Math.abs(priceDifferenceMobile) > 4;

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
          <div className="w-full flex flex-col pt-2 lg:pt-0 items-right gap-2">
            {isPromoted && (
              <div dir="rtl" className="flex">
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                  ★ מומלצים
                </span>
              </div>
            )}
            <div className="flex flex-col lg:flex-row lg:content-between gap-2">
              <div className="flex flex-col lg:w-4/5 items-right gap-2">
                <div className="flex flex-col gap-1">
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
                                  src={image.replace("{size}", imageSize)}
                                  alt="image"
                                  sizes="(max-width: 768px) 100vw, 300px"
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
                        guestRating={hotelInfo.metadata.guestRating}
                        guestReviewCount={hotelInfo.metadata.guestReviewCount}
                        roomName={selectedRoom?.room_data_trans.main_name || ""}
                        address={hotelInfo.metadata.address}
                        coordinates={{
                          lat: hotelInfo.metadata.latitude,
                          lng: hotelInfo.metadata.longitude,
                        }}
                      />
                      <div className="hidden lg:block">
                        <br />
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
          {/* Mobile pricing element - similar to FlightTicketCard */}
          <div
            className={cn(
              "absolute bg-white border lg:hidden right-2 top-0 whitespace-nowrap font-bold transform -translate-y-1/2 text-success rounded-2xl px-3 py-1 text-sm",
              isSelected && "bg-success text-white border-success"
            )}
          >
            {priceOutsidePackBoundariesMobile ? (
              <>
                {priceDifferenceMobile < 0 ? (
                  <span>
                    {"הפחיתו"} {displayPriceMobile} {"לאורח ממחיר החבילה"}
                  </span>
                ) : (
                  <span>
                    {"תוספת"} {displayPriceMobile} {"לאורח"}
                  </span>
                )}
              </>
            ) : (
              <span>כלול במחיר</span>
            )}
          </div>{" "}
        </CardWrapper>
      </Skeleton>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if the selection state for this specific card changes
    // or if other critical props change
    const prevSelected = prevProps.selectedHotelId === prevProps.hotelId;
    const nextSelected = nextProps.selectedHotelId === nextProps.hotelId;

    return (
      prevSelected === nextSelected &&
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.hotelRates === nextProps.hotelRates &&
      prevProps.hotelId === nextProps.hotelId
    );
  }
);

HotelCard.displayName = "HotelCard";
