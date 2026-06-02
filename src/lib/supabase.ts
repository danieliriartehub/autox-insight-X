import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  console.error(
    "[AutoX] VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no están definidas. " +
    "Agrégalas en Vercel → Settings → Environment Variables y redespliega."
  );
}

export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  key ?? "placeholder"
);

export const supabaseReady = Boolean(url && key);
