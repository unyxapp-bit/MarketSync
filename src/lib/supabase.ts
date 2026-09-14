import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
// The browser may only use the publishable/anon key. Never expose a service-role key here.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
