"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type FlashMessageType = "ok" | "err" | "delete" | "deleted";

export type FlashMessage = {
  type: FlashMessageType;
  text: string;
};

const SHOW_MS_DEFAULT = 4000;
const SHOW_MS_ERROR = 8000;
const FADE_MS = 300;

function durationForType(type: FlashMessageType): number {
  return type === "err" ? SHOW_MS_ERROR : SHOW_MS_DEFAULT;
}

/** Temporary success/error banner that fades out automatically. */
export function useFlashMessage() {
  const [message, setMessage] = useState<FlashMessage | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    clearTimers();
    setMessage(null);
    setDismissing(false);
  }, [clearTimers]);

  const show = useCallback(
    (next: FlashMessage, durationMs?: number) => {
      clearTimers();
      setDismissing(false);
      setMessage(next);
      const showMs = durationMs ?? durationForType(next.type);
      showTimerRef.current = setTimeout(() => {
        setDismissing(true);
        showTimerRef.current = null;
      }, showMs);
    },
    [clearTimers]
  );

  useEffect(() => {
    if (!dismissing) return;
    fadeTimerRef.current = setTimeout(() => {
      setMessage(null);
      setDismissing(false);
      fadeTimerRef.current = null;
    }, FADE_MS);
    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };
  }, [dismissing]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return { message, dismissing, show, clear };
}
