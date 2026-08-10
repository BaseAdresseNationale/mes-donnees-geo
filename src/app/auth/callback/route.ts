import { NextResponse } from "next/server";
import * as client from "openid-client";
import { proConnectConfig } from "@/lib/auth/proconnect";
import {
  clearOidcTransient,
  readOidcTransient,
} from "@/lib/auth/oidc-transient";
import { setSession, type SessionUser } from "@/lib/auth/session";
import { NotACommuneError, resolveCommuneFromSiret } from "@/lib/geo/commune";

interface ProConnectUserInfo {
  sub: string;
  email?: string;
  given_name?: string;
  usual_name?: string;
  family_name?: string;
  siret?: string;
  belonging_population?: string;
}

function errorRedirect(
  request: Request,
  code: string,
  detail?: string,
): Response {
  const url = new URL("/auth/erreur", request.url);
  url.searchParams.set("code", code);
  if (detail) url.searchParams.set("detail", detail);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: Request): Promise<Response> {
  const transient = await readOidcTransient();
  if (!transient) {
    return errorRedirect(request, "transient_missing");
  }

  let tokens;
  let userinfo: ProConnectUserInfo;
  try {
    const config = await proConnectConfig();
    tokens = await client.authorizationCodeGrant(config, new URL(request.url), {
      pkceCodeVerifier: transient.codeVerifier,
      expectedState: transient.state,
      expectedNonce: transient.nonce,
    });
    const idClaims = tokens.claims();
    if (!idClaims?.sub) {
      await clearOidcTransient();
      return errorRedirect(request, "missing_sub");
    }
    userinfo = (await client.fetchUserInfo(
      config,
      tokens.access_token,
      idClaims.sub,
    )) as unknown as ProConnectUserInfo;
  } catch (err) {
    await clearOidcTransient();
    const msg = err instanceof Error ? err.message : "erreur inconnue";
    return errorRedirect(request, "oidc_exchange_failed", msg);
  }

  if (!userinfo.siret) {
    await clearOidcTransient();
    return errorRedirect(request, "missing_siret");
  }

  let commune;
  try {
    commune = await resolveCommuneFromSiret(userinfo.siret);
  } catch (err) {
    await clearOidcTransient();
    if (err instanceof NotACommuneError) {
      return errorRedirect(request, "not_a_commune", err.message);
    }
    const msg = err instanceof Error ? err.message : "erreur inconnue";
    return errorRedirect(request, "siret_resolution_failed", msg);
  }

  const session: SessionUser = {
    sub: userinfo.sub,
    email: userinfo.email ?? "",
    givenName: userinfo.given_name ?? "",
    familyName: userinfo.usual_name ?? userinfo.family_name ?? "",
    communeSiret: commune.siret,
    communeInsee: commune.codeInsee,
    communeName: commune.nom,
    scopes: [],
    idToken: tokens.id_token,
  };

  await setSession(session);
  await clearOidcTransient();

  return NextResponse.redirect(new URL(`/${commune.codeInsee}`, request.url), {
    status: 303,
  });
}
