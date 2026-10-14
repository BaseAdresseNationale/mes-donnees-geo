import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth/session";
import { getBalToken, invalidateCommune } from "./bal-access";
import { mesAdressesApiUrl } from "./server-client";

const UPSTREAM_TIMEOUT_MS = 60_000;

// Headers du navigateur transmis à l'API. Tout le reste (cookie notamment)
// est volontairement abandonné.
const FORWARDED_REQUEST_HEADERS = ["content-type", "accept", "accept-language"];
const FORWARDED_RESPONSE_HEADERS = ["content-type", "content-disposition"];

// Ressources de l'API accessibles via le proxy (2e segment après "v2").
// Pour voies / numeros / toponymes, c'est l'API qui vérifie que l'entité
// appartient bien à la BAL du token.
const ALLOWED_RESOURCES = new Set([
  "bases-locales",
  "voies",
  "numeros",
  "toponymes",
  "signalements",
  "commune",
]);

// Sous-routes d'une BAL qu'on ne veut jamais exposer à l'éditeur.
const FORBIDDEN_BAL_SUBRESOURCES = new Set(["token", "recovery"]);

// Vérifie que le chemin demandé (après /api/adresses/bal/{balId}/) est autorisé.
// Exemples OK : v2/voies/abc, v2/bases-locales/{balId}/voies
// Refusés : v2/admin/..., v2/bases-locales/search, v2/bases-locales/{autreId}
export function isAllowedPath(balId: string, path: string[]): boolean {
  if (path.some((segment) => segment === "." || segment === "..")) {
    return false;
  }

  const [version, resource, resourceId, subResource] = path;
  if (version !== "v2" || !ALLOWED_RESOURCES.has(resource)) {
    return false;
  }

  if (resource === "bases-locales") {
    return (
      resourceId === balId &&
      !FORBIDDEN_BAL_SUBRESOURCES.has(subResource) &&
      !path.includes("recovery")
    );
  }

  if (resource === "signalements") {
    return resourceId === balId;
  }

  return true;
}

// Retire récursivement toute clé "token" d'une réponse JSON : l'API renvoie
// le token de la BAL aux appelants authentifiés, il ne doit pas sortir du serveur.
export function stripToken(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripToken);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "token")
        .map(([key, child]) => [key, stripToken(child)]),
    );
  }
  return value;
}

async function toClientResponse(upstream: Response): Promise<Response> {
  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (upstream.status === 204 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status, headers });
  }

  if (upstream.headers.get("content-type")?.includes("application/json")) {
    const text = await upstream.text();
    const body = text ? JSON.stringify(stripToken(JSON.parse(text))) : null;
    return new NextResponse(body, { status: upstream.status, headers });
  }

  // CSV, PDF, tuiles... : transmis tels quels
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

interface ForwardOptions {
  request: Request;
  session: SessionUser;
  balId: string;
  path: string[];
}

// Transmet la requête du navigateur à mes-adresses-api avec le token de la BAL.
export async function forwardToMesAdressesApi({
  request,
  session,
  balId,
  path,
}: ForwardOptions): Promise<Response> {
  if (!isAllowedPath(balId, path)) {
    return NextResponse.json({ error: "Route non autorisée" }, { status: 403 });
  }

  let token: string | null;
  try {
    token = await getBalToken(session, balId);
  } catch (error) {
    console.error("[api/adresses/bal] récupération du token", error);
    return NextResponse.json(
      { error: "mes-adresses-api indisponible" },
      { status: 502 },
    );
  }
  if (!token) {
    return NextResponse.json({ error: "BAL introuvable" }, { status: 403 });
  }

  const { search } = new URL(request.url);
  const url = `${mesAdressesApiUrl()}/${path.map(encodeURIComponent).join("/")}${search}`;

  // Le body est lu une seule fois en mémoire pour pouvoir rejouer la requête
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-acting-user", session.email);
  headers.set("x-request-id", randomUUID());

  const send = (balToken: string) => {
    headers.set("authorization", `Bearer ${balToken}`);
    return fetch(url, {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  };

  try {
    let upstream = await send(token);

    // Token refusé : il a peut-être été renouvelé depuis mes-adresses.
    // On recharge la liste, et on ne rejoue que si le token a changé
    // (sinon c'est un vrai refus de l'API, ex : BAL brouillon bloquée).
    if (upstream.status === 401 || upstream.status === 403) {
      invalidateCommune(session.communeInsee);
      const freshToken = await getBalToken(session, balId);
      if (freshToken && freshToken !== token) {
        upstream = await send(freshToken);
      }
    }

    return await toClientResponse(upstream);
  } catch (error) {
    console.error(`[api/adresses/bal] ${request.method} ${url}`, error);
    return NextResponse.json(
      { error: "mes-adresses-api indisponible" },
      { status: 502 },
    );
  }
}
