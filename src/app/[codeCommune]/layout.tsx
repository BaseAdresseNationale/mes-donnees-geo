import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import { fetchCommuneContour, isValidInseeCode } from "@/lib/geo/commune";
import { CommuneProvider } from "@/contexts/CommuneContext";
import { CommuneLayoutContent } from "@/components/Layout/CommuneLayoutContent";
import { getEnabledPlugins } from "@/plugins/registry";
import { getCommuneSettings } from "@/lib/db/commune-settings";

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

  const [contour, settings, enabledPlugins] = await Promise.all([
    fetchCommuneContour(codeCommune).catch(() => null),
    getCommuneSettings(codeCommune),
    getEnabledPlugins(codeCommune),
  ]);

  return (
    <CommuneProvider
      value={{
        codeInsee: codeCommune,
        nom: session.communeName,
        contour,
        enabledPluginIds: enabledPlugins.map((p) => p.id),
        basemap: settings.basemap,
      }}
    >
      <CommuneLayoutContent>{children}</CommuneLayoutContent>
    </CommuneProvider>
  );
}
