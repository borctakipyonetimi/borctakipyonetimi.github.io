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
import { 
  getDatabase, 
  ref, 
  set as rawSet, 
  get, 
  child, 
  update as rawUpdate, 
  onValue, 
  off, 
  serverTimestamp, 
  goOnline 
} from "firebase/database";
import { getAnalytics, isSupported } from "firebase/analytics";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot 
} from "firebase/firestore";

// Veritabanı çökmesini önleyen temizlik fonksiyonu
export function veriyiTemizle<T>(obj: T): T {
  if (obj === undefined || obj === null) return (null as unknown) as T;
  try {
    return JSON.parse(JSON.stringify(obj, (_k, v) => (v === undefined ? null : v)));
  } catch (err) {
    console.warn("veriyiTemizle dönüşüm uyarısı:", err);
    return obj;
  }
}

// Realtime Database set ve update işlemlerinde undefined değerlerini otomatik temizleyen koruyucular
export const set = (r: any, val: any) => {
  return rawSet(r, veriyiTemizle(val));
};

export const update = (r: any, val: any) => {
  return rawUpdate(r, veriyiTemizle(val));
};

export { ref, get, child, onValue, off, serverTimestamp, goOnline, rawSet, rawUpdate };

// Your web app's Firebase configuration
// Proje ID: borc-takip-pro-f6936 - Realtime Database databaseURL ekli
export const firebaseConfig = {
  apiKey: "AIzaSyDnMbBVsN37dGjNEYSL4XJnWVBIeiF1F4c",
  authDomain: "borc-takip-pro-f6936.firebaseapp.com",
  databaseURL: "https://borc-takip-pro-f6936-default-rtdb.firebaseio.com",
  projectId: "borc-takip-pro-f6936",
  storageBucket: "borc-takip-pro-f6936.firebasestorage.app",
  messagingSenderId: "845600628526",
  appId: "1:845600628526:web:f3321e061df344971624bf",
  measurementId: "G-47WH5XGE3T"
};

// Initialize Firebase
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Firebase Realtime Database - Android WebView ağ engeline takılmayan standart veritabanı
export const db = getDatabase(app);

// Cloud Firestore Database - Doküman tabanlı kullanıcı ve profil veritabanı
export const firestore = getFirestore(app);
export { doc, getDoc, setDoc, updateDoc, onSnapshot };

// Veritabanı bağlantısını çevrim içi tut
try {
  goOnline(db);
  console.log("Firebase Realtime Database başarıyla başlatıldı ve goOnline() çağrıldı.");
} catch (rtdbErr) {
  console.warn("Realtime Database goOnline uyarısı:", rtdbErr);
}

export async function ensureDatabaseNetwork(): Promise<{ success: boolean; message: string }> {
  try {
    goOnline(db);
    return { success: true, message: "Realtime Database ağı aktif." };
  } catch (err: any) {
    const code = err?.code || "HATA";
    const msg = err?.message || String(err);
    return { success: false, message: `[${code}] ${msg}` };
  }
}
export const ensureFirestoreNetwork = ensureDatabaseNetwork;
export const enableNetwork = (databaseInstance?: any) => {
  try {
    goOnline(databaseInstance || db);
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
};

export const auth = getAuth(app);
export { signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged };

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

export interface DatabaseErrorInfo {
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
export type FirestoreErrorInfo = DatabaseErrorInfo;

export function handleDatabaseError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code || "BilinmeyenHata";
  const formattedError = `[${errCode}] ${errMessage}`;

  const errInfo: DatabaseErrorInfo = {
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
  console.error("Firebase Database Error: ", JSON.stringify(errInfo));
  return formattedError;
}
export const handleFirestoreError = handleDatabaseError;
