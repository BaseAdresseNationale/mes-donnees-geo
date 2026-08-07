import * as client from "openid-client";
import type { SessionUser } from "./session";

interface ProConnectSettings {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: string;
}

export function proConnectSettings(): ProConnectSettings {
  const issuer = process.env.PROCONNECT_ISSUER;
  const clientId = process.env.PROCONNECT_CLIENT_ID;
  const clientSecret = process.env.PROCONNECT_CLIENT_SECRET;
  const redirectUri = process.env.PROCONNECT_REDIRECT_URI;
  const postLogoutRedirectUri =
    process.env.PROCONNECT_POST_LOGOUT_REDIRECT_URI ?? "";
  const scopes =
    process.env.PROCONNECT_SCOPES ?? "openid given_name usual_name email siret";
  if (!issuer || !clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Configuration ProConnect incomplète (PROCONNECT_ISSUER, PROCONNECT_CLIENT_ID, PROCONNECT_CLIENT_SECRET, PROCONNECT_REDIRECT_URI requis).",
    );
  }
  return {
    issuer,
    clientId,
    clientSecret,
    redirectUri,
    postLogoutRedirectUri,
    scopes,
  };
}

let cachedConfig: client.Configuration | null = null;

export async function proConnectConfig(): Promise<client.Configuration> {
  if (cachedConfig) return cachedConfig;
  const { issuer, clientId, clientSecret } = proConnectSettings();
  cachedConfig = await client.discovery(
    new URL(issuer),
    clientId,
    undefined,
    client.ClientSecretPost(clientSecret),
  );
  return cachedConfig;
}
