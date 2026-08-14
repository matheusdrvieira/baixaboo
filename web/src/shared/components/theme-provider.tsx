"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext, type Theme } from "@/shared/contexts/theme";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [resolvedTheme, setResolvedTheme] = useState<Theme>("dark");

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    const initialTheme: Theme =
      storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";

    applyTheme(initialTheme);
    setResolvedTheme(initialTheme);
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    localStorage.setItem("theme", theme);
    applyTheme(theme);
    setResolvedTheme(theme);
  }, []);

  const value = useMemo(() => ({ resolvedTheme, setTheme }), [resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
