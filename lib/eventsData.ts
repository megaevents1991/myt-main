import { supabase } from "@/lib/supabase";
import { Event } from "@/lib/app.types";
import { unstable_cache as nextCache } from "next/cache";

export const getCachedEvents = nextCache(getEvents, ["all-events"], {
  tags: ["events"],
  revalidate: 3600, // Revalidate every hour (1 hour = 3600 seconds)
});

export async function getEvents(id?: number): Promise<{ events: Event[] }> {
  const startTime = Date.now();

  try {
    // Calculate date 7 days from now
    const sevenDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    // Format to YYYY-MM-DD for database comparison
    const futureDate = sevenDaysFromNow.toISOString().split("T")[0]; // Format: 2025-04-32

    console.log(
      `[EventsData] Starting query - ID: ${id || "all"}, futureDate: ${futureDate}`,
    );

    let query = supabase
      .from("events")
      .select("*")
      .is("is_deleted", null)
      .gte("date", futureDate) // Only get events 7+ days in the future
      .order("date", { ascending: true });

    if (id !== undefined) {
      query = query.eq("id", id);
    }

    const { data: events, error } = await query;
    const queryTime = Date.now() - startTime;

    if (error) {
      console.error(`[EventsData] Database error after ${queryTime}ms:`, {
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        searchId: id,
        futureDate,
      });
      return Promise.resolve({ events: [] as Event[] });
    }

    console.log(
      `[EventsData] Query successful - Returned ${events?.length || 0} events in ${queryTime}ms`,
    );
    return { events: events || [] };
  } catch (error) {
    const queryTime = Date.now() - startTime;
    console.error(`[EventsData] Unexpected error after ${queryTime}ms:`, {
      error,
      searchId: id,
      timestamp: new Date().toISOString(),
    });
    return Promise.resolve({ events: [] as Event[] });
  }
}

export async function getEventsByName(
  searchName: string,
): Promise<{ events: Event[] }> {
  // Calculate date 7 days from now
  const today = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);

  // Format to YYYY-MM-DD for database comparison
  const futureDate = sevenDaysFromNow.toISOString().split("T")[0]; // Format: 2025-04-32

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .is("is_deleted", null)
    .ilike("name_english", `%${searchName}%`)
    .gte("date", futureDate) // Only get events 7+ days in the future
    .order("date", { ascending: true });

  if (error) return Promise.resolve({ events: [] as Event[] });
  return { events };
}
