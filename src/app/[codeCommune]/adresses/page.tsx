import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getCommuneBalsForClient } from "@/lib/api-bal/bal-access";

export default async function AdressesPage() {
  const session = await requireSession();
  // Liste déjà en cache après l'appel du layout, triée du plus récent au plus ancien
  const bals = await getCommuneBalsForClient(session);

  // Par défaut : la BAL publiée, sinon le brouillon le plus récent
  const defaultBal =
    bals?.find((bal) => bal.status === "published") ??
    bals?.find((bal) => bal.status === "draft");

  if (defaultBal) {
    redirect(`/${session.communeInsee}/adresses/${defaultBal.id}`);
  }

  return <div>Sélectionnez une Base Adresse Locale</div>;
}
