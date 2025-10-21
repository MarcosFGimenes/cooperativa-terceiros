import "server-only";
import { cookies } from "next/headers";

export const PCM_SESSION_COOKIE_NAME = "pcm_session";
export const PCM_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

export function setPcmSessionCookie(value: string, maxAge: number = PCM_SESSION_MAX_AGE_SECONDS) {
  cookies().set(PCM_SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge,
  });
}

export function clearPcmSessionCookie() {
  cookies().delete(PCM_SESSION_COOKIE_NAME);
}

export function getPcmSessionCookie(): string | null {
  return cookies().get(PCM_SESSION_COOKIE_NAME)?.value ?? null;
}
