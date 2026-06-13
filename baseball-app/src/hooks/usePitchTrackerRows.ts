"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PitchTrackerPitch } from "@/lib/types";

const FETCH_ERROR_DELAY_MS = 2_000;
const REALTIME_BAD_DELAY_MS = 2_000;

/** Subscribes to `pitches` for the current tracker session (coach iPad types). */
export function usePitchTrackerRows(trackerGroupId: string | null) {
  const [rows, setRows] = useState<PitchTrackerPitch[]>([]);
  const [loading, setLoading] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();
  const fetchSeqRef = useRef(0);
  const fetchErrorTimerRef = useRef<number | null>(null);
  const realtimeBadTimerRef = useRef<number | null>(null);

  const clearFetchErrorTimer = useCallback(() => {
    if (fetchErrorTimerRef.current != null) {
      window.clearTimeout(fetchErrorTimerRef.current);
      fetchErrorTimerRef.current = null;
    }
  }, []);

  const refresh = useCallback(
    async (options?: { background?: boolean }) => {
      if (!supabase || !trackerGroupId) {
        fetchSeqRef.current += 1;
        clearFetchErrorTimer();
        setRows([]);
        setFetchError(null);
        return;
      }
      const seq = ++fetchSeqRef.current;
      if (!options?.background) setLoading(true);
      try {
        const { data, error } = await supabase
          .from("pitches")
          .select("*")
          .eq("tracker_group_id", trackerGroupId)
          .order("pitch_number", { ascending: true });
        if (seq !== fetchSeqRef.current) return;
        if (error) throw new Error(error.message);
        setRows((data ?? []) as PitchTrackerPitch[]);
        clearFetchErrorTimer();
        setFetchError(null);
      } catch (e) {
        if (seq !== fetchSeqRef.current) return;
        const message = e instanceof Error ? e.message : "Could not load iPad pitches.";
        clearFetchErrorTimer();
        fetchErrorTimerRef.current = window.setTimeout(() => {
          if (seq !== fetchSeqRef.current) return;
          setFetchError(message);
        }, FETCH_ERROR_DELAY_MS);
      } finally {
        if (seq === fetchSeqRef.current && !options?.background) setLoading(false);
      }
    },
    [supabase, trackerGroupId, clearFetchErrorTimer]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      clearFetchErrorTimer();
      if (realtimeBadTimerRef.current != null) {
        window.clearTimeout(realtimeBadTimerRef.current);
        realtimeBadTimerRef.current = null;
      }
    };
  }, [clearFetchErrorTimer, trackerGroupId]);

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
          void refresh({ background: true });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (realtimeBadTimerRef.current != null) {
            window.clearTimeout(realtimeBadTimerRef.current);
            realtimeBadTimerRef.current = null;
          }
          setRealtimeOk(true);
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (realtimeBadTimerRef.current != null) {
            window.clearTimeout(realtimeBadTimerRef.current);
          }
          realtimeBadTimerRef.current = window.setTimeout(() => {
            setRealtimeOk(false);
            realtimeBadTimerRef.current = null;
          }, REALTIME_BAD_DELAY_MS);
        }
      });
    return () => {
      if (realtimeBadTimerRef.current != null) {
        window.clearTimeout(realtimeBadTimerRef.current);
        realtimeBadTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [supabase, trackerGroupId, refresh]);

  useEffect(() => {
    if (!trackerGroupId || realtimeOk) return;
    const id = window.setInterval(() => void refresh({ background: true }), 4000);
    return () => window.clearInterval(id);
  }, [trackerGroupId, realtimeOk, refresh]);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.pitch_number - b.pitch_number), [rows]);

  return { rows: sorted, loading, refresh, realtimeOk, fetchError };
}
