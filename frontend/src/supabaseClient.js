import { createClient } from '@supabase/supabase-js'

// Replace with your project's URL and anon key from the Supabase dashboard
const supabaseUrl = 'https://qowfogmfvvgsogflppqb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvd2ZvZ21mdnZnc29nZmxwcHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzE2NTksImV4cCI6MjA3OTkwNzY1OX0.VvkbSeX30SuYPUnTXMVYxzS1zaUIt3l28Al6Cz6bvzk'

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Optional: Set up authentication persistence
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('Supabase auth state changed:', event, session)
})
