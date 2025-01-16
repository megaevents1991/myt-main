import { supabase } from "@/lib/supabase";

export async function getEvents(){
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true });

  if (error) return [];
  return events;
}
