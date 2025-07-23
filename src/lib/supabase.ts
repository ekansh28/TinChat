
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = 
    'CRITICAL ERROR: Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY) are not set or are empty. ' +
    'Please ensure they are correctly defined in your .env file and accessible to your Next.js application. ' +
    'The application cannot initialize Supabase and will not function correctly without them. ' +
    'Supabase URL found: ' + supabaseUrl + ', Supabase Anon Key length: ' + (supabaseAnonKey ? supabaseAnonKey.length : 0);
  
  console.error('****************************************************************************************************');
  console.error(errorMessage);
  console.error('****************************************************************************************************');
  // Throw an error to stop the application from trying to run with a misconfigured Supabase.
  // This makes the problem very explicit during development.
  throw new Error("Supabase client initialization failed: Missing or invalid environment variables.");
}

try {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} catch (e: any) {
  console.error('****************************************************************************************************');
  console.error('ERROR: Failed to create Supabase client with the provided URL and Anon Key.');
  console.error('Supabase URL used:', supabaseUrl);
  console.error('Error details:', e.message);
  console.error('****************************************************************************************************');
  throw new Error(`Supabase client initialization failed during createClient call: ${e.message}`);
}

export const supabase = supabaseInstance;
