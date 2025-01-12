import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL! || 'https://fandqafngybfdyslofmr.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbmRxYWZuZ3liZmR5c2xvZm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1Mzg5ODQsImV4cCI6MjA1MjExNDk4NH0.tTWw7JSWWFJ0LlszbD4AKbcTxLJMfpYE1aO6ZZQ2enE'

export const supabase = createClient(supabaseUrl, supabaseKey)
