/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bütçem Pro - Centralized Auth, Role & AdMob Visibility Context (AuthContext / UserState)
 * 
 * Kurallar:
 * 1. Kayıt Olmadan Devam Edenler (Guest / Anonymous):
 *    - Pro özelliklerin tamamı kilitli / kapalıdır (hasProAccess = false).
 *    - Ücretsiz deneme hakkı KESİNLİKLE tanımlanmaz (isTrialActive = false, trialEndDate = null).
 *    - Banner ve geçiş (interstitial) reklamlarının tamamı bu kullanıcılara ZORUNLU olarak gösterilir (shouldShowAds = true).
 * 
 * 2. Kayıt Olup Giriş Yapanlar (Register / Login):
 *    - Yeni kayıt olan kullanıcıya 8 günlük ücretsiz Pro deneme süresi (trialEndDate = now + 8 days) otomatik tanımlanır.
 *    - 8 günlük deneme süresi aktif olduğu sürece Pro özellikler açık olmalı (hasProAccess = true) VE
 *      alt banner dahil hiç bir reklam gösterilmemelidir (shouldShowAds = false).
 *    - 8 günlük deneme süresi bittiğinde reklamlar tekrar aktif olur (shouldShowAds = true) ve Pro özellikler kilitlenir (hasProAccess = false).
 * 
 * 3. Premium Aboneler:
 *    - Pro özellikler tam açık olmalı (hasProAccess = true).
 *    - Hiçbir sayfada veya alt kısımda hiçbir reklam (Banner, Interstitial vb.) gösterilmemelidir:
 *      if (isPremium || isTrialActive) return null;
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth, firestore, doc, getDoc, setDoc } from "../utils/firebase";
import { showNativeInterstitialAd, showNativeBannerAd, hideNativeBannerAd } from "../utils/rewardedAdService";

export const TRIAL_DURATION_DAYS = 8;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

export interface AuthUserState {
  user: User | null;
  currentUser: string | null; // e-posta veya misafir etiketi
  isLoggedIn: boolean;        // Kayıtlı/oturum açmış kullanıcı
  isGuest: boolean;           // Misafir / anonim kullanıcı
  isPremium: boolean;         // Ücretli Premium abone veya süper yönetici
  isTrialActive: boolean;     // 8 günlük deneme süresi aktif mi?
  isTrialExpired: boolean;    // Deneme süresi doldu mu?
  trialDaysRemaining: number; // Kalan deneme gün sayısı (0-8)
  trialStartDate: string | null;
  trialEndDate: string | null;
  hasUsedTrial: boolean;

  // Master Access & Ad Controls
  hasProAccess: boolean;      // Pro özelliklerin kilidi açık mı? (isPremium || isTrialActive)
  shouldShowAds: boolean;     // Reklamlar gösterilmeli mi? (!isPremium && !isTrialActive)
  
  // Actions
  loginAsGuest: () => Promise<void>;
  registerWith8DayTrial: (email: string, uid?: string) => Promise<{ trialStartDate: string; trialEndDate: string }>;
  loginUser: (email: string, meta?: { isPremium?: boolean; isGuest?: boolean; createdAt?: string; trialEndDate?: string }) => void;
  logout: () => Promise<void>;
  setPremium: (status: boolean) => void;
  refreshAuthState: () => void;
  triggerInterstitialAdIfRequired: () => Promise<boolean>;
}

const AuthContext = createContext<AuthUserState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem("currentUser") || null;
  });

  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return localStorage.getItem("is_guest") === "true" || localStorage.getItem("userLoggedIn") !== "true";
  });

  const [isPremium, setIsPremium] = useState<boolean>(() => {
    const isSuper = (localStorage.getItem("currentUser") || "").toLowerCase().trim() === "info.borcodemetakip@gmail.com";
    if (isSuper) return true;
    const isPrem = localStorage.getItem("is_premium") === "true";
    const pSource = localStorage.getItem("premium_source");
    const isG = localStorage.getItem("is_guest") === "true";
    return isPrem && pSource !== "trial" && !isG;
  });

  const [trialStartDate, setTrialStartDate] = useState<string | null>(() => {
    return localStorage.getItem("trial_start_date") || null;
  });

  const [trialEndDate, setTrialEndDate] = useState<string | null>(() => {
    return localStorage.getItem("trial_end_date") || null;
  });

  const [hasUsedTrial, setHasUsedTrial] = useState<boolean>(() => {
    return localStorage.getItem("has_used_trial") === "true";
  });

  // Calculate dynamic trial state strictly according to the 8-day rule
  const calculateTrialStatus = useCallback((endStr: string | null, guestFlag: boolean, premFlag: boolean) => {
    // KURAL 1: Misafir veya anonim kullanıcılara ASLA ücretsiz deneme tanımlanamaz!
    if (guestFlag || !localStorage.getItem("currentUser") || localStorage.getItem("userLoggedIn") !== "true") {
      return { isTrialActive: false, isTrialExpired: false, daysRemaining: 0 };
    }

    // KURAL 3: Premium abonelerin denemeye ihtiyacı yoktur, zaten tam açıktır
    if (premFlag) {
      return { isTrialActive: false, isTrialExpired: false, daysRemaining: 0 };
    }

    if (!endStr) {
      return { isTrialActive: false, isTrialExpired: false, daysRemaining: 0 };
    }

    const endMs = new Date(endStr).getTime();
    if (isNaN(endMs)) {
      return { isTrialActive: false, isTrialExpired: false, daysRemaining: 0 };
    }

    const nowMs = Date.now();
    const diffMs = endMs - nowMs;

    if (diffMs > 0) {
      // 8 günlük deneme süresi aktif
      const daysLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      return { isTrialActive: true, isTrialExpired: false, daysRemaining: Math.min(TRIAL_DURATION_DAYS, daysLeft) };
    } else {
      // 8 günlük deneme süresi doldu!
      return { isTrialActive: false, isTrialExpired: true, daysRemaining: 0 };
    }
  }, []);

  const trialStatus = useMemo(() => {
    return calculateTrialStatus(trialEndDate, isGuest, isPremium);
  }, [calculateTrialStatus, trialEndDate, isGuest, isPremium]);

  const isTrialActive = trialStatus.isTrialActive;
  const isTrialExpired = trialStatus.isTrialExpired;
  const trialDaysRemaining = trialStatus.daysRemaining;

  // Master Access Check:
  // Pro özellikler SADECE Premium abonelere VEYA 8 günlük deneme süresi aktif olan kayıtlı kullanıcılara açıktır.
  // Misafirlere ve denemesi dolanlara kesinlikle KAPALIDIR.
  const hasProAccess = Boolean(isPremium || isTrialActive);

  // Master Ad Visibility Check:
  // KURAL 1: Misafirlere banner ve geçiş reklamlarının tamamı ZORUNLU olarak gösterilir.
  // KURAL 2: 8 günlük deneme aktif olduğu sürece HİÇBİR reklam gösterilmez. Süre dolunca tekrar zorunlu aktif olur.
  // KURAL 3: Premium abonelere HİÇBİR sayfada veya alt kısımda reklam gösterilmez: (if (isPremium || isTrialActive) return null;)
  const shouldShowAds = Boolean(!isPremium && !isTrialActive);

  // Sync state to LocalStorage and trigger system-wide events
  const syncToStorageAndDispatch = useCallback((updates: {
    isPremiumVal?: boolean;
    isGuestVal?: boolean;
    isTrialActiveVal?: boolean;
    trialEndDateVal?: string | null;
    trialStartDateVal?: string | null;
    hasUsedTrialVal?: boolean;
    currentUserVal?: string | null;
  }) => {
    try {
      if (updates.isPremiumVal !== undefined) {
        localStorage.setItem("is_premium", updates.isPremiumVal ? "true" : "false");
      }
      if (updates.isGuestVal !== undefined) {
        localStorage.setItem("is_guest", updates.isGuestVal ? "true" : "false");
      }
      if (updates.isTrialActiveVal !== undefined) {
        localStorage.setItem("is_trial_active", updates.isTrialActiveVal ? "true" : "false");
      }
      if (updates.trialEndDateVal !== undefined) {
        if (updates.trialEndDateVal) {
          localStorage.setItem("trial_end_date", updates.trialEndDateVal);
        } else {
          localStorage.removeItem("trial_end_date");
        }
      }
      if (updates.trialStartDateVal !== undefined) {
        if (updates.trialStartDateVal) {
          localStorage.setItem("trial_start_date", updates.trialStartDateVal);
        } else {
          localStorage.removeItem("trial_start_date");
        }
      }
      if (updates.hasUsedTrialVal !== undefined) {
        localStorage.setItem("has_used_trial", updates.hasUsedTrialVal ? "true" : "false");
      }
      if (updates.currentUserVal !== undefined) {
        if (updates.currentUserVal) {
          localStorage.setItem("currentUser", updates.currentUserVal);
        } else {
          localStorage.removeItem("currentUser");
        }
      }

      // Dispatch custom event for immediate reactive re-renders across all components
      window.dispatchEvent(new CustomEvent("premium_status_changed", {
        detail: {
          isPremium: updates.isPremiumVal ?? isPremium,
          isTrialActive: updates.isTrialActiveVal ?? isTrialActive,
          hasProAccess: (updates.isPremiumVal ?? isPremium) || (updates.isTrialActiveVal ?? isTrialActive),
          shouldShowAds: !((updates.isPremiumVal ?? isPremium) || (updates.isTrialActiveVal ?? isTrialActive))
        }
      }));
    } catch (e) {
      console.warn("[AuthContext] syncToStorage error:", e);
    }
  }, [isPremium, isTrialActive]);

  // Synchronize with Native AdMob Banner: Show if shouldShowAds, Hide if hasProAccess
  useEffect(() => {
    if (shouldShowAds) {
      showNativeBannerAd().catch(() => {});
    } else {
      hideNativeBannerAd().catch(() => {});
    }
  }, [shouldShowAds]);

  // KURAL 1: Misafir Olarak Devam Et (Guest / Anonymous)
  const loginAsGuest = useCallback(async () => {
    setIsGuest(true);
    setCurrentUser(null);
    setIsPremium(false);
    setTrialEndDate(null);
    setTrialStartDate(null);

    syncToStorageAndDispatch({
      isPremiumVal: false,
      isGuestVal: true,
      isTrialActiveVal: false,
      trialEndDateVal: null,
      trialStartDateVal: null,
      currentUserVal: null
    });

    try {
      localStorage.setItem("userLoggedIn", "false");
      localStorage.setItem("hasCompletedOnboarding", "true");
      localStorage.removeItem("premium_source");
      localStorage.removeItem("user_profile_name");
      localStorage.removeItem("user_profile_avatar");
    } catch (_) {}
  }, [syncToStorageAndDispatch]);

  // KURAL 2: Kayıt Olan Yeni Kullanıcıya 8 Günlük Ücretsiz Pro Deneme Süresi Otomatik Tanımlanır
  const registerWith8DayTrial = useCallback(async (email: string, uid?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const now = new Date();
    const nowMs = now.getTime();
    const startIso = now.toISOString();
    // trialEndDate = now + 8 days (KESİN 8 GÜN)
    const endIso = new Date(nowMs + TRIAL_DURATION_MS).toISOString();

    setCurrentUser(cleanEmail);
    setIsGuest(false);
    setIsPremium(false);
    setTrialStartDate(startIso);
    setTrialEndDate(endIso);
    setHasUsedTrial(true);

    syncToStorageAndDispatch({
      isPremiumVal: false,
      isGuestVal: false,
      isTrialActiveVal: true,
      trialEndDateVal: endIso,
      trialStartDateVal: startIso,
      hasUsedTrialVal: true,
      currentUserVal: cleanEmail
    });

    try {
      localStorage.setItem("userLoggedIn", "true");
      localStorage.setItem("hasCompletedOnboarding", "true");
      localStorage.setItem("premium_source", "trial");
      localStorage.setItem("user_created_at", startIso);
    } catch (_) {}

    // Cloud Firestore ve RTDB'ye 8 günlük denemeyi kaydet
    const targetUid = uid || auth.currentUser?.uid;
    if (targetUid) {
      const trialPayload = {
        uid: targetUid,
        email: cleanEmail,
        isGuest: false,
        isPremium: false,
        trialStartDate: startIso,
        trialEndDate: endIso,
        hasUsedTrial: true,
        isTrialActive: true,
        trialDaysRemaining: TRIAL_DURATION_DAYS,
        createdAt: startIso,
        updatedAt: startIso
      };

      try {
        await setDoc(doc(firestore, "users", targetUid), trialPayload, { merge: true });
        if (cleanEmail.includes("@")) {
          const emailDocId = "email_" + cleanEmail.replace(/[^a-zA-Z0-9_]/g, "_");
          await setDoc(doc(firestore, "users", emailDocId), trialPayload, { merge: true }).catch(() => {});
        }
      } catch (err) {
        console.warn("[AuthContext] Firestore trial provision uyarısı:", err);
      }
    }

    return { trialStartDate: startIso, trialEndDate: endIso };
  }, [syncToStorageAndDispatch]);

  // Giriş Yapma (Login) Mantığı
  const loginUser = useCallback((
    email: string,
    meta?: {
      isPremium?: boolean;
      isGuest?: boolean;
      createdAt?: string;
      trialEndDate?: string;
    }
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    const isSuper = cleanEmail === "info.borcodemetakip@gmail.com";
    const prem = isSuper || (meta?.isPremium === true);

    setCurrentUser(cleanEmail);
    setIsGuest(false);

    if (prem) {
      setIsPremium(true);
      setTrialEndDate(null);
      syncToStorageAndDispatch({
        isPremiumVal: true,
        isGuestVal: false,
        isTrialActiveVal: false,
        trialEndDateVal: null,
        currentUserVal: cleanEmail
      });
      try {
        localStorage.setItem("userLoggedIn", "true");
        localStorage.setItem("premium_source", "login");
      } catch (_) {}
      return;
    }

    // Normal kayıtlı kullanıcı girişi: 8 günlük deneme kontrolü
    const nowMs = Date.now();
    let effectiveEndStr = meta?.trialEndDate || localStorage.getItem("trial_end_date");

    if (!effectiveEndStr && meta?.createdAt) {
      const createdMs = new Date(meta.createdAt).getTime();
      effectiveEndStr = new Date(createdMs + TRIAL_DURATION_MS).toISOString();
    }

    // Eğer daha önce hiç deneme süresi tanımlanmamış yeni bir hesap ise, 8 günlük denemeyi hemen tanımla
    if (!effectiveEndStr) {
      const nowIso = new Date().toISOString();
      effectiveEndStr = new Date(nowMs + TRIAL_DURATION_MS).toISOString();
      setTrialStartDate(nowIso);
      setTrialEndDate(effectiveEndStr);
      setHasUsedTrial(true);
      syncToStorageAndDispatch({
        isPremiumVal: false,
        isGuestVal: false,
        isTrialActiveVal: true,
        trialEndDateVal: effectiveEndStr,
        trialStartDateVal: nowIso,
        hasUsedTrialVal: true,
        currentUserVal: cleanEmail
      });
      return;
    }

    const endMs = new Date(effectiveEndStr).getTime();
    const isExpired = !isNaN(endMs) && nowMs >= endMs;

    setTrialEndDate(effectiveEndStr);
    setIsPremium(false);
    setHasUsedTrial(true);

    if (isExpired) {
      syncToStorageAndDispatch({
        isPremiumVal: false,
        isGuestVal: false,
        isTrialActiveVal: false,
        trialEndDateVal: null,
        hasUsedTrialVal: true,
        currentUserVal: cleanEmail
      });
      try {
        localStorage.setItem("userLoggedIn", "true");
        localStorage.removeItem("premium_source");
      } catch (_) {}
    } else {
      syncToStorageAndDispatch({
        isPremiumVal: false,
        isGuestVal: false,
        isTrialActiveVal: true,
        trialEndDateVal: effectiveEndStr,
        hasUsedTrialVal: true,
        currentUserVal: cleanEmail
      });
      try {
        localStorage.setItem("userLoggedIn", "true");
        localStorage.setItem("premium_source", "trial");
      } catch (_) {}
    }
  }, [syncToStorageAndDispatch]);

  // Çıkış Yapma (Logout)
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (_) {}

    setCurrentUser(null);
    setUser(null);
    setIsGuest(true);
    setIsPremium(false);
    setTrialEndDate(null);
    setTrialStartDate(null);

    syncToStorageAndDispatch({
      isPremiumVal: false,
      isGuestVal: true,
      isTrialActiveVal: false,
      trialEndDateVal: null,
      trialStartDateVal: null,
      currentUserVal: null
    });

    try {
      localStorage.setItem("userLoggedIn", "false");
      localStorage.removeItem("premium_source");
      localStorage.removeItem("user_profile_name");
      localStorage.removeItem("user_profile_avatar");
    } catch (_) {}
  }, [syncToStorageAndDispatch]);

  const setPremium = useCallback((status: boolean) => {
    setIsPremium(status);
    syncToStorageAndDispatch({
      isPremiumVal: status,
      isGuestVal: false,
      isTrialActiveVal: false
    });
  }, [syncToStorageAndDispatch]);

  // Geçiş Reklamı Tetikleme: Sadece Pro olmayan (Guest veya Denemesi bitmiş) kullanıcılara gösterilir
  const triggerInterstitialAdIfRequired = useCallback(async (): Promise<boolean> => {
    // KURAL 3: if (isPremium || isTrialActive) return null / don't show
    if (isPremium || isTrialActive || !shouldShowAds) {
      return false;
    }

    try {
      const res = await showNativeInterstitialAd();
      return Boolean(res.success);
    } catch (err) {
      console.warn("[AuthContext] Interstitial ad trigger error:", err);
      return false;
    }
  }, [isPremium, isTrialActive, shouldShowAds]);

  const refreshAuthState = useCallback(() => {
    const isSuper = (localStorage.getItem("currentUser") || "").toLowerCase().trim() === "info.borcodemetakip@gmail.com";
    if (isSuper) {
      setIsPremium(true);
      return;
    }
    const prem = localStorage.getItem("is_premium") === "true";
    const pSource = localStorage.getItem("premium_source");
    const guest = localStorage.getItem("is_guest") === "true";
    setIsPremium(prem && pSource !== "trial" && !guest);
    setIsGuest(guest);
    setTrialEndDate(localStorage.getItem("trial_end_date"));
    setTrialStartDate(localStorage.getItem("trial_start_date"));
    setHasUsedTrial(localStorage.getItem("has_used_trial") === "true");
  }, []);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser && fbUser.email) {
        const cleanEmail = fbUser.email.trim().toLowerCase();
        setCurrentUser(cleanEmail);

        if (cleanEmail === "info.borcodemetakip@gmail.com") {
          setIsPremium(true);
          setIsGuest(false);
          return;
        }

        // Query Firestore for user status
        try {
          const snap = await getDoc(doc(firestore, "users", fbUser.uid));
          if (snap.exists()) {
            const data = snap.data();
            if (data?.isPremium === true && data?.isGuest !== true) {
              setIsPremium(true);
              setIsGuest(false);
              return;
            }

            // Check trial
            if (data?.trialEndDate) {
              setTrialEndDate(data.trialEndDate);
              if (data?.trialStartDate) setTrialStartDate(data.trialStartDate);
              const endMs = new Date(data.trialEndDate).getTime();
              const active = Date.now() < endMs;
              localStorage.setItem("is_trial_active", active ? "true" : "false");
              if (active) {
                localStorage.setItem("trial_end_date", data.trialEndDate);
              }
            }
          }
        } catch (e) {
          console.warn("[AuthContext] Firebase auth sync error:", e);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const value: AuthUserState = {
    user,
    currentUser,
    isLoggedIn: Boolean(currentUser && !isGuest),
    isGuest,
    isPremium,
    isTrialActive,
    isTrialExpired,
    trialDaysRemaining,
    trialStartDate,
    trialEndDate,
    hasUsedTrial,
    hasProAccess,
    shouldShowAds,
    loginAsGuest,
    registerWith8DayTrial,
    loginUser,
    logout,
    setPremium,
    refreshAuthState,
    triggerInterstitialAdIfRequired
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthUserState => {
  const context = useContext(AuthContext);
  if (!context) {
    // Fail-safe default object reading directly from localStorage if called outside AuthProvider
    const isSuper = (localStorage.getItem("currentUser") || "").toLowerCase().trim() === "info.borcodemetakip@gmail.com";
    const isPrem = isSuper || (localStorage.getItem("is_premium") === "true" && localStorage.getItem("premium_source") !== "trial" && localStorage.getItem("is_guest") !== "true");
    const trialEnd = localStorage.getItem("trial_end_date");
    const endMs = trialEnd ? new Date(trialEnd).getTime() : 0;
    const isGuest = localStorage.getItem("is_guest") === "true" || !localStorage.getItem("currentUser");
    const isTrialActive = !isPrem && !isGuest && !isNaN(endMs) && Date.now() < endMs;
    const hasProAccess = isPrem || isTrialActive;
    const shouldShowAds = !isPrem && !isTrialActive;

    return {
      user: null,
      currentUser: localStorage.getItem("currentUser") || null,
      isLoggedIn: !isGuest && Boolean(localStorage.getItem("currentUser")),
      isGuest,
      isPremium: isPrem,
      isTrialActive,
      isTrialExpired: !isPrem && !isGuest && !isNaN(endMs) && Date.now() >= endMs,
      trialDaysRemaining: isTrialActive ? Math.max(1, Math.ceil((endMs - Date.now()) / (1000 * 60 * 60 * 24))) : 0,
      trialStartDate: localStorage.getItem("trial_start_date"),
      trialEndDate: trialEnd,
      hasUsedTrial: localStorage.getItem("has_used_trial") === "true",
      hasProAccess,
      shouldShowAds,
      loginAsGuest: async () => {},
      registerWith8DayTrial: async () => ({ trialStartDate: "", trialEndDate: "" }),
      loginUser: () => {},
      logout: async () => {},
      setPremium: () => {},
      refreshAuthState: () => {},
      triggerInterstitialAdIfRequired: async () => false
    };
  }
  return context;
};
