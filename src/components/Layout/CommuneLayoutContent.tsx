"use client";
import ThemeContext from "@/contexts/ThemeContext";
import { LeftPanel, MainLayout } from "@gouvfr-lasuite/ui-components";
import { ReactNode, useContext } from "react";

type CommuneLayoutContentProps = {
  children: ReactNode;
};

export function CommuneLayoutContent({ children }: CommuneLayoutContentProps) {
  const { isLeftPanelOpen } = useContext(ThemeContext) ?? {
    isLeftPanelOpen: true,
  };

  return (
    <MainLayout
      leftPanelContent={<LeftPanel />}
      isLeftPanelOpen={isLeftPanelOpen}
      icon={
        <span className="headerLogo">
          <img src={`/images/logo.svg`} alt="Logo Mes données géo" width={32} />
          <b>Mes données géo</b>
        </span>
      }
    >
      {children}
    </MainLayout>
  );
}
