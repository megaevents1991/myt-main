import { Event, Flight, Hotel } from "./app.types";

export const events: Event[] = [
  {
    id: "1",
    name: "Summer Music Festival",
    date: "2025-01-15",
    location: {
      latitude: 40.785091,
      longitude: -73.968285,
      name: "Central Park, New York",
    },
    city: "New York",
    description:
      "A day-long music festival featuring top artists from around the world.",
    imageUrl: "/events/1_main.png",
    mapUrl: "/events/1_main.png",
    tickets: [
      {
        type: "General Admission",
        price: 100,
        description: "General Admission",
        id: "1",
      },
      { type: "VIP", price: 200, description: "VIP", id: "2" },
      {
        type: "Backstage Pass",
        price: 500,
        description: "Backstage Pass",
        id: "3",
      },
    ],
  },
  {
    id: "2",
    name: "World Cup Final",
    date: "2023-12-18",
    location: {
      latitude: 25.406566,
      longitude: 51.435725,
      name: "Lusail Stadium, Qatar",
    },
    description: "The final match of the FIFA World Cup 2023.",
    imageUrl: "/events/2_main.png",
    mapUrl: "/events/2_main.png",
    tickets: [
      {
        type: "General Admission",
        price: 100,
        description: "General Admission",
        id: "1",
      },
      { type: "VIP", price: 200, description: "VIP", id: "2" },
      {
        type: "Backstage Pass",
        price: 500,
        description: "Backstage Pass",
        id: "3",
      },
    ],
    city: "New York",
  },
  {
    id: "3",
    name: "Tech Conference 2023",
    date: "2023-09-22",
    location: {
      name: "Moscone Center, San Francisco",
      latitude: 37.783083,
      longitude: -122.403354,
    },
    description:
      "Annual conference showcasing the latest in technology and innovation.",
    imageUrl: "/events/3_main.png",
    mapUrl: "/events/3_main.png",

    tickets: [
      {
        type: "General Admission",
        price: 100,
        description: "General Admission",
        id: "1",
      },
      { type: "VIP", price: 200, description: "VIP", id: "2" },
      {
        type: "Backstage Pass",
        price: 500,
        description: "Backstage Pass",
        id: "3",
      },
    ],
    city: "New York",
  },
  {
    id: "4",
    name: "Tech Conference 2023",
    date: "2023-09-22",
    location: {
      name: "Moscone Center, San Francisco",
      latitude: 37.783083,
      longitude: -122.403354,
    },
    description:
      "Annual conference showcasing the latest in technology and innovation.",
    imageUrl: "/events/4_main.png",
    mapUrl: "/events/4_main.png",
    tickets: [
      {
        type: "General Admission",
        price: 100,
        description: "General Admission",
        id: "1",
      },
      { type: "VIP", price: 200, description: "VIP", id: "2" },
      {
        type: "Backstage Pass",
        price: 500,
        description: "Backstage Pass",
        id: "3",
      },
    ],
    city: "New York",
  },
];

export const flights: Flight[] = [
  {
    id: "1",
    airline: "Emirates",
    departureTime: "07:10",
    arrivalTime: "17:45",
    departureAirport: "JFK",
    arrivalAirport: "LGA",
    price: 450,
    duration: "1h 35m",
    stops: 0,
    returnDepartureTime: "19:30",
    returnArrivalTime: "05:45",
    metadata: {} as Flight["metadata"],
  },
  {
    id: "2",
    airline: "Delta",
    departureTime: "14:05",
    arrivalTime: "15:55",
    departureAirport: "JFK",
    arrivalAirport: "LGA",
    price: 380,
    duration: "1h 50m",
    stops: 0,
    returnDepartureTime: "18:00",
    returnArrivalTime: "19:50",
    metadata: {} as Flight["metadata"],
  },
];

export const hotels: Hotel[] = [
  {
    id: "1",
    name: "Luxury Hotel",
    price: 300,
    rating: 5,
    amenities: ["Free Wi-Fi", "Pool", "Spa"],
  },
  {
    id: "2",
    name: "Budget Inn",
    price: 100,
    rating: 3,
    amenities: ["Free Wi-Fi", "Breakfast"],
  },
];
