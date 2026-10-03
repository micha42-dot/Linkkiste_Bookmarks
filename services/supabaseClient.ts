import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------
// Hardcoded credentials for this specific dev instance as requested.
// ------------------------------------------------------------------

const HARDCODED_URL = 'https://aiqjkfdlblvsuspsgoxp.supabase.co';
const HARDCODED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpcWprZmRsYmx2c3VzcHNnb3hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjAyNzMsImV4cCI6MjA4MzY5NjI3M30.sj92mWAxRtaAjfw7L3bNJna07XpSkZ-XLIla7vOP_UA';

let supabaseUrl = HARDCODED_URL;
let supabaseAnonKey = HARDCODED_KEY;

// Attempt to load from Environment Variables (Vite standard) - Optional override
// We safely check for import.meta.env existence first
if (import.meta && import.meta.env) {
    // Debug Log to help verify Cloudflare Environment Variables (DEV only)
    if (import.meta.env.DEV) {
        console.log('LINKkiste Init:', {
            hasUrl: !!import.meta.env.VITE_SUPABASE_URL,
            hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
            mode: import.meta.env.MODE
        });
    }

    if (import.meta.env.VITE_SUPABASE_URL) {
        supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    }
    if (import.meta.env.VITE_SUPABASE_ANON_KEY) {
        supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    }
}

// Logic to determine if the app is ready to run
// Since we have hardcoded keys, this should effectively always be true
export const isSupabaseConfigured = 
  supabaseUrl !== '' && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== '' && 
  supabaseAnonKey !== 'your-anon-key-goes-here';

if (isSupabaseConfigured) {
    // Safe check before accessing import.meta.env.DEV
    const isDev = import.meta && import.meta.env && import.meta.env.DEV;
    
    if (isDev) {
        try {
            const projectId = supabaseUrl.split('//')[1].split('.')[0];
            console.log(`LINKkiste: Connected to Project ${projectId}`);
        } catch (e) {
            console.log('LINKkiste: Connected to Supabase');
        }
    }
} else {
    // Warn is acceptable even in prod if config is critically missing
    console.warn('LINKkiste: Missing Configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Fallback to placeholders to prevent crash on init, but app will show config screen
export const supabase = createClient(supabaseUrl, supabaseAnonKey);