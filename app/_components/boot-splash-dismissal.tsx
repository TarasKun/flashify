"use client";

import { useEffect } from "react";

export function BootSplashDismissal() {
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      document.documentElement.classList.add("flashify-hydrated");
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return null;
}
