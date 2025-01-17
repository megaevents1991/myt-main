import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.NEXT_SECRET_SUPABASE_SERVICE_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseKey)
