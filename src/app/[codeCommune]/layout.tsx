import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import { getEnabledPlugins } from "@/plugins/registry";
import { Header } from "@/components/Layout/Header";
import { PluginTabs } from "@/components/Layout/PluginTabs";
import { fetchCommuneContour, isValidInseeCode } from "@/lib/geo/commune";
import { CommuneProvider } from "@/components/CommuneContext";
import styles from "./layout.module.css";

export default async function CommuneLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ codeCommune: string }>;
}) {
  const { codeCommune } = await params;

  if (!isValidInseeCode(codeCommune)) notFound();

  const session = await getSession();
  if (!session || !isValidInseeCode(session.communeInsee ?? "")) redirect("/");
  if (session.communeInsee !== codeCommune) {
    redirect(`/${session.communeInsee}`);
  }

  const [plugins, contour] = await Promise.all([
    getEnabledPlugins(session.communeInsee),
    fetchCommuneContour(codeCommune).catch(() => null),
  ]);

  const tabItems = plugins.map((p) => ({
    id: p.id,
    label: p.label,
    icon: p.icon,
    href: `/${codeCommune}/${p.id}`,
  }));

  return (
    <CommuneProvider
      value={{
        codeInsee: codeCommune,
        nom: session.communeName,
        contour,
      }}
    >
      <div className={styles.shell}>
        <Header
          user={{
            fullName: `${session.givenName} ${session.familyName}`,
            communeName: `${session.communeName} (${codeCommune})`,
          }}
        />
        <PluginTabs items={tabItems} />
        <main id="contenu" className={styles.main}>
          {children}
        </main>
      </div>
    </CommuneProvider>
  );
}
