"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PitchTrackerPitch } from "@/lib/types";

/** Subscribes to `pitches` for the current tracker session (coach iPad types). */
export function usePitchTrackerRows(trackerGroupId: string | null) {
  const [rows, setRows] = useState<PitchTrackerPitch[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseBrowserClient();

  const refresh = useCallback(async () => {
    if (!supabase || !trackerGroupId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pitches")
        .select("*")
        .eq("tracker_group_id", trackerGroupId)
        .order("pitch_number", { ascending: true });
      if (error) throw new Error(error.message);
      setRows((data ?? []) as PitchTrackerPitch[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, trackerGroupId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supabase || !trackerGroupId) return;
    const channel = supabase
      .channel(`pitches-seq-${trackerGroupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pitches",
          filter: `tracker_group_id=eq.${trackerGroupId}`,
        },
        () => {
          void refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, trackerGroupId, refresh]);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.pitch_number - b.pitch_number), [rows]);

  return { rows: sorted, loading, refresh };
}
