import { NextResponse } from "next/server";
import * as client from "openid-client";
import { proConnectConfig, proConnectSettings } from "@/lib/auth/proconnect";
import { setOidcTransient } from "@/lib/auth/oidc-transient";

export async function POST(request: Request): Promise<Response> {
  const config = await proConnectConfig();
  const { redirectUri, scopes } = proConnectSettings();

  const state = client.randomState();
  const nonce = client.randomNonce();
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

  await setOidcTransient({ state, nonce, codeVerifier });

  const authUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    acr_values: "eidas1",
  });

  return NextResponse.redirect(authUrl.toString(), { status: 303 });
}
