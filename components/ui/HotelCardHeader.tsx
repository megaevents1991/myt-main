import { formatHotelName } from "@/lib/formatHotelName";
import { Stars } from "./stars";
import { GuestScoreBadge } from "./GuestScoreBadge";
import { Utensils, MapPin } from "lucide-react";
import { Tooltip, Modal } from "@mantine/core";
import { useClickOutside, useDisclosure } from "@mantine/hooks";
import { isMobile } from "react-device-detect";
import { useState } from "react";
import Map, { Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

type HotelCardHeaderProps = {
  hotelName: string;
  distanceFromCenter: number;
  meals: boolean;
  roomName: string;
  rating: number;
  guestRating?: number;
  guestReviewCount?: number;
  address?: string;
  coordinates?: { lat: number; lng: number };
};

export const HotelCardHeader = ({
  rating,
  guestRating,
  guestReviewCount,
  distanceFromCenter,
  hotelName,
  roomName,
  meals,
  address,
  coordinates,
}: HotelCardHeaderProps) => {
  const [tooltipOpened, setTooltipOpened] = useState(false);
  const [opened, { open, close }] = useDisclosure(false);
  const ref = useClickOutside(() => isMobile && setTooltipOpened(false));
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  return (
    <>
      <Modal
        opened={opened}
        onClose={close}
        title={hotelName}
        size="lg"
        centered
        zIndex={200}
      >
        <div className="w-full h-[400px] relative rounded-md overflow-hidden">
          {coordinates ? (
            mapboxToken ? (
              <Map
                initialViewState={{
                  longitude: coordinates.lng,
                  latitude: coordinates.lat,
                  zoom: 14,
                }}
                style={{ width: "100%", height: "100%" }}
                mapStyle="mapbox://styles/mapbox/outdoors-v12"
                mapboxAccessToken={mapboxToken}
              >
                <Marker
                  longitude={coordinates.lng}
                  latitude={coordinates.lat}
                  color="red"
                />
              </Map>
            ) : (
              <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                title={`Map showing location of ${hotelName}`}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                  coordinates.lng - 0.01
                }%2C${coordinates.lat - 0.01}%2C${coordinates.lng + 0.01}%2C${
                  coordinates.lat + 0.01
                }&layer=mapnik&marker=${coordinates.lat}%2C${coordinates.lng}`}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Map location not available
            </div>
          )}
        </div>
      </Modal>
      <div className="flex flex-col gap-2 m" ref={ref}>
        <div className="flex flex-col justify-between items-start">
          <div className="flex flex-row gap-2 items-center w-full">
            <div className="font-bold text-lg lg:text-2xl">
              {formatHotelName(hotelName)}
            </div>
            <Stars rating={rating} />
            <GuestScoreBadge rating={guestRating} />
          </div>
          <div className="text-[14px] flex items-center">
            <span>
              {Math.floor(distanceFromCenter / 100) / 10} ק&quot;מ ממרכז העיר
            </span>
            {(address || coordinates) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  open();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-foreground/10 rounded-full transition-colors"
                aria-label="Show on map"
              >
                <MapPin size={16} className="text-blue-500" />
              </button>
            )}
          </div>
          {roomName && (
          <div className="w-full flex flex-col lg:flex-row justify-between items-left text-sm lg:w-2/3">
            <div
              onTouchStart={() => setTooltipOpened((curr) => !curr)}
              className="text-xs leading-tight font-bold flex"
            >
              <span className="font-bold text-[16px] ml-2" dir="ltr">
                {roomName}
              </span>
              {meals ? (
                <Tooltip
                  label="כולל ארוחת בוקר"
                  position="top"
                  opened={true && (isMobile ? tooltipOpened : undefined)}
                >
                  <div className="w-4 h-4">
                    <span> {<Utensils size={18} />}</span>
                  </div>
                </Tooltip>
              ) : (
                <div />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};
