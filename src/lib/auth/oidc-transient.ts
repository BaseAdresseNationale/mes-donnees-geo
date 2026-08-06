import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "mdg_oidc";
const MAX_AGE_SECONDS = 60 * 10;

export interface OidcTransientState {
  state: string;
  nonce: string;
  codeVerifier: string;
  idTokenHint?: string;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET manquant ou trop court.");
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(data: OidcTransientState): string {
  const payload = Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): OidcTransientState | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OidcTransientState;
  } catch {
    return null;
  }
}

export async function setOidcTransient(data: OidcTransientState): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, encode(data), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readOidcTransient(): Promise<OidcTransientState | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decode(token);
}

export async function clearOidcTransient(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
