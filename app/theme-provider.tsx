"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void };

const ThemeContext = createContext<ThemeContextValue>({ theme: "light", setTheme: () => undefined });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("volta-weinlager-theme");
    if (saved === "dark" || saved === "light") {
      document.documentElement.dataset.theme = saved;
      window.setTimeout(() => setThemeState(saved), 0);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("volta-weinlager-theme", theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext);
  return <div className="theme-toggle" aria-label="Darstellung auswählen"><span>Darstellung</span><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")} aria-label="Helles Design">☼ Hell</button><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")} aria-label="Dunkles Design">◐ Dunkel</button></div>;
}
