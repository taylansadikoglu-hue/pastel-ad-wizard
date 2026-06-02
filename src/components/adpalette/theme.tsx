import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "warm" | "dark";
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "warm", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("warm");
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "warm" ? "dark" : "warm")) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
