import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BalMapEffects } from "@/components/adresses/BalMapEffects";
import { BalTabs } from "@/components/adresses/BalTabs";

// Identifiant de BAL au format ObjectId (24 caractères hexadécimaux)
const BAL_ID_RE = /^[0-9a-f]{24}$/i;

// Commun aux onglets d'une BAL : reste monté d'un onglet à l'autre, donc la
// carte et ses tuiles ne sont pas rechargées à chaque navigation.
export default async function BalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ codeCommune: string; balId: string }>;
}) {
  const { balId } = await params;
  if (!BAL_ID_RE.test(balId)) notFound();

  return (
    <>
      <BalMapEffects balId={balId} />
      <BalTabs />
      {children}
    </>
  );
}
