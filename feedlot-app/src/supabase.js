import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://jmxulljagtgcszdxlebo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpteHVsbGphZ3RnY3N6ZHhsZWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODU4MTMsImV4cCI6MjA5MjM2MTgxM30.gjBB1v_maxBWx5qjH8seyN101AMCaNRzYIkqv48V_Vs'
)