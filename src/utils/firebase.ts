import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { getFirestore, initializeFirestore, enableNetwork } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
// Proje ID: borc-takip-pro-f6936 ile %100 birebir eşleşen resmi konfigürasyon
export const firebaseConfig = {
  apiKey: "AIzaSyDnMbBVsN37dGjNEYSL4XJnWVBIeiF1F4c",
  authDomain: "borc-takip-pro-f6936.firebaseapp.com",
  projectId: "borc-takip-pro-f6936",
  storageBucket: "borc-takip-pro-f6936.firebasestorage.app",
  messagingSenderId: "845600628526",
  appId: "1:845600628526:web:f3321e061df344971624bf",
  measurementId: "G-47WH5XGE3T"
};

// Initialize Firebase
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Android WebView ve mobil tarayıcılarda WebSocket engellerini aşmak için experimentalForceLongPolling ile başlat
let firestoreDb: any;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalForceLongPolling: true
  });
} catch {
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;

// getFirestore kodunun hemen altına enableNetwork(db) komutunu ekleyerek uygulamanın çevrim dışı moda kaçmasını kesin olarak engelle
enableNetwork(db)
  .then(() => {
    console.log("Firestore ağı başarıyla etkinleştirildi (enableNetwork: OK)");
  })
  .catch((err) => {
    console.warn("Firestore enableNetwork uyarısı:", err?.message || err);
  });

export { enableNetwork };

export async function ensureFirestoreNetwork(): Promise<{ success: boolean; message: string }> {
  try {
    await enableNetwork(db);
    return { success: true, message: "Firestore ağı aktif." };
  } catch (err: any) {
    const code = err?.code || "HATA";
    const msg = err?.message || String(err);
    return { success: false, message: `[${code}] ${msg}` };
  }
}

export const auth = getAuth(app);

// E-Posta ve Şifre ile Firebase Auth İşlemleri
export async function epostaIleGirisYap(email: string, sifre: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  const credential = await signInWithEmailAndPassword(auth, cleanEmail, sifre);
  return credential.user;
}

export async function epostaIleKayitOl(email: string, sifre: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  const credential = await createUserWithEmailAndPassword(auth, cleanEmail, sifre);
  return credential.user;
}

export async function epostaSifreSifirla(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  await sendPasswordResetEmail(auth, cleanEmail);
}

export async function oturumuKapat(): Promise<void> {
  await signOut(auth);
}

// Initialize Analytics conditionally in browser
export let analytics: any = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch (err) {
        console.warn("Firebase Analytics initialization skipped:", err);
      }
    }
  }).catch(() => {});
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code || "BilinmeyenHata";
  const formattedError = `[${errCode}] ${errMessage}`;

  const errInfo: FirestoreErrorInfo = {
    error: formattedError,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  return formattedError;
}
