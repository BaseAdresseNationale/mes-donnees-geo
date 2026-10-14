import "server-only";
import { createClient, createConfig } from "./generated/client";

// URL de mes-adresses-api SANS le /v2 : les chemins générés le contiennent déjà.
export function mesAdressesApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_MES_ADRESSES_API_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_MES_ADRESSES_API_URL manquant.");
  }
  return url.replace(/\/+$/, "");
}

// Client qui appelle directement mes-adresses-api avec le token d'une BAL.
// Une instance par requête : ne jamais mettre de token sur le client global
// généré, il serait partagé entre tous les utilisateurs du serveur.
export function createServerBalClient(token: string) {
  return createClient(
    createConfig({
      baseUrl: mesAdressesApiUrl(),
      auth: token,
    }),
  );
}

// Client « de confiance » pour les routes /v2/trusted-client de mes-adresses-api.
// Le secret est envoyé dans le header x-client-secret (déclaré dans le Swagger),
// l'email de l'agent dans x-acting-user pour la traçabilité côté API.
export function createTrustedClient(actingUserEmail: string) {
  const secret = process.env.MES_DONNEES_GEO_CLIENT_SECRET;
  if (!secret) {
    throw new Error("MES_DONNEES_GEO_CLIENT_SECRET manquant.");
  }

  return createClient(
    createConfig({
      baseUrl: mesAdressesApiUrl(),
      auth: secret,
      headers: { "x-acting-user": actingUserEmail },
    }),
  );
}
