"use client";

import { AppLayout } from "@/layouts/AppLayout";
import {
  Footer,
  Hero,
  HomeGutter,
  LeftPanel,
  ProConnectButton,
} from "@gouvfr-lasuite/ui-components";
import Image from "next/image";

export function HomePageContent() {
  return (
    <AppLayout hideLeftPanelOnDesktop leftPanelContent={<LeftPanel />}>
      <div className="app__home">
        <HomeGutter>
          <Hero
            logo={
              <Image
                src={`/images/logo.svg`}
                alt="Logo Mes données géo"
                width={64}
                height={64}
              />
            }
            title="Vos données territoriales"
            banner={`/images/banner.png`}
            subtitle="Gérer les données géographiques de votre commune en toute simplicité"
            mainButton={
              <form action="/auth/login" method="post">
                <ProConnectButton />
              </form>
            }
          />
        </HomeGutter>
        <Footer />
      </div>
    </AppLayout>
  );
}
