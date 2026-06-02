import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "standard" | "pastel";
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "standard", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("standard");
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "pastel") root.classList.add("pastel");
    else root.classList.remove("pastel");
  }, [theme]);
  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "standard" ? "pastel" : "standard")) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
