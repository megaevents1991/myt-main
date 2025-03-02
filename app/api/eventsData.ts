import { supabase } from "@/lib/supabase";
import { Event } from "@/lib/app.types";

export async function getEvents(): Promise<{events:Event[]}> {
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true });

  if (error) return Promise.resolve({events: [] as Event[]});
  return { events };
}

export async function getEventsByName(searchName: string): Promise<{events:Event[]}> {
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .ilike('name_english', `%${searchName}%`)
    .order('date', { ascending: true });

  if (error) return Promise.resolve({events: [] as Event[]});
  return { events };
}
