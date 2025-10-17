import "server-only";
import { cookies } from "next/headers";

const COOKIE_NAME = "access_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

export function setTokenCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function getTokenCookie(): string | null {
  return cookies().get(COOKIE_NAME)?.value ?? null;
}

export function clearTokenCookie() {
  cookies().delete(COOKIE_NAME);
}
