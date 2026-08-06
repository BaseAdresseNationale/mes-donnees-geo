"use client";

import { CunninghamProvider, Loader } from "@gouvfr-lasuite/ui-components";
import React, { useState, ReactNode, useEffect } from "react";

interface ThemeContextType {
  theme: string;
  setTheme: (value: string) => void;
  isLeftPanelOpen: boolean;
  setIsLeftPanelOpen: (value: boolean) => void;
}

const ThemeContext = React.createContext<ThemeContextType | null>(null);

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState("default");
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const value = { theme, setTheme, isLeftPanelOpen, setIsLeftPanelOpen };

  useEffect(() => {
    if (!loaded) {
      setLoaded(true);
    }
  }, [loaded]);

  return !loaded ? (
    <Loader />
  ) : (
    <ThemeContext.Provider value={value}>
      <CunninghamProvider theme={theme}>{children}</CunninghamProvider>
    </ThemeContext.Provider>
  );
}

export const ThemeContextConsumer = ThemeContext.Consumer;

export default ThemeContext;
