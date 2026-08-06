import { ThemeContextProvider } from "@/contexts/ThemeContext";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@gouvfr-lasuite/ui-components/style";
import "@gouvfr-lasuite/ui-components/fonts/roboto";
import "@gouvfr-lasuite/ui-components/fonts/marianne";
import "@gouvfr-lasuite/ui-components/fonts/material-icons";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mes données géo",
    template: "%s · Mes données géo",
  },
  description:
    "Outil cartographique pour les communes françaises : édition modulaire des adresses, contours, chemins ruraux, etc.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <a href="#contenu" className="skip-link">
          Aller au contenu principal
        </a>
        <ThemeContextProvider>{children}</ThemeContextProvider>
      </body>
    </html>
  );
}
