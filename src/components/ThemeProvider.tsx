"use client";

import React, { createContext, useContext, useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "equiptalk-theme";
const CHANGE_EVENT = "equiptalk-theme-change";

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Applies the theme to the document: toggles the `dark` class (class-based
 * Tailwind dark variant, see globals.css) and sets `color-scheme` so native
 * controls (inputs, scrollbars) match. Kept in sync with the pre-hydration
 * script in the root layout so there is no flash of the wrong theme.
 */
function applyTheme(theme: Theme) {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
}

// The active theme is read directly from the DOM (the `.dark` class, which the
// pre-hydration script already set from localStorage/system). This makes the
// DOM the single source of truth and keeps SSR and client consistent via
// useSyncExternalStore.
function subscribe(callback: () => void) {
    window.addEventListener(CHANGE_EVENT, callback);
    return () => window.removeEventListener(CHANGE_EVENT, callback);
}

function getSnapshot(): Theme {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
    return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const setTheme = useCallback((next: Theme) => {
        applyTheme(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // localStorage may be unavailable (private mode); theme still
            // applies for the current session.
        }
        // Notify all subscribers to re-read the DOM snapshot.
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(getSnapshot() === "dark" ? "light" : "dark");
    }, [setTheme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return ctx;
}
