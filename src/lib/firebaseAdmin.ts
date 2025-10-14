import * as admin from "firebase-admin";

function init() {
  if (admin.apps.length) return admin.app();

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return admin.initializeApp({ credential: admin.credential.cert(json) });
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  // fallback (para dev local usando ADC)
  return admin.initializeApp();
}

export const adminApp = init();
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
