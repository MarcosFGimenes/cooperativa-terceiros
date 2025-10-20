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

function readRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value.trim();
}

function readOptionalEnv(name: string) {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
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

  const projectId = readRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const apiKey = readRequiredEnv("NEXT_PUBLIC_FIREBASE_API_KEY");
  const storageBucket = readRequiredEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  const appId = readRequiredEnv("NEXT_PUBLIC_FIREBASE_APP_ID");
  const messagingSenderId = readOptionalEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  const authDomain = resolveAuthDomain(projectId, process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);

  cachedConfig = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    appId,
    ...(messagingSenderId ? { messagingSenderId } : {}),
  };

  return cachedConfig;
}

export function getFirebaseAuthDomain() {
  return getFirebasePublicConfig().authDomain;
}
