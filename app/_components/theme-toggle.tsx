"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "flashify-theme";
const THEME_CHANGE_EVENT = "flashify-theme-change";

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "Use light theme" : "Use dark theme";

  return (
    <button
      aria-label={label}
      className="grid size-12 place-items-center rounded-full border border-white/70 bg-white/80 text-[var(--app-text)] shadow-[var(--app-shadow-soft)] backdrop-blur dark:border-white/10 dark:bg-white/10"
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" size={20} strokeWidth={2.2} />
    </button>
  );
}

function subscribeToTheme(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  mediaQuery.addEventListener("change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    mediaQuery.removeEventListener("change", onStoreChange);
  };
}

function getThemeSnapshot(): ThemeMode {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  return "light";
}

function getServerThemeSnapshot(): ThemeMode {
  return "light";
}
