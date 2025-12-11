import { createClient } from '@supabase/supabase-js'

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lrhzzhmesdbxylkbkaiu.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyaHp6aG1lc2RieHlsa2JrYWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMTY5MTAsImV4cCI6MjA3OTg5MjkxMH0.oCdYz0_knZyMVwybZP8BfUkugIDH1RYQA1KwHXvy-Co'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // default options are fine for most projects; configure per your needs
});

// Optional: Set up authentication persistence
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('Supabase auth state changed:', event, session)
})
