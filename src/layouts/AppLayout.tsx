import {
  LaGaufreV2,
  MainLayout,
  UserMenu,
} from "@gouvfr-lasuite/ui-components";
import styles from "./AppLayout.module.css";
import type { MainLayoutProps } from "@gouvfr-lasuite/ui-components";
import type { PropsWithChildren } from "react";
import Image from "next/image";
import { useCallback } from "react";

export type AppLayoutProps = {
  user?: {
    email: string;
    fullName: string;
  };
  rightHeaderContentChildren?: React.ReactNode;
} & PropsWithChildren<MainLayoutProps>;

export function AppLayout({
  children,
  rightHeaderContentChildren,
  user,
  ...props
}: AppLayoutProps) {
  const handleLogout = useCallback(() => {
    // Navigation plein-page requise : un fetch suivrait la redirection vers
    // ProConnect en arrière-plan sans effacer le cookie SSO du navigateur.
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/auth/logout";
    document.body.appendChild(form);
    form.submit();
  }, []);

  return (
    <MainLayout
      enableResize
      icon={
        <span className="headerLogo">
          <Image
            src={`/images/logo.svg`}
            alt="Logo Mes données géo"
            width={32}
            height={32}
          />
          <b>Mes données géo</b>
        </span>
      }
      rightHeaderContent={
        <div className={styles.rightHeaderContent}>
          {user && (
            <UserMenu
              logout={handleLogout}
              user={{
                email: user.email,
                full_name: user.fullName,
              }}
            />
          )}
          <LaGaufreV2
            apiUrl={`https://operateurs.suite.anct.gouv.fr/api/v1.0/lagaufre/services/?operator=${process.env.NEXT_PUBLIC_OPERATOR_ID}`}
            widgetPath="https://static.suite.anct.gouv.fr/widgets/lagaufre.js"
          />
          {rightHeaderContentChildren && (
            <div className={styles.rightHeaderContentChildren}>
              {rightHeaderContentChildren}
            </div>
          )}
        </div>
      }
      {...props}
    >
      {children}
    </MainLayout>
  );
}
