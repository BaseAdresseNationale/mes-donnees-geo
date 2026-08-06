"use client";

import {
  Footer,
  Hero,
  HomeGutter,
  LeftPanel,
  MainLayout,
  ProConnectButton,
} from "@gouvfr-lasuite/ui-components";

export function HomePageContent() {
  return (
    <MainLayout
      hideLeftPanelOnDesktop
      leftPanelContent={<LeftPanel />}
      icon={
        <span className="headerLogo">
          <img src={`/images/logo.svg`} alt="Logo Mes données géo" width={32} />
          <b>Mes données géo</b>
        </span>
      }
    >
      <div className="app__home">
        <HomeGutter>
          <Hero
            logo={
              <img
                src={`/images/logo.svg`}
                alt="Logo Mes données géo"
                width={64}
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
    </MainLayout>
  );
}
