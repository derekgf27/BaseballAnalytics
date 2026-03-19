import { NextResponse } from "next/server";
import { supabase, hasSupabase } from "@/lib/db/client";

/**
 * GET /api/supabase-status — Verify Supabase connection and tables.
 * Use this to confirm env vars and that the players table is reachable.
 */
export async function GET() {
  if (!hasSupabase() || !supabase) {
    return NextResponse.json(
      {
        connected: false,
        error: "Missing env: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
      },
      { status: 503 }
    );
  }

  try {
    const { data, error } = await supabase.from("players").select("id").limit(1);
    if (error) {
      return NextResponse.json(
        { connected: false, error: error.message, code: error.code },
        { status: 503 }
      );
    }
    return NextResponse.json({ connected: true });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Connection failed";
    const isDown =
      /521|522|523|524|ECONNREFUSED|ETIMEDOUT|fetch failed|network|web server is down/i.test(raw);
    const message = isDown
      ? "Database is still starting up (Supabase was just resumed). Wait 1–2 minutes and try again."
      : raw;
    return NextResponse.json(
      { connected: false, error: message },
      { status: 503 }
    );
  }
}
