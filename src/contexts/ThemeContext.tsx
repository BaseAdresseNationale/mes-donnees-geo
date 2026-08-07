"use client";

import { CunninghamProvider, Spinner } from "@gouvfr-lasuite/ui-components";
import React, { useState, ReactNode, useEffect } from "react";

interface ThemeContextType {
  theme: string;
  setTheme: (value: string) => void;
  isLeftPanelOpen: boolean;
  setIsLeftPanelOpen: (value: boolean) => void;
}

const ThemeContext = React.createContext<ThemeContextType>({
  theme: "default",
  setTheme: () => {},
  isLeftPanelOpen: true,
  setIsLeftPanelOpen: () => {},
});

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState("default");
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const value = { theme, setTheme, isLeftPanelOpen, setIsLeftPanelOpen };

  useEffect(() => {
    if (!loaded) {
      // Ne s'exécute que côté client, après le montage : évite un mismatch d'hydratation SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoaded(true);
    }
  }, [loaded]);

  return !loaded ? (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100vw",
        height: "100vh",
      }}
    >
      <Spinner size="xl" />
    </div>
  ) : (
    <ThemeContext.Provider value={value}>
      <CunninghamProvider theme={theme}>{children}</CunninghamProvider>
    </ThemeContext.Provider>
  );
}

export const ThemeContextConsumer = ThemeContext.Consumer;

export default ThemeContext;
