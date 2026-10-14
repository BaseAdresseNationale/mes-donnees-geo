import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getServerBalClient } from "./bal-access";

// Identifiant de BAL au format ObjectId (24 caractères hexadécimaux)
const BAL_ID_RE = /^[0-9a-f]{24}$/i;

// Client authentifié de la BAL pour les composants serveur sous
// /adresses/{balId}. 404 si l'id est invalide ou si la BAL n'appartient pas
// à la commune de la session.
// cache() : un seul calcul par requête, partagé entre le layout et la page.
// Le client n'est pas gardé plus longtemps (ni en session) : il porte le
// token de la BAL, qui ne doit pas sortir du serveur ni être partagé.
export const requireBalClient = cache(async (balId: string) => {
  if (!BAL_ID_RE.test(balId)) notFound();

  const session = await requireSession();
  const client = await getServerBalClient(session, balId);
  if (!client) notFound();

  return client;
});
