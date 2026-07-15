import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "";
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

const isConfigured = 
  supabaseUrl && 
  !supabaseUrl.includes("your-project-id") &&
  supabaseAnonKey &&
  !supabaseAnonKey.includes("your-supabase-anon-key");

export const supabase = createClient(
  isConfigured ? supabaseUrl : "https://placeholder-project.supabase.co",
  isConfigured ? supabaseAnonKey : "placeholder-key"
);

export const isSupabaseConfigured = isConfigured;
