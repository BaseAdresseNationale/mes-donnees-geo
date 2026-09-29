import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import { createClient, createConfig } from "./generated/client";
import {
  createBaseLocale,
  findCommuneBasesLocalesWithToken,
} from "./generated/sdk.gen";
import type { BaseLocale } from "./generated/types.gen";
import { stripToken } from "./proxy";
import { createTrustedClient, mesAdressesApiUrl } from "./server-client";

// Durée pendant laquelle on réutilise la liste des BAL (et leurs tokens)
// d'une commune avant de la redemander à mes-adresses-api.
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  expiresAt: number;
  // On stocke la promesse : deux requêtes simultanées pour la même commune
  // ne déclenchent qu'un seul appel à l'API.
  bals: Promise<BaseLocale[]>;
}

// Cache en mémoire du processus Node, clé = code INSEE.
// Les tokens restent côté serveur : ils ne vont jamais dans le cookie.
const cache = new Map<string, CacheEntry>();

async function fetchCommuneBals(session: SessionUser): Promise<BaseLocale[]> {
  const { data, error, response } = await findCommuneBasesLocalesWithToken({
    client: createTrustedClient(session.email),
    path: { codeCommune: session.communeInsee },
  });

  if (error || !data) {
    throw new Error(
      `Impossible de récupérer les BAL de la commune ${session.communeInsee} (HTTP ${response?.status}).`,
    );
  }

  return data;
}

// Liste des BAL (token inclus) de la commune de la session.
export async function listCommuneBals(
  session: SessionUser,
): Promise<BaseLocale[]> {
  const key = session.communeInsee;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.bals;
  }

  const bals = fetchCommuneBals(session);
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, bals });
  // En cas d'erreur, on ne garde pas la promesse rejetée en cache.
  bals.catch(() => cache.delete(key));

  return bals;
}

// BAL de la commune de la session, prêtes à être envoyées au navigateur :
// tokens retirés, plus récentes en premier. null si l'API est indisponible.
export async function getCommuneBalsForClient(
  session: SessionUser,
): Promise<BaseLocale[] | null> {
  try {
    const bals = stripToken(await listCommuneBals(session)) as BaseLocale[];
    return bals.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    console.error("[api-bal] récupération des BAL de la commune", error);
    return null;
  }
}

// Token de la BAL si elle appartient à la commune de la session, sinon null.
// C'est ce contrôle qui empêche une mairie d'accéder à la BAL d'une autre.
export async function getBalToken(
  session: SessionUser,
  balId: string,
): Promise<string | null> {
  const bals = await listCommuneBals(session);
  return bals.find((bal) => bal.id === balId)?.token ?? null;
}

// À appeler quand l'API refuse un token issu du cache (ex : token renouvelé
// depuis mes-adresses) ou après une création de BAL.
export function invalidateCommune(codeInsee: string): void {
  cache.delete(codeInsee);
}

// Crée une BAL pour la commune de la session, avec l'email de l'agent.
// La commune et l'email viennent de la session, jamais du navigateur.
export async function createCommuneBal(
  session: SessionUser,
  nom: string,
): Promise<BaseLocale> {
  const { data, error, response } = await createBaseLocale({
    // Route publique de l'API : pas besoin de secret ni de token
    client: createClient(createConfig({ baseUrl: mesAdressesApiUrl() })),
    body: {
      nom,
      commune: session.communeInsee,
      emails: [session.email],
      otherBalPublishedIgnored: false,
    },
  });

  if (error || !data) {
    throw new Error(
      `Impossible de créer la BAL pour la commune ${session.communeInsee} (HTTP ${response?.status}).`,
    );
  }

  invalidateCommune(session.communeInsee);
  return data;
}
