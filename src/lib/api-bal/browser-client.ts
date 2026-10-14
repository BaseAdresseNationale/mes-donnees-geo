import { createClient, createConfig } from "./generated/client";

// Client utilisé dans les composants "use client" : il passe par le proxy Next
// (/api/adresses/bal/{balId}/...), qui vérifie la session et ajoute le token
// de la BAL côté serveur. Aucun token ne transite donc par le navigateur.
export function createBalClient(balId: string) {
  return createClient(
    createConfig({
      baseUrl: `/api/adresses/bal/${encodeURIComponent(balId)}`,
    }),
  );
}
