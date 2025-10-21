import type { FirebaseOptions } from "firebase/app";

type FirebasePublicConfig = FirebaseOptions & {
  apiKey: string;
  appId: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId?: string;
};

let cachedConfig: FirebasePublicConfig | null = null;

const fallbackNotices = new Set<string>();

declare global {
  interface Window {
    __FIREBASE_PUBLIC_CONFIG?: FirebasePublicConfig;
  }
}

function readEnvValue(names: string[]): string | undefined {
  for (const candidate of names) {
    const raw = process.env[candidate];
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const [primary] = names;
    if (
      candidate !== primary &&
      process.env.NODE_ENV !== "production" &&
      !fallbackNotices.has(primary)
    ) {
      console.warn(
        `[firebase] Using ${candidate} as fallback for ${primary}. ` +
          "Consider defining the public NEXT_PUBLIC_* variables to avoid this warning.",
      );
      fallbackNotices.add(primary);
    }
    return trimmed;
  }
  return undefined;
}

function readRequiredEnv(name: string, fallbackNames: string[] = []) {
  const value = readEnvValue([name, ...fallbackNames]);
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

function readOptionalEnv(name: string, fallbackNames: string[] = []) {
  const value = readEnvValue([name, ...fallbackNames]);
  return value ?? undefined;
}

function sanitizeDomain(domain: string) {
  const withoutProtocol = domain.replace(/^https?:\/\//, "");
  return withoutProtocol.replace(/\/$/, "");
}

function resolveAuthDomain(projectId: string, explicitDomain?: string | null) {
  if (explicitDomain) {
    const sanitized = sanitizeDomain(explicitDomain);
    if (sanitized && !sanitized.endsWith(".vercel.app") && sanitized !== "vercel.app") {
      return sanitized;
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[firebase] Ignoring NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=\"${explicitDomain}\". ` +
          "Firebase Authentication cannot use a *.vercel.app domain. Falling back to the default firebaseapp.com domain.",
      );
    }
  }
  return `${projectId}.firebaseapp.com`;
}

export function getFirebasePublicConfig(): FirebasePublicConfig {
  if (cachedConfig) return cachedConfig;

  if (typeof window !== "undefined") {
    const injected = window.__FIREBASE_PUBLIC_CONFIG;
    if (injected) {
      cachedConfig = injected;
      return injected;
    }
  }

  const projectId = readRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_PROJECT",
    "GOOGLE_CLOUD_PROJECT",
    "GCLOUD_PROJECT",
  ]);
  const apiKey = readRequiredEnv("NEXT_PUBLIC_FIREBASE_API_KEY", ["FIREBASE_API_KEY"]);
  const storageBucket = readRequiredEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", [
    "FIREBASE_STORAGE_BUCKET",
    "FIREBASE_ADMIN_STORAGE_BUCKET",
  ]);
  const appId = readRequiredEnv("NEXT_PUBLIC_FIREBASE_APP_ID", [
    "FIREBASE_APP_ID",
    "FIREBASE_ADMIN_APP_ID",
  ]);
  const messagingSenderId = readOptionalEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", [
    "FIREBASE_MESSAGING_SENDER_ID",
  ]);
  const authDomain = resolveAuthDomain(projectId, process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? process.env.FIREBASE_AUTH_DOMAIN);

  cachedConfig = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    appId,
    ...(messagingSenderId ? { messagingSenderId } : {}),
  };

  if (typeof window !== "undefined") {
    window.__FIREBASE_PUBLIC_CONFIG = cachedConfig;
  }

  return cachedConfig;
}

export function getFirebaseAuthDomain() {
  return getFirebasePublicConfig().authDomain;
}
