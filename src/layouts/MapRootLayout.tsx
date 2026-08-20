"use client";

import { useContext } from "react";
import ThemeContext from "@/contexts/ThemeContext";
import type { SessionUser } from "@/lib/auth/session";
import { MapLayout } from "@/layouts/MapLayout";

interface MapRootLayoutProps {
  children: React.ReactNode;
  session: SessionUser;
}

export function MapRootLayout({ children, session }: MapRootLayoutProps) {
  const { isLeftPanelOpen, toolbarChildren, rightHeaderContentChildren } =
    useContext(ThemeContext);
  const fullName = [session.givenName, session.familyName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <MapLayout
      user={{
        email: session.email,
        fullName: fullName || session.email,
      }}
      isLeftPanelOpen={isLeftPanelOpen}
      leftPanelContent={children}
      toolbarChildren={toolbarChildren}
      rightHeaderContentChildren={rightHeaderContentChildren}
    />
  );
}
