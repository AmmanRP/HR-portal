import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

export type AccountType = "EMPLOYEE" | "FTO" | "HR";
export type AccountStatus = "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED";

export const SESSION_COOKIE = "patroldesk_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7;
const developmentSecret = "patroldesk-local-development-secret-change-before-deploy";

type SessionPayload = {
  sub: string;
  username: string;
  accountType: AccountType;
  accountStatus: AccountStatus;
  exp: number;
};

function getSessionSecret() {
  const configuredSecret = process.env.SESSION_SECRET;
  if (configuredSecret && configuredSecret.length >= 32) return configuredSecret;
  if (process.env.NODE_ENV !== "production") return developmentSecret;
  throw new Error("SESSION_SECRET must be set to at least 32 characters");
}

function deriveKey(password: string, salt: string, length: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, length, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const key = await deriveKey(password, salt, 64);
  return `scrypt$${salt}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, encodedKey] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !encodedKey) return false;
  const expected = Buffer.from(encodedKey, "base64url");
  const actual = await deriveKey(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken(account: Omit<SessionPayload, "exp">) {
  const payload = Buffer.from(JSON.stringify({
    ...account,
    exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
  } satisfies SessionPayload)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const expected = createHmac("sha256", getSessionSecret()).update(payload).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (!session.sub || !session.username || session.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!["EMPLOYEE", "FTO", "HR"].includes(session.accountType)) return null;
    if (!["ACTIVE", "PENDING_APPROVAL", "SUSPENDED"].includes(session.accountStatus)) return null;
    return session;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_LIFETIME_SECONDS,
};