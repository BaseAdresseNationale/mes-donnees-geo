import type { ReactNode } from "react";
import { requireBalClient } from "@/lib/api-bal/bal-client";
import { BalMapEffects } from "@/components/adresses/BalMapEffects";
import { BalTabs } from "@/components/adresses/BalTabs";
import { FormBackProvider } from "@/components/adresses/form/form-back";

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
  // Validation de l'id et contrôle d'accès, une fois pour tous les onglets
  await requireBalClient(balId);

  return (
    <FormBackProvider>
      <BalMapEffects balId={balId} />
      <BalTabs />
      {children}
    </FormBackProvider>
  );
}
