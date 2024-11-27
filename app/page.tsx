import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Music, Search } from "lucide-react";
import { events as staticEvents } from "@/lib/events-data";
import { Input } from "@mantine/core";

// Remove the getEvents function that uses fetch

export default function Home() {
  // Use the staticEvents directly instead of fetching
  const events = staticEvents;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center justify-between">
        <Link className="flex items-center justify-center" href="#">
          <Music className="h-6 w-6" />
          <span className="ml-2 text-lg font-bold">MYT Events</span>
        </Link>
        <nav className="hidden md:flex gap-4 sm:gap-6">
          <Link
            className="text-sm font-medium hover:underline underline-offset-4"
            href="#"
          >
            Events
          </Link>
          <Link
            className="text-sm font-medium hover:underline underline-offset-4"
            href="#"
          >
            About
          </Link>
          <Link
            className="text-sm font-medium hover:underline underline-offset-4"
            href="#"
          >
            Contact
          </Link>
        </nav>
        <Button className="md:hidden" variant="ghost" size="icon">
          <Music className="h-6 w-6" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 px-4 md:px-6 bg-black text-white">
          <div className="container mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none mb-4">
              Your Ultimate Event Experience
            </h1>
            <p className="mx-auto max-w-[700px] text-gray-300 md:text-xl mb-8">
              Book tickets, flights, and hotels for the hottest sports and music
              events.
            </p>
            <div className="w-full max-w-sm mx-auto space-y-2">
              <form className="flex flex-col sm:flex-row gap-2">
                <Input
                  className="flex-1"
                  placeholder="Search events"
                  type="text"
                />
                <Button
                  type="submit"
                  className="bg-white text-black hover:bg-gray-200 w-full sm:w-auto"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </form>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800 px-4 md:px-6">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl text-center mb-8">
              Featured Events
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="relative group overflow-hidden rounded-lg shadow-lg"
                >
                  <Image
                    src={event.imageUrl}
                    alt={event.name}
                    width={400}
                    height={300}
                    className="object-cover w-full h-60 transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity group-hover:bg-opacity-75" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                        {event.name}
                      </h3>
                      <p className="text-white mb-4">
                        {event.location} • {event.date}
                      </p>
                      <Link href={`/order?eventId=${event.id}`}>
                        <Button variant="secondary">Book Now</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="py-6 w-full px-4 md:px-6 border-t">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 sm:mb-0">
            © 2023 MYT Events. All rights reserved.
          </p>
          <nav className="flex gap-4 sm:gap-6">
            <Link
              className="text-xs hover:underline underline-offset-4"
              href="#"
            >
              Terms of Service
            </Link>
            <Link
              className="text-xs hover:underline underline-offset-4"
              href="#"
            >
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
