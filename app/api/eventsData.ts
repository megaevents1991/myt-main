import { supabase } from "@/lib/supabase";
import { Event } from "@/lib/app.types";
  
export async function getEvents(id?: number): Promise<{ events: Event[] }> {

  // Calculate date 7 days from now
  const today = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);
  
  // Format to YYYY-MM-DD for database comparison
  const futureDate = sevenDaysFromNow.toISOString().split('T')[0]; // Format: 2025-04-32
  
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

  if (error) return Promise.resolve({ events: [] as Event[] });
  return { events };
}

export async function getEventsByName(
  searchName: string
): Promise<{ events: Event[] }> {

  // Calculate date 7 days from now
  const today = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);
  
  // Format to YYYY-MM-DD for database comparison
  const futureDate = sevenDaysFromNow.toISOString().split('T')[0]; // Format: 2025-04-32
  
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
