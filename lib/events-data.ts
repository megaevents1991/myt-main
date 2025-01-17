import { Event, Flight } from "./app.types";

export const events: Event[] = [
  {
    id: "1",
    name: "באיירן מינכן - דורטמונד",
    date: "2025-08-22",
    location: {
      latitude: 40.785091,
      longitude: -73.968285,
      name: "מדריד, ספרד",
    },
    city: "Madrid",
    description:
      "A day-long music festival featuring top artists from around the world.",
    imageUrl: "/events/1_main.png",
    mapUrl: "/events/1_main.png",
    tickets: [
      {
        category: "קטגוריה 1",
        price: 100,
        description: "הסבר על הקטגוריה",
        colorOnTheMap: "red",
        id: "1",
      },
      {
        category: "קטגוריה 2",
        price: 120,
        description: "הסבר על הקטגוריה",
        colorOnTheMap: "green",
        id: "2",
      },
      {
        category: "קטגוריה 3",
        price: 137,
        description: "הסבר על הקטגוריה",
        colorOnTheMap: "blue",
        id: "3",
      },
      {
        category: "קטגוריה 4",
        price: 160,
        description: "הסבר על הקטגוריה",
        colorOnTheMap: "yellow",
        id: "4",
      },
      {
        category: "קטגוריה 5",
        price: 201,
        description: "הסבר על הקטגוריה",
        colorOnTheMap: "cyan",
        id: "5",
      },
      {
        category: "קטגוריה 6",
        price: 250,
        description: "הסבר על הקטגוריה",
        colorOnTheMap: "violet",
        id: "6",
      },
    ],
  },
  {
    id: "2",
    name: "Coldplay, London - קולדפליי בלונדון",
    date: "2025-08-22",
    location: {
      latitude: 25.406566,
      longitude: 51.435725,
      name: "וומבלי- לונדון, אנגליה",
    },
    description: "The final match of the FIFA World Cup 2023.",
    imageUrl: "/events/2_main.png",
    mapUrl: "/events/2_main.png",
    tickets: [
      {
        colorOnTheMap: "red",
        category: "General Admission",
        price: 100,
        description: "General Admission",
        id: "1",
      },
      {
        category: "VIP",
        price: 200,
        description: "VIP",
        id: "2",
        colorOnTheMap: "green",
      },
      {
        colorOnTheMap: "blue",
        category: "Backstage Pass",
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
        colorOnTheMap: "red",
        category: "General Admission",
        price: 100,
        description: "General Admission",
        id: "1",
      },
      {
        category: "VIP",
        price: 200,
        description: "VIP",
        id: "2",
        colorOnTheMap: "green",
      },
      {
        colorOnTheMap: "blue",
        category: "Backstage Pass",
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
        category: "General Admission",
        price: 100,
        description: "General Admission",
        id: "1",
        colorOnTheMap: "red",
      },
      {
        category: "VIP",
        price: 200,
        description: "VIP",
        id: "2",
        colorOnTheMap: "green",
      },
      {
        category: "Backstage Pass",
        price: 500,
        description: "Backstage Pass",
        id: "3",
        colorOnTheMap: "blue",
      },
    ],
    city: "New York",
  },
];
export const flights: Flight[] = [
  {
    id: "1",
    airline: "Emirates",
    price: 450,
    duration: "1h 35m",
    stops: 0,
    returnArrivalTime: "05:45",
    metadata: {} as Flight["metadata"],
  },
  {
    id: "2",
    airline: "Delta",
    price: 380,
    duration: "1h 50m",
    stops: 0,
    metadata: {} as Flight["metadata"],
  },
] as Flight[];
