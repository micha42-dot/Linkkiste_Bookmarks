import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------
// In a public repository, we strictly use Environment Variables.
// do NOT hardcode keys here. Use a .env file locally or
// Project Settings in Vercel/Netlify.
// ------------------------------------------------------------------

const PLACEHOLDER_URL = 'https://your-project.supabase.co';
const PLACEHOLDER_KEY = 'your-anon-key-goes-here';

let supabaseUrl = PLACEHOLDER_URL;
let supabaseAnonKey = PLACEHOLDER_KEY;

// Attempt to load from Environment Variables (Vite standard)
if (import.meta && import.meta.env) {
    // Debug Log to help verify Cloudflare Environment Variables
    console.log('LINKkiste Init:', {
        hasUrl: !!import.meta.env.VITE_SUPABASE_URL,
        hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
        mode: import.meta.env.MODE
    });

    if (import.meta.env.VITE_SUPABASE_URL) {
        supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    }
    if (import.meta.env.VITE_SUPABASE_ANON_KEY) {
        supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    }
}

// Logic to determine if the app is ready to run
export const isSupabaseConfigured = 
  supabaseUrl !== '' && 
  supabaseUrl !== PLACEHOLDER_URL &&
  supabaseAnonKey !== '' && 
  supabaseAnonKey !== PLACEHOLDER_KEY;

if (isSupabaseConfigured) {
    try {
        const projectId = supabaseUrl.split('//')[1].split('.')[0];
        console.log(`LINKkiste: Connected to Project ${projectId}`);
    } catch (e) {
        console.log('LINKkiste: Connected to Supabase');
    }
} else {
    console.warn('LINKkiste: Missing Configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Fallback to placeholders to prevent crash on init, but app will show config screen
export const supabase = createClient(supabaseUrl, supabaseAnonKey);