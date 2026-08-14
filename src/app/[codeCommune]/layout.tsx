import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { MapRootLayout } from "@/layouts/MapRootLayout";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import { fetchCommuneContour, isValidInseeCode } from "@/lib/geo/commune";
import { CommuneProvider } from "@/contexts/CommuneContext";
import { listAllPlugins } from "@/plugins/registry";
import { getCommuneSettings } from "@/lib/db/commune-settings";
import { MapContextProvider } from "@/contexts/MapContext";
import { CadastreContextProvider } from "@/contexts/CadastreContext";
import { PanoramaxContextProvider } from "@/contexts/PanoramaxContext";
import { LocalStorageContextProvider } from "@/contexts/LocalStorageContext";

import "maplibre-gl/dist/maplibre-gl.css";

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
    <LocalStorageContextProvider>
      <CommuneProvider
        value={{
          codeInsee: codeCommune,
          nom: session.communeName,
          contour,
          plugins,
        }}
      >
        <MapContextProvider>
          <CadastreContextProvider>
            <PanoramaxContextProvider>
              <MapRootLayout session={session}>{children}</MapRootLayout>
            </PanoramaxContextProvider>
          </CadastreContextProvider>
        </MapContextProvider>
      </CommuneProvider>
    </LocalStorageContextProvider>
  );
}
