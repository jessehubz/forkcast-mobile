import 'react-native-url-polyfill/auto';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from 'expo-constants';

// Use || (not ??) — Metro may inject "" for unset EXPO_PUBLIC_ vars, which ?? won't catch.
const supabaseUrl =
  (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim() ||
  ((Constants.expoConfig?.extra as any)?.supabaseUrl || '').trim() ||
  'https://vymzbqmkwninpkzyamzn.supabase.co';

const supabaseAnonKey =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim() ||
  ((Constants.expoConfig?.extra as any)?.supabaseAnonKey || '').trim() ||
  'sb_publishable_iwyHMjacfyUvciCHlXA8gw_my3o8YEx';

// Wrap fetch with a 12-second abort timeout so a bad network fails fast
// instead of hanging for 60+ seconds. url is passed as-is (no casting) to
// avoid the "[object Request]" bug from string-casting a Request object.
const fetchWithTimeout: typeof fetch = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
