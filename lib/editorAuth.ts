import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const EDITOR_SESSION_COOKIE = "portfolio_editor_session";
export const EDITOR_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function constantTimeEqual(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes);
}

function sessionSignature(expiresAt: string, nonce: string, password: string): string {
  return createHmac("sha256", password)
    .update(`${EDITOR_SESSION_COOKIE}:${expiresAt}:${nonce}`)
    .digest("base64url");
}

export function verifyEditorPassword(candidate: unknown): boolean {
  const expected = process.env.EDITOR_PASSWORD;
  if (typeof candidate !== "string" || !expected) return false;
  return constantTimeEqual(candidate, expected);
}

export function createEditorSessionToken(): string | null {
  const password = process.env.EDITOR_PASSWORD;
  if (!password) return null;

  const expiresAt = String(Math.floor(Date.now() / 1000) + EDITOR_SESSION_MAX_AGE_SECONDS);
  const nonce = randomUUID();
  return `${expiresAt}.${nonce}.${sessionSignature(expiresAt, nonce, password)}`;
}

export function hasValidEditorSession(request: Request): boolean {
  const password = process.env.EDITOR_PASSWORD;
  if (!password) return false;

  const cookie = request.headers.get("cookie")?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${EDITOR_SESSION_COOKIE}=`));
  if (!cookie) return false;

  const token = cookie.slice(EDITOR_SESSION_COOKIE.length + 1);
  const [expiresAt, nonce, signature, ...extra] = token.split(".");
  if (
    extra.length > 0 ||
    !expiresAt ||
    !nonce ||
    !signature ||
    !/^\d+$/.test(expiresAt)
  ) {
    return false;
  }

  const expiration = Number(expiresAt);
  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(expiration) ||
    expiration <= now ||
    expiration > now + EDITOR_SESSION_MAX_AGE_SECONDS
  ) {
    return false;
  }

  return constantTimeEqual(signature, sessionSignature(expiresAt, nonce, password));
}
