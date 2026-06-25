'use client';
import { createClient } from '@supabase/supabase-js';

// App standalone: fala SÓ com as RPCs mn_* (schema isolado). Anon key.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
});
