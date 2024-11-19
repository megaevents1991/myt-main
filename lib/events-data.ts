export interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  description: string;
  imageUrl: string;
  price: number;
}

export const events: Event[] = [
  {
    id: "1",
    name: "Summer Music Festival",
    date: "2023-07-15",
    location: "Central Park, New York",
    description:
      "A day-long music festival featuring top artists from around the world.",
    imageUrl:
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80",
    price: 150,
  },
  {
    id: "2",
    name: "World Cup Final",
    date: "2023-12-18",
    location: "Lusail Stadium, Qatar",
    description: "The final match of the FIFA World Cup 2023.",
    imageUrl:
      "https://images.unsplash.com/photo-1522778119026-d647f0596c20?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80",
    price: 500,
  },
  {
    id: "3",
    name: "Tech Conference 2023",
    date: "2023-09-22",
    location: "Moscone Center, San Francisco",
    description:
      "Annual conference showcasing the latest in technology and innovation.",
    imageUrl:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80",
    price: 300,
  },
];
