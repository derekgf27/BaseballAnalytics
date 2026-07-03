"use client";

import { useCallback, useEffect, useState } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = Element & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

async function requestFullscreen(el: Element): Promise<void> {
  const target = el as FullscreenElement;
  if (typeof el.requestFullscreen === "function") {
    await el.requestFullscreen();
    return;
  }
  if (typeof target.webkitRequestFullscreen === "function") {
    await target.webkitRequestFullscreen();
  }
}

async function exitFullscreen(): Promise<void> {
  const doc = document as FullscreenDocument;
  if (typeof document.exitFullscreen === "function" && document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  if (typeof doc.webkitExitFullscreen === "function" && doc.webkitFullscreenElement) {
    await doc.webkitExitFullscreen();
  }
}

/** Browser fullscreen (hides address bar / tabs and usually the OS taskbar). Laptop-oriented. */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(getFullscreenElement()));
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (getFullscreenElement()) {
        await exitFullscreen();
      } else {
        await requestFullscreen(document.documentElement);
      }
    } catch {
      // User denied or browser blocked fullscreen — leave state as-is.
    }
  }, []);

  return { isFullscreen, toggleFullscreen };
}
