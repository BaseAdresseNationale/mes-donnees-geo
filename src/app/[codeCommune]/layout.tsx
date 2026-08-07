import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import { fetchCommuneContour, isValidInseeCode } from "@/lib/geo/commune";
import { CommuneProvider } from "@/contexts/CommuneContext";
import { listAllPlugins } from "@/plugins/registry";
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

  const [contour, settings] = await Promise.all([
    fetchCommuneContour(codeCommune).catch(() => null),
    getCommuneSettings(codeCommune),
  ]);
  const disabled = new Set(settings.disabledPlugins);
  const plugins = listAllPlugins().map((p) => ({
    id: p.id,
    label: p.label,
    icon: p.icon,
    enabled: !disabled.has(p.id),
  }));

  return (
    <CommuneProvider
      value={{
        codeInsee: codeCommune,
        nom: session.communeName,
        contour,
        plugins,
        basemap: settings.basemap,
      }}
    >
      {children}
    </CommuneProvider>
  );
}
