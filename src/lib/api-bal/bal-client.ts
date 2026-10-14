import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getServerBalClient } from "./bal-access";
import { findVoie } from "./generated/sdk.gen";

// Identifiant au format ObjectId (24 caractères hexadécimaux)
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

// Client authentifié de la BAL pour les composants serveur sous
// /adresses/{balId}. 404 si l'id est invalide ou si la BAL n'appartient pas
// à la commune de la session.
// cache() : un seul calcul par requête, partagé entre le layout et la page.
// Le client n'est pas gardé plus longtemps (ni en session) : il porte le
// token de la BAL, qui ne doit pas sortir du serveur ni être partagé.
export const requireBalClient = cache(async (balId: string) => {
  if (!OBJECT_ID_RE.test(balId)) notFound();

  const session = await requireSession();
  const client = await getServerBalClient(session, balId);
  if (!client) notFound();

  return client;
});

// Voie de la BAL pour les pages sous /voies/{voieId} (consultation, édition).
// 404 si la voie n'existe pas ou n'appartient pas à la BAL de l'URL : les
// lectures de l'API sont publiques, ce contrôle est donc fait ici.
export const requireBalVoie = cache(async (balId: string, voieId: string) => {
  const client = await requireBalClient(balId);
  if (!OBJECT_ID_RE.test(voieId)) notFound();

  const { data: voie, response } = await findVoie({
    client,
    path: { voieId },
  });
  if (response?.status === 404 || (voie && voie.balId !== balId)) notFound();
  if (!voie) {
    throw new Error(
      `Impossible de récupérer la voie ${voieId} (HTTP ${response?.status}).`,
    );
  }

  return voie;
});
