import { NextResponse } from "next/server";
import * as client from "openid-client";
import { proConnectConfig } from "@/lib/auth/proconnect";
import {
  clearOidcTransient,
  readOidcTransient,
} from "@/lib/auth/oidc-transient";
import { setSession, type SessionUser } from "@/lib/auth/session";
import { NotACommuneError, resolveCommuneFromSiret } from "@/lib/geo/commune";
import { resolveAppUrl } from "@/lib/http/request-url";

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
  const url = resolveAppUrl(request, "/auth/erreur");
  url.searchParams.set("code", code);
  if (detail) url.searchParams.set("detail", detail);
  return NextResponse.redirect(url, { status: 303 });
}

// oauth4webapi (utilisé par openid-client) met les paramètres d'erreur du
// fournisseur d'identité dans `cause`, sous forme de URLSearchParams.
function describeOidcError(err: unknown): string {
  if (!(err instanceof Error)) return "erreur inconnue";
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof URLSearchParams) {
    const error = cause.get("error");
    const description = cause.get("error_description");
    if (error) return [error, description].filter(Boolean).join(": ");
  } else if (cause && typeof cause === "object") {
    const { error, error_description: description } = cause as {
      error?: string;
      error_description?: string;
    };
    if (error) return [error, description].filter(Boolean).join(": ");
  }
  return err.message;
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
    console.error("Échec de l'échange OIDC ProConnect:", err);
    return errorRedirect(
      request,
      "oidc_exchange_failed",
      describeOidcError(err),
    );
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

  return NextResponse.redirect(
    resolveAppUrl(request, `/${commune.codeInsee}`),
    {
      status: 303,
    },
  );
}
