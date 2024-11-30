"use client";

import { events } from "@/lib/events-data";
import { formatHotelName } from "@/lib/formatHotelName";
import { Hotel, HotelResponse } from "@/lib/hotel.type";
import { Card, Button, Text, Grid, Group, Badge } from "@mantine/core";
import { useState, useEffect } from "react";

const event = events[0];

export const HotelSelection = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async () => {
    const res = await fetch(`/api/hotels`, {
      method: "POST",
      body: JSON.stringify({
        location: event.location,
        checkin: new Date(new Date(event.date).getTime() - 2 * 8.64e7)
          .toISOString()
          .split("T")[0],
        checkout: new Date(new Date(event.date).getTime() + 8.64e7)
          .toISOString()
          .split("T")[0],
        adults: 1,
      }),
    });
    const data: HotelResponse = await res.json();
    setHotels(data.data.hotels);
  };

  return (
    <Grid>
      {hotels.map((hotel) => {
        const hotelName = formatHotelName(hotel.id);
        return (
          <Grid.Col key={hotel.id} span={8}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Card.Section>
                {/* <Image src={hotel.image} height={160} alt={hotelName} /> */}
              </Card.Section>

              <Group mt="md" mb="xs">
                <Text style={{ fontWeight: 500 }}>{hotelName}</Text>
                <Badge color="pink" variant="light">
                  {hotel.id} ★
                </Badge>
              </Group>

              <Text size="sm" color="dimmed">
                {hotel.rates[0].room_name}
              </Text>
              <Text style={{ fontWeight: 700 }} size="lg" mt="xs">
                {hotel.rates[0].daily_prices} / night
              </Text>
              <Group>
                {hotel.rates[0].amenities_data.map((amenity) => (
                  <Badge key={amenity} size="sm" color="gray" component="span">
                    {amenity}
                  </Badge>
                ))}
              </Group>
              <Button
                variant="light"
                color="blue"
                fullWidth
                mt="md"
                radius="md"
                onClick={() => alert(`You selected ${hotelName}`)}
              >
                Book Now
              </Button>
            </Card>
          </Grid.Col>
        );
      })}
    </Grid>
  );
};
