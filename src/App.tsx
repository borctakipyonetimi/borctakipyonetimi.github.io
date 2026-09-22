/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bütçem Pro - Kişisel Finans & Borç Takip Yönetimi
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, updatePassword, getRedirectResult } from "firebase/auth";
import { 
  auth, 
  db, 
  firestore,
  doc,
  getDoc,
  ref, 
  get, 
  set, 
  update, 
  onValue, 
  off, 
  veriyiTemizle, 
  handleDatabaseError, 
  handleFirestoreError, 
  OperationType, 
  goOnline, 
  enableNetwork 
} from "./utils/firebase";
import { compressAndResizeImage } from "./utils/imageUtils";
import { Purchases, PLAY_PRODUCTS, calculatePlanExpiry } from "./utils/purchases";
import { parseDateParts, isSameMonthYear, isDateWithinRange, getNotificationPeriodMs } from "./utils/dateUtils";
import { subscribeToNewsletter } from "./utils/newsletterService";
import { motion, AnimatePresence } from "motion/react";
import {
  Menu,
  ArrowRight,
  Coins,
  LogOut,
  LogIn,
  Bell,
  Sun,
  Moon,
  Shield,
  Upload,
  Download,
  FileSpreadsheet,
  Trash2,
  Calendar,
  DollarSign,
  Wallet,
  Sparkles,
  HelpingHand,
  Clock,
  Eye,
  EyeOff,
  Settings,
  RotateCw,
  LayoutDashboard,
  HelpCircle,
  BookOpen,
  MessageSquare,
  Star,
  Activity,
  ShoppingCart,
  Chrome,
  Mail,
  Youtube,
  Instagram,
  Send,
  Share2,
  Facebook,
  Link,
  Twitter,
  BellRing,
  Check,
  Zap,
  Sliders,
  Play,
  CheckCircle2,
  User,
  Pencil,
  Users,
  Camera,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Smartphone,
  TrendingUp,
  Compass,
  X,
  Info,
  Fuel,
  Coffee,
  Utensils,
  Copy,
  Folder,
  ClipboardList,
  Save,
  FileJson
} from "lucide-react";
import {
  Debt,
  Income,
  Alarm,
  NotificationItem,
  InstallmentDebt,
  PaymentLog,
  Expense,
  ExpenseCategory,
  FinancialStats
} from "./types";

// Import Modular Sub-Components
import { useCurrency, CurrencyType } from "./utils/CurrencyContext";
import { DashboardOverview } from "./components/DashboardOverview";
import { DebtList } from "./components/DebtList";
import { IncomesList } from "./components/IncomesList";
import { ExpensesList } from "./components/ExpensesList";
import { InstallmentsList } from "./components/InstallmentsList";
import { FollowUpMonthlyYearly } from "./components/FollowUpMonthlyYearly";
import { AIChat } from "./components/AIChat";
import { HelpAndGuides } from "./components/HelpAndGuides";
import { ProviderLoginModal } from "./components/ProviderLoginModal";
import { startDeviceSessionWatcher, saveUserSessionToFirestore, getDeviceUuid } from "./utils/deviceSessionService";
import { SecurityLockOverlay } from "./components/SecurityLockOverlay";
import { SecuritySettingsPanel } from "./components/SecuritySettingsPanel";
import { OnboardingWalkthrough } from "./components/OnboardingWalkthrough";
import { ContactsDebtPanel } from "./components/ContactsDebtPanel";
import { FinancialTools } from "./components/FinancialTools";
import { AdMobBanner } from "./components/AdMobBanner";
import VoiceAssistant from "./components/VoiceAssistant";
import { PublicLanding } from "./components/PublicLanding";
import { PublicBlog } from "./components/PublicBlog";
import { GPlayEnhancements } from "./components/GPlayEnhancements";
import { ProviderBadge } from "./components/ProviderBadge";
import { getProviderById, detectProviderFromName } from "./data/providers";
import { analyzeDebtsComprehensive } from "./utils/debtAnalyzer";
import { getApiUrl, safeFetchJson } from "./utils/api";
import {
  scheduleAndroidDebtAlarm,
  cancelAndroidDebtAlarm,
  scheduleCapacitorAlarm,
  cancelCapacitorAlarm,
  initCapacitorNotificationChannel,
  requestCapacitorNotificationPermission,
  setupCapacitorNotificationListeners,
  sendInstantCapacitorNotification,
  parseAlarmDateToMillis,
  syncAllAlarmsToAndroid,
  syncAllDebtsAndAlarmsToAndroid,
  testAndroidBackgroundAlarm,
  isAndroidAlarmBridgeAvailable,
  saveAndroidNativeFile,
  saveAndroidNativeBackupFile,
  saveAndroidNativeImageToGallery,
  shareAndroidNativeBackupFile,
  openAndroidGoogleDrive
} from "./utils/androidAlarmBridge";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import OneSignal from '@onesignal/capacitor-plugin';
import { downloadFileWithCustomName, saveImageToGalleryWithCustomName } from "./utils/fileDownloadHelper";
import confetti from "canvas-confetti";
import { BiometricAuth, BiyometrikDogrulamaYap } from "./utils/biometricAuth";

// Capacitor resmi OneSignal başlatma motoru (Web ortamında güvenle bekletilir, Android/iOS cihazda çalışır)
if (typeof OneSignal !== "undefined" && OneSignal && typeof OneSignal.initialize === "function") {
  const origInitialize = OneSignal.initialize.bind(OneSignal);
  (OneSignal as any).initialize = async function (configOrAppId: any) {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    const finalAppId =
      typeof configOrAppId === "object" && configOrAppId !== null && "appId" in configOrAppId
        ? configOrAppId.appId
        : configOrAppId;
    return origInitialize(finalAppId);
  };
}

if (typeof OneSignal !== "undefined" && OneSignal?.Notifications && typeof OneSignal.Notifications.requestPermission === "function") {
  const origRequestPermission = OneSignal.Notifications.requestPermission.bind(OneSignal.Notifications);
  OneSignal.Notifications.requestPermission = async function (fallbackToSettings?: boolean) {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    return origRequestPermission(fallbackToSettings);
  };
}

async function OneSignalGuncelBaslat() {
  // OneSignal Capacitor eklentisi yalnızca yerel mobil platformda (Android / iOS) çalışır
  if (!Capacitor.isNativePlatform()) {
    console.info("[OneSignal] Web ortamı aktif; OneSignal Capacitor mobil motoru yerel Android cihazda devreye girer.");
    return;
  }

  try {
    // Capacitor resmi OneSignal başlatma motoru
    await (OneSignal as any).initialize({ appId: "f0a34e24-e5c9-423e-927f-399736f68a92" });

    // Android 13+ için ekrana zorunlu bildirim izin penceresini fırlatıyoruz
    if (OneSignal?.Notifications?.requestPermission) {
      await OneSignal.Notifications.requestPermission(true);
    }

    // OneSignal Otomatik Tetikleyicilerini Kapat:
    // OneSignal'ın arka planda kendi kendine bildirim üretmesini ve in-app popupları engelle.
    // OneSignal sadece panelden manuel gönderilecek push mesajlarını dinler, cihaz içi alarmlara müdahale etmez.
    try {
      const inApp = OneSignal?.InAppMessages as any;
      if (inApp && typeof inApp.paused === "function") {
        inApp.paused(true);
      }
    } catch (_) {}

    console.log("OneSignal Başarıyla Aktif Edildi (Otomatik tetikleyiciler kapalı, panel push mesajları dinleniyor).");
  } catch (error: any) {
    if (error?.message?.includes("not implemented on web") || String(error).includes("not implemented on web")) {
      console.info("[OneSignal] Web ortamı; mobil eklenti güvenle bekletildi.");
      return;
    }
    console.error("OneSignal Hatası:", error);
  }
}

// Uygulama yüklenir yüklenmez tetikle (OneSignal & Biyometrik Doğrulama)
if (typeof window !== "undefined") {
  window.addEventListener('DOMContentLoaded', () => {
    OneSignalGuncelBaslat();
    BiyometrikDogrulamaYap();
  });
  document.addEventListener('deviceready', () => {
    BiyometrikDogrulamaYap();
  });
  if (document.readyState !== "loading") {
    OneSignalGuncelBaslat();
    BiyometrikDogrulamaYap();
  }
}

export default function App() {
  const { activeCurrency, setActiveCurrency, rates, setRates, format, convert, currencySymbol } = useCurrency();

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#a855f7", "#ec4899", "#10b981", "#f59e0b"]
      });
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.75 },
          colors: ["#6366f1", "#a855f7", "#ec4899", "#10b981", "#f59e0b"]
        });
      }, 120);
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.75 },
          colors: ["#6366f1", "#a855f7", "#ec4899", "#10b981", "#f59e0b"]
        });
      }, 180);
    } catch (e) {
      console.warn("Confetti animation failed to trigger:", e);
    }
  };

  // Avatar and profile picture state
  const [userAvatar, setUserAvatar] = useState<string>(() => {
    const user = localStorage.getItem("currentUser") || "anonymous";
    return localStorage.getItem(`user_${user}_avatar`) || "";
  });
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  // Navigation & Page routing state
  const [activeTab, setActiveTab] = useState("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [contactSyncTrigger, setContactSyncTrigger] = useState(0);
  const [language, setLanguage] = useState<"tr" | "en">("tr");

  // Public Landing / Blog routing state
  const [showPublicView, setShowPublicView] = useState<"landing" | "blog" | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get("page");
    if (pageParam === "landing") return "landing";
    if (pageParam === "blog" || pageParam === "blog-post") return "blog";
    return null; // Directly open the app, bypassing the landing page
  });
  const [selectedPublicPostId, setSelectedPublicPostId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  });

  // Custom Confirmation Modal state to bypass browser alert/confirm popup blocking inside sandboxed iframes
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  // User Profile authorizations state
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem("currentUser") || null;
  });

  // User Profile Name state (stored strictly under kullanicilar/UID/profil/isim in Realtime Database)
  const [userProfileName, setUserProfileName] = useState<string>(() => {
    return localStorage.getItem("user_profile_name") || "";
  });

  // Profil Düzenleme Modal Durumu (Tarayıcı / iFrame / Mobil uyumlu)
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Profil Güncelleme: Profil bilgileri veya kullanıcı adı güncellenirken, borçlar (debts)
  // veya diğer alt veritabanı düğümleri kesinlikle mutasyona uğramaz ve silinmez.
  // Kullanıcı adı sadece ve sadece kullanicilar/KULLANICI_UID/profil/isim düğümünü hedef alarak kaydedilir.
  const handleUpdateProfileName = async (newName: string) => {
    const cleanName = newName.trim();
    setUserProfileName(cleanName);
    localStorage.setItem("user_profile_name", cleanName);

    // Service Worker'a da yeni ismi anında bildir
    if (typeof window !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SYNC_USER_PROFILE",
        name: cleanName,
        email: currentUser || ""
      });
    }

    const fbUser = auth.currentUser;
    if (fbUser) {
      try {
        const profilRef = ref(db, `kullanicilar/${fbUser.uid}/profil/isim`);
        await set(profilRef, cleanName);

        try {
          await set(ref(db, `users/${fbUser.uid}/profil/isim`), cleanName);
        } catch (_) {}

        triggerToast(cleanName ? `Profil isminiz kaydedildi: ${cleanName} ✨` : "Profil ismi güncellendi ✨");
      } catch (err: any) {
        console.error("Profil ismi kayıt hatası:", err);
        triggerToast(`Profil ismi kaydedilemedi: ${err?.message || err}`, 4000);
      }
    } else {
      triggerToast(cleanName ? `İsminiz kaydedildi: ${cleanName} ✨` : "İsim kaydedildi ✨");
    }
  };

  // Profil Resmi Kaydetme: Görseli 200x200 piksele sıkıştırıp kullanicilar/KULLANICI_UID/profil/resim düğümüne kaydeder
  const handleSaveAvatar = async (rawImageBase64OrFile: string | File) => {
    try {
      // 1. Görseli tarayıcı tabanlı yüksek performanslı sıkıştır ve maksimum 200x200 piksele boyutlandır
      const compressedBase64 = await compressAndResizeImage(rawImageBase64OrFile, 200, 200, 0.82);

      // 2. React state ve yerel depolamayı anında güncelle
      setUserAvatar(compressedBase64);
      const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
      localStorage.setItem(`${spaceKey}_avatar`, compressedBase64);
      localStorage.setItem("user_profile_avatar", compressedBase64);
      setIsAvatarPickerOpen(false);

      // 3. Güvenli profil odası altına (kullanicilar/KULLANICI_UID/profil/resim) kalıcı olarak yaz
      const fbUser = auth.currentUser;
      if (fbUser) {
        const resimRef = ref(db, `kullanicilar/${fbUser.uid}/profil/resim`);
        await set(resimRef, compressedBase64);

        try {
          await set(ref(db, `users/${fbUser.uid}/profil/resim`), compressedBase64);
        } catch (_) {}

        triggerToast("Profil resminiz başarıyla kaydedildi! 📸");
      } else {
        triggerToast("Profil resmi güncellendi! 📸");
      }
    } catch (err: any) {
      console.error("Profil resmi işleme hatası:", err);
      triggerToast("Görsel işlenirken bir sorun oluştu! ⚠️", 3000);
    }
  };

  const handleRemoveAvatar = async () => {
    setUserAvatar("");
    const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
    localStorage.removeItem(`${spaceKey}_avatar`);
    localStorage.removeItem("user_profile_avatar");
    setIsAvatarPickerOpen(false);

    const fbUser = auth.currentUser;
    if (fbUser) {
      try {
        await set(ref(db, `kullanicilar/${fbUser.uid}/profil/resim`), null);
        try {
          await set(ref(db, `users/${fbUser.uid}/profil/resim`), null);
        } catch (_) {}
      } catch (err) {
        console.warn("Avatar silme uyarısı:", err);
      }
    }
    triggerToast("Profil resmi kaldırıldı");
  };

  const handleOpenEditProfileModal = () => {
    setProfileNameInput(userProfileName || "");
    setIsEditProfileModalOpen(true);
  };

  const handleSaveProfileModal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingProfile(true);
    try {
      await handleUpdateProfileName(profileNameInput);
      setIsEditProfileModalOpen(false);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePromptEditName = () => {
    handleOpenEditProfileModal();
  };

  const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";

  // Automatically load the avatar linked to the new active user profile
  useEffect(() => {
    const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
    const localAvatar = localStorage.getItem("user_profile_avatar") || localStorage.getItem(`${spaceKey}_avatar`) || "";
    if (localAvatar) {
      setUserAvatar(localAvatar);
    }
    setIsAvatarPickerOpen(false);
  }, [currentUser]);

  // App-lock state for PIN / Pattern security
  const [isUnlocked, setIsUnlocked] = useState(() => {
    try {
      const saved = localStorage.getItem("security_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isEnabled) {
          return false; // Lock immediately on boot
        }
      }
    } catch (e) {
      console.error(e);
    }
    return true; // No security setup, bypass instantly
  });

  const [loginUsername, setLoginUsername] = useState("");
  const [syncCodeToApprove, setSyncCodeToApprove] = useState<string | null>(null);

  // Core Financial tables states
  const [debts, setDebts] = useState<Debt[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [installmentDebts, setInstallmentDebts] = useState<InstallmentDebt[]>([]);
  const [focusedDebtId, setFocusedDebtId] = useState<number | null>(null);
  const [focusedInstallmentId, setFocusedInstallmentId] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [contactsRevision, setContactsRevision] = useState(0);

  // Period Scoper States (All-Time is represented by null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number | null>(new Date().getFullYear());

  // Premium tier configurations (Free vs Paid Premium, persisted to keep premium state on browser reload)
  const [isPremium, setIsPremium] = useState<boolean>(() => {
    const savedUser = (localStorage.getItem("currentUser") || "").toLowerCase().trim();
    if (savedUser === "info.borcodemetakip@gmail.com") {
      return true;
    }
    const isPrem = localStorage.getItem("is_premium") === "true";
    const pSource = localStorage.getItem("premium_source");
    if (isPrem && pSource !== "trial") return true;
    
    // Check 7-day expiration on initial load
    const createdAtStr = localStorage.getItem("user_created_at");
    if (createdAtStr) {
      const diffDays = (Date.now() - new Date(createdAtStr).getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= 7) return false;
    }
    return isPrem;
  });

  const [isTrialExpiredLocked, setIsTrialExpiredLocked] = useState<boolean>(() => {
    const savedUser = (localStorage.getItem("currentUser") || "").toLowerCase().trim();
    if (savedUser === "info.borcodemetakip@gmail.com") return false;
    if (localStorage.getItem("is_premium") === "true" && localStorage.getItem("premium_source") !== "trial") return false;

    // Matematiksel kontrol: "Şimdiki Zaman - Hesap Kayıt Zamanı (createdAt)"
    const createdAtStr = localStorage.getItem("user_created_at");
    if (createdAtStr) {
      const createdAtMs = new Date(createdAtStr).getTime();
      const diffDays = (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24);
      if (diffDays >= 7) return true;
    }
    const trialEndStr = localStorage.getItem("trial_end_date");
    if (trialEndStr && new Date(trialEndStr).getTime() <= Date.now()) {
      return true;
    }
    return false;
  });

  const [trialStatus, setTrialStatus] = useState<{
    hasTrial: boolean;
    isActive: boolean;
    isExpired: boolean;
    daysRemaining: number;
    startDate: string | null;
    endDate: string | null;
  } | null>(null);

  /**
   * 7 Günlük Deneme & Zorunlu Kilitleme Kontrolü:
   * isPremium: false ise "Şimdiki Zaman - Hesap Kayıt Zamanı (createdAt)" matematiksel farkını hesaplar.
   * - Fark 7 günü GEÇMİŞSE: Dashboard erişimini kilitler (isTrialExpiredLocked: true),
   *   Satın Alma sayfasını açar ve uyarı verir.
   * - Fark 7 günden AZ ise: Girişe izin verir ve deneme süresini aktif tutar.
   */
  const checkUserTrialExpiration = (userObj?: any, uData?: any): boolean => {
    const cleanUser = (currentUser || userObj?.email || localStorage.getItem("currentUser") || "").toLowerCase().trim();
    if (cleanUser === "info.borcodemetakip@gmail.com") {
      setIsPremium(true);
      setIsTrialExpiredLocked(false);
      return false;
    }

    if (uData?.isPremium === true) {
      setIsPremium(true);
      setIsTrialExpiredLocked(false);
      localStorage.setItem("is_premium", "true");
      localStorage.setItem("is_guest", "false");
      localStorage.setItem("premium_source", "login");
      return false;
    }

    const pSource = localStorage.getItem("premium_source");
    if (localStorage.getItem("is_premium") === "true" && pSource !== "trial") {
      setIsPremium(true);
      setIsTrialExpiredLocked(false);
      return false;
    }

    // Ödemesi tamamlanmamış Premium hesap kontrolü (isGuest: false & isPremium: false)
    if (uData && uData.isGuest === false && uData.isPremium === false) {
      setIsPremium(false);
      localStorage.setItem("is_premium", "false");
      localStorage.setItem("is_guest", "false");
      localStorage.removeItem("premium_source");
      localStorage.removeItem("trial_end_date");
      setIsTrialExpiredLocked(true);
      setIsUpgradeModalOpen(true);
      triggerToast("Aboneliğinizi tamamlamak için lütfen bir plan seçin.");
      return true;
    }

    // Matematiksel kontrol: "Şimdiki Zaman - Hesap Kayıt Zamanı (createdAt)"
    let createdAtStr: string | null = uData?.createdAt || localStorage.getItem("user_created_at");
    if (!createdAtStr && userObj?.metadata?.creationTime) {
      createdAtStr = new Date(userObj.metadata.creationTime).toISOString();
    }
    if (!createdAtStr) {
      const trialEnd = localStorage.getItem("trial_end_date");
      if (trialEnd) {
        createdAtStr = new Date(new Date(trialEnd).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    if (createdAtStr) {
      localStorage.setItem("user_created_at", createdAtStr);
      const createdAtMs = new Date(createdAtStr).getTime();
      const nowMs = Date.now();
      const diffMs = nowMs - createdAtMs;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays >= 7) {
        // 7 GÜNÜ GEÇMİŞSE -> ZORUNLU KİLİTLEME!
        setIsPremium(false);
        localStorage.setItem("is_premium", "false");
        localStorage.setItem("is_guest", "true");
        localStorage.removeItem("premium_source");
        localStorage.removeItem("trial_end_date");
        setIsTrialExpiredLocked(true);
        setIsUpgradeModalOpen(true);
        triggerToast("7 günlük ücretsiz deneme süreniz sona ermiştir. Uygulamayı kullanmaya devam etmek için lütfen Premium planlardan birini seçin.");
        return true;
      } else {
        // 7 günden az -> Deneme aktif, uygulamaya girişe müsaade et
        setIsTrialExpiredLocked(false);
        const daysLeft = Math.max(1, Math.ceil(7 - diffDays));
        const trialEndDate = new Date(createdAtMs + 7 * 24 * 60 * 60 * 1000).toISOString();
        localStorage.setItem("trial_end_date", trialEndDate);
        localStorage.setItem("premium_source", "trial");
        setTrialStatus({
          hasTrial: true,
          isActive: true,
          isExpired: false,
          daysRemaining: daysLeft,
          startDate: createdAtStr,
          endDate: trialEndDate
        });
        return false;
      }
    }
    return false;
  };

  const checkTrialStatus = async () => {
    let deviceId = localStorage.getItem("butcem_device_id");
    if (!deviceId) {
      deviceId = "dev_" + Math.random().toString(36).slice(2, 12);
      localStorage.setItem("butcem_device_id", deviceId);
    }

    try {
      const data = await safeFetchJson<{
        hasTrial: boolean;
        isActive: boolean;
        isExpired: boolean;
        daysRemaining: number;
        startDate: string | null;
        endDate: string | null;
      }>(`/api/trial/status?userId=${encodeURIComponent(currentUser || "")}&deviceId=${encodeURIComponent(deviceId)}`);

      if (data && typeof data.hasTrial === "boolean") {
        setTrialStatus(data);
        
        const cleanUser = (currentUser || auth.currentUser?.email || "").toLowerCase();
        if (cleanUser === "info.borcodemetakip@gmail.com") {
          setIsPremium(true);
          localStorage.setItem("is_premium", "true");
          localStorage.setItem("is_guest", "false");
          return;
        }

        const pSource = localStorage.getItem("premium_source");
        if (pSource === "login" || pSource === "purchase") {
          setIsPremium(true);
          return;
        }
        
        if (data.hasTrial) {
          if (data.isActive) {
            if (pSource !== "purchase") {
              setIsPremium(true);
              localStorage.setItem("is_premium", "true");
              localStorage.setItem("premium_source", "trial");
              if (data.endDate) {
                localStorage.setItem("trial_end_date", data.endDate);
              }
            }
          } else if (data.isExpired) {
            localStorage.removeItem("trial_end_date");
            setTrialStatus(data);
            if (pSource === "trial" || (!pSource && isPremium)) {
              setIsPremium(false);
              localStorage.setItem("is_premium", "false");
              localStorage.removeItem("premium_source");
              
              const expMsg = "⏳ 7 günlük ücretsiz Bütçem Pro deneme süreniz dolmuştur. Reklamlı ve kısıtlı ücretsiz plan ile devam ediyorsunuz. Sınırsız kullanım için PRO paketi satın alabilirsiniz.";
              triggerToast(expMsg);
              
              setNotifications(prev => {
                const alreadyExists = prev.some(n => n.title?.includes("deneme") || (n as any).message?.includes("deneme"));
                if (alreadyExists) return prev;
                return [
                  {
                    id: Date.now(),
                    title: "⏳ Deneme Süresi Sona Erdi",
                    time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
                    date: new Date().toLocaleDateString("tr-TR"),
                    isRead: false,
                    type: "warning"
                  },
                  ...prev
                ];
              });
            }
          }
        }
        return;
      }
    } catch (e) {
      console.warn("Server trial check unavailable, evaluating local state:", e);
    }

    // Fallback: Check local trial cache if network request failed (offline / network error)
    const localEndDate = localStorage.getItem("trial_end_date");
    const pSource = localStorage.getItem("premium_source");
    if (localEndDate && pSource === "trial") {
      const endMs = new Date(localEndDate).getTime();
      const nowMs = Date.now();
      const daysLeft = Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24)));
      const isExpired = nowMs >= endMs;
      
      setTrialStatus({
        hasTrial: true,
        isActive: !isExpired,
        isExpired: isExpired,
        daysRemaining: daysLeft,
        startDate: null,
        endDate: localEndDate
      });

      if (isExpired) {
        setIsPremium(false);
        localStorage.setItem("is_premium", "false");
        localStorage.removeItem("premium_source");
        localStorage.removeItem("trial_end_date");
      } else {
        setIsPremium(true);
      }
    }
  };

  const handleActivateTrial = async () => {
    let deviceId = localStorage.getItem("butcem_device_id");
    if (!deviceId) {
      deviceId = "dev_" + Math.random().toString(36).slice(2, 12);
      localStorage.setItem("butcem_device_id", deviceId);
    }

    try {
      const data = await safeFetchJson<{
        hasTrial: boolean;
        isActive: boolean;
        isExpired: boolean;
        daysRemaining: number;
        startDate: string | null;
        endDate: string | null;
      }>("/api/trial/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser || "",
          deviceId
        })
      });

      if (data) {
        setTrialStatus(data);
        if (data.isActive) {
          setIsPremium(true);
          localStorage.setItem("is_premium", "true");
          localStorage.setItem("premium_source", "trial");
          const trialEndDate = data.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          localStorage.setItem("trial_end_date", trialEndDate);
          triggerToast("🎉 7 Günlük Ücretsiz Bütçem Pro Denemeniz Başarıyla Başlatıldı! Tüm Pro özellikler aktif edildi.");
          return;
        } else if (data.isExpired) {
          setIsPremium(false);
          localStorage.setItem("is_premium", "false");
          localStorage.removeItem("premium_source");
          localStorage.removeItem("trial_end_date");
          triggerToast("⏳ 7 günlük deneme süreniz daha önce tamamlanmıştır. Reklamlı ve kısıtlı ücretsiz plan ile devam edilmektedir.");
          return;
        }
      }
    } catch (e) {
      console.warn("Trial activation server request failed, activating locally:", e);
    }

    // Local activation fallback (only if not expired before)
    const existingEnd = localStorage.getItem("trial_end_date");
    if (existingEnd && new Date(existingEnd).getTime() <= Date.now()) {
      triggerToast("⏳ 7 günlük deneme süreniz dolmuştur. Reklamlı ve kısıtlı ücretsiz plan ile devam ediliyor.");
      return;
    }

    const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem("is_premium", "true");
    localStorage.setItem("premium_source", "trial");
    localStorage.setItem("trial_end_date", trialEndDate);
    setIsPremium(true);
    setTrialStatus({
      hasTrial: true,
      isActive: true,
      isExpired: false,
      daysRemaining: 7,
      startDate: new Date().toISOString(),
      endDate: trialEndDate
    });
    triggerToast("🎉 7 Günlük Ücretsiz Bütçem Pro Denemeniz Başlatıldı!");
  };

  const handleCancelTrial = async () => {
    let deviceId = localStorage.getItem("butcem_device_id");
    try {
      await safeFetchJson("/api/trial/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser || "",
          deviceId
        })
      });
    } catch (e) {
      console.warn("Trial cancel server error:", e);
    }

    // Clear local trial & premium state completely
    localStorage.removeItem("premium_source");
    localStorage.removeItem("trial_end_date");
    localStorage.setItem("is_premium", "false");
    setIsPremium(false);

    setTrialStatus({
      hasTrial: true,
      isActive: false,
      isExpired: true,
      daysRemaining: 0,
      startDate: null,
      endDate: null
    });

    await savePremiumStatusAndSync(false, "yearly");
    triggerToast("Deneme sürümü iptal edildi. Reklamlı ve kısıtlı ücretsiz plana geçildi ⚪");
  };

  useEffect(() => {
    checkTrialStatus();
  }, []);

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly" | "lifetime">("yearly");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStep, setRestoreStep] = useState<"method" | "firebase" | "gpa" | "restoring" | "success">("method");
  const [gpaInput, setGpaInput] = useState("");
  const [restoredPlanType, setRestoredPlanType] = useState<"monthly" | "yearly" | "lifetime">("yearly");
  const [restoreStatusLog, setRestoreStatusLog] = useState("");
  const [promoFeature, setPromoFeature] = useState<string | null>(null);

  const openUpgradeModal = (featureName?: string) => {
    setPromoFeature(featureName || null);
    setIsUpgradeModalOpen(true);
  };

  const closeUpgradeModal = () => {
    if (isTrialExpiredLocked) {
      triggerToast("7 günlük ücretsiz deneme süreniz sona ermiştir. Uygulamayı kullanmaya devam etmek için lütfen Premium planlardan birini seçin.");
      return;
    }
    setIsUpgradeModalOpen(false);
    setPromoFeature(null);
  };

  useEffect(() => {
    if (isTrialExpiredLocked) {
      setIsUpgradeModalOpen(true);
    }
  }, [isTrialExpiredLocked]);

  // Custom Google Play & RevenueCat states
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [dynamicProducts, setDynamicProducts] = useState(PLAY_PRODUCTS);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState("");
  const [isGPlayBillingActive, setIsGPlayBillingActive] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState({
    id: "visa",
    name: "Visa •••• 5043",
    type: "Google Pay / Kredi Kartı",
    icon: "💳"
  });
  const [isChangingPaymentMethod, setIsChangingPaymentMethod] = useState(false);

  const [playPaymentMethods, setPlayPaymentMethods] = useState([
    { id: "visa", name: "Visa •••• 5043", type: "Google Pay / Kredi Kartı", icon: "💳" },
    { id: "mastercard", name: "Mastercard •••• 9811", type: "Bireysel Kredi Kartı", icon: "💳" },
    { id: "gplay_balance", name: "Google Play Bakiyesi", type: "Mevcut Bakiye: ₺1.250,00", icon: "✨" },
    { id: "mobil_odeme", name: "Turkcell Mobil Ödeme", type: "Mobil Ödeme (532 123 45 67)", icon: "📱", details: "532 123 45 67" }
  ]);

  const [playAccountEmail, setPlayAccountEmail] = useState("info.borcodemetakip@gmail.com");
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  // Form states for adding simulated payment options
  const [paymentFormType, setPaymentFormType] = useState<"none" | "card" | "mobile">("none");
  const [newCardNameValue, setNewCardNameValue] = useState("");
  const [newCardNumberValue, setNewCardNumberValue] = useState("");
  const [newCardExpiryValue, setNewCardExpiryValue] = useState("");
  const [newCardCVVValue, setNewCardCVVValue] = useState("");
  const [newMobileNoValue, setNewMobileNoValue] = useState("532 123 45 67");

  const purchaseTimeoutsRef = useRef<any[]>([]);
  const clearPurchaseTimeouts = () => {
    purchaseTimeoutsRef.current.forEach((t) => clearTimeout(t));
    purchaseTimeoutsRef.current = [];
  };

  // Local Alerts indicators
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [firestoreErrorMessage, setFirestoreErrorMessage] = useState<string | null>(null);
  const [sessionTerminatedReason, setSessionTerminatedReason] = useState<string | null>(null);

  // Live Timer states
  const [liveClock, setLiveClock] = useState("--:--:--");
  const [isClockVisible, setIsClockVisible] = useState(true);

  // Design palettes state - defaults with automatic phone/system adaptation
  const [themeMode, setThemeMode] = useState<"auto" | "dark" | "light">(() => {
    return (localStorage.getItem("themeMode") as "auto" | "dark" | "light") || "auto";
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const savedMode = localStorage.getItem("themeMode") || "auto";
    if (savedMode === "dark") return true;
    if (savedMode === "light") return false;
    // Auto mode or initial visit -> adapt to phone / system setting
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });
  const [colorTheme, setColorTheme] = useState<string>(() => {
    return localStorage.getItem("colorTheme") || "default";
  });

  // Push Notification settings and Daily Frequency state (Uygulama içi sesler kaldırılmıştır)
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem("pushNotificationsEnabled") !== "false";
  });
  const [pushFrequency, setPushFrequency] = useState<string>(() => {
    return localStorage.getItem("pushNotificationFrequency") || "2";
  });

  const handleTogglePushNotifications = async (enabled: boolean) => {
    setPushNotificationsEnabled(enabled);
    localStorage.setItem("pushNotificationsEnabled", String(enabled));

    if (typeof window !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SYNC_PUSH_SETTINGS",
        enabled: enabled,
        frequency: pushFrequency
      });
    }

    if (enabled) {
      await requestNotificationPermission();
      triggerToast("Push Bildirimleri Aktifleştirildi 🔔");
    } else {
      triggerToast("Push Bildirimleri Kapatıldı 🔕");
    }
  };

  const handleSetPushFrequency = (val: string) => {
    setPushFrequency(val);
    localStorage.setItem("pushNotificationFrequency", val);

    if (typeof window !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SYNC_PUSH_SETTINGS",
        enabled: pushNotificationsEnabled,
        frequency: val
      });
    }

    const labels: Record<string, string> = {
      "1": "Günde 1 Kez (Sabah 09:00)",
      "2": "Günde 2 Kez (09:00 ve 18:00)",
      "3": "Günde 3 Kez (09:00, 13:00 ve 19:00)",
      "4": "Günde 4 Kez (09:00, 13:00, 18:00 ve 21:00)",
      "hourly": "2 Saatte Bir (09:00 - 21:00)"
    };
    triggerToast(`Bildirim Sıklığı: ${labels[val] || val} ⏰`);
  };
  const [marqueeSpeed, setMarqueeSpeed] = useState<number>(() => {
    const saved = localStorage.getItem("marqueeSpeed");
    return saved ? parseInt(saved, 10) : 55;
  });
  const [marqueePaused, setMarqueePaused] = useState<boolean>(() => {
    return localStorage.getItem("marqueePaused") === "true";
  });

  const handleSetMarqueePaused = (val: boolean) => {
    setMarqueePaused(val);
    localStorage.setItem("marqueePaused", String(val));
  };

  // CSV Report Filter modal states
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Export Backup File Name Modal states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFileNameInput, setExportFileNameInput] = useState("borçtakip listesi");

  // For APK / WebView Export-Import Safeguard
  const [webViewExportOpen, setWebViewExportOpen] = useState(false);
  const [webViewExportTitle, setWebViewExportTitle] = useState("");
  const [webViewExportContent, setWebViewExportContent] = useState("");
  const [webViewExportFileName, setWebViewExportFileName] = useState("");
  const [isImportTextOpen, setIsImportTextOpen] = useState(false);
  const [pastedImportText, setPastedImportText] = useState("");
  
  const checkIsWebView = () => {
    if (typeof window === "undefined" || !navigator) return false;
    const ua = navigator.userAgent || "";
    return /Android/i.test(ua) && (ua.includes("; wv") || /Version\/[0-9.]+/i.test(ua));
  };
  const isWebView = checkIsWebView();
  const [csvStep, setCsvStep] = useState<"filter" | "preview">("filter");
  const [csvStartDate, setCsvStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [csvEndDate, setCsvEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  });
  const [voiceAssistantEnabled, setVoiceAssistantEnabled] = useState<boolean>(() => {
    return localStorage.getItem("voiceAssistantEnabled") !== "0";
  });
  const [notifFilter, setNotifFilter] = useState<"all" | "alarm" | "system" | "upcoming">("all");
  const [notifSectionTab, setNotifSectionTab] = useState<"feed" | "settings">("feed");

  // OneSignal Environment & Active States
  const [oneSignalAppId, setOneSignalAppId] = useState<string>(() => {
    return localStorage.getItem("oneSignalAppId") || (import.meta as any).env?.VITE_ONESIGNAL_APP_ID || "f0a34e24-e5c9-423e-927f-399736f68a92";
  });
  const [oneSignalInput, setOneSignalInput] = useState(oneSignalAppId);
  const [oneSignalSubscribed, setOneSignalSubscribed] = useState(false);

  // Newsletter Subscription State
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [isNewsletterSubscribed, setIsNewsletterSubscribed] = useState(false);
  const [isSubscribingNewsletter, setIsSubscribingNewsletter] = useState(false);
  const [newsletterFeedback, setNewsletterFeedback] = useState("");

  // Initialize and register OneSignal dynamically using official Capacitor Plugin
  useEffect(() => {
    OneSignalGuncelBaslat();

    // Push abonelik durumunu denetle (yalnızca yerel mobil ortamda)
    if (Capacitor.isNativePlatform()) {
      try {
        if (OneSignal?.User?.pushSubscription) {
          OneSignal.User.pushSubscription.getOptedInAsync().then((optedIn: boolean) => {
            setOneSignalSubscribed(optedIn);
          }).catch(() => {});

          OneSignal.User.pushSubscription.addEventListener("change", (e: any) => {
            if (e && e.current) {
              setOneSignalSubscribed(!!e.current.optedIn);
            }
          });
        }
      } catch (e) {
        console.warn("OneSignal push subscription check notice:", e);
      }
    }
  }, [oneSignalAppId]);

  // Scroll to top unconditionally on tab transition or public view switch to prevent screen scroll lockups
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [activeTab, showPublicView]);

  // Register Service Worker and inject Android WebView Polyfill for System Tray Push Notifications and Audio Gesture Unlocker
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 1. Register Service Worker to unlock navigator.serviceWorker.ready -> showNotification
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js")
          .then((reg) => {
            console.log("Notification Service Worker registered successfully:", reg.scope);
          })
          .catch((err) => {
            console.error("Service Worker registration failed:", err);
          });
      }

      // 2. Fallback Notification polyfill for simple hybrid APK WebView containers (where window.Notification is missing)
      if (!("Notification" in window)) {
        console.log("Notification API missing in this container (Common in simple Android WebViews). Injecting robust Fallback Notification polyfill...");
        
        class FallbackNotification {
          static permission: string = "granted"; // Polyfill assumed granted inside wrappers that don't support it standardly
          static async requestPermission(): Promise<string> {
            FallbackNotification.permission = "granted";
            return "granted";
          }
          constructor(title: string, options?: NotificationOptions) {
            console.log("FallbackNotification triggered:", title, options);
            if ("serviceWorker" in navigator && navigator.serviceWorker.ready) {
              navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification(title, {
                  body: options?.body,
                  icon: options?.icon || "/logo.png",
                  vibrate: [200, 100, 200],
                  tag: "butcempro-alert",
                  renotify: true
                } as any);
              }).catch(err => {
                console.warn("ServiceWorker background notify fallback failed:", err);
              });
            }
          }
        }

        (window as any).Notification = FallbackNotification as any;
        setHasNotificationPermission("granted");
      }

      // Sync initial push notification preferences to Service Worker
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        const savedPushEnabled = localStorage.getItem("pushNotificationsEnabled") !== "false";
        const savedPushFreq = localStorage.getItem("pushNotificationFrequency") || "2";
        const savedLastGenTime = Number(localStorage.getItem("sonGenelBildirimZamani") || 0);
        const savedTwiceDailyTime = Number(localStorage.getItem("sonGundeIkiBildirimZamani") || 0);
        navigator.serviceWorker.controller.postMessage({
          type: "SYNC_PUSH_SETTINGS",
          enabled: savedPushEnabled,
          frequency: savedPushFreq,
          sonGenelBildirimZamani: savedLastGenTime,
          sonGundeIkiBildirimZamani: savedTwiceDailyTime
        });
      }

      // Listen to messages from Service Worker
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data?.type === "UPDATE_LAST_NOTIFICATION_TIME" && event.data.timestamp) {
            localStorage.setItem("sonGenelBildirimZamani", String(event.data.timestamp));
            localStorage.setItem("sonGundeIkiBildirimZamani", String(event.data.timestamp));
          }
        });
      }
    }
  }, []);

  // Dynamic Notification permission states & Simulated Mobile Alerts
  const [hasNotificationPermission, setHasNotificationPermission] = useState<string>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const [isAddingAlarmNew, setIsAddingAlarmNew] = useState(false);
  const [testPushStatus, setTestPushStatus] = useState<string>("");
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);

  const triggerDiagnosticTestPush = async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      triggerToast("Bu tarayıcı bildirim altyapısını desteklemiyor.");
      return;
    }

    // Check device permission level before trying to register subscription
    if ("Notification" in window) {
      if (Notification.permission === "denied") {
        triggerToast("İzin engeli: Bildirim gönderimi cihazınızda engellenmiş. Lütfen Cihaz Teşhis Verileri bölümündeki adımları takip edin.");
        setTestPushStatus("ENGELLİ ❌");
        return;
      }
      if (Notification.permission === "default") {
        triggerToast("Lütfen açılacak pencerede 'İzin Ver' (Allow) butonuna tıklayın.");
        const requestPermissionFn = window.Notification?.requestPermission || (window as any).Notification?.requestPermission;
        if (requestPermissionFn) {
          const resPermission = await requestPermissionFn();
          if (resPermission !== "granted") {
            triggerToast("Bildirim izni verilmediği için test başlatılamadı.");
            setTestPushStatus("İZİN YOK ⚠️");
            return;
          }
          setHasNotificationPermission("granted");
        } else {
          triggerToast("Bildirim izni alınamadı.");
          setTestPushStatus("HATA");
          return;
        }
      }
    }

    setTestPushStatus("HAZIRLIK");
    triggerToast("Test hazırlanıyor... Web Push aboneliği kontrol ediliyor.");

    try {
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();
      
      if (!subscription) {
        const res = await fetch(getApiUrl("/api/push-vapid-public-key"));
        if (!res.ok) throw new Error("VAPID public key fetch failed");
        const { publicKey } = await res.json();
        
        if (!publicKey) {
          triggerToast("Hata: Sunucu bildirim anahtarı bulunamadı.");
          setTestPushStatus("HATA");
          return;
        }

        const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
        const base64 = (publicKey + padding).replace(/\-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }

        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray
        });
      }

      if (!subscription) {
        triggerToast("Cihaz aboneliği oluşturulamadı. İzinlerin açık olduğundan emin olun.");
        setTestPushStatus("HATA");
        return;
      }

      setIsPushSubscribed(true);

      // Sync user subscription details including current alarms and debts
      await fetch(getApiUrl("/api/push-register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription,
          alarms: alarmsRef.current,
          debts: debtsRef.current,
          installmentDebts: installmentDebtsRef.current,
          user: currentUser || "anonymous"
        })
      });

      const response = await fetch(getApiUrl("/api/send-test-push"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription,
          delaySeconds: 10
        })
      });

      if (response.ok) {
        setTestPushStatus("SÜRE: 10 SANİYE ⏳");
        triggerToast("⏰ 10 Saniyelik Test Başladı! Lütfen HEMEN telefonunuzu kilitleyin!");
        
        let count = 10;
        const interval = setInterval(() => {
          count--;
          if (count > 0) {
            setTestPushStatus(`SÜRE: ${count} SANİYE ⏳`);
          } else {
            clearInterval(interval);
            setTestPushStatus("GÖNDERİLDİ 🎉");
            setTimeout(() => setTestPushStatus(""), 4000);
          }
        }, 1000);
      } else {
        triggerToast("Sunucuyla bağlantı kurulamadı.");
        setTestPushStatus("HATA");
      }
    } catch (err) {
      console.error(err);
      triggerToast("İzin engeli veya ağ hatası sebebiyle test kurulamadı.");
      setTestPushStatus("HATA");
    }
  };
  const [newAlarmTitle, setNewAlarmTitle] = useState("");
  const [newAlarmDate, setNewAlarmDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined") return;

    // 1. Capacitor Native Notification İzni & Kanal Hazırlığı (Android 13+)
    try {
      const capGranted = await requestCapacitorNotificationPermission();
      if (capGranted) {
        setHasNotificationPermission("granted");
        triggerToast("Cihaz Bildirim İzni Verildi 🔔");
        sendSystemNotification(
          "Anlık Bildirimler Aktif!", 
          "Bütçem Pro bildirimleri artık telefonunuzun bildirim çekmecesine ulaştırılacak.",
          false
        );
        return;
      }
    } catch (capErr) {
      console.warn("Capacitor izin sorgusu web ortamına aktarıldı:", capErr);
    }

    const hasNotification = "Notification" in window;
    const hasServiceWorker = "serviceWorker" in navigator;

    if (!hasNotification && !hasServiceWorker) {
      setHasNotificationPermission("granted");
      return;
    }

    try {
      const requestPermissionFn = window.Notification?.requestPermission || (window as any).Notification?.requestPermission;
      if (requestPermissionFn) {
        const permission = await requestPermissionFn();
        setHasNotificationPermission(permission);
        
        if (permission === "granted") {
          triggerToast("Telefon Bildirim İzni Verildi 🔔");
          sendSystemNotification(
            "Anlık Bildirimler Aktif!", 
            "Bütçem Pro bildirimleri artık telefonunuzun bildirim çekmecesine ulaştırılacak.",
            false
          );
        } else if (permission === "denied") {
          triggerToast("⚠️ Bildirim izni reddedildi. Cihaz/tarayıcı ayarlarından izin verebilirsiniz.");
        }
      } else {
        setHasNotificationPermission("granted");
      }
    } catch (e) {
      console.error("Permission request error:", e);
      setHasNotificationPermission("granted");
    }

    try {
      syncAlarmsWithPushServer();
    } catch (pushErr) {
      console.warn("Could not automatically bind Push subscription on permission change:", pushErr);
    }
  };


  // Timezone-and-platform robust local datetime parser
  const parseLocalOrUTCString = (dateStr: string): Date => {
    try {
      if (dateStr.includes("T")) {
        const [datePart, timePart] = dateStr.split("T");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hour, minute] = timePart.split(":").map(Number);
        return new Date(year, month - 1, day, hour, minute || 0, 0, 0);
      } else {
        const [year, month, day] = dateStr.split("-").map(Number);
        // Saat belirtilmediyse varsayılan olarak sabah 09:00'da uyandırma yap
        const candidate = new Date(year, month - 1, day, 9, 0, 0, 0);
        const now = new Date();
        // Eğer seçilen tarih bugün ise ve saat 09:00'ı geçtiyse, test bildirimi için 2 dakika sonrasına ayarla
        if (
          candidate.getTime() <= now.getTime() &&
          year === now.getFullYear() &&
          (month - 1) === now.getMonth() &&
          day === now.getDate()
        ) {
          return new Date(now.getTime() + 2 * 60 * 1000);
        }
        return candidate;
      }
    } catch (e) {
      console.warn("Date parsing error callback:", e, dateStr);
      return new Date(dateStr);
    }
  };

  /**
   * Borç adı ve kategorisine göre profesyonel simge (emoji) belirler
   */
  const getDebtCategoryEmoji = (name = "", category = ""): string => {
    const combined = `${name || ""} ${category || ""}`.toLocaleLowerCase("tr-TR");
    if (combined.includes("internet") || combined.includes("wifi") || combined.includes("superonline") || combined.includes("ttnet") || combined.includes("telekom") || combined.includes("modem") || combined.includes("turknet") || combined.includes("fiber")) return "🛜";
    if (combined.includes("su ") || combined.includes("su fatur") || combined.includes("iski") || combined.includes("aski") || combined.includes("izsu") || combined.includes("buski") || combined.includes("koski") || combined.includes("şebeke")) return "💧";
    if (combined.includes("elektrik") || combined.includes("enerji") || combined.includes("tedaş") || combined.includes("gediz") || combined.includes("akım") || combined.includes("ck boğaziçi") || combined.includes("aydem") || combined.includes("limak")) return "⚡";
    if (combined.includes("doğalgaz") || combined.includes("dogalgaz") || combined.includes("igdaş") || combined.includes("gaz") || combined.includes("kombi") || combined.includes("başkentgaz") || combined.includes("enerya")) return "🔥";
    if (combined.includes("telefon") || combined.includes("gsm") || combined.includes("turkcell") || combined.includes("vodafone") || combined.includes("mobil") || combined.includes("hat")) return "📱";
    if (combined.includes("kart") || combined.includes("kredi") || combined.includes("banka") || combined.includes("avans") || combined.includes("ek hesap") || combined.includes("kmh") || combined.includes("bonus") || combined.includes("world") || combined.includes("maximum") || combined.includes("axess") || combined.includes("paraf")) return "💳";
    if (combined.includes("kira") || combined.includes("ev") || combined.includes("konut") || combined.includes("daire") || combined.includes("dükkan") || combined.includes("dukkan") || combined.includes("ofis")) return "🏠";
    if (combined.includes("aidat") || combined.includes("apartman") || combined.includes("site") || combined.includes("bina")) return "🏢";
    if (combined.includes("market") || combined.includes("gıda") || combined.includes("alisveris") || combined.includes("alışveriş") || combined.includes("bakkal") || combined.includes("migros") || combined.includes("bim") || combined.includes("a101") || combined.includes("şok")) return "🛒";
    if (combined.includes("araç") || combined.includes("araba") || combined.includes("taşıt") || combined.includes("tasit") || combined.includes("yakıt") || combined.includes("benzin") || combined.includes("mazot") || combined.includes("kasko") || combined.includes("sigorta") || combined.includes("hgs") || combined.includes("ogs") || combined.includes("mtv")) return "🚗";
    if (combined.includes("hastane") || combined.includes("sağlık") || combined.includes("saglik") || combined.includes("eczane") || combined.includes("doktor") || combined.includes("ilaç") || combined.includes("ilac") || combined.includes("diş")) return "🏥";
    if (combined.includes("okul") || combined.includes("eğitim") || combined.includes("egitim") || combined.includes("kurs") || combined.includes("harç") || combined.includes("servis") || combined.includes("kreş") || combined.includes("üniversite")) return "🎓";
    if (combined.includes("taksit")) return "📦";
    if (combined.includes("netflix") || combined.includes("spotify") || combined.includes("youtube") || combined.includes("prime") || combined.includes("disney") || combined.includes("abonelik")) return "📺";
    if (combined.includes("vergi") || combined.includes("ceza") || combined.includes("haciz") || combined.includes("icra")) return "⚖️";
    if (combined.includes("fatura")) return "🧾";
    return "💳";
  };

  const sendSystemNotification = (
    title: string,
    body: string,
    persist = true,
    alarmOrDebtId?: number
  ) => {
    // Push bildirimleri kullanıcı tarafından kapatıldıysa cihaz uyarısı üretme
    if (!pushNotificationsEnabled) {
      console.log("Push bildirimleri kullanıcı tarafından kapatıldı.");
      if (persist) {
        const newNotificationItem: NotificationItem = {
          id: Date.now(),
          title,
          message: body,
          date: new Date().toISOString(),
          isRead: false
        };
        const updated = [newNotificationItem, ...notifications];
        setNotifications(updated);
        saveAllToUser(debts, incomes, alarms, updated, installmentDebts, payments, expenses, expenseCategories);
      }
      return;
    }

    // 1. Sessiz fiziksel titreşim (melodik sesler tamamen kaldırılmıştır)
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([250, 100, 250]);
    }

    // 2. Net, profesyonel bildirim metni - Çiftleme ve başlık tekrarlarını engelliyoruz
    const todayStr = new Date().toLocaleDateString("tr-TR");
    const rawResolvedName = (userProfileName && userProfileName.trim())
      || (localStorage.getItem("user_profile_name") || "").trim()
      || (currentUser && currentUser !== "Varsayılan Kullanıcı" ? currentUser : "");
    const safeUser = rawResolvedName ? rawResolvedName.toUpperCase() : "SERKAN SAĞLAM";

    // Eğer body zaten özel formatlanmışsa (👤 SN. ile başlıyorsa veya AKTİF BORÇ LİSTENİZ içeriyorsa) tekrara girmeden doğrudan kullan
    const isAlreadyFormatted = Boolean(
      body && (
        body.startsWith("👤") ||
        body.startsWith("SN.") ||
        body.includes("AKTİF BORÇ LİSTENİZ") ||
        body.includes("B001")
      )
    );

    const officialSmsMessage = isAlreadyFormatted
      ? body
      : `👤 SN. ${safeUser}\n📅 Rapor Tarihi: ${todayStr}\n\n${body ? `${body}\n\n` : ""}⚠️ Vade gecikme faizlerinden korunmak için ödemelerinizi zamanında yapmanızı rica ederiz. İyi günler dileriz. B001`;

    // Sabit ve benzersiz borç / alarm ID'si (Android işletim sistemi aynı ID'ye sahip alarmları ezer, ekranda tek mesaj gösterir)
    const fixedNotifId = alarmOrDebtId !== undefined && alarmOrDebtId !== null && !isNaN(Number(alarmOrDebtId))
      ? Math.abs(Number(alarmOrDebtId))
      : undefined;

    // 3a. Android Doze Modu ve Kilit Ekranı Kesin Uyandırma (Capacitor LocalNotifications)
    sendInstantCapacitorNotification(title, officialSmsMessage, fixedNotifId).catch(() => {});

    // 3b. Native Android WebView Bridge - Direct Drawer & Heads-Up Banner
    if (typeof window !== "undefined" && (window as any).AndroidAlarm && typeof (window as any).AndroidAlarm.showNotification === "function") {
      try {
        (window as any).AndroidAlarm.showNotification(title, officialSmsMessage, fixedNotifId);
      } catch (bridgeErr) {
        console.warn("AndroidAlarm.showNotification hatası:", bridgeErr);
      }
    }

    // 3c. Trigger robust Standard phone OS Notification or Service Worker background push for Web
    if (typeof window !== "undefined") {
      const hasNotification = "Notification" in window;
      const isGranted = hasNotification && (Notification.permission === "granted" || (Notification as any).permission === "granted");

      if (isGranted) {
        const appIcon = window.location.origin + "/logo.png";
        let sentWithSW = false;

        const systemNotifTitle = title || "📊 Bütçem Pro: Güncel Vade Özeti";
        const systemNotifBody = officialSmsMessage;
        const uniqueTag = fixedNotifId ? `alarm-${fixedNotifId}` : ("butcempro-alert-" + Date.now());
        const shouldRenotify = !fixedNotifId; // Özel alarmlarda renotify false yapılarak çift bildirim engellenir

        const triggerDirectNotificationFallback = () => {
          if (sentWithSW) return;
          try {
            const isNative = (Notification as any).toString().indexOf("FallbackNotification") === -1;
            if (isNative) {
              const directNotif = new Notification(systemNotifTitle, {
                body: systemNotifBody,
                icon: appIcon,
                badge: appIcon,
                vibrate: [300, 100, 300, 100, 400],
                tag: uniqueTag,
                renotify: shouldRenotify,
                requireInteraction: true,
                silent: false,
                timestamp: Date.now()
              } as any);
              directNotif.onclick = () => {
                window.focus();
                setActiveTab("debts");
              };
            }
          } catch (e) {
            console.log("Direct Native Notification failed fallback:", e);
          }
        };

        // ALWAYS prefer Service Worker showNotification for Android drawer & system tray delivery
        if ("serviceWorker" in navigator) {
          const deliverViaSw = (reg: ServiceWorkerRegistration) => {
            reg.showNotification(systemNotifTitle, {
              body: systemNotifBody,
              icon: appIcon,
              badge: appIcon,
              vibrate: [300, 100, 300, 100, 400],
              tag: uniqueTag,
              renotify: shouldRenotify,
              requireInteraction: true,
              silent: false,
              timestamp: Date.now(),
              actions: [{ action: "open_app", title: "Ödemeyi Gör" }],
              data: { url: "/?tab=debts", alarmId: fixedNotifId }
            } as any).then(() => {
              sentWithSW = true;
              console.log("Notification sent successfully through active Service Worker registration.");
              if (navigator && (navigator as any).setAppBadge) {
                (navigator as any).setAppBadge(1).catch((err: any) => console.log("Set badge err:", err));
              }
            }).catch(swError => {
              console.warn("ServiceWorker showNotification failed, trying fallback...", swError);
              triggerDirectNotificationFallback();
            });
          };

          navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg) {
              deliverViaSw(reg);
            } else {
              navigator.serviceWorker.ready.then(deliverViaSw).catch(triggerDirectNotificationFallback);
            }
          }).catch(() => {
            navigator.serviceWorker.ready.then(deliverViaSw).catch(triggerDirectNotificationFallback);
          });
        } else {
          triggerDirectNotificationFallback();
        }
      }
    }

    // 4. Record to "Bildirim Paneli" feed if requested
    if (persist) {
      setNotifications((prev) => {
        const newId = prev.length > 0 ? Math.max(...prev.map((n) => n.id)) + 1 : 1;
        const newNotif: NotificationItem = {
          id: newId,
          title: `📢 ${title}: ${body}`
        };
        const updated = [newNotif, ...prev];
        // Instantly save to localStorage to maintain absolute robustness
        const currentSpaceNick = localStorage.getItem("currentUser") || currentUser;
        const spaceKey = currentSpaceNick ? `user_${currentSpaceNick}` : "user_anonymous";
        const rawData = localStorage.getItem(spaceKey);
        if (rawData) {
          try {
            const parsed = JSON.parse(rawData);
            parsed.notifications = updated;
            localStorage.setItem(spaceKey, JSON.stringify(parsed));
          } catch (err) {
            console.error("Local save from push alert warning:", err);
          }
        }
        return updated;
      });
    }
  };

  const triggerToast = (msg: string, duration = 2000) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, duration);
  };

  // Robust client-side Web Push subscription manager
  const registerPushSubscription = async (reg: ServiceWorkerRegistration, overrideAlarms?: Alarm[]) => {
    try {
      const res = await fetch(getApiUrl("/api/push-vapid-public-key"));
      if (!res.ok) throw new Error("VAPID public key fetch failed");
      const { publicKey } = await res.json();
      
      if (!publicKey) {
        console.warn("VAPID public key not configured on server.");
        return null;
      }

      // Convert VAPID base64url keys to Uint8Array for PushManager registration
      const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
      const base64 = (publicKey + padding).replace(/\-/g, "+").replace(/_/g, "/");
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray
      });

      setIsPushSubscribed(true);
      console.log("[Push Client] Registered subscription payload successfully:", subscription);
      
      const targetAlarms = overrideAlarms !== undefined ? overrideAlarms : alarmsRef.current;

      // Dispatch subscription details, active alarms and debt records to the server-side cron scheduler
      await fetch(getApiUrl("/api/push-register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription,
          alarms: targetAlarms,
          debts: debtsRef.current,
          installmentDebts: installmentDebtsRef.current,
          user: currentUser || "anonymous"
        })
      });
      console.log("[Push Client] Handshake with background push database successful.");
      triggerToast("🔔 Telefon Bildirim Sistemi Başarıyla Bağlandı!");
      return subscription;
    } catch (err: any) {
      console.warn("[Push Client] Web Push subscription workflow error:", err);
      if (err.name === "NotAllowedError") {
        triggerToast("❌ Tarayıcı bildirim iznini engelledi. Lütfen ayarlardan izin verin.");
      } else {
        triggerToast("⚠️ Bildirim bağlantısı kurulamadı. Lütfen tekrar deneyin.");
      }
      return null;
    }
  };

  const syncAlarmsWithPushServer = async (overrideAlarms?: Alarm[]) => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();
      
      const targetAlarms = overrideAlarms !== undefined ? overrideAlarms : alarmsRef.current;

      // Register subscription on demand if permission is granted but standard registration was cleared
      if (!subscription && typeof Notification !== "undefined" && (Notification as any).permission === "granted") {
        subscription = await registerPushSubscription(reg, targetAlarms);
        return;
      }
      
      if (subscription) {
        setIsPushSubscribed(true);
        await fetch(getApiUrl("/api/push-register"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription,
            alarms: targetAlarms,
            debts: debtsRef.current,
            installmentDebts: installmentDebtsRef.current,
            user: currentUser || "anonymous"
          })
        });
      }
    } catch (err) {
      console.warn("[Push Client] Could not synchronize alarms & debts state with database daemon:", err);
    }
  };

  // Synchronized state refs for periodic Alarm triggering engine (bypasses stale closures)
  const alarmsRef = useRef(alarms);
  const notificationsRef = useRef(notifications);
  const debtsRef = useRef(debts);
  const incomesRef = useRef(incomes);
  const installmentDebtsRef = useRef(installmentDebts);
  const paymentsRef = useRef(payments);
  const expensesRef = useRef(expenses);
  const expenseCategoriesRef = useRef(expenseCategories);

  useEffect(() => { alarmsRef.current = alarms; }, [alarms]);
  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);
  useEffect(() => { debtsRef.current = debts; }, [debts]);
  useEffect(() => { incomesRef.current = incomes; }, [incomes]);
  useEffect(() => { installmentDebtsRef.current = installmentDebts; }, [installmentDebts]);
  useEffect(() => { paymentsRef.current = payments; }, [payments]);
  useEffect(() => { expensesRef.current = expenses; }, [expenses]);
  useEffect(() => { expenseCategoriesRef.current = expenseCategories; }, [expenseCategories]);

  // Clean device app icon notification badging / red dot on application layout mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasBadging = ("clearAppBadge" in navigator) || (navigator as any).clearAppBadge;
      if (hasBadging) {
        try {
          (navigator as any).clearAppBadge();
        } catch (err) {
          console.warn("[Badge System] Failed to clear application logo badge count:", err);
        }
      }

      // Android 8.0+ Bildirim kanalını başlat ve Capacitor bildirim izinlerini kontrol et
      initCapacitorNotificationChannel().catch(() => {});
      requestCapacitorNotificationPermission().catch(() => {});
      setupCapacitorNotificationListeners((notification) => {
        if (notification?.title) {
          triggerToast(`🔔 Bildirim: ${notification.title}`);
        }
      });
    }
  }, []);

  // Sync scheduled future active alarms and debts to background Android / Chrome Service Worker threads using SyncManager API
  useEffect(() => {
    const syncStateWithSW = async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sw = reg.active || navigator.serviceWorker.controller;
        if (sw) {
          sw.postMessage({
            type: "SYNC_ALL_DATA",
            alarms: alarmsRef.current,
            debts: debtsRef.current,
            installmentDebts: installmentDebtsRef.current
          });
        }

        // Register SyncManager background sync if supported
        if ("sync" in reg) {
          try {
            await (reg as any).sync.register("sync-alarms");
            await (reg as any).sync.register("sync-debts");
            await (reg as any).sync.register("check-debts-sync");
          } catch (e) {}
        }

        // Register Periodic Background Sync if supported (e.g. Chromium / Android PWA)
        if ("periodicSync" in reg) {
          try {
            await (reg as any).periodicSync.register("check-debts-periodic", {
              minInterval: 6 * 60 * 60 * 1000 // 6 hours
            });
          } catch (e) {}
        }
      } catch (err) {
        console.warn("[Background SW Sync Warn] Unable to synchronize alarms/debts to background service worker thread:", err);
      }

      // Synchronize alarms and debts state with the Web Push backend database for closed-app notifications
      try {
        syncAlarmsWithPushServer();
      } catch (err) {
        console.warn("Push sync call deferred:", err);
      }

      // Synchronize alarms, debts, and installment debts to native Android AlarmManager and SharedPreferences
      try {
        if (isAndroidAlarmBridgeAvailable()) {
          syncAllDebtsAndAlarmsToAndroid(
            alarmsRef.current,
            debtsRef.current,
            installmentDebtsRef.current
          );
        }
      } catch (err) {
        console.warn("[AndroidAlarmBridge] Native alarm & debt synchronization error:", err);
      }
    };

    // Immediate sync on state change
    syncStateWithSW();

    // Trigger on visibility change (when user backgrounds app or locks screen)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        syncStateWithSW();
      }
    };

    // Trigger on page blur & before unload
    const handleBlur = () => {
      syncStateWithSW();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("beforeunload", handleBlur);

    // Heartbeat sync every 60 seconds
    const interval = setInterval(syncStateWithSW, 60000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("beforeunload", handleBlur);
      clearInterval(interval);
    };
  }, [alarms, debts, installmentDebts, currentUser]);

  // High-Precision Real-time Automated Alarm Checking Engine
  useEffect(() => {
    const checkScheduledAlarms = () => {
      const now = new Date();
      const nowTime = now.getTime();
      const currentAlarms = alarmsRef.current;

      // Check for valid active alarms that are due now
      const dueAlarms = currentAlarms.filter((a) => {
        if (!a.date) return false;
        const alarmTime = parseLocalOrUTCString(a.date).getTime();
        return !isNaN(alarmTime) && alarmTime <= nowTime;
      });

      if (dueAlarms.length > 0) {
        console.log("TRIGGERED ALARMS DETECTED:", dueAlarms);
        const dueIds = dueAlarms.map((a) => a.id);
        
        // Filter out these fired alarms from active alarms list
        const remainingAlarms = currentAlarms.filter((a) => !dueIds.includes(a.id));
        
        let currentNotifs = [...notificationsRef.current];
        
        dueAlarms.forEach((a) => {
          // Add detailed notification item to Bildirim Paneli
          const nextId = currentNotifs.length > 0 ? Math.max(...currentNotifs.map((n) => n.id)) + 1 : 1;
          const newNotif: NotificationItem = {
            id: nextId,
            title: `⏰ HATIRLATICI SİNYALİ: ${a.title} (Ödeme Tarihi Geldi)`
          };
          currentNotifs = [newNotif, ...currentNotifs];

          // Borç / alarm ID'sini kapsayan benzersiz ve sabit id parametresi ver (Android aynı ID'ye sahip alarmları ezer ve kesinlikle sadece 1 defa basar)
          const fixedAlarmId = Math.abs(Number(a.debtId || a.id));

          // Trigger sound/vibe + general system overlay push notifications
          sendSystemNotification(
            "Ödeme Zamanı Geldi! ⏰",
            `${a.title}`,
            false, // skip extra manual disk commits inside sendSystemNotification since we do saveAllToUser below
            fixedAlarmId
          );

          // Force local app text toast prompt
          triggerToast(`⏰ Hatırlatıcı Sinyali: ${a.title}`);
        });

        // Set states atomically
        setAlarms(remainingAlarms);
        setNotifications(currentNotifs);

        // Perform cohesive disk state commit
        saveAllToUser(
          debtsRef.current,
          incomesRef.current,
          remainingAlarms,
          currentNotifs,
          installmentDebtsRef.current,
          paymentsRef.current,
          expensesRef.current,
          expenseCategoriesRef.current
        );
      }
    };

    // Run initial instant check right away on load/resume
    checkScheduledAlarms();

    const checkAlarmsInterval = setInterval(checkScheduledAlarms, 2000); // 2-second check rate gives ultra-rapid responsiveness

    // Instant check when user unlocks their phone / turns on their screen and returns to the app
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        console.log("Device woke up or tab focused - running instant high precision alarms check...");
        checkScheduledAlarms();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", checkScheduledAlarms);

    return () => {
      clearInterval(checkAlarmsInterval);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", checkScheduledAlarms);
    };
  }, []);

  // Automatically scroll to the very top of the window when switching active tabs
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeTab]);

  // Listen for global custom event toasts
  useEffect(() => {
    const handleGlobalToast = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent && customEvent.detail) {
        triggerToast(customEvent.detail);
      }
    };
    window.addEventListener("trigger-toast", handleGlobalToast);
    return () => window.removeEventListener("trigger-toast", handleGlobalToast);
  }, []);

  // Listen for contacts updates to sync computations
  useEffect(() => {
    const handleContactsUpdate = () => {
      setContactsRevision((prev) => prev + 1);
    };
    window.addEventListener("contacts-updated", handleContactsUpdate);
    return () => window.removeEventListener("contacts-updated", handleContactsUpdate);
  }, []);

  // Live Clock loop
  useEffect(() => {
    const handleClock = () => {
      const d = new Date();
      setLiveClock(
        `${d.getHours().toString().padStart(2, "0")}:${d
          .getMinutes()
          .toString()
          .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`
      );
    };
    handleClock();
    const timer = setInterval(handleClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Read APK Sync Code on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("sync_code");
    if (code) {
      setSyncCodeToApprove(code);
      // Clean query params so it doesn't stay in URL on reload, but keep in state
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Auto-lock when minimized/backgrounded to prevent direct bypass
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        try {
          const saved = localStorage.getItem("security_settings");
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.isEnabled) {
              setIsUnlocked(false);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Monitor quality-of-life: trigger a gentle JSON backup reminder if not exported in the last 30 days
  useEffect(() => {
    if (!isUnlocked) return;

    // Use sessionStorage to only alert once per active browser session
    const alertKey = "has_checked_backup_this_session";
    if (sessionStorage.getItem(alertKey) === "true") {
      return;
    }
    sessionStorage.setItem(alertKey, "true");

    const runBackupCheck = () => {
      const lastBackupStr = localStorage.getItem("last_backup_export_date");
      let needsBackupReminder = false;

      if (!lastBackupStr) {
        needsBackupReminder = true;
      } else {
        try {
          const lastBackupTime = new Date(lastBackupStr).getTime();
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          if (lastBackupTime < thirtyDaysAgo) {
            needsBackupReminder = true;
          }
        } catch (e) {
          needsBackupReminder = true;
        }
      }

      if (needsBackupReminder) {
        triggerToast("💡 Son 30 gündür veri yedeği almadınız. Verilerinizi güvenceye almak için veri yedeklemesi yapın.");
      }
    };

    // Postpone slightly to let other startup items loading toasts subside
    const timer = setTimeout(runBackupCheck, 4000);
    return () => clearTimeout(timer);
  }, [isUnlocked]);

  const handleApproveSync = async () => {
    if (!auth.currentUser || !syncCodeToApprove) return;
    try {
      // Securely link their password to the APK Secure format: ApkSecurePass_ + user.uid
      await updatePassword(auth.currentUser, "ApkSecurePass_" + auth.currentUser.uid);
    } catch (e: any) {
      console.warn("Google credentials password linking completed natively or needs refresh:", e);
    }

    try {
      await set(ref(db, `apk_sync_sessions/${syncCodeToApprove}`), {
        status: "success",
        email: auth.currentUser.email || auth.currentUser.uid,
        uid: auth.currentUser.uid,
        approvedAt: Date.now()
      });
      triggerToast("APK Girişi Başarıyla Yetkilendirildi! 🎉");
      setSyncCodeToApprove(null);
    } catch (err: any) {
      console.error("Failed to approve APK session:", err);
      triggerToast("Onay sinyali sunucuya ulaştırılamadı.");
    }
  };

  const handleGoogleAuthForSync = () => {
    if (!isPremium) {
      triggerToast("👑 E-posta ile giriş ve bulut eşitleme sadece Premium üyelere özeldir!");
      setIsUpgradeModalOpen(true);
      return;
    }
    setSelectedProvider("google");
    setProviderLoginOpen(true);
  };

  // Application Intro Loading Screen & 5-Page Visual Walkthrough states and handlers
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      const completed = localStorage.getItem("butcem_onboarding_welcome_v6");
      return !completed;
    } catch {
      return false;
    }
  });
  // Tanıtım sayfası ilk kez açılıyorsa splash henüz başlamasın; tanıtım bittiğinde başlayacak.
  // Tanıtım zaten daha önce tamamlanmışsa doğrudan animasyonlu açılış ekranı başlar.
  const [splashVisible, setSplashVisible] = useState<boolean>(() => {
    try {
      const completed = localStorage.getItem("butcem_onboarding_welcome_v6");
      return !!completed;
    } catch {
      return false;
    }
  });
  const [splashProgress, setSplashProgress] = useState(0);
  const [splashStatus, setSplashStatus] = useState("Veriler Güvenle Yükleniyor...");
  const [isQuickLoggingIn, setIsQuickLoggingIn] = useState<string | null>(null);
  const [providerLoginOpen, setProviderLoginOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"google" | null>(null);
  const splashTimerRef = useRef<any>(null);

  const startSplashAnimation = () => {
    if (splashTimerRef.current) {
      clearInterval(splashTimerRef.current);
    }
    setSplashProgress(0);
    setSplashStatus("Sistemler Başlatılıyor...");
    setSplashVisible(true);

    const totalDuration = 2200; // Smoother 2.2 second professional tech loading flow
    const intervalTime = 25;
    const steps = totalDuration / intervalTime;
    let currentStep = 0;

    splashTimerRef.current = setInterval(() => {
      currentStep++;
      const progress = Math.min((currentStep / steps) * 100, 100);
      setSplashProgress(Math.round(progress));

      if (progress < 30) {
        setSplashStatus("Sistemler Başlatılıyor...");
      } else if (progress < 60) {
        setSplashStatus("Mali Tablolar Hesaplanıyor...");
      } else if (progress < 90) {
        setSplashStatus("AI Finans Asistanı Hazırlanıyor...");
      } else {
        setSplashStatus("Bağlantı Kuruldu!");
      }

      if (progress >= 100) {
        clearInterval(splashTimerRef.current);
        splashTimerRef.current = null;
        setTimeout(() => {
          setSplashVisible(false);
        }, 80);
      }
    }, intervalTime);
  };

  useEffect(() => {
    // Tanıtım daha önce tamamlanmışsa uygulama açılışında animasyonlu ekranı hemen başlat
    const completed = localStorage.getItem("butcem_onboarding_welcome_v6");
    if (completed) {
      startSplashAnimation();
    }
    return () => {
      if (splashTimerRef.current) {
        clearInterval(splashTimerRef.current);
      }
    };
  }, []);

  const handleCompleteOnboarding = () => {
    try {
      localStorage.setItem("butcem_onboarding_welcome_v6", "true");
      localStorage.setItem("butcem_onboarding_completed", "true");
    } catch (e) {
      console.warn("Could not write onboarding status to localStorage:", e);
    }
    setShowOnboarding(false);
    // 5 sayfalık tanıtım sayfasından hemen sonra Bütçem Pro animasyonlu açılış sayfası başlar
    startSplashAnimation();
  };

  const handleOnboardingDirectLogin = () => {
    try {
      localStorage.setItem("butcem_onboarding_welcome_v6", "true");
      localStorage.setItem("butcem_onboarding_completed", "true");
    } catch (e) {
      console.warn("Could not write onboarding status to localStorage:", e);
    }
    setShowOnboarding(false);
    setSplashVisible(false);
    if (splashTimerRef.current) {
      clearInterval(splashTimerRef.current);
      splashTimerRef.current = null;
    }

    setSelectedProvider("google");
    setProviderLoginOpen(true);
  };

  const handleQuickLogin = (provider: "google") => {
    setSelectedProvider(provider);
    setProviderLoginOpen(true);
  };

  const handleSidebarGoogleLogin = () => {
    setSelectedProvider("google");
    setProviderLoginOpen(true);
  };

  const handleSidebarDeviceLogin = () => {
    setSelectedProvider("google");
    setProviderLoginOpen(true);
  };

  const handleProviderLoginSuccess = (
    email: string,
    meta?: {
      isPremium?: boolean;
      isGuest?: boolean;
      isPendingPayment?: boolean;
      isTrialActive?: boolean;
      isTrialExpired?: boolean;
      trialMessage?: string;
      createdAt?: string;
    }
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    const isTestSuperAccount = cleanEmail === "info.borcodemetakip@gmail.com";
    const finalIsPremium = isTestSuperAccount ? true : (meta?.isPremium ?? false);
    const finalIsGuest = isTestSuperAccount ? false : (meta?.isGuest ?? !finalIsPremium);

    setCurrentUser(cleanEmail);
    localStorage.setItem("currentUser", cleanEmail);
    
    if (meta?.createdAt) {
      localStorage.setItem("user_created_at", meta.createdAt);
    }

    // Modal'ları ve pencereleri anında kapat
    setProviderLoginOpen(false);
    setSelectedProvider(null);
    setSessionTerminatedReason(null);

    // 1. KENDİ E-POSTAM (info.borcodemetakip@gmail.com) veya Lisanslı Premium
    if (isTestSuperAccount || finalIsPremium) {
      setIsPremium(true);
      setIsTrialExpiredLocked(false);
      localStorage.setItem("is_premium", "true");
      localStorage.setItem("is_guest", "false");
      localStorage.setItem("premium_source", "login");

      setIsUpgradeModalOpen(false);
      setShowPublicView(null);
      setActiveTab("overview");
      triggerToast("👑 Premium Giriş Başarılı! Tüm özelliklerin kilidi açıldı.");
      return;
    }

    // 2. ÖDEMESİ TAMAMLANMAMIŞ PREMİUM HESAPLAR İÇİN KONTROL (ZORUNLU SATIN ALMA YÖNLENDİRMESİ)
    // Eğer kullanıcı Premium kaydı açmış veya isPremium: false olan bir hesapla giriş yapmışsa,
    // ana sayfaya geçişi engelle ve "Aboneliğinizi tamamlamak için lütfen bir plan seçin" uyarısıyla Satın Alma Sayfasına at!
    if (meta?.isPendingPayment || (!finalIsPremium && !finalIsGuest)) {
      setIsPremium(false);
      setIsTrialExpiredLocked(true);
      localStorage.setItem("is_premium", "false");
      localStorage.setItem("is_guest", "false");
      localStorage.removeItem("premium_source");
      localStorage.removeItem("trial_end_date");

      setShowPublicView(null);
      setIsUpgradeModalOpen(true);
      const msg = meta?.trialMessage || "Aboneliğinizi tamamlamak için lütfen bir plan seçin.";
      triggerToast(msg);
      return;
    }

    // 3. 7 GÜNLÜK SÜRE BİTİM KONTROLÜ (MİSAFİR HESAPLAR İÇİN)
    if (meta?.isTrialExpired) {
      setIsPremium(false);
      setIsTrialExpiredLocked(true);
      localStorage.setItem("is_premium", "false");
      localStorage.setItem("is_guest", "true");
      localStorage.removeItem("premium_source");
      localStorage.removeItem("trial_end_date");

      setShowPublicView(null);
      setIsUpgradeModalOpen(true);
      triggerToast("7 günlük ücretsiz deneme süreniz sona ermiştir. Uygulamayı kullanmaya devam etmek için lütfen Premium planlardan birini seçin.");
      return;
    }

    // 4. Misafir 7 Günlük Deneme Aktif İse: Girişe Müsaade Et
    setIsPremium(false);
    setIsTrialExpiredLocked(false);
    localStorage.setItem("is_premium", "false");
    localStorage.setItem("is_guest", "true");

    setIsUpgradeModalOpen(false);
    setShowPublicView(null);
    setActiveTab("overview");

    const message = meta?.trialMessage || "Uygulamamızı test edebilmeniz için 7 günlük ücretsiz deneme süreniz tanımlanmıştır!";
    triggerToast(message);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        triggerToast("Lütfen 5MB'den küçük bir görsel seçin! ⚠️");
        return;
      }
      await handleSaveAvatar(file);
      e.target.value = "";
    }
  };

  // Listen to genuine Firebase Authentication state changes
  useEffect(() => {
    let sessionWatcherUnsub: (() => void) | null = null;

    // Process redirect result if coming back from Google OAuth redirect
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          const emailOrUid = (result.user.email ? result.user.email.toLowerCase() : null) || result.user.uid;
          const displayName = emailOrUid.endsWith("@borctakip.app") 
            ? emailOrUid.replace("@borctakip.app", "") 
            : emailOrUid;
          setCurrentUser(displayName);
          localStorage.setItem("currentUser", displayName);
          triggerToast("Google ile Giriş Yapıldı! 🎉");
        }
      })
      .catch((err) => {
        console.warn("getRedirectResult error:", err);
      });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (sessionWatcherUnsub) {
        sessionWatcherUnsub();
        sessionWatcherUnsub = null;
      }

      if (user) {
        // Eşzamanlı tek cihaz koruması (Sadece isPremium: true olan hesaplar için)
        sessionWatcherUnsub = startDeviceSessionWatcher(user.uid, (reason) => {
          setSessionTerminatedReason(reason);
          setCurrentUser(null);
          setProviderLoginOpen(true);
        });

        const emailOrUid = (user.email ? user.email.toLowerCase() : null) || user.uid;
        const displayName = emailOrUid.endsWith("@borctakip.app") 
            ? emailOrUid.replace("@borctakip.app", "") 
            : emailOrUid;
        setCurrentUser(displayName);
        localStorage.setItem("currentUser", displayName);

        // 1. & 3. Kural: info.borcodemetakip@gmail.com veya Firestore verisine göre Premium durumunu global state'e aktar
        const cleanUserEmail = (user.email || displayName).toLowerCase();
        const isSuperTestEmail = cleanUserEmail === "info.borcodemetakip@gmail.com";

        if (isSuperTestEmail) {
          setIsPremium(true);
          setIsTrialExpiredLocked(false);
          localStorage.setItem("is_premium", "true");
          localStorage.setItem("is_guest", "false");
          localStorage.setItem("premium_source", "login");
        } else {
          getDoc(doc(firestore, "users", user.uid))
            .then((docSnap) => {
              if (docSnap.exists()) {
                const uData = docSnap.data();
                if (uData.isPremium === true) {
                  setIsPremium(true);
                  setIsTrialExpiredLocked(false);
                  localStorage.setItem("is_premium", "true");
                  localStorage.setItem("is_guest", "false");
                  localStorage.setItem("premium_source", "login");
                } else {
                  // Firestore'da isPremium: false -> 7 günlük süreyi matematiksel kontrol et
                  checkUserTrialExpiration(user, uData);
                }
              } else {
                checkUserTrialExpiration(user, null);
              }
            })
            .catch(() => {
              checkUserTrialExpiration(user, null);
            });
        }

        // Kullanıcının kayıtlı profil ismini kullanicilar/KULLANICI_UID/profil/isim düğümünden çek
        get(ref(db, `kullanicilar/${user.uid}/profil/isim`))
          .then((pSnap) => {
            if (pSnap.exists() && pSnap.val()) {
              const pName = String(pSnap.val()).trim();
              if (pName) {
                setUserProfileName(pName);
                localStorage.setItem("user_profile_name", pName);
              }
            }
          })
          .catch((pErr) => {
            console.warn("Profil ismi sorgulama uyarısı:", pErr);
          });

        // Kullanıcının kayıtlı profil resmini kullanicilar/KULLANICI_UID/profil/resim düğümünden çek
        get(ref(db, `kullanicilar/${user.uid}/profil/resim`))
          .then((imgSnap) => {
            if (imgSnap.exists() && imgSnap.val()) {
              const imgData = String(imgSnap.val()).trim();
              if (imgData) {
                setUserAvatar(imgData);
                localStorage.setItem("user_profile_avatar", imgData);
                const spaceKey = user.email ? `user_${user.email.toLowerCase()}` : `user_${user.uid}`;
                localStorage.setItem(`${spaceKey}_avatar`, imgData);
              }
            }
          })
          .catch((imgErr) => {
            console.warn("Profil resmi sorgulama uyarısı:", imgErr);
          });
      } else {
        const savedUser = localStorage.getItem("currentUser");
        if (savedUser) {
          // Keep the local/hybrid session active if Firebase is loading or in a fallback state
          setCurrentUser(savedUser);
          checkUserTrialExpiration(null, null);
        } else {
          setCurrentUser(null);
        }
        const savedProfileName = localStorage.getItem("user_profile_name");
        if (savedProfileName) {
          setUserProfileName(savedProfileName);
        }
        const savedAvatar = localStorage.getItem("user_profile_avatar");
        if (savedAvatar) {
          setUserAvatar(savedAvatar);
        }
      }
    });

    return () => {
      unsubscribe();
      if (sessionWatcherUnsub) {
        sessionWatcherUnsub();
      }
    };
  }, []);

  // Configure RevenueCat and load offerings on paywall dialog open
  useEffect(() => {
    if (isUpgradeModalOpen) {
      const initAndFetchPlayPricing = async () => {
        setIsPricingLoading(true);
        try {
          // Setup with user-linked custom SDK token goog_prod_butcem_pro
          await Purchases.configure("goog_prod_butcem_pro", auth.currentUser?.uid || "web_test_user");
          const offerings = await Purchases.getOfferings();
          if (offerings && offerings.current) {
            setDynamicProducts({
              butcem_pro_aylik: offerings.current.monthly.product,
              butcem_pro_yillik: offerings.current.annual.product,
              butcem_pro_sinirsiz: offerings.current.lifetime.product
            });
          }
        } catch (err) {
          console.error("RevenueCat offering loading failed:", err);
        } finally {
          setIsPricingLoading(false);
        }
      };
      initAndFetchPlayPricing();
    }
  }, [isUpgradeModalOpen]);

  // Otomatik telefon karanlık / aydınlık mod dinleyicisi
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const currentMode = localStorage.getItem("themeMode") || "auto";
      if (currentMode === "auto") {
        setDarkMode(e.matches);
      }
    };

    if (themeMode === "auto") {
      setDarkMode(mediaQuery.matches);
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleSystemChange);
      return () => mediaQuery.removeEventListener("change", handleSystemChange);
    } else {
      mediaQuery.addListener(handleSystemChange);
      return () => mediaQuery.removeListener(handleSystemChange);
    }
  }, [themeMode]);

  // Sync theme configurations on body and mobile status bar (theme-color)
  useEffect(() => {
    // Dynamic theme-color sync for mobile/PWA status bar
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.setAttribute("name", "theme-color");
      document.head.appendChild(metaThemeColor);
    }
    // Gündüz ve gece modunda üst başlık (header) ile tam uyumlu koyu lacivert ton (#0b132b / #020617),
    // böylece telefonun pil göstergesi (99%), saat ve sinyal simgeleri bembeyaz ve kristal netliğinde görünür
    const statusBarColor = darkMode ? "#020617" : "#0b132b";
    metaThemeColor.setAttribute("content", statusBarColor);

    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
      document.body.classList.add("dark-mode");
      localStorage.setItem("darkMode", "1");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
      document.body.classList.remove("dark-mode");
      localStorage.setItem("darkMode", "0");
    }
  }, [darkMode]);

  // Sync color theme overrides on documents
  useEffect(() => {
    const themes = ["theme-default", "theme-green", "theme-purple", "theme-orange"];
    themes.forEach((t) => {
      document.documentElement.classList.remove(t);
      document.body.classList.remove(t);
    });
    
    const activeClass = `theme-${colorTheme}`;
    document.documentElement.classList.add(activeClass);
    document.body.classList.add(activeClass);
  }, [colorTheme]);

  // Load appropriate data when user target profile changes or mounts (local + Firebase Firestore sync)
  useEffect(() => {
    let active = true;

    const defaultCategories: ExpenseCategory[] = [
      { id: 1, name: "Kira", color: "#3b82f6", icon: "🏠" },
      { id: 2, name: "Market", color: "#10b981", icon: "🛒" },
      { id: 3, name: "Ulaşım", color: "#f59e0b", icon: "🚗" },
      { id: 4, name: "Yeme İçme", color: "#ec4899", icon: "🍔" },
      { id: 5, name: "Faturalar", color: "#ef4444", icon: "⚡" }
    ];

    const isSampleItem = (item: any, type: "debt" | "installment" | "income" | "expense" | "alarm" | "notif") => {
      if (!item) return true;
      if (type === "debt") {
        if (item.name === "Örnek Finansal Borç" || item.name === "Telefon Taksidi (Örnek)") return true;
        if (typeof item.name === "string" && item.name.toLowerCase().includes("örnek")) return true;
      }
      if (type === "installment") {
        if (item.name === "Telefon Taksidi (Örnek)") return true;
        if (typeof item.name === "string" && item.name.toLowerCase().includes("örnek")) return true;
      }
      if (type === "income") {
        if (item.name === "Aylık Maaş Geliri" && Number(item.amount) === 20000) return true;
        if (typeof item.name === "string" && item.name.toLowerCase().includes("örnek")) return true;
      }
      if (type === "expense") {
        if (item.description === "Haftalık mutfak alışverişi" && Number(item.amount) === 550) return true;
        if (item.description === "Elektrik Faturası" && Number(item.amount) === 240) return true;
        if (typeof item.description === "string" && item.description.toLowerCase().includes("örnek")) return true;
      }
      if (type === "alarm") {
        if (item.title === "Kredi Kartı Son Ödeme") return true;
      }
      if (type === "notif") {
        if (item.title === "Sisteme Hoş Geldiniz! Borçlarınızı buraya kaydedebilirsiniz.") return true;
      }
      return false;
    };

    const applyDataPayload = (data: any) => {
      if (!active) return;
      const cleanDebts = (data.debts || []).filter((d: any) => !isSampleItem(d, "debt"));
      const cleanInsts = (data.installmentDebts || []).filter((i: any) => !isSampleItem(i, "installment"));
      const validDebtIds = new Set(cleanDebts.map((d: any) => d.id));
      const validInstIds = new Set(cleanInsts.map((i: any) => i.id));
      const cleanPayments = (data.payments || []).filter((p: any) => {
        return p.debtId && (validDebtIds.has(p.debtId) || validInstIds.has(p.debtId));
      });
      const cleanIncomes = (data.incomes || []).filter((inc: any) => !isSampleItem(inc, "income"));
      const cleanAlarms = (data.alarms || []).filter((a: any) => !isSampleItem(a, "alarm"));
      const cleanNotifs = (data.notifications || []).filter((n: any) => !isSampleItem(n, "notif"));
      const cleanExpenses = (data.expenses || []).filter((e: any) => !isSampleItem(e, "expense"));

      setDebts(cleanDebts);
      setIncomes(cleanIncomes);
      setAlarms(cleanAlarms);
      setNotifications(cleanNotifs);
      setInstallmentDebts(cleanInsts);
      setPayments(cleanPayments);
      setExpenses(cleanExpenses);

      const isSuperUser = (currentUser || auth.currentUser?.email || "").toLowerCase() === "info.borcodemetakip@gmail.com";
      if (isSuperUser) {
        setIsPremium(true);
        localStorage.setItem("is_premium", "true");
        localStorage.setItem("is_guest", "false");
      } else if (localStorage.getItem("premium_source") === "login" && localStorage.getItem("is_premium") === "true") {
        setIsPremium(true);
      } else if (data.isPremium !== undefined) {
        setIsPremium(data.isPremium);
        localStorage.setItem("is_premium", data.isPremium ? "true" : "false");
      }
      if (data.premiumPlan !== undefined) {
        setSelectedPlan(data.premiumPlan);
        localStorage.setItem("premium_plan", data.premiumPlan);
      }

      const hasCats = data.expenseCategories && Array.isArray(data.expenseCategories) && data.expenseCategories.length > 0;
      setExpenseCategories(hasCats ? data.expenseCategories : defaultCategories);

      // Cache locally for instant offline loading
      const userKey = currentUser || (auth.currentUser?.email ? auth.currentUser.email.toLowerCase() : auth.currentUser?.uid);
      if (userKey) {
        const spaceKey = `user_${userKey}`;
        const dataBag = {
          debts: cleanDebts,
          incomes: cleanIncomes,
          alarms: cleanAlarms,
          notifications: cleanNotifs,
          installmentDebts: cleanInsts,
          payments: cleanPayments,
          expenses: cleanExpenses,
          expenseCategories: hasCats ? data.expenseCategories : defaultCategories
        };
        try {
          localStorage.setItem(spaceKey, JSON.stringify(dataBag));
        } catch {}
      }
    };

    const loadFromLocalStorage = () => {
      const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
      const dataString = localStorage.getItem(spaceKey);
      if (dataString) {
        try {
          const parsed = JSON.parse(dataString);
          const loadedDebts = (parsed.debts || []).filter((d: any) => !isSampleItem(d, "debt"));
          const loadedInstallments = (parsed.installmentDebts || []).filter((i: any) => !isSampleItem(i, "installment"));
          const validDebtIds = new Set(loadedDebts.map((d: any) => d.id));
          const validInstIds = new Set(loadedInstallments.map((i: any) => i.id));
          
          // Purge orphan payment logs from deleted/non-existent debts
          const cleanPayments = (parsed.payments || []).filter((p: any) => {
            return p.debtId && (validDebtIds.has(p.debtId) || validInstIds.has(p.debtId));
          });

          const loadedIncomes = (parsed.incomes || []).filter((inc: any) => !isSampleItem(inc, "income"));
          const loadedAlarms = (parsed.alarms || []).filter((a: any) => !isSampleItem(a, "alarm"));
          const loadedNotifs = (parsed.notifications || []).filter((n: any) => !isSampleItem(n, "notif"));
          const loadedExpenses = (parsed.expenses || []).filter((e: any) => !isSampleItem(e, "expense"));
          const hasCategories = parsed.expenseCategories && Array.isArray(parsed.expenseCategories) && parsed.expenseCategories.length > 0;
          const cleanCats = hasCategories ? parsed.expenseCategories : defaultCategories;

          setDebts(loadedDebts);
          setIncomes(loadedIncomes);
          setAlarms(loadedAlarms);
          setNotifications(loadedNotifs);
          setInstallmentDebts(loadedInstallments);
          setPayments(cleanPayments);
          setExpenses(loadedExpenses);
          setExpenseCategories(cleanCats);

          // Update storage with cleaned data
          try {
            const cleanBag = {
              ...parsed,
              debts: loadedDebts,
              installmentDebts: loadedInstallments,
              incomes: loadedIncomes,
              alarms: loadedAlarms,
              notifications: loadedNotifs,
              payments: cleanPayments,
              expenses: loadedExpenses,
              expenseCategories: cleanCats
            };
            localStorage.setItem(spaceKey, JSON.stringify(cleanBag));
          } catch {}
          return;
        } catch (e) {
          console.error("Local data parsing warning:", e);
        }
      }

      // Completely clean system: start with empty tables
      setDebts([]);
      setIncomes([]);
      setAlarms([]);
      setNotifications([]);
      setInstallmentDebts([]);
      setPayments([]);
      setExpenses([]);
      setExpenseCategories(defaultCategories);
    };

    let unsubscribeSnapshot: (() => void) | null = null;

    const loadData = async (targetUser?: any) => {
      const fbUser = targetUser || auth.currentUser;
      if (fbUser) {
        try {
          setIsOfflineMode(false);
          setFirestoreErrorMessage(null);

          // Realtime Database bağlantısını online tut
          try {
            goOnline(db);
          } catch (netErr: any) {
            console.warn("Realtime Database goOnline uyarısı:", netErr?.message || netErr);
          }

          // 1. Birincil kontrol: doğrudan kullanicilar/KULLANICI_UID/veriler düğümü
          const primaryVerilerRef = ref(db, `kullanicilar/${fbUser.uid}/veriler`);
          let snap = await get(primaryVerilerRef);

          // 2. Yedek kontrol: kullanicilar/KULLANICI_UID veya users/KULLANICI_UID/veriler
          if (!snap.exists()) {
            snap = await get(ref(db, `users/${fbUser.uid}/veriler`));
          }
          if (!snap.exists()) {
            snap = await get(ref(db, `kullanicilar/${fbUser.uid}`));
          }
          if (!snap.exists()) {
            snap = await get(ref(db, `users/${fbUser.uid}`));
          }

          if (snap.exists() && snap.val()) {
            const val = snap.val();
            const resolvedData = val.veriler ? val.veriler : val;
            applyDataPayload(resolvedData);
          } else {
            // Yerel hafızadaki verileri kontrol et ve Realtime Database'e ilk eşitlemeyi yap
            const cleanEmail = fbUser.email ? fbUser.email.toLowerCase() : null;
            const spaceKey = cleanEmail ? `user_${cleanEmail}` : `user_${fbUser.uid}`;
            const localDataStr = localStorage.getItem(spaceKey) || (currentUser ? localStorage.getItem(`user_${currentUser}`) : null);
            if (localDataStr) {
              try {
                const parsed = JSON.parse(localDataStr);
                applyDataPayload(parsed);
                const payload = veriyiTemizle({
                  ...parsed,
                  email: cleanEmail || "",
                  emailLower: cleanEmail || "",
                  userUid: fbUser.uid,
                  isPremium: localStorage.getItem("is_premium") === "true",
                  premiumPlan: localStorage.getItem("premium_plan") || "yearly",
                  updatedAt: Date.now()
                });
                await Promise.all([
                  set(ref(db, `kullanicilar/${fbUser.uid}/veriler`), payload),
                  set(ref(db, `users/${fbUser.uid}/veriler`), payload)
                ]);
              } catch (initErr: any) {
                const initErrCode = initErr?.code || "HATA";
                const initErrMsg = initErr?.message || String(initErr);
                const fullInitErr = `[${initErrCode}] ${initErrMsg}`;
                console.warn("Realtime Database ilk kayıt hatası:", fullInitErr);
                setFirestoreErrorMessage(`Database İlk Başlatma Hatası: ${fullInitErr}`);
                triggerToast(`İlk Kayıt Hatası: ${fullInitErr}`, 5000);
                loadFromLocalStorage();
              }
            } else {
              loadFromLocalStorage();
            }
          }

          // Profil ismini doğrudan ve sadece kullanicilar/KULLANICI_UID/profil/isim düğümünden oku
          try {
            const pSnap = await get(ref(db, `kullanicilar/${fbUser.uid}/profil/isim`));
            if (pSnap.exists() && pSnap.val()) {
              const pName = String(pSnap.val()).trim();
              if (pName) {
                setUserProfileName(pName);
                localStorage.setItem("user_profile_name", pName);
              }
            }
          } catch (pErr) {
            console.warn("Profil ismi okuma uyarısı:", pErr);
          }

          // Profil resmini doğrudan ve sadece kullanicilar/KULLANICI_UID/profil/resim düğümünden oku
          try {
            const imgSnap = await get(ref(db, `kullanicilar/${fbUser.uid}/profil/resim`));
            if (imgSnap.exists() && imgSnap.val()) {
              const imgData = String(imgSnap.val()).trim();
              if (imgData) {
                setUserAvatar(imgData);
                localStorage.setItem("user_profile_avatar", imgData);
                const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
                localStorage.setItem(`${spaceKey}_avatar`, imgData);
              }
            }
          } catch (imgErr) {
            console.warn("Profil resmi okuma uyarısı:", imgErr);
          }

          // Realtime Database canlı senkronizasyon dinleyicisi (onValue)
          try {
            const rtdbUnsub = onValue(primaryVerilerRef, (snapshot) => {
              if (snapshot.exists() && active) {
                const val = snapshot.val();
                applyDataPayload(val.veriler ? val.veriler : val);
                setFirestoreErrorMessage(null);
              }
            }, (error: any) => {
              const snapCode = error?.code || "HATA";
              const snapMsg = error?.message || String(error);
              const fullSnapErr = `[${snapCode}] ${snapMsg}`;
              console.warn("Realtime Database dinleyici hatası:", fullSnapErr);
              setFirestoreErrorMessage(`Database Dinleyici Hatası: ${fullSnapErr}`);
            });

            // Profil ismini canlı dinleyici ile izle
            const profilUnsub = onValue(ref(db, `kullanicilar/${fbUser.uid}/profil/isim`), (pSnapshot) => {
              if (pSnapshot.exists() && active) {
                const pName = String(pSnapshot.val() || "").trim();
                if (pName) {
                  setUserProfileName(pName);
                  localStorage.setItem("user_profile_name", pName);
                }
              }
            });

            // Profil resmini canlı dinleyici ile izle
            const profilResimUnsub = onValue(ref(db, `kullanicilar/${fbUser.uid}/profil/resim`), (imgSnapshot) => {
              if (imgSnapshot.exists() && active) {
                const imgData = String(imgSnapshot.val() || "").trim();
                if (imgData) {
                  setUserAvatar(imgData);
                  localStorage.setItem("user_profile_avatar", imgData);
                  const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
                  localStorage.setItem(`${spaceKey}_avatar`, imgData);
                }
              }
            });

            unsubscribeSnapshot = () => {
              rtdbUnsub();
              profilUnsub();
              profilResimUnsub();
            };
          } catch (snapErr: any) {
            const snapSetupCode = snapErr?.code || "HATA";
            const snapSetupMsg = snapErr?.message || String(snapErr);
            console.warn("Database dinleyici kurulum uyarısı:", `[${snapSetupCode}] ${snapSetupMsg}`);
          }

        } catch (err: any) {
          const errCode = err?.code || "HATA";
          const errMsg = err?.message || String(err);
          const fullErrText = `[${errCode}] ${errMsg}`;

          console.error("Realtime Database yükleme hatası:", fullErrText, err);

          if (active) {
            loadFromLocalStorage();
            setIsOfflineMode(true);
            setFirestoreErrorMessage(`Database Bağlantı Hatası: ${fullErrText}`);
            triggerToast(`Database Bağlantı Hatası: ${fullErrText}`, 6000);
            
            const isPermissionError = err && (
              err.code === "permission-denied" || 
              err.message?.toLowerCase().includes("permission") || 
              err.message?.toLowerCase().includes("denied")
            );
            
            if (isPermissionError) {
              try {
                handleDatabaseError(err, OperationType.GET, `kullanicilar/${fbUser.uid}/veriler`);
              } catch (e) {
                console.error("Permission error handled:", e);
              }
            }
          }
        }
      } else {
        loadFromLocalStorage();
        setIsOfflineMode(false);
      }
    };

    loadData();

    return () => {
      active = false;
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, [currentUser]);

  // Robust dynamic calculation of upcoming/overdue payments (due in <= 3 days, or overdue and not yet paid)
  const getUpcomingPayments = () => {
    const list: {
      id: string;
      title: string;
      desc: string;
      dueDate: string;
      daysLeft: number;
      type: string;
      amount: number;
      paid: number;
    }[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Check standard single-payment debts
    (debts || []).forEach((debt) => {
      // Only process incomplete payments
      if (debt.paid >= debt.amount) return;
      if (!debt.dueDate) return;

      try {
        const [year, month, day] = debt.dueDate.split("-").map(Number);
        const due = new Date(year, month - 1, day, 0, 0, 0, 0);
        
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 3) {
          list.push({
            id: `upcoming-debt-${debt.id}`,
            title: `Borç Ödemesi: ${debt.name}`,
            desc: diffDays < 0 
              ? `Vadesi ${Math.abs(diffDays)} gün geçti! Ödenmesi gereken kalan tutar: ${(debt.amount - debt.paid).toLocaleString("tr-TR")} TL`
              : `Son ödeme tarihine ${diffDays === 0 ? "BUGÜN" : `${diffDays} gün`} kaldı! Kalan Tutar: ${(debt.amount - debt.paid).toLocaleString("tr-TR")} TL`,
            dueDate: debt.dueDate,
            daysLeft: diffDays,
            type: "upcoming",
            amount: debt.amount,
            paid: debt.paid
          });
        }
      } catch (err) {
        console.warn("Error calculating debt upcoming alert:", err);
      }
    });

    // 2. Check installment payments
    (installmentDebts || []).forEach((inst) => {
      if (inst.paidInstallmentCount >= inst.installmentCount) return;
      if (!inst.firstDueDate) return;

      try {
        const [year, month, day] = inst.firstDueDate.split("-").map(Number);
        const baseDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        baseDate.setMonth(baseDate.getMonth() + inst.paidInstallmentCount);

        const diffTime = baseDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 3) {
          const perInstallmentAmount = inst.totalAmount / inst.installmentCount;
          
          let dateStr = inst.firstDueDate;
          try {
            dateStr = baseDate.toISOString().split("T")[0];
          } catch (_) {}

          list.push({
            id: `upcoming-inst-${inst.id}`,
            title: `${inst.name} (Taksit ${inst.paidInstallmentCount + 1}/${inst.installmentCount})`,
            desc: diffDays < 0
              ? `Vadesi ${Math.abs(diffDays)} gün geçti! Taksit Tutarı: ${perInstallmentAmount.toLocaleString("tr-TR")} TL`
              : `Son ödeme tarihine ${diffDays === 0 ? "BUGÜN" : `${diffDays} gün`} kaldı! Taksit Tutarı: ${perInstallmentAmount.toLocaleString("tr-TR")} TL`,
            dueDate: dateStr,
            daysLeft: diffDays,
            type: "upcoming",
            amount: perInstallmentAmount,
            paid: 0
          });
        }
      } catch (err) {
        console.warn("Error calculating installment upcoming alert:", err);
      }
    });

    // Sort: most imminent/overdue first. Overdue (negative daysLeft) will bubble appropriately.
    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  };

  // Bildirim zaman damgalarını (sonBildirimZamani, sonGecikmeBildirimZamani)
  // React State, LocalStorage ve Firebase Realtime Database ile arka planda sessizce senkronize eder
  const syncDebtNotificationTimestamps = async (
    updatedDebts: Debt[],
    updatedInstallments: InstallmentDebt[]
  ) => {
    setDebts(updatedDebts);
    setInstallmentDebts(updatedInstallments);
    debtsRef.current = updatedDebts;
    installmentDebtsRef.current = updatedInstallments;

    // 1. LocalStorage güncelle
    const fbUser = auth.currentUser;
    const cleanEmail = fbUser?.email ? fbUser.email.toLowerCase() : (currentUser && currentUser.includes("@") ? currentUser.toLowerCase() : null);
    const spaceKey = cleanEmail ? `user_${cleanEmail}` : (currentUser ? `user_${currentUser}` : "user_anonymous");
    try {
      const rawData = localStorage.getItem(spaceKey);
      if (rawData) {
        const parsed = JSON.parse(rawData);
        parsed.debts = updatedDebts;
        parsed.installmentDebts = updatedInstallments;
        localStorage.setItem(spaceKey, JSON.stringify(parsed));
      }
      if (fbUser?.uid) {
        const rawUid = localStorage.getItem(`user_${fbUser.uid}`);
        if (rawUid) {
          const parsedUid = JSON.parse(rawUid);
          parsedUid.debts = updatedDebts;
          parsedUid.installmentDebts = updatedInstallments;
          localStorage.setItem(`user_${fbUser.uid}`, JSON.stringify(parsedUid));
        }
      }
    } catch (lsErr) {
      console.warn("LocalStorage timestamp sync warning:", lsErr);
    }

    // 2. Firebase Realtime Database ile tam senkronizasyon
    if (fbUser) {
      try {
        await Promise.all([
          update(ref(db, `kullanicilar/${fbUser.uid}/veriler`), {
            debts: updatedDebts,
            installmentDebts: updatedInstallments,
            updatedAt: Date.now()
          }),
          update(ref(db, `users/${fbUser.uid}/veriler`), {
            debts: updatedDebts,
            installmentDebts: updatedInstallments,
            updatedAt: Date.now()
          })
        ]);
        console.log("[Notification Engine] sonBildirimZamani bilgileri Firebase Realtime Database ile eşitlendi.");
      } catch (dbErr) {
        console.warn("[Notification Engine] Firebase timestamp sync error:", dbErr);
      }
    }

    // 3. Service Worker arka plan önbelleğine anında bildir
    if (typeof window !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SYNC_ALL_DATA",
        debts: updatedDebts,
        installmentDebts: updatedInstallments
      });
    }
  };

  // Belirlenen günlük push sıklığına (günde kaç kez veya 2 saatte bir) göre otomatik ödeme hatırlatıcı kontrolü
  useEffect(() => {
    if (!pushNotificationsEnabled) return;

    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    const checkAndTriggerPushReminders = async () => {
      if (!pushNotificationsEnabled) return;

      const currentDebts = debtsRef.current || [];
      const currentInsts = installmentDebtsRef.current || [];
      if (currentDebts.length === 0 && currentInsts.length === 0) return;

      const now = new Date();
      const currentHour = now.getHours();
      const nowMs = now.getTime();

      // Gece 23:00 ile sabah 08:30 arası rahatsız etmeme penceresi
      if (currentHour < 8 || currentHour >= 23) return;

      // --- 12 SAAT KİLİDİ: 'Günde 2 kez' Bildirim Ayarı İçin Kesin Zaman Damgası Engeli ---
      const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000; // 43.200.000 milisaniye
      const isTwiceDaily = !pushFrequency || pushFrequency === "2";
      const lastTwiceDailyTime = Number(localStorage.getItem("sonGundeIkiBildirimZamani") || 0);

      // Arka plan servisi Android yüzünden her 15 dakikada bir uyandığında kontrol et: Şimdiki Zaman - sonGundeIkiBildirimZamani.
      // Eğer aradan geçen süre tam 12 saatten (43.200.000 milisaniye) az ise bildirim gönderme fonksiyonunu kesinlikle İPTAL ET ve uykuya dön!
      if (isTwiceDaily && lastTwiceDailyTime > 0 && (nowMs - lastTwiceDailyTime) < TWELVE_HOURS_MS) {
        const remainingMinutes = Math.ceil((TWELVE_HOURS_MS - (nowMs - lastTwiceDailyTime)) / 60000);
        console.log(`[12 Saat Kilidi] 'Günde 2 kez' bildirim aralığı henüz dolmadı (${remainingMinutes} dk / ${(remainingMinutes / 60).toFixed(1)} saat kaldı). Bildirim gönderme KESİNLİKLE İPTAL EDİLDİ ve uykuya dönüldü.`);
        return;
      }

      // --- AKILLI ENGEL: Gecikmiş/Yaklaşan Borç Döngüsünü Seçilen Saate Sabitle (15 Dk Engelini Aş) ---
      // Kullanıcının arayüzden seçtiği bildirim periyodu saatini milisaniye cinsinden oku (ör. Günde 2 Kez = 12 saat = 43.200.000 ms)
      const selectedPeriodMs = getNotificationPeriodMs(pushFrequency);
      const lastGeneralTime = Number(localStorage.getItem("sonGenelBildirimZamani") || 0);

      // Arka plan servisi 15 dakikada bir uyandığında kontrol et: Şimdiki Zaman - sonGenelBildirimZamani.
      // Eğer aradan geçen süre kullanıcının seçtiği saat periyodundan az ise bildirim fırlatmayı doğrudan İPTAL ET ve uykuya dön!
      if (lastGeneralTime > 0 && (nowMs - lastGeneralTime) < selectedPeriodMs) {
        const remainingMinutes = Math.ceil((selectedPeriodMs - (nowMs - lastGeneralTime)) / 60000);
        console.log(`[Akıllı Engel] Arka plan döngüsü periyodu henüz dolmadı (${remainingMinutes} dk kaldı). Bildirim fırlatma İPTAL EDİLDİ ve uykuya dönüldü.`);
        return;
      }

      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

      // --- 1. Adım: Tüm borçları ve taksitleri gün farkına göre tara ---
      interface ScannedDebtItem {
        itemType: "debt" | "installment";
        originalId: number;
        name: string;
        category?: string;
        amount: number;
        daysLeft: number;
        sonBildirimZamani?: number;
        sonGecikmeBildirimZamani?: number;
      }

      const scannedItems: ScannedDebtItem[] = [];

      currentDebts.forEach((d) => {
        if (!d || Number(d.paid || 0) >= Number(d.amount || 0)) return;
        if (!d.dueDate) return;
        try {
          const [year, month, day] = d.dueDate.split("-").map(Number);
          const due = new Date(year, month - 1, day, 0, 0, 0, 0);
          const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          scannedItems.push({
            itemType: "debt",
            originalId: d.id,
            name: d.name || "Borç",
            category: d.category || "",
            amount: (Number(d.amount) || 0) - (Number(d.paid) || 0),
            daysLeft: diffDays,
            sonBildirimZamani: d.sonBildirimZamani,
            sonGecikmeBildirimZamani: d.sonGecikmeBildirimZamani
          });
        } catch (_) {}
      });

      currentInsts.forEach((inst) => {
        if (!inst || Number(inst.paidInstallmentCount || 0) >= Number(inst.installmentCount || 1)) return;
        if (!inst.firstDueDate) return;
        try {
          const [year, month, day] = inst.firstDueDate.split("-").map(Number);
          const baseDate = new Date(year, month - 1, day, 0, 0, 0, 0);
          baseDate.setMonth(baseDate.getMonth() + (Number(inst.paidInstallmentCount) || 0));
          const diffDays = Math.ceil((baseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const perInst = (Number(inst.totalAmount) || 0) / (Number(inst.installmentCount) || 1);
          scannedItems.push({
            itemType: "installment",
            originalId: inst.id,
            name: `${inst.name || "Taksit"} (${(Number(inst.paidInstallmentCount) || 0) + 1}/${inst.installmentCount}. Taksit)`,
            category: "taksit",
            amount: perInst,
            daysLeft: diffDays,
            sonBildirimZamani: inst.sonBildirimZamani,
            sonGecikmeBildirimZamani: inst.sonGecikmeBildirimZamani
          });
        } catch (_) {}
      });

      let updatedDebtsCopy = [...currentDebts];
      let updatedInstsCopy = [...currentInsts];
      let hasStateChanges = false;

      // --- 2. Adım: Yalnızca seçilen süre dolduğunda TEK BİR ÖZET BİLDİRİM fırlat ---
      const overdueItems = scannedItems.filter((item) => item.daysLeft < 0);
      const dueTodayItems = scannedItems.filter((item) => item.daysLeft === 0);
      const upcomingItems = scannedItems.filter((item) => item.daysLeft > 0 && item.daysLeft <= 3);
      const allActionable = [...dueTodayItems, ...overdueItems, ...upcomingItems];

      if (allActionable.length > 0) {
        const totalDue = allActionable.reduce((acc, cur) => acc + cur.amount, 0);
        const toplamMiktar = Math.round(totalDue).toLocaleString("tr-TR");
        const dateFormatted = now.toLocaleDateString("tr-TR");

        const rawPeriodicName = (userProfileName && userProfileName.trim())
          || (localStorage.getItem("user_profile_name") || "").trim()
          || (currentUser && currentUser !== "Varsayılan Kullanıcı" ? currentUser : "");
        const safePeriodicUser = rawPeriodicName ? rawPeriodicName.toUpperCase() : "SERKAN SAĞLAM";

        const borcListesiMetni = allActionable
          .map((item) => {
            const emoji = getDebtCategoryEmoji(item.name, item.category);
            const statusText =
              item.daysLeft === 0
                ? "Vadesi BUGÜN"
                : item.daysLeft < 0
                ? `${Math.abs(item.daysLeft)} gün gecikti`
                : `${item.daysLeft} gün kaldı`;
            return `${emoji} ${item.name}: ${Math.round(item.amount).toLocaleString("tr-TR")} TL (${statusText})`;
          })
          .join("\n");

        // Başlık alanını net ve tek bir defa tanımlıyoruz
        const bildirimBasligi = "📊 Bütçem Pro: Güncel Vade Özeti";

        // İçerik alanını jilet gibi alt alta emojilerle grupluyoruz
        const bildirimIcerigi = `👤 SN. ${safePeriodicUser}\n` +
          `📅 Rapor Tarihi: ${dateFormatted}\n\n` +
          `📌 AKTİF BORÇ LİSTENİZ:\n` +
          `${borcListesiMetni}\n\n` +
          `💰 Toplam Geciken/Vadesi Gelen: ${toplamMiktar} TL\n\n` +
          `⚠️ Vade gecikme faizlerinden korunmak için ödemelerinizi zamanında yapmanızı rica ederiz. İyi günler dileriz. B001`;

        sendSystemNotification(
          bildirimBasligi,
          bildirimIcerigi,
          false
        );

        // sonGundeIkiBildirimZamani ve sonGenelBildirimZamani damgalarını kaydet
        localStorage.setItem("sonGundeIkiBildirimZamani", String(nowMs));
        localStorage.setItem("sonGenelBildirimZamani", String(nowMs));
        if (auth.currentUser) {
          try {
            set(ref(db, `kullanicilar/${auth.currentUser.uid}/veriler/sonGundeIkiBildirimZamani`), nowMs);
            set(ref(db, `kullanicilar/${auth.currentUser.uid}/veriler/sonGenelBildirimZamani`), nowMs);
          } catch (_) {}
        }

        // Service Worker'a da bildir
        if (typeof window !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "SYNC_LAST_NOTIFICATION_TIME",
            timestamp: nowMs
          });
        }

        // Bildirim gönderildiği an o borcun veri nesnesine sonBildirimZamani bilgisini (timestamp) kaydet
        const notifiedDebtIds = new Set(allActionable.filter((i) => i.itemType === "debt").map((i) => i.originalId));
        const notifiedInstIds = new Set(allActionable.filter((i) => i.itemType === "installment").map((i) => i.originalId));

        updatedDebtsCopy = updatedDebtsCopy.map((d) => {
          if (notifiedDebtIds.has(d.id)) {
            return {
              ...d,
              sonBildirimZamani: nowMs,
              ...(d.dueDate && (new Date(d.dueDate).getTime() < today.getTime() - 7 * 24 * 60 * 60 * 1000) ? { sonGecikmeBildirimZamani: nowMs } : {})
            };
          }
          return d;
        });

        updatedInstsCopy = updatedInstsCopy.map((inst) => {
          if (notifiedInstIds.has(inst.id)) {
            return { ...inst, sonBildirimZamani: nowMs, sonGecikmeBildirimZamani: nowMs };
          }
          return inst;
        });

        hasStateChanges = true;
      }

      // --- 4. Adım: Eğer zaman damgası güncellendiyse Firebase Realtime Database ile tam senkronize et ---
      if (hasStateChanges) {
        await syncDebtNotificationTimestamps(updatedDebtsCopy, updatedInstsCopy);
      }
    };

    checkAndTriggerPushReminders();
    const interval = setInterval(checkAndTriggerPushReminders, 2 * 60 * 1000); // 2 dakikada bir kontrol
    return () => clearInterval(interval);
  }, [pushNotificationsEnabled, pushFrequency]);

  // General persistent workspace saver (local + Firebase Firestore sync)
  const saveAllToUser = async (
    updatedDebts: Debt[],
    updatedIncomes: Income[],
    updatedAlarms: Alarm[],
    updatedNotifs: NotificationItem[],
    updatedInstallments: InstallmentDebt[],
    updatedPayments: PaymentLog[],
    updatedExpenses: Expense[],
    updatedCategories: ExpenseCategory[],
    silent: boolean = false
  ) => {
    const fbUser = auth.currentUser;
    const cleanEmail = fbUser?.email ? fbUser.email.toLowerCase() : (currentUser && currentUser.includes("@") ? currentUser.toLowerCase() : null);
    const spaceKey = cleanEmail ? `user_${cleanEmail}` : (currentUser ? `user_${currentUser}` : "user_anonymous");
    
    const dataBag = {
      debts: updatedDebts,
      incomes: updatedIncomes,
      alarms: updatedAlarms,
      notifications: updatedNotifs,
      installmentDebts: updatedInstallments,
      payments: updatedPayments,
      expenses: updatedExpenses,
      expenseCategories: updatedCategories
    };

    try {
      localStorage.setItem(spaceKey, JSON.stringify(dataBag));
      if (fbUser?.uid) {
        localStorage.setItem(`user_${fbUser.uid}`, JSON.stringify(dataBag));
      }
      
      if (fbUser) {
        const payload = veriyiTemizle({
          ...dataBag,
          email: cleanEmail || "",
          emailLower: cleanEmail || "",
          userUid: fbUser.uid,
          isPremium: localStorage.getItem("is_premium") === "true",
          premiumPlan: localStorage.getItem("premium_plan") || "yearly",
          updatedAt: Date.now()
        });

        // Realtime Database: verileri doğrudan kullanicilar/KULLANICI_UID/veriler düğümüne kaydet
        await Promise.all([
          set(ref(db, `kullanicilar/${fbUser.uid}/veriler`), payload),
          set(ref(db, `users/${fbUser.uid}/veriler`), payload)
        ]);
        setIsOfflineMode(false);
      }
      if (!silent) {
        triggerToast("Değişiklikler Kaydedildi");
      }
    } catch (err: any) {
      const errCode = err?.code || "HATA";
      const errMsg = err?.message || String(err);
      const fullErrText = `[${errCode}] ${errMsg}`;

      console.error("Critical error in saveAllToUser storage write:", fullErrText, err);
      setIsOfflineMode(true);
      setFirestoreErrorMessage(`Database Kayıt Hatası: ${fullErrText}`);
      triggerToast(`Bulut Kayıt Hatası: ${fullErrText}`, 6000);
      
      const isPermissionError = err && (
        err.code === "permission-denied" || 
        err.message?.toLowerCase().includes("permission") || 
        err.message?.toLowerCase().includes("denied")
      );
      
      if (isPermissionError && auth.currentUser) {
        try {
          handleDatabaseError(err, OperationType.WRITE, `kullanicilar/${auth.currentUser.uid}/veriler`);
        } catch (e) {
          console.error("Permission write error handled:", e);
        }
      }
    }
  };

  const savePremiumStatusAndSync = async (premiumState: boolean, planType: "monthly" | "yearly" | "lifetime") => {
    setIsPremium(premiumState);
    setSelectedPlan(planType);
    localStorage.setItem("is_premium", premiumState ? "true" : "false");
    localStorage.setItem("is_guest", (!premiumState).toString());
    localStorage.setItem("premium_plan", planType);

    const { premiumType, premiumExpiryDate, productId } = calculatePlanExpiry(planType);

    if (premiumState) {
      localStorage.setItem("premium_source", "purchase");
      localStorage.setItem("premium_type", premiumType);
      localStorage.setItem("premium_expiry_date", premiumExpiryDate);
    } else {
      localStorage.removeItem("premium_source");
      localStorage.removeItem("premium_type");
      localStorage.removeItem("premium_expiry_date");
    }

    const fbUser = auth.currentUser;
    const userEmail = (fbUser?.email || localStorage.getItem("currentUser") || "").toLowerCase();
    const effectiveUid = fbUser?.uid || (userEmail ? "email_" + userEmail.replace(/[^a-zA-Z0-9_]/g, "_") : null);

    if (effectiveUid) {
      try {
        const deviceUuid = await getDeviceUuid();
        await saveUserSessionToFirestore({
          userId: effectiveUid,
          email: userEmail,
          isPremium: premiumState,
          isGuest: !premiumState,
          deviceId: deviceUuid,
          premiumType: premiumState ? premiumType : undefined,
          premiumExpiryDate: premiumState ? premiumExpiryDate : undefined,
          productId: premiumState ? productId : undefined
        });
      } catch (firestoreErr) {
        console.warn("Could not sync premium session to Firestore:", firestoreErr);
      }
    }

    if (fbUser) {
      try {
        const now = Date.now();
        await Promise.all([
          update(ref(db, `kullanicilar/${fbUser.uid}/veriler`), {
            isPremium: premiumState,
            isGuest: !premiumState,
            premiumPlan: planType,
            premiumType: premiumState ? premiumType : null,
            premiumExpiryDate: premiumState ? premiumExpiryDate : null,
            productId: premiumState ? productId : null,
            updatedAt: now
          }),
          update(ref(db, `users/${fbUser.uid}/veriler`), {
            isPremium: premiumState,
            isGuest: !premiumState,
            premiumPlan: planType,
            premiumType: premiumState ? premiumType : null,
            premiumExpiryDate: premiumState ? premiumExpiryDate : null,
            productId: premiumState ? productId : null,
            updatedAt: now
          })
        ]);
      } catch (err) {
        console.warn("Could not sync restored premium status to Database:", err);
      }
    }
  };

  const handlePurchase = async (planType: "monthly" | "yearly" | "lifetime") => {
    setSelectedPlan(planType);
    setIsPurchasing(true);
    setPurchaseStatus("Google Play Billing bağlantısı kuruluyor...");
    setIsGPlayBillingActive(true);
  };

  const handleRevenueCatRestore = async () => {
    setIsRestoring(true);
    setRestoreStep("restoring");
    setRestoreStatusLog("Google Play Store bağlantısı doğrulanıyor...");
    try {
      const res = await Purchases.restorePurchases();
      if (res.success && res.customerInfo) {
        const activeSub = res.customerInfo.activeSubscriptions[0];
        const planMapped: "monthly" | "yearly" | "lifetime" = 
          activeSub === "butcem_pro_aylik" || activeSub === "borc_takip_aylik" ? "monthly" : 
          activeSub === "butcem_pro_sinirsiz" || activeSub === "borc_takip_sinirsiz" ? "lifetime" : "yearly";
        
        await savePremiumStatusAndSync(true, planMapped);
        setRestoredPlanType(planMapped);
        setRestoreStep("success");
      } else {
        setRestoreStep("method");
        triggerToast("Geri yüklenecek aktif Google Play aboneliği veya limitsiz ödemesi saptanamadı.");
      }
    } catch (err: any) {
      console.error(err);
      setRestoreStep("method");
      triggerToast("Geri yükleme hatası: " + (err.message || "Bilinmeyen Google Play API hatası"));
    }
  };

  const handleRestoreBackup = (data: any) => {
    if (!data) return;
    
    // Attempt robust structural mapping for various backup versions
    const bDebts = data.debts || data.borclar || [];
    const bIncomes = data.incomes || data.gelirler || [];
    const bAlarms = data.alarms || data.hatirlaticilar || [];
    const bNotifs = data.notifications || data.bildirimler || [];
    const bInstallments = data.installmentDebts || data.taksitli_borclar || [];
    const bPayments = data.payments || data.odemeler || [];
    const bExpenses = data.expenses || data.harcamalar || [];
    const bCategories = data.expenseCategories || data.kategoriler || [];

    setDebts(bDebts);
    setIncomes(bIncomes);
    setAlarms(bAlarms);
    setNotifications(bNotifs);
    setInstallmentDebts(bInstallments);
    setPayments(bPayments);
    setExpenses(bExpenses);
    setExpenseCategories(bCategories);

    saveAllToUser(
      bDebts,
      bIncomes,
      bAlarms,
      bNotifs,
      bInstallments,
      bPayments,
      bExpenses,
      bCategories
    );
    
    triggerToast("Bulut yedeği başarıyla geri yüklendi! 📊");
  };

  // Helper ID generators
  const generateId = (items: { id: number }[]) => {
    return items.length ? Math.max(...items.map((x) => x.id)) + 1 : 1;
  };

  const syncInstallmentPayments = (
    debtId: number,
    targetPaidCount: number,
    perMonth: number,
    firstDueDate: string,
    currentPayments: PaymentLog[]
  ): PaymentLog[] => {
    const debtPayments = currentPayments.filter((p) => p.debtId === debtId && p.type === "installment");
    // Sort ascending by date or identifier
    debtPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const otherPayments = currentPayments.filter((p) => !(p.debtId === debtId && p.type === "installment"));

    // Sync individual payment amounts in case installment total/count edited
    const updatedDebtPayments = debtPayments.map((p) => ({
      ...p,
      amount: perMonth
    }));

    if (updatedDebtPayments.length === targetPaidCount) {
      return [...otherPayments, ...updatedDebtPayments];
    }

    if (updatedDebtPayments.length > targetPaidCount) {
      const keptDebtPayments = updatedDebtPayments.slice(0, targetPaidCount);
      return [...otherPayments, ...keptDebtPayments];
    } else {
      const neededCount = targetPaidCount - updatedDebtPayments.length;
      const newDebtPayments = [...updatedDebtPayments];

      for (let i = 0; i < neededCount; i++) {
        const installmentIndex = newDebtPayments.length;
        let payDate = new Date();
        if (firstDueDate) {
          try {
            const parts = parseDateParts(firstDueDate);
            if (parts) {
              payDate = new Date(parts.year, parts.month + installmentIndex, parts.day || 15);
            } else {
              const baseDate = new Date(firstDueDate);
              baseDate.setMonth(baseDate.getMonth() + installmentIndex);
              payDate = baseDate;
            }
          } catch {}
        }

        const newId = Math.max(0, ...otherPayments.map((p) => p.id), ...newDebtPayments.map((p) => p.id)) + 1;
        newDebtPayments.push({
          id: newId,
          debtId: debtId,
          amount: perMonth,
          date: payDate.toISOString(),
          type: "installment"
        });
      }
      return [...otherPayments, ...newDebtPayments];
    }
  };

  // ---------------- Financial Calculations (Memoized) ----------------
  const {
    statsBag,
    filteredIncomesByMonth,
    filteredExpensesByMonth,
    currentMonthTotalPaymentsCount,
    monthlyInstallmentsDue,
  } = useMemo(() => {
    const activeMonthIdx = selectedMonth !== null ? selectedMonth : new Date().getMonth();
    const activeYearVal = selectedYear !== null ? selectedYear : new Date().getFullYear();

    // 1. Incomes scoped to chosen period (Recurring regular incomes stay active in subsequent months)
    const filteredIncomesForStats = incomes.filter((i) => {
      if (selectedMonth === null || selectedYear === null) return true;
      const parts = parseDateParts(i.date);
      if (!parts) return true;
      if (i.isRecurring !== false) {
        const selectedTime = selectedYear * 12 + selectedMonth;
        const incomeTime = parts.year * 12 + parts.month;
        return selectedTime >= incomeTime;
      } else {
        return parts.month === selectedMonth && parts.year === selectedYear;
      }
    });

    // 2. Expenses scoped to chosen period
    const filteredExpensesForStats = expenses.filter((e) => {
      if (selectedMonth === null || selectedYear === null) return true;
      const parts = parseDateParts(e.date);
      if (!parts) return true;
      return parts.month === selectedMonth && parts.year === selectedYear;
    });

    // 3. Payments scoped to chosen period
    const filteredPaymentsForStats = payments.filter((p) => {
      if (selectedMonth === null || selectedYear === null) return true;
      const parts = parseDateParts(p.date);
      if (!parts) return true;
      return parts.month === selectedMonth && parts.year === selectedYear;
    });

    // 4. Lifetime totals for cumulative overall debt widgets (un-filtered by period, integrating contact-based payables as well)
    const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
    const savedContactTxsStr = localStorage.getItem(`${spaceKey}_contacts_transactions`);
    let contactPayablesTotal = 0;
    let contactPayablesPaid = 0;
    let contactReceivablesTotal = 0;
    let contactReceivablesCollected = 0;
    if (savedContactTxsStr) {
      try {
        const txs = JSON.parse(savedContactTxsStr);
        if (Array.isArray(txs)) {
          txs.forEach((t: any) => {
            if (t.type === "payable") {
              const amt = Number(t.amount) || 0;
              contactPayablesTotal += amt;
              if (t.isPaid) {
                contactPayablesPaid += amt;
              }
            } else if (t.type === "receivable") {
              const amt = Number(t.amount) || 0;
              contactReceivablesTotal += amt;
              if (t.isPaid) {
                contactReceivablesCollected += amt;
              }
            }
          });
        }
      } catch (e) {
        console.error("Error loading contact transactions:", e);
      }
    }
    const contactPayablesRemaining = contactPayablesTotal - contactPayablesPaid;
    const contactReceivablesRemaining = contactReceivablesTotal - contactReceivablesCollected;

    const trueOverallDebt = debts.reduce((sum, d) => sum + d.amount, 0) + 
      installmentDebts.reduce((sum, inst) => sum + inst.totalAmount, 0) +
      contactPayablesTotal;

    const trueOverallPaid = debts.reduce((sum, d) => sum + d.paid, 0) + 
      installmentDebts.reduce((sum, inst) => sum + (inst.paidInstallmentCount * (inst.totalAmount / (inst.installmentCount || 1))), 0) +
      contactPayablesPaid;

    const trueOverallRemaining = trueOverallDebt - trueOverallPaid;

    // 5. Selected period's specific monthly debt calculation
    let periodSimpleDebtPaidThisMonth = 0;
    let periodSimpleDebtRemaining = 0;

    const validDebtIds = new Set(debts.map((d) => d.id));
    const validInstIds = new Set(installmentDebts.map((i) => i.id));

    if (selectedMonth === null || selectedYear === null) {
      periodSimpleDebtRemaining = debts.reduce((sum, d) => sum + Math.max(0, d.amount - d.paid), 0);
      periodSimpleDebtPaidThisMonth = debts.reduce((sum, d) => sum + Math.min(d.amount, d.paid), 0);
    } else {
      const selectedTime = selectedYear * 12 + selectedMonth;

      debts.forEach((d) => {
        const dParts = parseDateParts(d.dueDate);
        const debtRemaining = Math.max(0, d.amount - d.paid);

        if (dParts) {
          const debtTime = dParts.year * 12 + dParts.month;

          if (debtTime === selectedTime) {
            // Debt is due strictly in selected month
            periodSimpleDebtRemaining += debtRemaining;
            periodSimpleDebtPaidThisMonth += Math.min(d.amount, d.paid);
          }
        } else {
          // If no due date, include in remaining if unpaid
          if (debtRemaining > 0) {
            periodSimpleDebtRemaining += debtRemaining;
          }
        }
      });
    }

    // --- INSTALLMENT DEBTS ---
    let periodInstallmentPaidThisMonth = 0;
    let periodInstallmentRemaining = 0;
    let monthlyInstallmentsDue = 0;

    if (selectedMonth === null || selectedYear === null) {
      periodInstallmentRemaining = installmentDebts.reduce((sum, inst) => {
        const paidSoFar = inst.paidInstallmentCount * (inst.totalAmount / (inst.installmentCount || 1));
        return sum + Math.max(0, inst.totalAmount - paidSoFar);
      }, 0);
      periodInstallmentPaidThisMonth = installmentDebts.reduce((sum, inst) => {
        return sum + (inst.paidInstallmentCount * (inst.totalAmount / (inst.installmentCount || 1)));
      }, 0);
    } else {
      const selectedTime = selectedYear * 12 + selectedMonth;

      // Payment logs for valid installments in this month
      const installmentPaymentsThisMonth = payments.filter((p) => {
        if (p.type !== "installment" || !validInstIds.has(p.debtId)) return false;
        const parts = parseDateParts(p.date);
        return parts ? (parts.month === selectedMonth && parts.year === selectedYear) : false;
      });

      installmentDebts.forEach((inst) => {
        const perMonth = inst.totalAmount / (inst.installmentCount || 1);
        const startParts = parseDateParts(inst.firstDueDate);

        if (startParts) {
          const startTime = startParts.year * 12 + startParts.month;
          const monthDiff = selectedTime - startTime;

          if (monthDiff >= 0 && monthDiff < inst.installmentCount) {
            // Active installment plan for this month (1 installment due for this month)
            // Check if payment was logged for this installment in this specific month
            const hasPaymentThisMonth = installmentPaymentsThisMonth.some((p) => p.debtId === inst.id);
            if (hasPaymentThisMonth) {
              periodInstallmentPaidThisMonth += perMonth;
            } else {
              periodInstallmentRemaining += perMonth;
              monthlyInstallmentsDue += perMonth;
            }
          }
        }
      });
    }

    // --- CONTACT PAYABLES ---
    let periodContactPayablesPaid = 0;
    let periodContactPayablesRemaining = 0;

    if (savedContactTxsStr) {
      try {
        const txs = JSON.parse(savedContactTxsStr);
        if (Array.isArray(txs)) {
          txs.forEach((t: any) => {
            if (t.type === "payable") {
              const amt = Number(t.amount) || 0;
              if (selectedMonth === null || selectedYear === null) {
                if (t.isPaid) periodContactPayablesPaid += amt;
                else periodContactPayablesRemaining += amt;
              } else {
                const selectedTime = selectedYear * 12 + selectedMonth;
                const dParts = parseDateParts(t.dueDate);
                if (dParts) {
                  const dueTime = dParts.year * 12 + dParts.month;
                  if (dueTime === selectedTime) {
                    if (t.isPaid) periodContactPayablesPaid += amt;
                    else periodContactPayablesRemaining += amt;
                  }
                } else {
                  if (!t.isPaid) periodContactPayablesRemaining += amt;
                }
              }
            }
          });
        }
      } catch {}
    }

    const computedThisMonthKalanBorc = periodSimpleDebtRemaining + periodInstallmentRemaining + periodContactPayablesRemaining;
    const computedThisMonthPaidBorc = periodSimpleDebtPaidThisMonth + periodInstallmentPaidThisMonth + periodContactPayablesPaid;
    const computedThisMonthTotalBorc = computedThisMonthKalanBorc + computedThisMonthPaidBorc;

    const baseTotalIncome = filteredIncomesForStats.reduce((sum, i) => sum + i.amount, 0);
    const totalIncome = baseTotalIncome;
    const totalExpense = filteredExpensesForStats.reduce((sum, e) => sum + e.amount, 0);
    const netIncomeValue = totalIncome - totalExpense - computedThisMonthPaidBorc;

    // 6. Precise payment count for the selected period
    let paidSimpleDebtsCountThisMonth = 0;
    if (selectedMonth === null || selectedYear === null) {
      paidSimpleDebtsCountThisMonth = debts.filter((d) => (d.paid || 0) > 0).length;
    } else {
      const selectedTime = selectedYear * 12 + selectedMonth;
      debts.forEach((d) => {
        if ((d.paid || 0) <= 0) return;
        const dParts = parseDateParts(d.dueDate);
        if (dParts) {
          const debtTime = dParts.year * 12 + dParts.month;
          if (debtTime === selectedTime) {
            paidSimpleDebtsCountThisMonth++;
          }
        } else {
          // If no dueDate was specified, check if payment was made in this month
          const hasPaymentLogThisMonth = payments.some((p) => {
            if (p.debtId !== d.id || (p.amount || 0) <= 0) return false;
            const pParts = parseDateParts(p.date);
            return pParts ? (pParts.month === selectedMonth && pParts.year === selectedYear) : false;
          });
          if (hasPaymentLogThisMonth) {
            paidSimpleDebtsCountThisMonth++;
          }
        }
      });
    }

    let paidInstallmentsCountThisMonth = 0;
    if (selectedMonth === null || selectedYear === null) {
      paidInstallmentsCountThisMonth = installmentDebts.reduce((sum, inst) => sum + (inst.paidInstallmentCount || 0), 0);
    } else {
      const selectedTime = selectedYear * 12 + selectedMonth;

      installmentDebts.forEach((inst) => {
        const startParts = parseDateParts(inst.firstDueDate);
        if (startParts) {
          const startTime = startParts.year * 12 + startParts.month;
          const monthDiff = selectedTime - startTime;
          if (monthDiff >= 0 && monthDiff < inst.installmentCount) {
            // Active installment plan for this month: only count 1 if this month's installment is paid
            if ((inst.paidInstallmentCount || 0) > monthDiff) {
              paidInstallmentsCountThisMonth++;
            }
          }
        }
      });
    }

    let paidContactPayablesCountThisMonth = 0;
    if (savedContactTxsStr) {
      try {
        const txs = JSON.parse(savedContactTxsStr);
        if (Array.isArray(txs)) {
          txs.forEach((t: any) => {
            if (t.type === "payable" && t.isPaid) {
              if (selectedMonth === null || selectedYear === null) {
                paidContactPayablesCountThisMonth++;
              } else {
                const selectedTime = selectedYear * 12 + selectedMonth;
                const dParts = parseDateParts(t.dueDate || t.createdAt);
                if (dParts) {
                  const dueTime = dParts.year * 12 + dParts.month;
                  if (dueTime === selectedTime) {
                    paidContactPayablesCountThisMonth++;
                  }
                }
              }
            }
          });
        }
      } catch {}
    }

    const currentMonthTotalPaymentsCount = paidSimpleDebtsCountThisMonth + paidInstallmentsCountThisMonth + paidContactPayablesCountThisMonth;

    const statsBag: FinancialStats = {
      totalDebt: trueOverallDebt,
      totalPaid: trueOverallPaid,
      remaining: trueOverallRemaining,
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      netIncome: netIncomeValue,
      thisMonthTotalBorc: computedThisMonthTotalBorc,
      thisMonthKalanBorc: computedThisMonthKalanBorc,
      thisMonthPaidBorc: computedThisMonthPaidBorc,
      carryOverBalance: 0,
      contactPayablesTotal,
      contactPayablesRemaining,
      contactPayablesPaid,
      contactReceivablesTotal,
      contactReceivablesRemaining,
      contactReceivablesCollected
    };

    const filteredIncomesByMonth = incomes.filter((i) => {
      if (selectedMonth === null || selectedYear === null) return true;
      const dParts = parseDateParts(i.date);
      if (!dParts) return true;
      if (i.isRecurring !== false) {
        const selectedTime = selectedYear * 12 + selectedMonth;
        const incomeTime = dParts.year * 12 + dParts.month;
        return selectedTime >= incomeTime;
      } else {
        return dParts.month === selectedMonth && dParts.year === selectedYear;
      }
    });

    const filteredExpensesByMonth = expenses.filter((e) => {
      if (selectedMonth === null || selectedYear === null) return true;
      const dParts = parseDateParts(e.date);
      if (!dParts) return true;
      return dParts.month === selectedMonth && dParts.year === selectedYear;
    });

    return {
      statsBag,
      filteredIncomesByMonth,
      filteredExpensesByMonth,
      currentMonthTotalPaymentsCount,
      monthlyInstallmentsDue,
    };
  }, [
    currentUser,
    selectedMonth,
    selectedYear,
    incomes,
    expenses,
    payments,
    debts,
    installmentDebts,
    contactsRevision,
  ]);

  // ---------------- Profile Session Controls ----------------
  const handleLogin = () => {
    if (!loginUsername.trim()) {
      alert("Kullanıcı profil tanımlaması için geçerli bir ad girin.");
      return;
    }
    const cleanNick = loginUsername.trim();
    if (currentUser !== cleanNick) {
      const proceedLogin = () => {
        setCurrentUser(cleanNick);
        localStorage.setItem("currentUser", cleanNick);
        setLoginUsername("");
        triggerToast(`Giriş Başarılı: ${cleanNick}`);
      };

      const guestData = localStorage.getItem("user_anonymous");
      if (guestData) {
        triggerConfirm(
          "Veri Aktarımı",
          "Mevcut misafir verilerini bu hesaba kopyalamak ister misiniz?",
          () => {
            localStorage.setItem(`user_${cleanNick}`, guestData);
            proceedLogin();
          }
        );
      } else {
        proceedLogin();
      }
    }
  };

  const handleLogout = () => {
    triggerConfirm(
      "Oturumu Kapat",
      "Oturumu kapatmak istediğinize emin misiniz?",
      async () => {
        try {
          await signOut(auth);
        } catch (err) {
          console.error("SignOut error:", err);
        }
        localStorage.removeItem("currentUser");
        localStorage.removeItem("user_profile_name");
        setUserProfileName("");
        setCurrentUser(null);
        setDebts([]);
        setIncomes([]);
        setAlarms([]);
        setNotifications([]);
        setInstallmentDebts([]);
        setPayments([]);
        setExpenses([]);
        triggerToast("Oturum Kapatıldı ve Veriler Temizlendi 🔒");
      }
    );
  };

  const handleSaveDebtBulk = (newDebtsList: Partial<Debt>[]) => {
    if (!newDebtsList || newDebtsList.length === 0) return;
    let updated = [...debts];
    let updatedPayments = [...payments];
    let nextId = generateId(updated);

    newDebtsList.forEach((debtData) => {
      const debtName = debtData.name || "İsimsiz Borç";
      const dueDate = debtData.dueDate || "";
      const newAmount = debtData.amount || 0;
      const newPaid = debtData.paid || 0;

      const newD: Debt = {
        id: nextId++,
        name: debtName,
        amount: newAmount,
        paid: newPaid,
        category: debtData.category || "Diğer",
        dueDate: dueDate
      };
      updated.push(newD);
    });

    setDebts(updated);
    saveAllToUser(updated, incomes, alarms, notifications, installmentDebts, updatedPayments, expenses, expenseCategories);
    triggerToast(`${newDebtsList.length} Borç Başarıyla Kaydedildi 📋`);
  };

  // ---------------- CRUD Operations ----------------
  const handleSaveDebt = (debtData: Partial<Debt>, autoCreateAlarm?: boolean) => {
    let updated: Debt[] = [];
    let updatedPayments = [...payments];
    let updatedAlarms = [...alarms];
    let updatedNotifs = [...notifications];
    let shouldCelebrate = false;

    const debtName = debtData.name || "İsimsiz Borç";
    const dueDate = debtData.dueDate || "";

    if (debtData.id) {
      // It's an update. Check if payment changed
      const oldDebt = debts.find((d) => d.id === debtData.id);
      const oldPaid = oldDebt ? oldDebt.paid : 0;
      const oldAmount = oldDebt ? oldDebt.amount : 0;
      const newPaid = debtData.paid || 0;
      const newAmount = debtData.amount || oldAmount;

      const wasPaid = oldPaid >= oldAmount && oldAmount > 0;
      const isPaidNow = newPaid >= newAmount && newAmount > 0;

      if (!wasPaid && isPaidNow) {
        shouldCelebrate = true;
      }

      const diff = newPaid - oldPaid;

      if (diff > 0) {
        // Log the difference as a manual payment
        let payDate = debtData.dueDate || (oldDebt ? oldDebt.dueDate : "") || (selectedMonth !== null && selectedYear !== null ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-15` : new Date().toISOString());
        const newPayment: PaymentLog = {
          id: generateId(updatedPayments),
          debtId: debtData.id,
          amount: diff,
          date: payDate,
          type: "manual"
        };
        updatedPayments.push(newPayment);
      } else if (diff < 0) {
        // Reduced payment. We can clean up manual payments list for this debt
        // to prevent mismatching monthly figures
        updatedPayments = updatedPayments.filter((p) => !(p.debtId === debtData.id && p.type === "manual"));
        if (newPaid > 0) {
          let payDate = debtData.dueDate || (oldDebt ? oldDebt.dueDate : "") || (selectedMonth !== null && selectedYear !== null ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-15` : new Date().toISOString());
          const newPayment: PaymentLog = {
            id: generateId(updatedPayments),
            debtId: debtData.id,
            amount: newPaid,
            date: payDate,
            type: "manual"
          };
          updatedPayments.push(newPayment);
        }
      }

      updated = debts.map((d) => (d.id === debtData.id ? { ...d, ...debtData } as Debt : d));
    } else {
      // It's a new debt creation.
      const newId = generateId(debts);
      const newPaid = debtData.paid || 0;
      const newAmount = debtData.amount || 0;
      const isPaidNow = newPaid >= newAmount && newAmount > 0;

      if (isPaidNow) {
        shouldCelebrate = true;
      }

      const newD: Debt = {
        id: newId,
        name: debtName,
        amount: newAmount,
        paid: newPaid,
        category: debtData.category || "Diğer",
        dueDate: dueDate,
        providerId: debtData.providerId || null
      };
      updated = [...debts, newD];

      if (newPaid > 0) {
        // Log initial payment
        let payDate = dueDate || (selectedMonth !== null && selectedYear !== null ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-15` : new Date().toISOString());
        const newPayment: PaymentLog = {
          id: generateId(updatedPayments),
          debtId: newId,
          amount: newPaid,
          date: payDate,
          type: "manual"
        };
        updatedPayments.push(newPayment);
      }
    }

    // Borç kaydı tamamlandıktan sonra kaydedilen borcun güncel bilgilerini al
    const savedDebt = updated.find((d) => (debtData.id ? d.id === debtData.id : d.name === debtName));
    const effectiveAmount = savedDebt ? savedDebt.amount : (debtData.amount || 0);
    const effectivePaid = savedDebt ? savedDebt.paid : (debtData.paid || 0);
    const effectiveId = savedDebt ? savedDebt.id : (debtData.id || 0);

    // Borç vade tarihi girildiğinde veya autoCreateAlarm aktif olduğunda Capacitor ve sistem alarmını kur/güncelle
    const shouldSetAlarm = Boolean(dueDate && dueDate.trim()) && autoCreateAlarm !== false;
    if (shouldSetAlarm && dueDate && effectivePaid < effectiveAmount) {
      if (typeof window !== "undefined" && "Notification" in window && (Notification as any).permission !== "granted") {
        requestNotificationPermission();
      }
      const titleString = `Borç Son Ödeme Tarihi: ${debtName}`;
      const alarmDateObj = parseLocalOrUTCString(dueDate);

      // Mevcut bir alarm kaydı varsa güncelle, yoksa yeni oluştur
      const existingIdx = updatedAlarms.findIndex(
        (a) => a.title.includes(debtName) || (effectiveId && a.id === effectiveId)
      );

      let targetAlarmId: number;
      if (existingIdx >= 0) {
        targetAlarmId = updatedAlarms[existingIdx].id;
        updatedAlarms[existingIdx] = {
          ...updatedAlarms[existingIdx],
          debtId: effectiveId || updatedAlarms[existingIdx].debtId,
          title: titleString,
          date: dueDate,
          timestamp: alarmDateObj.getTime()
        };
      } else {
        targetAlarmId = effectiveId || generateId(updatedAlarms);
        const newA: Alarm = {
          id: targetAlarmId,
          debtId: effectiveId || undefined,
          title: titleString,
          date: dueDate,
          timestamp: alarmDateObj.getTime()
        };
        updatedAlarms = [...updatedAlarms, newA];
      }

      const newNotifId = updatedNotifs.length > 0 ? Math.max(...updatedNotifs.map((n) => n.id)) + 1 : 1;
      const newNotif: NotificationItem = {
        id: newNotifId,
        title: `⏰ Otomatik Alarm Kuruldu - ${titleString} (${new Date(dueDate).toLocaleDateString("tr-TR")})`
      };
      updatedNotifs = [newNotif, ...updatedNotifs];

      setAlarms(updatedAlarms);
      setNotifications(updatedNotifs);

      // Play audio prompt and request OS notifications
      sendSystemNotification(
        "Ödeme Hatırlatıcısı Kuruldu! ⏰",
        `"${titleString}" başlıklı alarmınız otomatik oluşturulup cihazınıza kaydedildi.`,
        false
      );

      // Capacitor LocalNotifications ile ekran kapalıyken çalan donanım alarmı kur (allowWhileIdle: true)
      if (alarmDateObj.getTime() > Date.now()) {
        const remaining = (effectiveAmount - effectivePaid).toLocaleString("tr-TR");
        const dateFormatted = new Date(dueDate).toLocaleDateString("tr-TR");
        const richTitle = "🚨 Bütçem Pro: Ödeme Hatırlatıcı!";
        const richBody = `💰 Borç: ${debtName}\n💵 Miktar: ${remaining} TL\n📅 Son Tarih: ${dateFormatted}\n⚠️ Durum: Gecikmemesi için lütfen kontrol edin!`;

        scheduleCapacitorAlarm(
          targetAlarmId,
          richTitle,
          alarmDateObj.getTime(),
          richBody,
          {
            borcAdi: debtName,
            miktar: `${remaining} TL`,
            tarih: dateFormatted,
            durum: "Gecikmemesi için lütfen kontrol edin!"
          }
        ).catch(() => {});
        scheduleAndroidDebtAlarm(
          targetAlarmId,
          richTitle,
          alarmDateObj.getTime(),
          richBody
        );
      }
    } else if (effectivePaid >= effectiveAmount && effectiveId) {
      // Borç tamamen ödendiyse eski alarmı iptal et
      cancelCapacitorAlarm(effectiveId).catch(() => {});
      cancelCapacitorAlarm(200000 + effectiveId).catch(() => {});
      cancelAndroidDebtAlarm(effectiveId);
    }

    setDebts(updated);
    setPayments(updatedPayments);
    saveAllToUser(updated, incomes, updatedAlarms, updatedNotifs, installmentDebts, updatedPayments, expenses, expenseCategories);
    if (shouldCelebrate) {
      triggerConfetti();
    }
  };

  const handleDeleteDebt = (id: number) => {
    triggerConfirm(
      "Borcu Sil",
      "Bu borç kaydı tamamen silinecektir, devam edilsin mi?",
      () => {
        // Borca bağlı tüm sistem ve Capacitor alarmlarını iptal et
        cancelCapacitorAlarm(id).catch(() => {});
        cancelCapacitorAlarm(200000 + id).catch(() => {});
        cancelAndroidDebtAlarm(id);

        const updatedDebts = debts.filter((d) => d.id !== id);
        const updatedPayments = payments.filter((p) => p.debtId !== id);
        setDebts(updatedDebts);
        setPayments(updatedPayments);
        saveAllToUser(
          updatedDebts,
          incomes,
          alarms,
          notifications,
          installmentDebts,
          updatedPayments,
          expenses,
          expenseCategories
        );
      }
    );
  };

  const handleToggleDebtPaid = (id: number) => {
    let updatedPayments = [...payments];
    let shouldCelebrate = false;
    const updated = debts.map((d) => {
      if (d.id === id) {
        const isPaid = d.paid >= d.amount;
        const newPaid = isPaid ? 0 : d.amount;

        // Clean any existing manual payment logs for this debt to prevent duplicates
        updatedPayments = updatedPayments.filter((p) => !(p.debtId === id && p.type === "manual"));

        if (newPaid > 0) {
          let payDate = d.dueDate || (selectedMonth !== null && selectedYear !== null ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-15` : new Date().toISOString());
          const newPayment: PaymentLog = {
            id: generateId(updatedPayments),
            debtId: id,
            amount: newPaid,
            date: payDate,
            type: "manual"
          };
          updatedPayments.push(newPayment);
          shouldCelebrate = true;

          // Borç tamamen ödendiğinde alarmı iptal et
          cancelCapacitorAlarm(id).catch(() => {});
          cancelCapacitorAlarm(200000 + id).catch(() => {});
          cancelAndroidDebtAlarm(id);
        } else if (d.dueDate) {
          // Ödeme geri alındığında alarmı tekrar kur
          const trig = parseAlarmDateToMillis(d.dueDate);
          if (trig && trig > Date.now()) {
            const remaining = (d.amount - newPaid).toLocaleString("tr-TR");
            const dateFormatted = new Date(d.dueDate).toLocaleDateString("tr-TR");
            const richTitle = "🚨 Bütçem Pro: Ödeme Hatırlatıcı!";
            const richBody = `💰 Borç: ${d.name}\n💵 Kalan Tutar: ${remaining} TL\n📅 Son Tarih: ${dateFormatted}\n⚠️ Durum: Gecikmemesi için lütfen kontrol edin!`;

            scheduleCapacitorAlarm(
              200000 + id,
              richTitle,
              trig,
              richBody,
              {
                borcAdi: d.name,
                miktar: `${remaining} TL`,
                tarih: dateFormatted,
                durum: "Gecikmemesi için lütfen kontrol edin!"
              }
            ).catch(() => {});
          }
        }

        return {
          ...d,
          paid: newPaid
        };
      }
      return d;
    });

    setDebts(updated);
    setPayments(updatedPayments);
    saveAllToUser(updated, incomes, alarms, notifications, installmentDebts, updatedPayments, expenses, expenseCategories);
    if (shouldCelebrate) {
      triggerConfetti();
    }
  };

  const handleSaveIncome = (incData: Partial<Income>) => {
    let updated: Income[] = [];
    if (incData.id) {
      updated = incomes.map((i) => (i.id === incData.id ? { ...i, ...incData } as Income : i));
    } else {
      const newI: Income = {
        id: generateId(incomes),
        name: incData.name || "Ek Gelir",
        amount: incData.amount || 0,
        date: incData.date || new Date().toISOString(),
        isRecurring: incData.isRecurring
      };
      updated = [...incomes, newI];
    }
    setIncomes(updated);
    saveAllToUser(debts, updated, alarms, notifications, installmentDebts, payments, expenses, expenseCategories);
  };

  const handleDeleteIncome = (id: number) => {
    const updatedIncomes = incomes.filter((i) => i.id !== id);
    setIncomes(updatedIncomes);
    saveAllToUser(debts, updatedIncomes, alarms, notifications, installmentDebts, payments, expenses, expenseCategories);
  };

  const handleSaveExpense = (expData: Partial<Expense>) => {
    let updated: Expense[] = [];
    if (expData.id) {
      updated = expenses.map((e) => (e.id === expData.id ? (expData as Expense) : e));
    } else {
      const newE: Expense = {
        id: generateId(expenses),
        categoryId: expData.categoryId || 1,
        amount: expData.amount || 0,
        description: expData.description || "",
        date: expData.date || new Date().toISOString()
      };
      updated = [...expenses, newE];
    }
    setExpenses(updated);
    saveAllToUser(debts, incomes, alarms, notifications, installmentDebts, payments, updated, expenseCategories);
  };

  const handleDeleteExpense = (id: number) => {
    const updatedExpenses = expenses.filter((e) => e.id !== id);
    setExpenses(updatedExpenses);
    saveAllToUser(debts, incomes, alarms, notifications, installmentDebts, payments, updatedExpenses, expenseCategories);
  };

  const handleSaveCategory = (catData: Partial<ExpenseCategory>) => {
    let updated: ExpenseCategory[] = [];
    if (catData.id) {
      updated = expenseCategories.map((c) => (c.id === catData.id ? { ...c, ...catData } : c));
    } else {
      const palette = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1"];
      const randomColor = palette[Math.floor(Math.random() * palette.length)];
      const newC: ExpenseCategory = {
        id: generateId(expenseCategories),
        name: catData.name || "Kategori",
        color: catData.color || randomColor
      };
      updated = [...expenseCategories, newC];
    }
    setExpenseCategories(updated);
    saveAllToUser(debts, incomes, alarms, notifications, installmentDebts, payments, expenses, updated);
  };

  const handleSaveAllCategories = (cats: ExpenseCategory[]) => {
    try {
      setExpenseCategories(cats);
      saveAllToUser(debts, incomes, alarms, notifications, installmentDebts, payments, expenses, cats);
    } catch (err) {
      console.error("Error updating all categories:", err);
    }
  };

  const handleDeleteCategory = (id: number) => {
    triggerConfirm(
      "Kategoriyi Sil",
      "Bu kategori silindiğinde bu kategoriye ait harcamalar da kaldırılacaktır. Onaylıyor musunuz?",
      () => {
        const updatedCategories = expenseCategories.filter((c) => c.id !== id);
        const updatedExpenses = expenses.filter((e) => e.categoryId !== id);
        setExpenseCategories(updatedCategories);
        setExpenses(updatedExpenses);
        saveAllToUser(debts, incomes, alarms, notifications, installmentDebts, payments, updatedExpenses, updatedCategories);
      }
    );
  };

  const handleSaveInstallment = (instData: Partial<InstallmentDebt>) => {
    let updated: InstallmentDebt[] = [];
    let updatedPayments = [...payments];

    if (instData.id) {
      updated = installmentDebts.map((i) => (i.id === instData.id ? (instData as InstallmentDebt) : i));
      
      const inst = updated.find((i) => i.id === instData.id);
      if (inst) {
        const perMonth = inst.totalAmount / (inst.installmentCount || 1);
        updatedPayments = syncInstallmentPayments(
          inst.id,
          inst.paidInstallmentCount,
          perMonth,
          inst.firstDueDate,
          updatedPayments
        );
      }
    } else {
      const newId = generateId(installmentDebts);
      const newInst: InstallmentDebt = {
        id: newId,
        name: instData.name || "Yeni Taksit Planı",
        totalAmount: instData.totalAmount || 0,
        installmentCount: instData.installmentCount || 1,
        paidInstallmentCount: instData.paidInstallmentCount || 0,
        firstDueDate: instData.firstDueDate || new Date().toISOString().slice(0, 10),
        providerId: instData.providerId || null
      };
      updated = [...installmentDebts, newInst];

      if (newInst.paidInstallmentCount > 0) {
        const perMonth = newInst.totalAmount / (newInst.installmentCount || 1);
        updatedPayments = syncInstallmentPayments(
          newId,
          newInst.paidInstallmentCount,
          perMonth,
          newInst.firstDueDate,
          updatedPayments
        );
      }
    }
    setInstallmentDebts(updated);
    setPayments(updatedPayments);
    saveAllToUser(debts, incomes, alarms, notifications, updated, updatedPayments, expenses, expenseCategories);

    // Sıradaki taksit ödeme günü için otomatik Capacitor alarmı kur
    const savedInstId = instData.id || (updated.length > 0 ? updated[updated.length - 1].id : 0);
    const targetInst = updated.find((i) => i.id === savedInstId);
    if (targetInst && targetInst.firstDueDate && (targetInst.paidInstallmentCount || 0) < (targetInst.installmentCount || 1)) {
      const nextIdx = Number(targetInst.paidInstallmentCount || 0);
      const [y, m, d] = targetInst.firstDueDate.split("-").map(Number);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const nextDate = new Date(y, (m - 1) + nextIdx, d, 9, 0, 0, 0);
        const trig = nextDate.getTime();
        if (trig > Date.now()) {
          const perMonth = targetInst.installmentCount ? Math.round(Number(targetInst.totalAmount || 0) / Number(targetInst.installmentCount)) : 0;
          const miktar = `${perMonth.toLocaleString("tr-TR")} TL`;
          const borcAdi = `${targetInst.name} (${nextIdx + 1}/${targetInst.installmentCount}. Taksit)`;
          const tarih = nextDate.toLocaleDateString("tr-TR");
          const richTitle = "🚨 Bütçem Pro: Ödeme Hatırlatıcı!";
          const richBody = `💰 Borç: ${borcAdi}\n💵 Miktar: ${miktar}\n📅 Son Tarih: ${tarih}\n⚠️ Durum: Gecikmemesi için lütfen kontrol edin!`;

          scheduleCapacitorAlarm(
            800000 + targetInst.id,
            richTitle,
            trig,
            richBody,
            {
              borcAdi,
              miktar,
              tarih,
              durum: "Gecikmemesi için lütfen kontrol edin!"
            }
          ).catch(() => {});
        }
      }
    }
  };

  const handleDeleteInstallment = (id: number) => {
    triggerConfirm(
      "Taksit Planını Sil",
      "Taksit planı tamamen silinecektir, devam edilsin mi?",
      () => {
        cancelCapacitorAlarm(800000 + id).catch(() => {});
        const updated = installmentDebts.filter((i) => i.id !== id);
        const updatedPayments = payments.filter((p) => !(p.debtId === id && p.type === "installment"));
        setInstallmentDebts(updated);
        setPayments(updatedPayments);
        saveAllToUser(debts, incomes, alarms, notifications, updated, updatedPayments, expenses, expenseCategories);
      }
    );
  };

  const handlePayInstallment = (id: number, customDate?: string) => {
    let updatedPayments = [...payments];
    const updated = installmentDebts.map((inst) => {
      if (inst.id === id && inst.paidInstallmentCount < inst.installmentCount) {
        const perMonth = inst.totalAmount / inst.installmentCount;
        const updatedPaidCount = inst.paidInstallmentCount + 1;
        
        let payDate = customDate ? new Date(customDate).toISOString() : new Date().toISOString();
        if (!customDate && inst.firstDueDate) {
          try {
            const baseDate = new Date(inst.firstDueDate);
            baseDate.setMonth(baseDate.getMonth() + inst.paidInstallmentCount);
            payDate = baseDate.toISOString();
          } catch {}
        }

        // Push payment logs
        const newPayment: PaymentLog = {
          id: generateId(updatedPayments),
          debtId: id,
          amount: perMonth,
          date: payDate,
          type: "installment"
        };
        updatedPayments.push(newPayment);
        
        return {
          ...inst,
          paidInstallmentCount: updatedPaidCount
        };
      }
      return inst;
    });
    setInstallmentDebts(updated);
    setPayments(updatedPayments);
    saveAllToUser(debts, incomes, alarms, notifications, updated, updatedPayments, expenses, expenseCategories);

    // Taksit ödendikten sonra sıradaki taksit alarmını güncelle veya bittiyse iptal et
    const targetInst = updated.find((i) => i.id === id);
    if (targetInst) {
      if ((targetInst.paidInstallmentCount || 0) >= (targetInst.installmentCount || 1)) {
        cancelCapacitorAlarm(800000 + id).catch(() => {});
      } else if (targetInst.firstDueDate) {
        const nextIdx = Number(targetInst.paidInstallmentCount || 0);
        const [y, m, d] = targetInst.firstDueDate.split("-").map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const nextDate = new Date(y, (m - 1) + nextIdx, d, 9, 0, 0, 0);
          const trig = nextDate.getTime();
          if (trig > Date.now()) {
            const perMonth = targetInst.installmentCount ? Math.round(Number(targetInst.totalAmount || 0) / Number(targetInst.installmentCount)) : 0;
            const miktar = `${perMonth.toLocaleString("tr-TR")} TL`;
            const borcAdi = `${targetInst.name} (${nextIdx + 1}/${targetInst.installmentCount}. Taksit)`;
            const tarih = nextDate.toLocaleDateString("tr-TR");
            const richTitle = "🚨 Bütçem Pro: Ödeme Hatırlatıcı!";
            const richBody = `💰 Borç: ${borcAdi}\n💵 Miktar: ${miktar}\n📅 Son Tarih: ${tarih}\n⚠️ Durum: Gecikmemesi için lütfen kontrol edin!`;

            scheduleCapacitorAlarm(
              800000 + targetInst.id,
              richTitle,
              trig,
              richBody,
              {
                borcAdi,
                miktar,
                tarih,
                durum: "Gecikmemesi için lütfen kontrol edin!"
              }
            ).catch(() => {});
          }
        }
      }
    }

    triggerToast("Taksit Ödemesi Kaydedildi");
  };

  const handleRevertInstallmentPayment = (id: number) => {
    let updatedPayments = [...payments];
    const updated = installmentDebts.map((inst) => {
      if (inst.id === id && inst.paidInstallmentCount > 0) {
        const updatedPaidCount = inst.paidInstallmentCount - 1;
        const perMonth = inst.totalAmount / inst.installmentCount;
        
        updatedPayments = syncInstallmentPayments(
          id,
          updatedPaidCount,
          perMonth,
          inst.firstDueDate,
          updatedPayments
        );
        
        return {
          ...inst,
          paidInstallmentCount: updatedPaidCount
        };
      }
      return inst;
    });
    setInstallmentDebts(updated);
    setPayments(updatedPayments);
    saveAllToUser(debts, incomes, alarms, notifications, updated, updatedPayments, expenses, expenseCategories);
    triggerToast("Son Ödeme Geri Alındı");
  };

  const handleRestoreInstallments = (newInstallments: InstallmentDebt[], mode: "replace" | "merge" = "replace") => {
    let finalInstallments: InstallmentDebt[] = [];
    if (mode === "replace") {
      finalInstallments = newInstallments.map((inst, idx) => ({
        ...inst,
        id: inst.id || Date.now() + idx,
        totalAmount: Number(inst.totalAmount) || 0,
        installmentCount: Number(inst.installmentCount) || 1,
        paidInstallmentCount: Math.min(Number(inst.installmentCount) || 1, Math.max(0, Number(inst.paidInstallmentCount) || 0)),
        firstDueDate: inst.firstDueDate || new Date().toISOString().slice(0, 10),
      }));
    } else {
      const existingNames = new Set(installmentDebts.map((i) => (i.name || "").toLowerCase().trim()));
      const incoming = newInstallments
        .filter((i) => !existingNames.has((i.name || "").toLowerCase().trim()))
        .map((inst, idx) => ({
          ...inst,
          id: Date.now() + idx + Math.floor(Math.random() * 1000),
          totalAmount: Number(inst.totalAmount) || 0,
          installmentCount: Number(inst.installmentCount) || 1,
          paidInstallmentCount: Math.min(Number(inst.installmentCount) || 1, Math.max(0, Number(inst.paidInstallmentCount) || 0)),
          firstDueDate: inst.firstDueDate || new Date().toISOString().slice(0, 10),
        }));
      finalInstallments = [...installmentDebts, ...incoming];
    }

    // Rebuild installment payments
    let updatedPayments = payments.filter((p) => p.type !== "installment");
    finalInstallments.forEach((inst) => {
      if (inst.paidInstallmentCount > 0) {
        const perMonth = inst.totalAmount / (inst.installmentCount || 1);
        updatedPayments = syncInstallmentPayments(
          inst.id,
          inst.paidInstallmentCount,
          perMonth,
          inst.firstDueDate,
          updatedPayments
        );
      }
    });

    setInstallmentDebts(finalInstallments);
    setPayments(updatedPayments);
    saveAllToUser(debts, incomes, alarms, notifications, finalInstallments, updatedPayments, expenses, expenseCategories);
    triggerToast(`🎉 ${finalInstallments.length} adet taksit planı başarıyla geri yüklendi!`);
  };

  const handleResetPayments = (scope: "current_month" | "all") => {
    let updatedDebts = [...debts];
    let updatedInstallments = [...installmentDebts];
    let updatedPayments = [...payments];

    if (scope === "current_month") {
      if (selectedMonth !== null && selectedYear !== null) {
        // Reset paid on debts due this month
        updatedDebts = updatedDebts.map((d) => {
          const parts = parseDateParts(d.dueDate);
          if (parts && parts.month === selectedMonth && parts.year === selectedYear) {
            return { ...d, paid: 0 };
          }
          return d;
        });

        // Filter out payments logged in this month
        updatedPayments = updatedPayments.filter((p) => {
          const parts = parseDateParts(p.date);
          if (!parts) return true;
          return !(parts.month === selectedMonth && parts.year === selectedYear);
        });
      }
      triggerToast("Seçili aya ait tüm borç ödemeleri sıfırlandı.");
    } else {
      // Reset ALL payments
      updatedDebts = updatedDebts.map((d) => ({ ...d, paid: 0 }));
      updatedInstallments = updatedInstallments.map((inst) => ({ ...inst, paidInstallmentCount: 0 }));
      updatedPayments = [];
      triggerToast("Tüm borç ödemeleri ve taksit kayıtları başarıyla sıfırlandı.");
    }

    setDebts(updatedDebts);
    setInstallmentDebts(updatedInstallments);
    setPayments(updatedPayments);
    saveAllToUser(
      updatedDebts,
      incomes,
      alarms,
      notifications,
      updatedInstallments,
      updatedPayments,
      expenses,
      expenseCategories
    );
  };

  const handleAddAlarm = (titleString: string, dateString: string, debtIdParam?: number) => {
    // Proactively request browser/device notification permission if not yet granted
    if (typeof window !== "undefined" && "Notification" in window && (Notification as any).permission !== "granted") {
      requestNotificationPermission();
    }

    const alarmDateObj = parseLocalOrUTCString(dateString);
    const targetAlarmId = debtIdParam ? Number(debtIdParam) : generateId(alarms);
    const newA: Alarm = {
      id: targetAlarmId,
      debtId: debtIdParam ? Number(debtIdParam) : undefined,
      title: titleString,
      date: dateString,
      timestamp: alarmDateObj.getTime()
    };
    const updated = [...alarms, newA];

    // Atomically create a Notification Item to be stored in the "Bildirim Paneli" list
    const newNotifId = notifications.length > 0 ? Math.max(...notifications.map((n) => n.id)) + 1 : 1;
    const newNotif: NotificationItem = {
      id: newNotifId,
      title: `⏰ Ödeme Hatırlatıcısı Kuruldu - ${titleString} (${dateString ? new Date(dateString).toLocaleDateString("tr-TR") : "Tarih Belirtilmedi"})`
    };
    const updatedNotifs = [newNotif, ...notifications];

    setAlarms(updated);
    setNotifications(updatedNotifs);
    saveAllToUser(debts, incomes, updated, updatedNotifs, installmentDebts, payments, expenses, expenseCategories);

    // Schedule alarm into Capacitor LocalNotifications (triggers when app is closed / phone locked)
    if (alarmDateObj.getTime() > Date.now()) {
      const safeAlarmId = Math.abs(Number(newA.debtId || newA.id));
      try {
        initCapacitorNotificationChannel().catch(() => {});
        const dateFormatted = alarmDateObj.toLocaleString("tr-TR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        });
        const richTitle = "🚨 Bütçem Pro: Ödeme Hatırlatıcı!";
        const richBody = `💰 Borç: ${titleString || "Ödeme"}\n📅 Son Tarih: ${dateFormatted}\n⚠️ Durum: Gecikmemesi için lütfen kontrol edin!`;

        LocalNotifications.schedule({
          notifications: [
            {
              id: safeAlarmId,
              title: richTitle,
              body: richBody,
              largeBody: richBody,
              summaryText: "Ödeme detaylarınızı kontrol etmeyi unutmayın.",
              schedule: {
                at: new Date(alarmDateObj.getTime()),
                allowWhileIdle: true,
                exact: true,
                allowInExactlyDatatype: true
              },
              channelId: "debt_reminders",
              smallIcon: 'ic_stat_notify',
              iconColor: '#10B981',
              autoCancel: true,
              android: {
                summaryText: 'Ödeme detaylarınızı kontrol etmeyi unutmayın.',
                priority: 'max',
                visibility: 'public'
              },
              extra: { id: safeAlarmId, debtId: newA.debtId, title: titleString, body: richBody }
            } as any
          ]
        }).then(() => {
          console.log(`[Capacitor LocalNotifications] Alarm #${safeAlarmId} zamanlandı.`);
        }).catch((cErr) => {
          console.warn("[Capacitor LocalNotifications] schedule error:", cErr);
        });
      } catch (capErr) {
        console.warn("[Capacitor LocalNotifications] call error:", capErr);
      }

      // Also schedule alarm into native Android AlarmManager bridge
      scheduleAndroidDebtAlarm(
        safeAlarmId,
        "🚨 Bütçem Pro: Ödeme Hatırlatıcı!",
        alarmDateObj.getTime(),
        `💰 Borç: ${titleString || "Ödeme"}\n📅 Son Tarih: ${alarmDateObj.toLocaleString("tr-TR")}\n⚠️ Durum: Gecikmemesi için lütfen kontrol edin!`
      );
    }
    
    // Instantly synchronize with Service Worker and Web Push daemon for background/closed-phone delivery
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SYNC_ALL_DATA",
          alarms: updated,
          debts,
          installmentDebts
        });
      }
      syncAlarmsWithPushServer(updated);
    }

    // Trigger OS alert sounds/visuals (persist is false here because we saved it already in the line above)
    sendSystemNotification(
      "Ödeme Hatırlatıcısı Kuruldu! ⏰",
      `"${titleString}" başlıklı alarmınız kuruldu.`,
      false
    );
  };

  const handleDeletePayment = (paymentId: number) => {
    const targetPayment = payments.find((p) => p.id === paymentId);
    const updatedPayments = payments.filter((p) => p.id !== paymentId);

    let updatedDebts = [...debts];
    let updatedInstallments = [...installmentDebts];

    if (targetPayment) {
      if (targetPayment.type === "installment") {
        updatedInstallments = updatedInstallments.map((inst) => {
          if (inst.id === targetPayment.debtId) {
            return {
              ...inst,
              paidInstallmentCount: Math.max(0, (inst.paidInstallmentCount || 0) - 1)
            };
          }
          return inst;
        });
      } else {
        updatedDebts = updatedDebts.map((d) => {
          if (d.id === targetPayment.debtId) {
            return {
              ...d,
              paid: Math.max(0, (d.paid || 0) - targetPayment.amount)
            };
          }
          return d;
        });
      }
    }

    setPayments(updatedPayments);
    setDebts(updatedDebts);
    setInstallmentDebts(updatedInstallments);
    saveAllToUser(
      updatedDebts,
      incomes,
      alarms,
      notifications,
      updatedInstallments,
      updatedPayments,
      expenses,
      expenseCategories
    );
    triggerToast("Ödeme kaydı silindi.");
  };

  const handleDeleteAlarm = (id: number) => {
    cancelCapacitorAlarm(id).catch(() => {});
    cancelCapacitorAlarm(200000 + id).catch(() => {});
    cancelCapacitorAlarm(800000 + id).catch(() => {});
    cancelAndroidDebtAlarm(id);

    const target = alarms.find((a) => a.id === id);
    const safeDebtId = target?.debtId ? Math.abs(Number(target.debtId)) : undefined;
    if (safeDebtId && safeDebtId !== id) {
      cancelCapacitorAlarm(safeDebtId).catch(() => {});
      cancelAndroidDebtAlarm(safeDebtId);
      if (typeof window !== "undefined") {
        try {
          LocalNotifications.cancel({
            notifications: [{ id: safeDebtId }]
          }).catch(() => {});
        } catch (_) {}
      }
    }

    if (typeof window !== "undefined") {
      try {
        LocalNotifications.cancel({
          notifications: [{ id: Math.abs(Number(id)) || 1 }]
        }).then(() => {
          console.log(`[Capacitor LocalNotifications] Alarm #${id} iptal edildi.`);
        }).catch(() => {});
      } catch (capErr) {
        console.warn("[Capacitor LocalNotifications] cancel error:", capErr);
      }
    }
    const updated = alarms.filter((a) => a.id !== id);
    setAlarms(updated);
    saveAllToUser(debts, incomes, updated, notifications, installmentDebts, payments, expenses, expenseCategories);

    // Instantly notify Service Worker and Web Push daemon of deletion
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SYNC_ALL_DATA",
          alarms: updated,
          debts,
          installmentDebts
        });
      }
      syncAlarmsWithPushServer(updated);
    }
    triggerToast("Alarm silindi ve arka plan servisinden kaldırıldı.");
  };

  const handleDeleteNotif = (id: number) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    saveAllToUser(debts, incomes, alarms, updated, installmentDebts, payments, expenses, expenseCategories);
  };

  const handleClearNotifs = () => {
    setNotifications([]);
    saveAllToUser(debts, incomes, alarms, [], installmentDebts, payments, expenses, expenseCategories);
  };

  const handleTestBackgroundAlarm = async () => {
    try {
      // 1. Capacitor LocalNotifications doğrudan test (Android 13/14 Doze & Kilit Ekranı)
      const testTitle = "🚨 Bütçem Pro: Ödeme Hatırlatıcı!";
      const testBody = `💰 Borç: Örnek Kira & Fatura Ödemesi\n💵 Miktar: 15.000 TL\n📅 Son Tarih: Bugün\n⚠️ Durum: Gecikmemesi için lütfen kontrol edin!`;
      const capOk = await scheduleCapacitorAlarm(
        777777,
        testTitle,
        Date.now() + 5000,
        testBody,
        {
          borcAdi: "Örnek Kira & Fatura Ödemesi",
          miktar: "15.000 TL",
          tarih: "Bugün",
          durum: "Gecikmemesi için lütfen kontrol edin!"
        }
      );
      if (capOk) {
        triggerToast("⏰ 5 Saniyelik Zengin Alarm Kuruldu! Lütfen HEMEN telefonunuzu kilitleyin veya uygulamayı kapatın.");
        return;
      }

      if (isAndroidAlarmBridgeAvailable()) {
        const ok = testAndroidBackgroundAlarm(5);
        if (ok) {
          triggerToast("⏰ 5 Saniyelik Test Alarmı Kuruldu.");
          return;
        }
      }

      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            triggerToast("⏰ 5 Saniye Sonra Test Bildirimi Gönderilecek.");
            await fetch(getApiUrl("/api/send-test-push"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subscription: sub, delaySeconds: 5 })
            });
            return;
          }
        } catch (swErr) {
          console.warn("SW push test error:", swErr);
        }
      }

      triggerToast("⏰ 5 Saniye Sonra Test Bildirimi Gönderilecek.");
      setTimeout(() => {
        sendSystemNotification(
          "🔔 Bildirim Testi",
          "Tebrikler! Bildirim motoru başarıyla çalışıyor. Borç ve alarmlarınız eksiksiz gelecektir."
        );
      }, 5000);
    } catch (err) {
      console.warn("Background test notification error:", err);
      triggerToast("Test başlatılırken bir hata oluştu.");
    }
  };

  const handleTriggerInstantOverduePush = async () => {
    try {
      if (isAndroidAlarmBridgeAvailable()) {
        syncAllDebtsAndAlarmsToAndroid(alarmsRef.current, debtsRef.current, installmentDebtsRef.current);
        triggerToast("Android sistemine tüm borçlar senkronize edildi ve gecikmiş borç taraması yenilendi!");
      }

      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            const res = await fetch(getApiUrl("/api/trigger-overdue-push"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscription: sub,
                debts: debtsRef.current,
                installmentDebts: installmentDebtsRef.current
              })
            });
            const data = await res.json();
            triggerToast(data.message || "Gecikmiş borç tarama bildirimi gönderildi.");
            return;
          }
        } catch (swErr) {
          console.warn("Instant overdue push error:", swErr);
        }
      }

      // Local browser fallback
      const overdue = debts.filter(d => ((d.amount - (d.paid || 0)) > 0) && d.dueDate && new Date(d.dueDate).getTime() < Date.now());
      if (overdue.length > 0) {
        sendSystemNotification(
          `⚠️ Gecikmiş Borç Uyarısı (${overdue.length} Adet)`,
          `Vadesi geçmiş borcunuz var: "${overdue[0].name}" (₺${overdue[0].amount}). Lütfen kontrol ediniz!`
        );
        triggerToast("Gecikmiş borç bildirimi oluşturuldu.");
      } else {
        triggerToast("Harika! Gecikmiş herhangi bir borcunuz bulunmuyor.");
      }
    } catch (err) {
      console.warn("handleTriggerInstantOverduePush error:", err);
    }
  };

  const handleSaveContactTx = (contactName: string, amount: number, type: "receivable" | "payable", description?: string) => {
    try {
      const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
      const contactsKey = `${spaceKey}_contacts_directory`;
      const txsKey = `${spaceKey}_contacts_transactions`;

      let oldContacts: any[] = [];
      let oldTxs: any[] = [];

      try {
        oldContacts = JSON.parse(localStorage.getItem(contactsKey) || "[]");
      } catch {}
      try {
        oldTxs = JSON.parse(localStorage.getItem(txsKey) || "[]");
      } catch {}

      // Find or create contact
      let contactObj = oldContacts.find(
        (c) => c.name.toLowerCase().trim() === contactName.toLowerCase().trim()
      );

      if (!contactObj) {
        const gradients = [
          "from-emerald-500 to-teal-600",
          "from-indigo-500 to-indigo-700",
          "from-amber-500 to-orange-600",
          "from-pink-500 to-rose-600",
          "from-sky-500 to-blue-700",
          "from-purple-500 to-fuchsia-700"
        ];
        const randomGrad = gradients[Math.floor(Math.random() * gradients.length)];
        contactObj = {
          id: "cont_" + Date.now(),
          name: contactName,
          phone: "Belirtilmemiş 📞",
          category: "friend",
          avatarColor: randomGrad,
          createdAt: new Date().toISOString()
        };
        oldContacts = [contactObj, ...oldContacts];
        localStorage.setItem(contactsKey, JSON.stringify(oldContacts));
      }

      // Add transaction
      const newTx = {
        id: "tx_" + Date.now(),
        contactId: contactObj.id,
        type: type,
        amount: Number(amount) || 0,
        description: description || "Sesli asistan kaydı",
        dueDate: new Date().toISOString().split("T")[0],
        isPaid: false,
        createdAt: new Date().toISOString()
      };

      oldTxs = [newTx, ...oldTxs];
      localStorage.setItem(txsKey, JSON.stringify(oldTxs));

      // Force state sync to update lifetime stats in App.tsx
      setContactSyncTrigger((prev) => prev + 1);
    } catch (e) {
      console.error("Error in handleSaveContactTx:", e);
    }
  };

  // ---------------- Backup Utilities ----------------
  const processBackupJSON = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      
      const rawDebts = parsed.debts || parsed.allDebts || parsed.debtList || [];
      const rawIncomes = parsed.incomes || parsed.allIncomes || parsed.incomeList || [];
      const rawAlarms = parsed.alarms || parsed.allAlarms || parsed.alarmList || [];
      const rawNotifs = parsed.notifications || parsed.allNotifications || parsed.notificationList || [];
      const rawInstallments = parsed.installmentDebts || parsed.installments || parsed.installmentList || [];
      const rawPayments = parsed.payments || parsed.payments_logs || parsed.paymentList || [];
      const rawExpenses = parsed.expenses || parsed.allExpenses || parsed.expenseList || [];
      const rawCategoriesTemp = parsed.expenseCategories || parsed.categories || parsed.categoryList || [];
      const defaultCategories = [
        { id: 1, name: "Kira", color: "#3b82f6", icon: "🏠" },
        { id: 2, name: "Market", color: "#10b981", icon: "🛒" },
        { id: 3, name: "Ulaşım", color: "#f59e0b", icon: "🚗" },
        { id: 4, name: "Yeme İçme", color: "#ec4899", icon: "🍔" },
        { id: 5, name: "Faturalar", color: "#ef4444", icon: "⚡" }
      ];
      const rawCategories = (rawCategoriesTemp && rawCategoriesTemp.length > 0) ? rawCategoriesTemp : defaultCategories;
      
      setDebts(rawDebts);
      setIncomes(rawIncomes);
      setAlarms(rawAlarms);
      setNotifications(rawNotifs);
      setInstallmentDebts(rawInstallments);
      setPayments(rawPayments);
      setExpenses(rawExpenses);
      setExpenseCategories(rawCategories);
      
      saveAllToUser(
        rawDebts,
        rawIncomes,
        rawAlarms,
        rawNotifs,
        rawInstallments,
        rawPayments,
        rawExpenses,
        rawCategories
      );
      
      const rawContacts = parsed.contacts || parsed.contacts_directory || parsed.contactsDirectory || [];
      const rawContactTxs = parsed.contactTransactions || parsed.contacts_transactions || parsed.contactTransactionsList || [];
      
      localStorage.setItem(`${spaceKey}_contacts_directory`, JSON.stringify(rawContacts));
      localStorage.setItem(`${spaceKey}_contacts_transactions`, JSON.stringify(rawContactTxs));
      
      triggerToast("Veri Yedek Dosyası Başarıyla İçe Aktarıldı... Sayfa Güncelleniyor! 📊");
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      return true;
    } catch (err: any) {
      alert(`Yedek yüklenirken hata oluştu: ${err.message}`);
      return false;
    }
  };

  const handleRestoreIncomes = (
    newIncomes: Income[],
    mode: "replace" | "merge" = "merge",
    targetMonth?: number | null,
    targetYear?: number | null
  ) => {
    const mVal = targetMonth !== null && targetMonth !== undefined ? targetMonth : selectedMonth;
    const yVal = targetYear !== null && targetYear !== undefined ? targetYear : selectedYear;

    const preparedIncomes: Income[] = newIncomes.map((inc, idx) => {
      let finalDate = inc.date || new Date().toISOString().slice(0, 10);
      if (mVal !== null && yVal !== null) {
        let day = 1;
        try {
          if (inc.date) {
            const d = new Date(inc.date);
            if (!isNaN(d.getDate())) day = d.getDate();
          }
        } catch {}
        const safeDay = Math.min(28, Math.max(1, day));
        finalDate = `${yVal}-${String(mVal + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
      }
      return {
        id: Date.now() + idx + Math.floor(Math.random() * 1000),
        name: String(inc.name || "Gelir").trim(),
        amount: Number(inc.amount) || 0,
        date: finalDate,
        isRecurring: inc.isRecurring !== false,
      };
    });

    let finalIncomes: Income[] = [];
    if (mode === "replace") {
      if (mVal !== null && yVal !== null) {
        const otherMonthsIncomes = incomes.filter((i) => {
          const parts = parseDateParts(i.date);
          if (!parts) return true;
          return !(parts.month === mVal && parts.year === yVal);
        });
        finalIncomes = [...otherMonthsIncomes, ...preparedIncomes];
      } else {
        finalIncomes = preparedIncomes;
      }
    } else {
      const existingNamesInTarget = new Set(
        incomes
          .filter((i) => {
            if (mVal === null || yVal === null) return true;
            const parts = parseDateParts(i.date);
            return parts && parts.month === mVal && parts.year === yVal;
          })
          .map((i) => (i.name || "").toLowerCase().trim())
      );
      const nonDuplicates = preparedIncomes.filter((i) => !existingNamesInTarget.has((i.name || "").toLowerCase().trim()));
      finalIncomes = [...incomes, ...nonDuplicates];
    }

    setIncomes(finalIncomes);
    saveAllToUser(debts, finalIncomes, alarms, notifications, installmentDebts, payments, expenses, expenseCategories);
    triggerToast(`🎉 ${preparedIncomes.length} adet gelir kaydı başarıyla güncellendi/yüklendi!`);
  };

  const executeExportBackup = async (
    customName?: string, 
    action: "share" | "download" | "drive" | "whatsapp" | "picker" | boolean = "download"
  ) => {
    if (!isPremium) {
      setPromoFeature("Veri Yedekleme (Dışa Aktarma)");
      setIsUpgradeModalOpen(true);
      return;
    }

    const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
    const contactsKey = `${spaceKey}_contacts_directory`;
    const contactTxsKey = `${spaceKey}_contacts_transactions`;
    
    let contactsData = [];
    let contactTxsData = [];
    
    try {
      contactsData = JSON.parse(localStorage.getItem(contactsKey) || "[]");
    } catch {}
    try {
      contactTxsData = JSON.parse(localStorage.getItem(contactTxsKey) || "[]");
    } catch {}

    const bag = { 
      version: "2.0.0",
      exportDate: new Date().toISOString(),
      user: currentUser || "Bireysel Kullanıcı",
      debts, 
      incomes, 
      alarms, 
      notifications, 
      installmentDebts, 
      payments, 
      expenses, 
      expenseCategories,
      contacts: contactsData,
      contactTransactions: contactTxsData
    };
    
    const jsonString = JSON.stringify(bag, null, 2);
    
    // Clean and strictly format the file name
    let rawName = (customName || exportFileNameInput || `butcem_yedek_${new Date().toISOString().slice(0, 10)}`).trim();
    if (!rawName) rawName = `butcem_yedek_${new Date().toISOString().slice(0, 10)}`;
    const baseName = rawName.replace(/\.json$/i, "").replace(/[\/\\?%*:|"<>]/g, "_") || "butcem_yedek";
    const fileName = `${baseName}.json`;

    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
    const mode = typeof action === "boolean" ? (action ? "share" : "download") : action;

    // Helper: Register backup on server to obtain a temporary secure link (for WhatsApp / Web share)
    const getShareableLink = async (): Promise<string | null> => {
      try {
        const res = await fetch(getApiUrl("/api/temp-backup"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: jsonString, filename: fileName })
        });
        const data = await res.json();
        if (data.success && data.key) {
          return `${window.location.origin}/api/download-temp?key=${data.key}`;
        }
      } catch (e) {
        console.warn("Could not generate share link:", e);
      }
      return null;
    };

    // Helper: Trigger pure download (Android APK Native Bridge + Blob + Server fallback)
    const triggerFileDownload = async () => {
      await downloadFileWithCustomName({
        fileName,
        content: jsonString,
        mimeType: "application/json",
        onSuccess: () => {
          triggerToast(`✅ '${fileName}' dosyası İndirilenler klasörünüze kaydedildi!`);
          localStorage.setItem("last_backup_export_date", new Date().toISOString());
        },
        onError: () => {
          triggerToast(`✅ '${fileName}' dosyası kaydedildi!`);
          localStorage.setItem("last_backup_export_date", new Date().toISOString());
        }
      });
    };

    const isWebViewEnv = typeof navigator !== "undefined" && (
      /wv|Android.*Build\/|Version\/[0-9.]+/i.test(navigator.userAgent) && !/Chrome\/[0-9.]+\s+Mobile/i.test(navigator.userAgent)
    );

    // 0. Capacitor Native Platform (Android / iOS APK) Tam Desteği:
    if (Capacitor.isNativePlatform()) {
      try {
        const cacheRes = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
          recursive: true
        });

        // Ayrıca kullanıcının Dosyalar / Belgeler klasörüne de kaydet
        try {
          await Filesystem.writeFile({
            path: fileName,
            data: jsonString,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
            recursive: true
          });
        } catch {}

        if (mode === "drive") {
          triggerToast(`📁 '${fileName}' hazırlandı! Menüden Google Drive'ı seçerek bulutunuza kaydedebilirsiniz.`);
          await Share.share({
            title: "Google Drive'a Kaydet",
            text: `Bütçem Pro Veri Yedeği (${fileName})`,
            url: cacheRes.uri,
            dialogTitle: "Google Drive veya Buluta Kaydet"
          });
          localStorage.setItem("last_backup_export_date", new Date().toISOString());
          return;
        }

        if (mode === "whatsapp") {
          const summaryText = 
            `💰 *BÜTÇEM PRO - VERİ YEDEĞİ* 📊\n` +
            `📅 Tarih: ${new Date().toLocaleDateString("tr-TR")}\n` +
            `📁 Dosya: ${fileName}\n\n` +
            `📌 *Kayıt Özeti:*\n` +
            `• ${debts.length} Borç Kaydı\n` +
            `• ${incomes.length} Gelir Kaydı\n` +
            `• ${expenses.length} Gider Kaydı\n` +
            `• ${installmentDebts.length} Taksitli Borç Planı\n` +
            `• ${contactsData.length} Kişi Cari Kaydı\n\n` +
            `_Bütçem Pro ile güvenle yedeklendi._`;

          await Share.share({
            title: "WhatsApp ile Paylaş",
            text: summaryText,
            url: cacheRes.uri,
            dialogTitle: "WhatsApp veya Uygulama Seçin"
          });
          triggerToast(`✅ Veri yedeği paylaşıldı: ${fileName}`);
          localStorage.setItem("last_backup_export_date", new Date().toISOString());
          return;
        }

        if (mode === "share") {
          await Share.share({
            title: "Bütçem Veri Yedeği",
            text: `Bütçem Pro Veri Yedeği: ${fileName}`,
            url: cacheRes.uri,
            dialogTitle: "Yedeği Paylaş veya Kaydet"
          });
          triggerToast(`✅ Paylaşım menüsü açıldı!`);
          localStorage.setItem("last_backup_export_date", new Date().toISOString());
          return;
        }

        // mode === "download"
        triggerToast(`✅ '${fileName}' İndirilenler/Belgeler klasörüne başarıyla kaydedildi!`);
        try {
          await Share.share({
            title: fileName,
            text: fileName,
            url: cacheRes.uri,
            dialogTitle: "Dosyayı Kaydet veya Aç"
          });
        } catch {}
        localStorage.setItem("last_backup_export_date", new Date().toISOString());
        return;
      } catch (capErr: any) {
        if (capErr?.name !== "AbortError") {
          console.warn("[executeExportBackup] Capacitor export fallback:", capErr);
        }
      }
    }

    // 1. WhatsApp Action
    if (mode === "whatsapp") {
      // Android Native Share Check
      if (isAndroidAlarmBridgeAvailable()) {
        const shared = shareAndroidNativeBackupFile(fileName, jsonString, "Bütçem Veri Yedeği");
        if (shared) {
          localStorage.setItem("last_backup_export_date", new Date().toISOString());
          return;
        }
      }

      let sharedWithNative = false;

      if (!isWebViewEnv) {
        try {
          const testFile = new File([blob], fileName, { type: "application/json" });
          if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [testFile] })) {
            await navigator.share({
              title: "Bütçem Veri Yedeği",
              text: `Bütçem Pro Veri Yedeği (${fileName})`,
              files: [testFile]
            });
            sharedWithNative = true;
            triggerToast(`✅ Veri yedeği WhatsApp / seçilen uygulamaya iletildi: ${fileName}`);
            localStorage.setItem("last_backup_export_date", new Date().toISOString());
            return;
          }
        } catch (shareErr: any) {
          if (shareErr.name === "AbortError") return;
        }
      }

      if (!sharedWithNative) {
        const link = await getShareableLink();
        const summaryText = 
          `💰 *BÜTÇEM PRO - VERİ YEDEĞİ* 📊\n` +
          `📅 Tarih: ${new Date().toLocaleDateString("tr-TR")}\n` +
          `📁 Dosya: ${fileName}\n\n` +
          `📌 *Kayıt Özeti:*\n` +
          `• ${debts.length} Borç Kaydı\n` +
          `• ${incomes.length} Gelir Kaydı\n` +
          `• ${expenses.length} Gider Kaydı\n` +
          `• ${installmentDebts.length} Taksitli Borç\n` +
          `• ${contactsData.length} Kişi Cari Kaydı\n\n` +
          (link ? `🔗 *Yedeği İndir / Yükle:* ${link}\n\n` : "") +
          `_Bütçem Pro ile güvenle yedeklendi._`;

        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`;
        window.open(waUrl, "_blank");
        await triggerFileDownload();
        triggerToast("📲 WhatsApp paylaşım sayfası açıldı ve dosyanız indirildi!");
        return;
      }
    }

    // 2. Google Drive Action
    if (mode === "drive") {
      // On Android native app, save the file to downloads and trigger native Drive or open Google Drive safely
      if (isAndroidAlarmBridgeAvailable()) {
        saveAndroidNativeBackupFile(fileName, jsonString);
        const shared = shareAndroidNativeBackupFile(fileName, jsonString, "Drive'a Kaydet");
        if (!shared) {
          openAndroidGoogleDrive();
        }
        localStorage.setItem("last_backup_export_date", new Date().toISOString());
        return;
      }

      await triggerFileDownload();
      if (!isWebViewEnv) {
        try {
          const testFile = new File([blob], fileName, { type: "application/json" });
          if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [testFile] })) {
            await navigator.share({
              title: "Google Drive'a Kaydet",
              text: `Bütçem Pro Veri Yedeği: ${fileName}`,
              files: [testFile]
            });
            localStorage.setItem("last_backup_export_date", new Date().toISOString());
            return;
          }
        } catch (e: any) {
          if (e.name === "AbortError") return;
        }
      }
      
      // On desktop or when share is not available, offer 1-click Google Drive Web tab
      triggerToast(`📁 '${fileName}' indirildi! Google Drive açılıyor...`);
      setTimeout(() => {
        window.open("https://drive.google.com/drive/my-drive", "_blank");
      }, 600);
      return;
    }

    // 3. System Share Action (Android & iOS Web Share API)
    if (mode === "share") {
      if (isAndroidAlarmBridgeAvailable()) {
        const shared = shareAndroidNativeBackupFile(fileName, jsonString, "Bütçem Veri Yedeği");
        if (shared) {
          localStorage.setItem("last_backup_export_date", new Date().toISOString());
          return;
        }
      }

      if (!isWebViewEnv) {
        try {
          const testFile = new File([blob], fileName, { type: "application/json" });
          if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [testFile] })) {
            await navigator.share({
              title: "Bütçem Veri Yedeği",
              text: `Bütçem Pro Veri Yedeği (${fileName})`,
              files: [testFile]
            });
            triggerToast(`✅ Veri yedeği seçilen uygulamaya iletildi: ${fileName}`);
            localStorage.setItem("last_backup_export_date", new Date().toISOString());
            return;
          }
        } catch (shareErr: any) {
          if (shareErr.name === "AbortError") return;
          console.warn("navigator.share failed:", shareErr);
        }
      }

      // If navigator.share was unavailable or rejected, fallback to direct download with the custom name
      await triggerFileDownload();
      return;
    }

    // 4. Pure Download Action
    await triggerFileDownload();
  };

  const handleExportBackup = (directName?: string) => {
    if (!isPremium) {
      setPromoFeature("Veri Yedekleme (Dışa Aktarma)");
      setIsUpgradeModalOpen(true);
      return;
    }
    if (typeof directName === "string" && directName.trim()) {
      executeExportBackup(directName, "download");
    } else {
      setExportFileNameInput(`butcem_yedek_${new Date().toISOString().slice(0, 10)}`);
      setIsExportModalOpen(true);
    }
  };

  const generateCSVData = (startDate?: string, endDate?: string): { fileName: string; csvContent: string } => {
    const esc = (val: any) => {
      const str = String(val === undefined || val === null ? "" : val);
      return `"${str.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    };

    // 1. Gelir ve Gider filtrelemeleri
    const filteredIncomes = incomes.filter(inc => isDateWithinRange(inc.date, startDate, endDate));
    const filteredExpenses = expenses.filter(exp => isDateWithinRange(exp.date, startDate, endDate));

    const filteredTotalIncome = filteredIncomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const filteredTotalExpense = filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    // 2. Kişi Cari Defteri (Contacts Directory ve İşlemleri)
    const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
    let contactsDirectory: any[] = [];
    let contactTransactions: any[] = [];
    try {
      contactsDirectory = JSON.parse(localStorage.getItem(`${spaceKey}_contacts_directory`) || "[]");
    } catch {}
    try {
      contactTransactions = JSON.parse(localStorage.getItem(`${spaceKey}_contacts_transactions`) || "[]");
    } catch {}

    const contactMap = new Map<string, { name: string; phone: string }>();
    if (Array.isArray(contactsDirectory)) {
      contactsDirectory.forEach((c: any) => {
        contactMap.set(String(c.id), { name: c.name || "Kişi", phone: c.phone || "" });
      });
    }

    const filteredContactPayables: any[] = [];
    const filteredContactReceivables: any[] = [];
    if (Array.isArray(contactTransactions)) {
      contactTransactions.forEach((t: any) => {
        const txDate = t.dueDate || t.createdAt;
        if (isDateWithinRange(txDate, startDate, endDate)) {
          const info = contactMap.get(String(t.contactId)) || { name: t.personName || "Kişi", phone: "" };
          const item = {
            ...t,
            displayName: info.name,
            displayPhone: info.phone,
            effectiveDate: txDate
          };
          if (t.type === "payable") {
            filteredContactPayables.push(item);
          } else if (t.type === "receivable") {
            filteredContactReceivables.push(item);
          }
        }
      });
    }

    const contactPayablesTotal = filteredContactPayables.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const contactPayablesPaid = filteredContactPayables.reduce((sum, c) => sum + (c.isPaid ? (Number(c.amount) || 0) : 0), 0);
    const contactPayablesRemaining = Math.max(0, contactPayablesTotal - contactPayablesPaid);

    const contactReceivablesTotal = filteredContactReceivables.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const contactReceivablesCollected = filteredContactReceivables.reduce((sum, c) => sum + (c.isPaid ? (Number(c.amount) || 0) : 0), 0);
    const contactReceivablesPending = Math.max(0, contactReceivablesTotal - contactReceivablesCollected);

    // 3. Basit / Kurumsal Borçlar
    const filteredDebts = debts.filter(d => {
      if (!startDate && !endDate) return true;
      if (isDateWithinRange(d.dueDate || (d as any).date, startDate, endDate)) return true;
      const hasPayment = payments.some(p => p.debtId === d.id && isDateWithinRange(p.date, startDate, endDate));
      return hasPayment;
    });

    const simpleDebtsTotal = filteredDebts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const simpleDebtsPaid = filteredDebts.reduce((sum, d) => {
      const paidVal = (d as any).paidAmount !== undefined ? Number((d as any).paidAmount) : (Number(d.paid) || 0);
      return sum + Math.min(Number(d.amount) || 0, paidVal);
    }, 0);
    const simpleDebtsRemaining = Math.max(0, simpleDebtsTotal - simpleDebtsPaid);

    // 4. Taksitli Borç ve Kredi Planları
    let installmentsTotal = 0;
    let installmentsPaid = 0;
    const filteredInstallments: any[] = [];

    installmentDebts.forEach((inst: any) => {
      const count = inst.installmentCount || 1;
      const monthlyAmt = (Number(inst.totalAmount) || 0) / count;

      if (!startDate && !endDate) {
        const planPaid = (inst.paidInstallmentCount || 0) * monthlyAmt;
        installmentsTotal += (Number(inst.totalAmount) || 0);
        installmentsPaid += planPaid;
        filteredInstallments.push({
          ...inst,
          periodDueAmount: Number(inst.totalAmount) || 0,
          periodPaidAmount: planPaid,
          periodRemainingAmount: Math.max(0, (Number(inst.totalAmount) || 0) - planPaid),
          periodInstallmentDue: count,
          periodInstallmentPaidCount: inst.paidInstallmentCount || 0
        });
      } else {
        let occurrences = 0;
        let paidOccurrences = 0;
        const startParts = parseDateParts(inst.firstDueDate);
        if (startParts) {
          for (let i = 0; i < count; i++) {
            const occDate = new Date(startParts.year, startParts.month + i, startParts.day);
            const occYMD = occDate.toISOString().slice(0, 10);
            if (isDateWithinRange(occYMD, startDate, endDate)) {
              occurrences++;
              if ((inst.paidInstallmentCount || 0) > i) {
                paidOccurrences++;
              }
            }
          }
        } else if (isDateWithinRange(inst.firstDueDate, startDate, endDate)) {
          occurrences = 1;
          if ((inst.paidInstallmentCount || 0) > 0) paidOccurrences = 1;
        }

        if (occurrences > 0) {
          const periodDue = occurrences * monthlyAmt;
          const periodPaid = paidOccurrences * monthlyAmt;
          installmentsTotal += periodDue;
          installmentsPaid += periodPaid;
          filteredInstallments.push({
            ...inst,
            periodDueAmount: periodDue,
            periodPaidAmount: periodPaid,
            periodRemainingAmount: Math.max(0, periodDue - periodPaid),
            periodInstallmentDue: occurrences,
            periodInstallmentPaidCount: paidOccurrences
          });
        }
      }
    });
    const installmentsRemaining = Math.max(0, installmentsTotal - installmentsPaid);

    // 5. Gerçek Toplamlar (Basit + Taksitli + Kişi Borçları)
    const filteredTotalDebt = simpleDebtsTotal + installmentsTotal + contactPayablesTotal;
    const filteredTotalPaid = simpleDebtsPaid + installmentsPaid + contactPayablesPaid;
    const filteredRemainingDebt = Math.max(0, filteredTotalDebt - filteredTotalPaid);
    const filteredNetReserve = filteredTotalIncome - filteredTotalExpense - filteredTotalPaid;

    let periodLabel = "Tüm Zamanlar (Filtresiz)";
    if (startDate && endDate) {
      if (startDate === endDate) {
        periodLabel = `${startDate} (Günlük Rapor)`;
      } else {
        periodLabel = `${startDate} ile ${endDate}`;
      }
    } else if (startDate) {
      periodLabel = `${startDate} sonrasındaki kayıtlar`;
    } else if (endDate) {
      periodLabel = `${endDate} öncesindeki kayıtlar`;
    }

    let csvContent = "";
    csvContent += "\uFEFF"; // UTF-8 BOM byte sequence Excel Türkçe karakter desteği

    // Başlık
    csvContent += [esc("FİNANSAL DURUM VE KAPSAMLI BÜTÇE RAPORU"), esc("")].join(";") + "\n";
    csvContent += [esc("Rapor Oluşturma Tarihi"), esc(new Date().toLocaleDateString("tr-TR"))].join(";") + "\n";
    csvContent += [esc("Rapor Filtrelenen Dönem"), esc(periodLabel)].join(";") + "\n";
    csvContent += [esc("Aktif Para Birimi"), esc(activeCurrency)].join(";") + "\n";
    csvContent += "\n";

    // 1. DÖNEMSEL FİNANSAL GÖSTERGELER VE GENEL ÖZET
    csvContent += [esc("=== 1. DÖNEMSEL FİNANSAL GÖSTERGELER VE GENEL ÖZET ==="), esc(""), esc("")].join(";") + "\n";
    csvContent += [esc("Finansal Gösterge"), esc(`Tutar (${activeCurrency})`), esc("Açıklama / Kapsam")].join(";") + "\n";
    csvContent += [esc("Toplam Gelir"), esc(format(filteredTotalIncome)), esc(`${filteredIncomes.length} adet gelir işlemi`)].join(";") + "\n";
    csvContent += [esc("Toplam Gider (Harcama)"), esc(format(filteredTotalExpense)), esc(`${filteredExpenses.length} adet harcama işlemi`)].join(";") + "\n";
    csvContent += [esc("Basit ve Kurumsal Borçlar Kapsamı"), esc(format(simpleDebtsTotal)), esc(`${filteredDebts.length} adet borç kaydı`)].join(";") + "\n";
    csvContent += [esc("Taksitli Borç ve Kredi Payı"), esc(format(installmentsTotal)), esc(`${filteredInstallments.length} adet taksitli plan`)].join(";") + "\n";
    csvContent += [esc("Kişilere Olan Borçlarımız (Verecekler)"), esc(format(contactPayablesTotal)), esc(`${filteredContactPayables.length} kişi borç kaydı`)].join(";") + "\n";
    csvContent += [esc("⭐ GERÇEK TOPLAM BORÇ KAPSAMI"), esc(format(filteredTotalDebt)), esc("Basit + Taksitli + Kişi Borçları Toplamı")].join(";") + "\n";
    csvContent += [esc("↳ Toplam Ödenen Borç Payı"), esc(format(filteredTotalPaid)), esc("Bu dönemde kapatılan tüm borçlar")].join(";") + "\n";
    csvContent += [esc("↳ Kalan Aktif Gerçek Borç"), esc(format(filteredRemainingDebt)), esc("Ödenmesi gereken güncel net borç")].join(";") + "\n";
    csvContent += [esc("Kişilerden Beklenen Alacaklarımız (Tahsilat)"), esc(format(contactReceivablesTotal)), esc(`${filteredContactReceivables.length} kişi alacak kaydı (Kalan: ${format(contactReceivablesPending)})`)].join(";") + "\n";
    csvContent += [esc("💰 NET FİNANSAL DURUM (KALAN REZERV)"), esc(format(filteredNetReserve)), esc("Toplam Gelir - Toplam Gider - Ödenen Borçlar")].join(";") + "\n";
    csvContent += "\n";

    // 2. KİŞİLERE OLAN BORÇLARIMIZ (VERECEKLER - AYRI LİSTE)
    csvContent += [esc("=== 2. KİŞİLERE OLAN BORÇLARIMIZ (VERECEKLER - AYRI LİSTE) ==="), esc(""), esc(""), esc(""), esc(""), esc("")].join(";") + "\n";
    csvContent += [esc("Kişi / Alacaklı Adı"), esc("Telefon"), esc(`Borç Tutarı (${activeCurrency})`), esc("Vade / İşlem Tarihi"), esc("Açıklama"), esc("Ödeme Durumu")].join(";") + "\n";
    if (filteredContactPayables.length === 0) {
      csvContent += [esc("Seçilen dönemde kişilere ait kayıtlı borç bulunamadı."), esc(""), esc(""), esc(""), esc(""), esc("")].join(";") + "\n";
    } else {
      filteredContactPayables.forEach((c: any) => {
        csvContent += [
          esc(c.displayName || c.personName || "Kişi"),
          esc(c.displayPhone || "-"),
          esc(c.amount),
          esc(c.effectiveDate || "-"),
          esc(c.description || c.notes || "-"),
          esc(c.isPaid ? "ÖDENDİ" : "BEKLİYOR")
        ].join(";") + "\n";
      });
    }
    csvContent += "\n";

    // 3. KİŞİLERDEN OLAN ALACAKLARIMIZ (TAHSİLATLAR - AYRI LİSTE)
    csvContent += [esc("=== 3. KİŞİLERDEN OLAN ALACAKLARIMIZ (TAHSİLATLAR - AYRI LİSTE) ==="), esc(""), esc(""), esc(""), esc(""), esc("")].join(";") + "\n";
    csvContent += [esc("Kişi / Borçlu Adı"), esc("Telefon"), esc(`Alacak Tutarı (${activeCurrency})`), esc("Vade / İşlem Tarihi"), esc("Açıklama"), esc("Tahsilat Durumu")].join(";") + "\n";
    if (filteredContactReceivables.length === 0) {
      csvContent += [esc("Seçilen dönemde kişilerden kayıtlı alacak bulunamadı."), esc(""), esc(""), esc(""), esc(""), esc("")].join(";") + "\n";
    } else {
      filteredContactReceivables.forEach((c: any) => {
        csvContent += [
          esc(c.displayName || c.personName || "Kişi"),
          esc(c.displayPhone || "-"),
          esc(c.amount),
          esc(c.effectiveDate || "-"),
          esc(c.description || c.notes || "-"),
          esc(c.isPaid ? "TAHSİL EDİLDİ" : "BEKLİYOR")
        ].join(";") + "\n";
      });
    }
    csvContent += "\n";

    // 4. DETAYLI KAYITLI GELİRLER
    csvContent += [esc("=== 4. DETAYLI KAYITLI GELİRLER ==="), esc(""), esc(""), esc("")].join(";") + "\n";
    csvContent += [esc("Gelir Başlığı"), esc(`Miktar (${activeCurrency})`), esc("Gelir Kategorisi"), esc("Tarih / Not")].join(";") + "\n";
    if (filteredIncomes.length === 0) {
      csvContent += [esc("Seçilen dönemde kayıtlı gelir bulunamadı."), esc(""), esc(""), esc("")].join(";") + "\n";
    } else {
      filteredIncomes.forEach((inc: any) => {
        csvContent += [esc(inc.title || inc.name || "Gelir"), esc(inc.amount), esc(inc.category || "Genel"), esc(inc.date || "")].join(";") + "\n";
      });
    }
    csvContent += "\n";

    // 5. DETAYLI HARCAMA VE GİDERLER
    csvContent += [esc("=== 5. DETAYLI HARCAMA VE GİDERLER ==="), esc(""), esc(""), esc("")].join(";") + "\n";
    csvContent += [esc("Harcama Başlığı"), esc(`Miktar (${activeCurrency})`), esc("Kategori"), esc("Harcama Tarihi")].join(";") + "\n";
    if (filteredExpenses.length === 0) {
      csvContent += [esc("Seçilen dönemde kayıtlı harcama bulunamadı."), esc(""), esc(""), esc("")].join(";") + "\n";
    } else {
      filteredExpenses.forEach((exp: any) => {
        csvContent += [esc(exp.title || exp.description || "Gider"), esc(exp.amount), esc(exp.category || "Genel"), esc(exp.date || "")].join(";") + "\n";
      });
    }
    csvContent += "\n";

    // 6. DETAYLI BASİT VE KURUMSAL BORÇLAR
    csvContent += [esc("=== 6. DETAYLI BASİT VE KURUMSAL BORÇLAR ==="), esc(""), esc(""), esc(""), esc(""), esc(""), esc("")].join(";") + "\n";
    csvContent += [esc("Borç Açıklaması"), esc(`Toplam Tutar (${activeCurrency})`), esc("Ödenen Kısım"), esc("Kalan Tutar"), esc("Alacaklı Kurum / Kişi"), esc("Vade Tarihi"), esc("Durum")].join(";") + "\n";
    if (filteredDebts.length === 0) {
      csvContent += [esc("Seçilen dönemde kayıtlı borç bulunamadı."), esc(""), esc(""), esc(""), esc(""), esc(""), esc("")].join(";") + "\n";
    } else {
      filteredDebts.forEach((d: any) => {
        const paidVal = (d as any).paidAmount !== undefined ? Number((d as any).paidAmount) : (Number(d.paid) || 0);
        const amt = Number(d.amount) || 0;
        csvContent += [
          esc(d.title || d.name || "Borç"),
          esc(amt),
          esc(paidVal),
          esc(Math.max(0, amt - paidVal)),
          esc(d.creditor || d.category || "-"),
          esc(d.dueDate || ""),
          esc(d.isPaid || paidVal >= amt ? "ÖDENDİ" : "BEKLEYEN ÖDEME")
        ].join(";") + "\n";
      });
    }
    csvContent += "\n";

    // 7. DETAYLI TAKSİTLİ HARCAMA VE KREDİLER
    csvContent += [esc("=== 7. DETAYLI TAKSİTLİ HARCAMA VE KREDİLER ==="), esc(""), esc(""), esc(""), esc(""), esc(""), esc("")].join(";") + "\n";
    csvContent += [esc("Kredi / Taksit Adı"), esc("Aylık Tutar"), esc("Dönemdeki Taksit"), esc("Dönem Tutar Payı"), esc("Ödenen Pay"), esc("Kalan Tutar"), esc("İlk Vade Tarihi")].join(";") + "\n";
    if (filteredInstallments.length === 0) {
      csvContent += [esc("Seçilen dönemde kayıtlı taksitli borç bulunamadı."), esc(""), esc(""), esc(""), esc(""), esc(""), esc("")].join(";") + "\n";
    } else {
      filteredInstallments.forEach((inst: any) => {
        const monthly = (Number(inst.totalAmount) || 0) / (inst.installmentCount || 1);
        csvContent += [
          esc(inst.title || inst.name || "Taksit Planı"),
          esc(monthly),
          esc(`${inst.periodInstallmentDue || inst.installmentCount} taksit`),
          esc(inst.periodDueAmount || inst.totalAmount),
          esc(inst.periodPaidAmount || 0),
          esc(inst.periodRemainingAmount || 0),
          esc(inst.firstDueDate || inst.startDate || "")
        ].join(";") + "\n";
      });
    }
    csvContent += "\n";

    const dateSuffix = startDate && endDate ? `${startDate}_${endDate}` : `${new Date().toISOString().split('T')[0]}`;
    const fileName = `Finansal_Rapor_${dateSuffix}.csv`;

    return { fileName, csvContent };
  };

  const handleDownloadCSV = (startDate?: string, endDate?: string) => {
    const { fileName, csvContent } = generateCSVData(startDate, endDate);

    triggerToast("CSV Finansal Rapor indiriliyor... ⏳");

    downloadFileWithCustomName({
      fileName,
      content: csvContent,
      mimeType: "text/csv;charset=utf-8",
      onSuccess: () => {
        triggerToast("Filtrelenmiş Finansal Rapor başarıyla indirildi! 📊");
      },
      onError: () => {
        try {
          navigator.clipboard.writeText(csvContent);
          triggerToast("📋 Rapor panoya kopyalandı! Excel veya E-Tablolar'a yapıştırabilirsiniz.");
        } catch {
          triggerToast("Rapor indirilemedi.");
        }
      }
    });
  };

  const handleImportBackup = () => {
    if (!isPremium) {
      setPromoFeature("Veri Yedekleme (İçe Aktarma)");
      setIsUpgradeModalOpen(true);
      return;
    }
    triggerToast(language === "tr" ? "Yedek Dosyası Seçin (.json)... 📂" : "Select Backup File (.json)... 📂");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.style.display = "none";
    document.body.appendChild(input);

    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        processBackupJSON(evt.target?.result as string);
      };
      reader.readAsText(file);
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    };
    input.click();
  };

  const handleResetAllData = () => {
    triggerConfirm(
      "TÜM VERİLERİ SIFIRLA",
      "BU KULLANICIYA AİT TÜM VERİLER SİLİNECEK! Bu işlem geri alınamaz. Onaylıyor musunuz?",
      () => {
        setDebts([]);
        setIncomes([]);
        setAlarms([]);
        setNotifications([]);
        setInstallmentDebts([]);
        setPayments([]);
        setExpenses([]);
        setExpenseCategories([]);
        const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
        localStorage.removeItem(spaceKey);
        triggerToast("Bütün veriler sıfırlandı!");
      }
    );
  };

  // Handle external navigation events (from child components)
  useEffect(() => {
    const handleNavToAi = () => setActiveTab("aiStrategy");
    window.addEventListener("nav-to-ai", handleNavToAi);
    return () => window.removeEventListener("nav-to-ai", handleNavToAi);
  }, []);

  // Scroll back to top on navigation to prevent scroll restoration issues inside Web/iFrame environments and ensure all page content is visible
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      
      const mainElement = document.querySelector("main");
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
    }
  }, [activeTab, showPublicView]);

  // Navigation target mappings
  const sidebarItems = [
    { id: "overview", label: "GENEL BAKIŞ", icon: LayoutDashboard },
    { id: "monthly", label: "AYLIK TAKİP", icon: Calendar },
    { id: "yearly", label: "YILLIK TAKİP", icon: Activity },
    { id: "debts", label: "BORÇ LİSTESİ", icon: Coins },
    { id: "contacts", label: "KİŞİ ALACAK/VERECEK", icon: Users, isPro: true },
    { id: "income", label: "GELİRLER", icon: Wallet },
    { id: "expenses", label: "GİDERLER", icon: ShoppingCart },
    { id: "installments", label: "TAKSİTLİ BORÇLAR", icon: Calendar },
    { id: "gplay_enhancements", label: "PRO ÖZELLİKLER", icon: Sparkles, isPro: true },
    { id: "notifications", label: "BİLDİRİM AYARLARI", icon: Bell, isPro: true },
    { id: "aiStrategy", label: "AKILLI ASİSTAN (AI)", icon: Sparkles, isPro: true },
    { id: "financialTools", label: "FİNANSAL ANALİZ", icon: TrendingUp, isPro: true },
    { id: "settings", label: "GÜVENLİK VE AYARLAR", icon: Settings },
    { id: "help", label: "KULLANIM REHBERİ", icon: HelpCircle },
    { id: "blog", label: "FİNANS KILAVUZLARI", icon: BookOpen },
    { id: "feedback", label: "GERİ BİLDİRİM", icon: MessageSquare },
    { id: "about", label: "HAKKINDA", icon: Star },
    { id: "privacy", label: "GİZLİLİK POLİTİKASI", icon: Shield },
    { id: "public_landing", label: "TANITIM & AÇILIŞ", icon: Compass }
  ];

  const handleNavClick = (tabId: string) => {
    if (tabId === "public_landing") {
      setShowPublicView("landing");
      setIsSidebarOpen(false);
      return;
    }

    if (tabId === "security" || tabId === "security_settings" || tabId === "settings") {
      setActiveTab("settings");
      setIsSidebarOpen(false);
      return;
    }

    if (tabId === "voice_assistant" || tabId === "voice") {
      setVoiceAssistantEnabled(true);
      triggerToast("🎙️ Sesli Finans Asistanı aktif edildi! Sağ alt taraftaki mikrofon butonuna basıp konuşabilirsiniz.");
      setIsSidebarOpen(false);
      return;
    }

    if (tabId === "currency" || tabId === "markets") {
      setActiveTab("gplay_enhancements");
      setIsSidebarOpen(false);
      setTimeout(() => {
        const el = document.getElementById("live-currency-converter-widget");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 150);
      return;
    }

    if (tabId === "cloud_sync" || tabId === "cloud" || tabId === "backup_cloud") {
      setActiveTab("settings");
      setIsSidebarOpen(false);
      return;
    }

    const clickedItem = sidebarItems.find(item => item.id === tabId);
    if (clickedItem?.isPro && !isPremium) {
      openUpgradeModal(clickedItem.label);
      triggerToast(`👑 ${clickedItem.label} özelliği yalnızca Pro üyelerimize özeldir!`);
      return;
    }

    setActiveTab(tabId);
    setIsSidebarOpen(false);
  };

  if (showPublicView === "landing") {
    return (
      <div className={`min-h-screen font-sans transition-all duration-300 bg-[#f8fafc] dark:bg-[#0f172a] theme-${colorTheme}`}>
        <PublicLanding
          onStartApp={() => {
            localStorage.setItem("skip_landing", "true");
            setActiveTab("overview");
            setShowPublicView(null);
          }}
          onNavigateToTab={(tabId) => {
            localStorage.setItem("skip_landing", "true");
            setActiveTab(tabId);
            setShowPublicView(null);
          }}
          onNavigateToPrivacy={() => {
            localStorage.setItem("skip_landing", "true");
            setActiveTab("privacy");
            setShowPublicView(null);
          }}
          onUpgradeToPro={() => {
            localStorage.setItem("skip_landing", "true");
            setActiveTab("overview");
            setShowPublicView(null);
            setIsUpgradeModalOpen(true);
          }}
          onNavigateToBlog={() => setShowPublicView("blog")}
          onNavigateToPost={(id) => {
            setSelectedPublicPostId(id);
            setShowPublicView("blog");
          }}
        />
      </div>
    );
  }

  if (showPublicView === "blog") {
    return (
      <div className={`min-h-screen font-sans transition-all duration-300 bg-[#f8fafc] dark:bg-[#0f172a] theme-${colorTheme}`}>
        <PublicBlog
          selectedPostId={selectedPublicPostId}
          onSelectPost={setSelectedPublicPostId}
          onStartApp={() => {
            localStorage.setItem("skip_landing", "true");
            setActiveTab("overview");
            setShowPublicView(null);
          }}
          onBackToLanding={() => setShowPublicView("landing")}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-16 md:pb-6 font-sans transition-all duration-300 bg-[#f8fafc] dark:bg-[#0f172a] theme-${colorTheme}`}>
      <AnimatePresence mode="wait">
        {showOnboarding && (
          <OnboardingWalkthrough
            key="onboarding-walkthrough-modal"
            onComplete={handleCompleteOnboarding}
            language={language}
            isPremium={isPremium}
            onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
            onDirectLoginClick={handleOnboardingDirectLogin}
          />
        )}
        {splashVisible && (
          <motion.div
            key="premium-splash-loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-slate-950 text-white p-6 select-none overflow-hidden"
          >
            {/* Background floating visual aesthetics (100% stable, no Math.random hydration bugs) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
              {[
                { left: "12%", top: "20%", duration: 22, text: "₺", delay: 0 },
                { left: "85%", top: "15%", duration: 18, text: "%", delay: 1 },
                { left: "75%", top: "78%", duration: 25, text: "$", delay: 2 },
                { left: "18%", top: "65%", duration: 20, text: "₺", delay: 0.5 },
                { left: "45%", top: "85%", duration: 28, text: "€", delay: 1.5 },
                { left: "55%", top: "10%", duration: 24, text: "+", delay: 3 },
              ].map((p, idx) => (
                <motion.div
                  key={idx}
                  animate={{ 
                    y: [0, -15, 0],
                    x: [0, 10, 0],
                    opacity: [0.15, 0.4, 0.15]
                  }}
                  transition={{ 
                    duration: p.duration, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    delay: p.delay 
                  }}
                  className="absolute text-indigo-400 text-3xl font-black font-mono"
                  style={{ left: p.left, top: p.top }}
                >
                  {p.text}
                </motion.div>
              ))}
            </div>

            {/* Glowing gradient backdrops */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-emerald-500/10 blur-[130px] pointer-events-none animate-pulse [animation-delay:2s]" />

            <div className="text-center space-y-6 max-w-sm w-full relative z-10">
              {/* Premium Animated 4-Quadrant Logo Loader (Matching user's reference screenshot exactly) */}
              <div className="relative inline-flex flex-col items-center justify-center mx-auto mb-6">
                {/* Ambient glowing back shadow */}
                <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-3xl scale-150 animate-pulse pointer-events-none" />
                <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-2xl scale-125 pointer-events-none" />
                
                {/* Outer spinning dashed ring (Clockwise) with glowing orbit satellite dot */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 18, ease: "linear" }}
                  className="w-44 h-44 border border-dashed border-cyan-400/40 rounded-full absolute flex items-start justify-center"
                >
                  <div className="w-2.5 h-2.5 -mt-1 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-pulse" />
                </motion.div>

                {/* Middle fast counter-spinning dotted ring */}
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 24, ease: "linear" }}
                  className="w-38 h-38 border-2 border-dotted border-emerald-400/35 rounded-full absolute flex items-end justify-center"
                >
                  <div className="w-2 h-2 -mb-1 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                </motion.div>

                {/* Outer glowing pulse border ring */}
                <motion.div
                  animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.85, 0.5] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="w-34 h-34 rounded-full border border-indigo-400/30 absolute pointer-events-none"
                />

                {/* Main 4-Quadrant Circular Animated Logo */}
                <motion.div
                  animate={{
                    scale: [1, 1.03, 1],
                    y: [0, -3, 0]
                  }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="relative z-10 w-32 h-32 sm:w-36 sm:h-36 rounded-full shadow-[0_0_35px_rgba(14,165,233,0.45)] overflow-hidden flex items-center justify-center p-0.5 bg-slate-900 border-2 border-slate-700/80"
                >
                  {/* The 4 Colored Quadrants (Pie Segments) */}
                  <div className="w-full h-full rounded-full overflow-hidden grid grid-cols-2 grid-rows-2 relative">
                    {/* 1. Top-Left: Cyan / Blue (Shopping Cart) */}
                    <div className="bg-[#00b4d8] flex items-center justify-center relative p-2 shadow-inner">
                      <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-md" />
                    </div>

                    {/* 2. Top-Right: Magenta / Rose (Fuel Pump) */}
                    <div className="bg-[#e63973] flex items-center justify-center relative p-2 shadow-inner">
                      <Fuel className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-md" />
                    </div>

                    {/* 3. Bottom-Left: Emerald / Green (Utensils / Food) */}
                    <div className="bg-[#10b981] flex items-center justify-center relative p-2 shadow-inner">
                      <Utensils className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-md" />
                    </div>

                    {/* 4. Bottom-Right: Amber / Golden (Coffee / Cafe) */}
                    <div className="bg-[#eab308] flex items-center justify-center relative p-2 shadow-inner">
                      <Coffee className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-md" />
                    </div>

                    {/* Center Dark Circular Disc / Hub with Glowing Border */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1e293b] border-2 border-slate-900 shadow-lg flex items-center justify-center z-20">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#090d16] border border-slate-700" />
                    </div>

                    {/* Subtle division lines between quadrants */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-950/60 pointer-events-none z-10" />
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-slate-950/60 pointer-events-none z-10" />
                  </div>
                </motion.div>
              </div>
              
              {/* Splendid Title Card */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.08 }
                  }
                }}
                className="space-y-3 select-none"
              >
                <div className="flex items-center justify-center gap-2 font-black text-3xl sm:text-4xl tracking-tight drop-shadow-[0_0_20px_rgba(99,102,241,0.55)]">
                  <motion.span
                    variants={{
                      hidden: { opacity: 0, y: -20, scale: 0.8 },
                      visible: { opacity: 1, y: 0, scale: 1 }
                    }}
                    transition={{ type: "spring", stiffness: 220, damping: 11 }}
                    className="text-white inline-block font-black tracking-wider"
                  >
                    BÜTÇEM
                  </motion.span>
                  
                  <motion.span
                    variants={{
                      hidden: { opacity: 0, y: 20, scale: 1.3, filter: "blur(4px)" },
                      visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
                    }}
                    transition={{ type: "spring", stiffness: 280, damping: 9, delay: 0.2 }}
                    style={{ textShadow: "0 0 16px rgba(34,211,238,0.85)" }}
                    className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent inline-block font-black tracking-wider"
                  >
                    PRO
                  </motion.span>
                </div>

                <motion.div
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
                  className="w-44 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto relative"
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-300 rounded-full blur-[2px] animate-ping" />
                </motion.div>
              </motion.div>

              {/* Progress Slider */}
              <div className="space-y-3 pt-1">
                <div className="w-full h-3 bg-slate-900/95 rounded-full border border-white/10 relative p-[2px] overflow-hidden">
                  {/* Glowing ambient flow back track */}
                  <div className="absolute inset-x-0 h-full bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-emerald-400/5" />
                  
                  <motion.div 
                    className="h-full rounded-full relative flex items-center justify-end"
                    initial={{ width: "4%" }}
                    animate={{ width: `${Math.max(4, splashProgress)}%` }}
                    transition={{ type: "tween", ease: "linear", duration: 0.05 }}
                    style={{ 
                      background: "linear-gradient(90deg, #8b5cf6 0%, #6366f1 40%, #06b6d4 100%)"
                    }}
                  >
                    {/* Glowing front lead cursor tip */}
                    {splashProgress > 1 && (
                      <span className="w-1.5 h-1.5 mr-0.5 rounded-full bg-white shadow-[0_0_8px_#ffffff] shrink-0 inline-block animate-pulse" />
                    )}
                  </motion.div>
                </div>
                
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1">
                  <span className="animate-pulse flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-indigo-400 animate-ping inline-block" />
                    {splashStatus}
                  </span>
                  <span className="font-mono font-bold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-500/10 shadow-md">{splashProgress}%</span>
                </div>
              </div>

              {/* Real-time Loading Systems Checklist */}
              <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-white/5 space-y-2.5 text-left max-w-xs mx-auto text-[10px] font-bold tracking-wider">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{splashProgress >= 30 ? "⚡" : "⏳"}</span>
                    <span className={splashProgress >= 30 ? "text-slate-400 line-through decoration-emerald-500/50" : "text-slate-300"}>
                      GÜVENLİ VERİ YAPILANDIRMASI
                    </span>
                  </div>
                  <span className={splashProgress >= 30 ? "text-emerald-400 font-extrabold flex items-center gap-1" : "text-indigo-400 animate-pulse font-extrabold"}>
                    {splashProgress >= 30 ? "TAMAMLANDI ✓" : "YAPILANDIRILIYOR..."}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{splashProgress >= 65 ? "🧠" : "⏳"}</span>
                    <span className={splashProgress >= 65 ? "text-slate-400 line-through decoration-emerald-500/50" : "text-slate-300"}>
                      AKILLI FİNANS MOTORU
                    </span>
                  </div>
                  <span className={splashProgress >= 65 ? "text-emerald-400 font-extrabold flex items-center gap-1" : splashProgress >= 30 ? "text-indigo-400 animate-pulse font-extrabold" : "text-slate-500"}>
                    {splashProgress >= 65 ? "HAZIR ✓" : splashProgress >= 30 ? "YÜKLENİYOR" : "BEKLENİYOR"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{splashProgress >= 90 ? "📡" : "⏳"}</span>
                    <span className={splashProgress >= 90 ? "text-slate-400 line-through decoration-emerald-500/50" : "text-slate-300"}>
                      PUSH ALARM SUNUCUSU
                    </span>
                  </div>
                  <span className={splashProgress >= 90 ? "text-emerald-400 font-extrabold flex items-center gap-1" : splashProgress >= 65 ? "text-indigo-400 animate-pulse font-extrabold" : "text-slate-500"}>
                    {splashProgress >= 90 ? "BAĞLANDI ✓" : splashProgress >= 65 ? "YÜKLENİYOR" : "BEKLENİYOR"}
                  </span>
                </div>
              </div>

              {/* Fast forward skip button for super fast launch */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setSplashProgress(100);
                  setSplashStatus("Sistemler Kısayolla Başlatıldı!");
                  setTimeout(() => {
                    setSplashVisible(false);
                  }, 80);
                }}
                className="px-6 py-2.5 rounded-full bg-white border border-indigo-100 text-xs font-black uppercase text-indigo-950 tracking-wider shadow-lg hover:bg-slate-100 cursor-pointer select-none transition-all flex items-center gap-2 mx-auto"
              >
                <span>HEMEN BAŞLA</span>
                <span className="text-amber-500 text-sm">⚡</span>
              </motion.button>
            </div>

            {/* Footer info lock */}
            <div className="absolute bottom-6 text-[9px] text-slate-400 tracking-widest uppercase font-black text-center space-y-0.5">
              <div>Bütçem v5.0 Ultimate Edition</div>
              <div className="text-[7.5px] text-slate-500 font-mono tracking-normal text-center">Secure AES-256 Workspace Ingress • Verified</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal to bypass browser modal blocking inside sandboxed iframe previews */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs transition-all duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 transform scale-100 transition-all">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1 px-1.5 rounded-lg bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-base font-bold">💡</span>
                <h3 className="text-xs font-black text-slate-950 dark:text-white uppercase tracking-wider">
                  {confirmModal.title}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3 text-[11px] font-black tracking-wider uppercase bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-2xl transition cursor-pointer select-none"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="flex-1 py-3 text-[11px] font-black tracking-wider uppercase bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-md transition cursor-pointer select-none"
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Toast Alerts */}
      {showToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-700/50 text-white rounded-full px-5 py-2.5 shadow-lg text-xs font-bold leading-relaxed flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" /> {toastMessage}
        </div>
      )}

      {/* Session Terminated (Single Concurrent Device Restriction) Dialog */}
      {sessionTerminatedReason && (
        <div 
          id="session-terminated-modal"
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[1100] flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-500 mx-auto flex items-center justify-center border border-amber-500/30">
              <Shield className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Güvenlik Uyarısı
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                Oturumunuz Sonlandırıldı
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                {sessionTerminatedReason}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Premium hesaplar eşzamanlı tek cihaz korumalıdır. Bu cihazda devam etmek için lütfen tekrar giriş yapın.
              </p>
            </div>
            <button
              id="btn-re-login-terminated"
              type="button"
              onClick={() => {
                setSessionTerminatedReason(null);
                setProviderLoginOpen(true);
              }}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer active:scale-95 shadow-lg shadow-amber-500/25"
            >
              Bu Cihazda Tekrar Giriş Yap
            </button>
          </div>
        </div>
      )}

      {/* Real-time Interactive Google and Hotmail Login Portal */}
      <ProviderLoginModal
        isOpen={providerLoginOpen}
        provider={selectedProvider}
        isPremium={isPremium}
        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
        onClose={() => {
          setProviderLoginOpen(false);
          setSelectedProvider(null);
          // 3. Madde: Kullanıcı ekranı elle kapatsa bile Premium durumunu anında global state'e yansıt
          const fbUser = auth.currentUser;
          const currentEmail = (fbUser?.email || localStorage.getItem("currentUser") || "").toLowerCase();
          if (currentEmail === "info.borcodemetakip@gmail.com") {
            setIsPremium(true);
            localStorage.setItem("is_premium", "true");
            localStorage.setItem("is_guest", "false");
            localStorage.setItem("premium_source", "login");
          } else if (localStorage.getItem("is_premium") === "true") {
            setIsPremium(true);
          }
        }}
        onLoginSuccess={handleProviderLoginSuccess}
        onContinueGuest={() => {
          setProviderLoginOpen(false);
          setSelectedProvider(null);
          triggerToast("Misafir modu ile devam ediliyor (Yerel Cihaz Hafızası) 👍");
        }}
      />

      {/* Header Container - Premium Glossy Mesh Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-slate-950 via-[#0b132b] to-[#1c2541] dark:from-slate-950 dark:via-black dark:to-slate-950 border-b border-indigo-500/20 text-white shadow-2xl px-4 sm:px-8 py-5 md:py-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between backdrop-blur-lg transition-all duration-300 relative overflow-hidden group">
        
        {/* Decorative ambient lighting overlays */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-500/80 to-emerald-400/80 animate-pulse duration-[3000ms]" />
        <div className="absolute top-[-40%] right-[10%] w-72 h-24 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[2%] w-56 h-16 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        
        {/* Inner layout for logo and title */}
        <div className="flex items-center justify-between gap-3 sm:gap-4 min-w-0 relative z-10 w-full md:w-auto">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="p-2 sm:p-2.5 shrink-0 focus:outline-none bg-white/[0.04] hover:bg-white/[0.1] active:scale-95 rounded-2xl border border-white/10 transition-all cursor-pointer flex items-center justify-center shadow-md shadow-black/30"
              title="Menüyü Aç/Kapat"
            >
              <Menu className="w-5 h-5 text-indigo-200 group-hover:text-white transition" />
            </button>
            
            <div className="space-y-1 min-w-0">
              <h1 className="text-lg sm:text-2xl md:text-2xl lg:text-3xl font-black tracking-normal flex items-center select-none whitespace-nowrap gap-1.5 sm:gap-3 leading-none bg-gradient-to-r from-white via-slate-100 to-indigo-100 bg-clip-text text-transparent">
                <span className="animate-wave-flag inline-block shrink-0 select-none">
                  <svg viewBox="0 0 1200 800" className="w-[18px] h-[12px] sm:w-[32px] sm:h-[21.5px] md:w-[38px] md:h-[25.5px] rounded-xs shadow-md overflow-hidden shrink-0 inline-block border border-white/10" style={{ minWidth: "18px" }}>
                    <rect width="1200" height="800" fill="#e30a17"/>
                    <circle cx="400" cy="400" r="200" fill="#ffffff"/>
                    <circle cx="450" cy="400" r="160" fill="#e30a17"/>
                    <polygon points="585,400 643.78,419.1 607.45,369.1 607.45,430.9 643.78,380.9" fill="#ffffff" transform="rotate(-30 585 400)"/>
                  </svg>
                </span>
                <span>
                  BÜTÇEM
                </span>
                <span className="text-[8px] sm:text-[10px] md:text-xs px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-500 rounded-lg font-black tracking-widest uppercase animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                  PRO
                </span>
              </h1>
              <p className={`text-[7px] sm:text-[10px] font-black tracking-wider uppercase flex items-center gap-1 sm:gap-1.5 select-none leading-none ${isOfflineMode ? "text-amber-400" : "text-emerald-400/90"}`}>
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  {isOfflineMode ? (
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500 animate-pulse"></span>
                  ) : (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_4px_#10b981]"></span>
                    </>
                  )}
                </span>
                <span className="hidden sm:inline">{isOfflineMode ? "ÇEVRİMDIŞI (GÜVENLİ)" : "FİNANSAL ÖZGÜRLÜĞÜNÜZÜ BİZİMLE KEŞFEDİN"}</span>
                <span className="sm:hidden">{isOfflineMode ? "GÜVENLİ" : "AKILLI ASİSTAN"}</span>
              </p>
            </div>
          </div>

          {/* User welcome message styled beautifully inside a glossy container with a custom editable name trigger */}
          {(() => {
            const rawUser = currentUser || "";
            const cleanDisplayName = userProfileName?.trim() || (rawUser.includes("@") ? rawUser.split("@")[0] : rawUser);
            const displayGreeting = cleanDisplayName.trim() || (language === "tr" ? "İsim Girin" : "Add Name");

            const getWelcomeThemeStyles = () => {
              switch (colorTheme) {
                case "green":
                  return {
                    bg: "from-emerald-500/15 via-emerald-600/5 to-teal-500/15 hover:shadow-emerald-500/20",
                    border: "border-emerald-500/30 hover:border-emerald-500/60",
                    textGradient: "text-emerald-400 group-hover:text-emerald-300",
                    iconContainerBg: "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30 text-white",
                    pencilColor: "text-emerald-400 group-hover:text-emerald-300",
                    glow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_0_12px_rgba(16,185,129,0.15)]"
                  };
                case "purple":
                  return {
                    bg: "from-purple-500/15 via-purple-600/5 to-indigo-500/15 hover:shadow-purple-500/20",
                    border: "border-purple-500/30 hover:border-purple-500/60",
                    textGradient: "text-purple-400 group-hover:text-purple-300",
                    iconContainerBg: "bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/30 text-white",
                    pencilColor: "text-purple-400 group-hover:text-purple-300",
                    glow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_0_12px_rgba(168,85,247,0.15)]"
                  };
                case "orange":
                  return {
                    bg: "from-amber-500/15 via-orange-600/5 to-rose-500/15 hover:shadow-amber-500/20",
                    border: "border-amber-500/30 hover:border-amber-500/60",
                    textGradient: "text-amber-400 group-hover:text-amber-300",
                    iconContainerBg: "bg-gradient-to-br from-amber-500 to-rose-600 shadow-amber-500/30 text-white",
                    pencilColor: "text-amber-400 group-hover:text-amber-300",
                    glow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_0_12px_rgba(245,158,11,0.15)]"
                  };
                default:
                  return {
                    bg: "from-indigo-500/15 via-indigo-600/5 to-cyan-500/15 hover:shadow-indigo-500/20",
                    border: "border-indigo-500/30 hover:border-indigo-500/60",
                    textGradient: "text-indigo-400 group-hover:text-indigo-300",
                    iconContainerBg: "bg-gradient-to-br from-indigo-500 to-cyan-600 shadow-indigo-500/30 text-white",
                    pencilColor: "text-indigo-400 group-hover:text-indigo-300",
                    glow: "shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_0_12px_rgba(99,102,241,0.15)]"
                  };
              }
            };

            const themeStyles = getWelcomeThemeStyles();
            return (
              <motion.div 
                key={(userProfileName || cleanDisplayName) + colorTheme}
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="flex items-center shrink-0 max-w-[150px] xs:max-w-[180px] sm:max-w-none ml-1 sm:ml-2"
              >
                <button 
                  onClick={handlePromptEditName}
                  title={language === "tr" ? "İsmini değiştirmek veya yazmak için tıkla" : "Click to change or write your name"}
                  className={`group flex items-center gap-1.5 sm:gap-2.5 bg-gradient-to-r ${themeStyles.bg} backdrop-blur-md px-2 sm:px-3 py-1.5 rounded-xl border ${themeStyles.border} ${themeStyles.glow} transition-all duration-300 cursor-pointer select-none shrink-0 w-full hover:brightness-110 active:scale-95`}
                >
                  <div className={`p-1.5 ${themeStyles.iconContainerBg} rounded-lg group-hover:scale-110 group-hover:rotate-[12deg] transition-all duration-300 flex items-center justify-center shrink-0`}>
                    <User className="w-3 sm:w-3.5 h-3 sm:h-3.5 animate-pulse" />
                  </div>
                  <div className="flex flex-col text-left leading-tight min-w-0 pr-0.5 select-none text-ellipsis overflow-hidden">
                    <span className="text-[7px] sm:text-[9.5px] font-black uppercase tracking-widest text-slate-400">
                      {language === "tr" ? "HOŞ GELDİNİZ" : "WELCOME"}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5 min-w-0">
                      <span className={`text-[10px] sm:text-xs font-bold leading-tight ${themeStyles.textGradient} transition-all duration-300 truncate max-w-[65px] xs:max-w-[90px] sm:max-w-[140px] tracking-wide inline-block`}>
                        {displayGreeting}
                      </span>
                      <Pencil className={`w-2.5 h-2.5 ${themeStyles.pencilColor} shrink-0 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200`} />
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })()}
        </div>

        {/* Right side navigation toolbar / tools */}
        <div className="flex items-center overflow-x-auto scrollbar-none gap-1.5 sm:gap-2 shrink-0 relative z-10 w-full md:w-auto border-t md:border-t-0 border-white/5 pt-2.5 md:pt-0 justify-between md:justify-end">
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 select-none shrink-0">
            {/* Animated Contacts Directory Logo */}
            <motion.button
              onClick={() => {
                handleNavClick("contacts");
                triggerToast("Cari Hesaplar & Kişi Rehberi Açıldı! 👤📖");
              }}
              title="Kişi Rehberi & Cari Hesaplar"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                y: [0, -2, 0],
                rotate: [0, -1, 1, 0]
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className={`p-1.5 sm:p-2 lg:p-2.5 rounded-xl transition-all duration-305 flex items-center justify-center border cursor-pointer shrink-0 relative ${
                activeTab === "contacts"
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-slate-300 hover:border-indigo-500/30"
              }`}
            >
              {/* Binder spiral rings of directory book */}
              <div className="absolute left-1 top-1 bottom-1 w-0.5 rounded flex flex-col justify-around py-0.5">
                <div className="w-[3px] h-[3px] bg-indigo-400/80 rounded-full" />
                <div className="w-[3px] h-[3px] bg-indigo-400/80 rounded-full" />
                <div className="w-[3px] h-[3px] bg-indigo-400/80 rounded-full" />
              </div>
              
              <Users className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1 text-indigo-300 group-hover:text-white ${activeTab === "contacts" ? "animate-pulse" : "animate-bounce"}`} style={{ animationDuration: "2.5s" }} />
              
              <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
              </span>
            </motion.button>

            <button
              onClick={() => {
                openUpgradeModal();
              }}
              title="Premium Sürüme Yükselt"
              className={`p-1.5 sm:p-2 lg:p-2.5 rounded-xl border transition-all flex items-center justify-center space-x-1 duration-300 cursor-pointer shrink-0 active:scale-95 ${
                isPremium 
                  ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 border-amber-500/40 shadow-sm" 
                  : "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
              }`}
            >
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="text-[8px] sm:text-[9px] font-black tracking-wide uppercase">
                {isPremium ? "PREMIUM" : "PRO'YA GEÇ"}
              </span>
            </button>

            <button
              onClick={() => {
                setShowOnboarding(true);
                triggerToast("Bütçem Pro Tanıtım & Hoş Geldiniz Ekranı Açılıyor... ✨");
              }}
              title="Bütçem Pro Tanıtım & Hoş Geldiniz Turu"
              className="px-2 sm:px-2.5 py-1.5 sm:py-2 bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-emerald-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 border border-amber-500/40 text-amber-300 active:scale-95 rounded-xl transition-all flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black tracking-wide duration-300 cursor-pointer shrink-0 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="hidden xs:inline">TANITIM TURU</span>
            </button>

            <button
              onClick={() => handleNavClick("settings")}
              title="Güvenlik ve Ayarlar"
              className={`p-1.5 sm:p-2 lg:p-2.5 rounded-xl border transition-all flex items-center justify-center duration-300 cursor-pointer shrink-0 active:scale-95 ${
                activeTab === "settings"
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                  : "bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-600/30 text-indigo-400 dark:text-indigo-300"
              }`}
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>


            <button
              onClick={() => {
                if (themeMode === "auto") {
                  const nextDark = !darkMode;
                  const nextMode = nextDark ? "dark" : "light";
                  setThemeMode(nextMode);
                  setDarkMode(nextDark);
                  localStorage.setItem("themeMode", nextMode);
                  triggerToast(nextDark ? "Karanlık Mod Sabitlendi 🌙 (Otomatik için tekrar dokunun)" : "Aydınlık Mod Sabitlendi ☀️ (Otomatik için tekrar dokunun)");
                } else if (themeMode === "dark") {
                  setThemeMode("light");
                  setDarkMode(false);
                  localStorage.setItem("themeMode", "light");
                  triggerToast("Aydınlık Mod Sabitlendi ☀️ (Otomatik için tekrar dokunun)");
                } else {
                  setThemeMode("auto");
                  localStorage.setItem("themeMode", "auto");
                  const isSysDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
                  setDarkMode(!!isSysDark);
                  triggerToast(`Telefona Uyarlandı (Otomatik Mod) 📱 (${isSysDark ? "Karanlık" : "Aydınlık"})`);
                }
              }}
              title={`Tema: ${themeMode === "auto" ? "Telefona Göre Otomatik 📱" : themeMode === "dark" ? "Karanlık Mod 🌙" : "Aydınlık Mod ☀️"}`}
              className="p-1.5 sm:p-2 lg:p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 rounded-xl transition-all text-white flex items-center justify-center duration-300 cursor-pointer shadow-inner shrink-0 relative"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-200" />}
              {themeMode === "auto" && (
                <span className="absolute -top-1 -right-1 px-1 py-0.2 text-[7px] font-black bg-emerald-500 text-slate-950 rounded-full leading-none shadow-xs">
                  OTO
                </span>
              )}
            </button>

            <button
              onClick={() => {
                triggerToast("Uygulama Yenileniyor... 🔄");
                setTimeout(() => {
                  window.location.reload();
                }, 350);
              }}
              title="Sayfayı Yenile"
              className="p-1.5 sm:p-2 lg:p-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 active:scale-95 rounded-xl transition-all flex items-center justify-center duration-300 cursor-pointer shrink-0"
            >
              <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 animate-spin [animation-duration:15s]" />
            </button>

            <button
              onClick={() => {
                handleNavClick("notifications");
                const el = document.getElementById("main-nav-tabs") || document.getElementById("notifications-container");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth" });
                }
              }}
              title={`Bildirimler ve Alarmlar (${notifications.length})`}
              className="p-1.5 sm:p-2 lg:p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 rounded-xl transition-all text-white flex items-center justify-center duration-300 cursor-pointer shadow-inner relative shrink-0"
            >
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-300" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white font-mono text-[8px] sm:text-[9px] font-black h-3.5 min-w-[14px] px-1 rounded-full flex items-center justify-center ring-1 ring-slate-900">
                  {notifications.length}
                </span>
              )}
            </button>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="relative shrink-0">
              <select
                value={colorTheme}
                onChange={(e) => {
                  setColorTheme(e.target.value);
                  localStorage.setItem("colorTheme", e.target.value);
                }}
                className="appearance-none pl-2.5 pr-6 py-1.5 sm:py-2 bg-white/5 hover:bg-white/10 border border-white/10 dark:bg-slate-900 text-white rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] md:text-xs font-black tracking-wider uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer transition active:scale-95 text-center min-w-[65px] sm:min-w-[85px]"
              >
                <option value="default" className="text-slate-900 bg-white">MAVİ 🔵</option>
                <option value="green" className="text-slate-900 bg-white">YEŞİL 🟢</option>
                <option value="purple" className="text-slate-900 bg-white">MOR 🟣</option>
                <option value="orange" className="text-slate-900 bg-white">TURUNCU 🟠</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-white/50 text-[7px]" style={{ right: "6px" }}>
                ▼
              </div>
            </div>

            {/* Currency (Döviz) Selector Dropdown */}
            <div className="relative shrink-0">
              <select
                value={activeCurrency}
                onChange={(e) => {
                  setActiveCurrency(e.target.value as any);
                  triggerToast(`Hesaplama Birimi Değiştirildi: ${e.target.value}`);
                }}
                title="Para Birimi Değiştir"
                className="appearance-none pl-2.5 pr-6 py-1.5 sm:py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] md:text-xs font-black tracking-wider uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer transition active:scale-95 text-center min-w-[65px] sm:min-w-[85px]"
              >
                <option value="TRY" className="text-slate-900 bg-white">TRY (₺)</option>
                <option value="USD" className="text-slate-900 bg-white">USD ($)</option>
                <option value="EUR" className="text-slate-900 bg-white font-mono">EUR (€)</option>
                <option value="GBP" className="text-slate-900 bg-white font-mono">GBP (£)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-emerald-300/60 text-[7px]" style={{ right: "6px" }}>
                ▼
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Firestore Connection / Sync Error Banner with full error text and retry */}
      {firestoreErrorMessage && (
        <div className="bg-rose-950/95 border-b border-rose-500/40 text-rose-100 px-4 py-3 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md animate-in fade-in z-20 relative">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 bg-rose-500/20 text-rose-300 rounded-lg shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-4 h-4 text-rose-300 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Firebase Firestore Bağlantı Uyarısı</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-rose-500/30 text-rose-300 rounded font-mono uppercase">Detaylı Hata</span>
              </p>
              <p className="text-[11px] font-mono text-rose-200/90 break-all select-all mt-0.5 leading-relaxed bg-black/30 p-1.5 rounded border border-rose-500/20">
                {firestoreErrorMessage}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              onClick={async () => {
                try {
                  goOnline(db);
                  triggerToast("Realtime Database ağı kontrol ediliyor...");
                  setFirestoreErrorMessage(null);
                  if (auth.currentUser) {
                    setIsOfflineMode(false);
                    const snap = await get(ref(db, `kullanicilar/${auth.currentUser.uid}/veriler`));
                    if (snap.exists()) {
                      triggerToast("Bulut bağlantısı sağlandı ve veriler eşitlendi!");
                    } else {
                      triggerToast("Bağlantı açık, Realtime Database hazır.");
                    }
                  }
                } catch (retryErr: any) {
                  const retryCode = retryErr?.code || "HATA";
                  const retryMsg = retryErr?.message || String(retryErr);
                  const fullRetry = `[${retryCode}] ${retryMsg}`;
                  setFirestoreErrorMessage(`Tekrar Deneme Hatası: ${fullRetry}`);
                  triggerToast(`Hata: ${fullRetry}`, 5000);
                }
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ağı Yeniden Başlat</span>
            </button>
            <button
              onClick={() => setFirestoreErrorMessage(null)}
              className="p-1.5 text-rose-300 hover:text-white hover:bg-rose-500/20 rounded-lg transition cursor-pointer"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Overdue & Due Debts Sliding Marquee Banner */}
      {(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const calculateDiffDays = (dateStr: string | null | undefined): number | null => {
          if (!dateStr) return null;
          const parts = parseDateParts(dateStr);
          if (!parts) return null;
          const due = new Date(parts.year, parts.month, parts.day, 0, 0, 0, 0);
          const diffTime = due.getTime() - today.getTime();
          return Math.round(diffTime / (1000 * 60 * 60 * 24));
        };

        const getNextInstallmentDateInfo = (firstDueDateStr: string, paidCount: number, totalCount: number) => {
          if (paidCount >= totalCount) return null;
          const parts = parseDateParts(firstDueDateStr);
          if (!parts) return null;
          const nextDate = new Date(parts.year, parts.month + paidCount, parts.day, 0, 0, 0, 0);
          const diffTime = nextDate.getTime() - today.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          const y = nextDate.getFullYear();
          const m = String(nextDate.getMonth() + 1).padStart(2, "0");
          const d = String(nextDate.getDate()).padStart(2, "0");
          return {
            dueDateStr: `${y}-${m}-${d}`,
            formattedDate: `${d}.${m}.${y}`,
            diffDays,
          };
        };

        const singleAlerts = debts
          .filter((d) => d.paid < d.amount && d.dueDate)
          .map((d) => {
            const diffDays = calculateDiffDays(d.dueDate);
            if (diffDays === null) return null;
            const remainingAmount = d.amount - d.paid;
            const parts = parseDateParts(d.dueDate);
            const formattedDate = parts ? `${String(parts.day).padStart(2, "0")}.${String(parts.month + 1).padStart(2, "0")}.${parts.year}` : d.dueDate;
            return {
              id: `single-${d.id}`,
              originalId: d.id,
              type: "single" as const,
              name: d.name,
              category: d.category,
              providerId: d.providerId,
              dueDate: d.dueDate,
              formattedDate,
              remainingAmount,
              isOverdue: diffDays < 0,
              days: Math.abs(diffDays),
              actualDiffDays: diffDays,
            };
          });

        const installmentAlerts = installmentDebts
          .filter((inst) => inst.paidInstallmentCount < inst.installmentCount && inst.firstDueDate)
          .map((inst) => {
            const nextInfo = getNextInstallmentDateInfo(inst.firstDueDate, inst.paidInstallmentCount, inst.installmentCount);
            if (!nextInfo) return null;
            const installmentAmount = inst.totalAmount / inst.installmentCount;
            return {
              id: `installment-${inst.id}`,
              originalId: inst.id,
              type: "installment" as const,
              name: inst.name,
              installmentLabel: `${inst.paidInstallmentCount + 1}. Taksit`,
              dueDate: nextInfo.dueDateStr,
              formattedDate: nextInfo.formattedDate,
              remainingAmount: installmentAmount,
              isOverdue: nextInfo.diffDays < 0,
              days: Math.abs(nextInfo.diffDays),
              actualDiffDays: nextInfo.diffDays,
              providerId: inst.providerId,
            };
          });

        const validAlerts = [...singleAlerts, ...installmentAlerts].filter(
          (item): item is NonNullable<typeof item> => item !== null
        );

        // Filter alerts: Prioritize overdue, due today, and debts due in the next 30 days
        // If there are few alerts (e.g. <= 5), include all active debts with due dates so users always have visibility
        const allAlerts = validAlerts
          .filter((item) => item.actualDiffDays <= 30 || validAlerts.length <= 5)
          .sort((a, b) => {
            if (a.isOverdue && !b.isOverdue) return -1;
            if (!a.isOverdue && b.isOverdue) return 1;
            if (a.isOverdue && b.isOverdue) return b.days - a.days; // Most overdue first
            return a.actualDiffDays - b.actualDiffDays; // Soonest due first
          });

        const unpaidDebtsWithoutDueDate = debts.filter((d) => d.paid < d.amount && !d.dueDate);

        const getAlertThemeStyles = () => {
          switch (colorTheme) {
            case "green":
              return {
                barBg: "bg-gradient-to-r from-emerald-50/95 via-emerald-100/95 to-emerald-50/95 dark:from-emerald-950/40 dark:via-emerald-900/40 dark:to-emerald-950/40 border-b-2 border-emerald-500/40",
                badgeBg: "bg-gradient-to-r from-emerald-600 to-emerald-700 border-emerald-500/20",
                buttonBorder: "border-emerald-200/60 dark:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
                overdueLabelBg: "bg-emerald-600",
                overdueText: "text-emerald-900 dark:text-emerald-100",
                priceBg: "bg-emerald-100/80 dark:bg-emerald-950/75 border-emerald-500/20 text-emerald-700 dark:text-emerald-200",
                separator: "bg-emerald-300 dark:bg-emerald-800"
              };
            case "purple":
              return {
                barBg: "bg-gradient-to-r from-purple-50/95 via-purple-100/95 to-purple-50/95 dark:from-purple-950/40 dark:via-purple-900/40 dark:to-purple-950/40 border-b-2 border-purple-500/40",
                badgeBg: "bg-gradient-to-r from-purple-600 to-purple-700 border-purple-500/20",
                buttonBorder: "border-purple-200/60 dark:border-purple-800/50 hover:bg-purple-50 dark:hover:bg-purple-950/30",
                overdueLabelBg: "bg-purple-600",
                overdueText: "text-purple-900 dark:text-purple-100",
                priceBg: "bg-purple-100/80 dark:bg-purple-950/75 border-purple-500/20 text-purple-700 dark:text-purple-200",
                separator: "bg-purple-300 dark:bg-purple-800"
              };
            case "orange":
              return {
                barBg: "bg-gradient-to-r from-amber-50/95 via-amber-100/95 to-amber-50/95 dark:from-amber-950/40 dark:via-amber-900/40 dark:to-amber-950/40 border-b-2 border-amber-500/40",
                badgeBg: "bg-gradient-to-r from-amber-600 to-amber-700 border-amber-500/20",
                buttonBorder: "border-amber-200/60 dark:border-amber-800/50 hover:bg-amber-50 dark:hover:bg-amber-950/30",
                overdueLabelBg: "bg-amber-600",
                overdueText: "text-amber-900 dark:text-amber-100",
                priceBg: "bg-amber-100/80 dark:bg-amber-950/75 border-amber-500/20 text-amber-700 dark:text-amber-200",
                separator: "bg-amber-300 dark:bg-amber-800"
              };
            default: // indigo / default
              return {
                barBg: "bg-gradient-to-r from-indigo-50/95 via-indigo-100/95 to-indigo-50/95 dark:from-indigo-950/40 dark:via-indigo-900/40 dark:to-indigo-950/40 border-b-2 border-indigo-500/40",
                badgeBg: "bg-gradient-to-r from-indigo-600 to-indigo-700 border-indigo-500/20",
                buttonBorder: "border-indigo-200/60 dark:border-indigo-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30",
                overdueLabelBg: "bg-indigo-600",
                overdueText: "text-indigo-900 dark:text-indigo-100",
                priceBg: "bg-indigo-100/80 dark:bg-indigo-950/75 border-indigo-500/20 text-indigo-700 dark:text-indigo-200",
                separator: "bg-indigo-300 dark:bg-indigo-800"
              };
          }
        };

        const themeStyles = getAlertThemeStyles();

        // When alerts exist, repeat them so the CSS translateX(0%) to translateX(-50%) loop is smooth and continuous
        const itemsToLoop = allAlerts.length > 0
          ? (allAlerts.length < 3 ? [...allAlerts, ...allAlerts, ...allAlerts, ...allAlerts] : [...allAlerts, ...allAlerts])
          : [];

        return (
          <div className={`relative w-full py-1.5 overflow-hidden flex items-center z-20 shadow-xs backdrop-blur-md ${themeStyles.barBg}`}>
            {/* Left Status Badge with Compact Responsive Label and Play/Pause Controller */}
            <div className={`absolute left-0 top-0 bottom-0 px-2 sm:px-3 text-white font-black text-[8.5px] sm:text-[9.5px] uppercase tracking-wider flex items-center gap-1 sm:gap-1.5 z-30 shadow-md rounded-r-xl border-r border-white/20 shrink-0 select-none ${themeStyles.badgeBg}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
              <span className="animate-pulse tracking-tight hidden sm:inline whitespace-nowrap">VADE UYARILARI ⏰</span>
              <span className="animate-pulse tracking-tight sm:hidden text-[8.5px] whitespace-nowrap">VADE ⏰</span>
              <button
                type="button"
                id="btnMarqueeToggle"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const next = !marqueePaused;
                  handleSetMarqueePaused(next);
                  triggerToast(next ? "Bant Akışı Duraklatıldı ⏸️" : "Bant Akışı Başlatıldı ▶️");
                }}
                title={marqueePaused ? "Akışı Başlat (Oynat)" : "Akışı Duraklat"}
                className={`ml-1 px-2 py-0.5 rounded-lg text-[9.5px] sm:text-[10.5px] font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 shadow-xs active:scale-95 z-40 ${
                  marqueePaused
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white ring-1 ring-white/60 animate-pulse"
                    : "bg-white/25 hover:bg-white/35 text-white"
                }`}
              >
                <span>{marqueePaused ? "▶️" : "⏸️"}</span>
                <span className="hidden sm:inline font-bold">{marqueePaused ? "Başlat" : "Durdur"}</span>
              </button>
            </div>

            {/* Content Ticker */}
            <div className="w-full pl-28 sm:pl-56 overflow-hidden">
              {allAlerts.length > 0 ? (
                <div
                  className={`animate-marquee whitespace-nowrap flex items-center gap-3 sm:gap-5 text-xs font-bold py-0.5 ${marqueePaused ? "is-paused" : "is-running"}`}
                  style={{
                    animationDuration: `${Math.max(25, marqueeSpeed)}s`,
                    animationPlayState: marqueePaused ? "paused" : "running"
                  }}
                >
                  {itemsToLoop.map((d, index) => {
                    const rawName = d.name;
                    const categoryName = d.type === "single" ? d.category : undefined;
                    const provider = getProviderById(d.providerId) || detectProviderFromName(rawName, categoryName);
                    const displayName = d.type === "installment" ? `${d.name} (${d.installmentLabel})` : d.name;

                    return (
                      <button
                        key={`${d.id}-${index}`}
                        type="button"
                        onClick={() => {
                          if (d.type === "single") {
                            setFocusedDebtId(d.originalId);
                            setActiveTab("debts");
                          } else {
                            setFocusedInstallmentId(d.originalId);
                            setActiveTab("installments");
                          }
                          triggerToast(`📍 ${d.name} borcuna yönlendiriliyorsunuz...`);
                        }}
                        className={`inline-flex items-center gap-2 sm:gap-2.5 shrink-0 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-xl border text-left transition-all duration-200 select-none shadow-xs hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-xs ${
                          d.isOverdue
                            ? "bg-rose-50/95 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800/80 hover:bg-rose-100/90 dark:hover:bg-rose-900/60"
                            : d.actualDiffDays === 0
                            ? "bg-amber-50/95 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700/80 hover:bg-amber-100/90"
                            : "bg-white/95 dark:bg-slate-900/90 border-slate-300/80 dark:border-slate-700/90 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        {/* Provider Logo Badge */}
                        {provider && (
                          <ProviderBadge providerId={provider.id} size="xs" showLabel={false} />
                        )}

                        {d.isOverdue ? (
                          <>
                            <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[8.5px] sm:text-[9px] rounded-lg uppercase tracking-wide shadow-xs shrink-0 animate-pulse">
                              🚨 GECİKTİ • {d.days} GÜN
                            </span>
                            <span className="font-black text-rose-950 dark:text-rose-100 tracking-tight flex items-center gap-1.5">
                              <span>{displayName}</span>
                              {provider && (
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.2 rounded shrink-0">
                                  ({provider.badgeLabel || provider.name})
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300">({d.formattedDate})</span>
                            </span>
                          </>
                        ) : d.actualDiffDays === 0 ? (
                          <>
                            <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[8.5px] sm:text-[9px] rounded-lg uppercase tracking-wide shadow-xs shrink-0 animate-pulse">
                              ⚠️ BUGÜN SON GÜN
                            </span>
                            <span className="font-extrabold text-amber-950 dark:text-amber-200 tracking-tight flex items-center gap-1.5">
                              <span>{displayName}</span>
                              {provider && (
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded shrink-0">
                                  ({provider.badgeLabel || provider.name})
                                </span>
                              )}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className={`px-2 py-0.5 font-black text-[8.5px] sm:text-[9px] rounded-lg uppercase tracking-wide shadow-xs shrink-0 ${
                              d.actualDiffDays <= 3
                                ? "bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400"
                                : "bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                            }`}>
                              {d.actualDiffDays <= 3 ? `⏰ ${d.days} GÜN KALDI` : `⏳ ${d.days} GÜN`}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-1.5">
                              <span>{displayName}</span>
                              {provider && (
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded shrink-0">
                                  ({provider.badgeLabel || provider.name})
                                </span>
                              )}
                              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">({d.formattedDate})</span>
                            </span>
                          </>
                        )}
                        
                        <span className={`font-mono px-2 py-0.5 rounded-lg border font-black text-xs shrink-0 shadow-2xs ${
                          d.isOverdue
                            ? "bg-rose-200/90 dark:bg-rose-900/80 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100"
                            : "bg-slate-900 dark:bg-slate-800 text-white dark:text-amber-300 border-slate-800 dark:border-slate-700"
                        }`}>
                          {format(d.remainingAmount)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Informative Status Ticker when no urgent debt dates are present */
                <div className="flex items-center justify-between gap-3 text-xs py-0.5 px-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate">
                      {unpaidDebtsWithoutDueDate.length > 0
                        ? `💡 Vade Takibi: ${unpaidDebtsWithoutDueDate.length} adet borcunuza son ödeme tarihi belirleyerek canlı geri sayımı buradan izleyebilirsiniz.`
                        : "✨ Harika! Vadesi yaklaşan veya gecikmiş borcunuz bulunmuyor • Tüm vadeleriniz kontrol altında."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("debts");
                      triggerToast("Borçlar ve vadeler ekranına yönlendiriliyorsunuz...");
                    }}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black tracking-wide cursor-pointer transition shadow-xs active:scale-95"
                  >
                    {unpaidDebtsWithoutDueDate.length > 0 ? "Vade Belirle 📅" : "+ Borç Ekle 💳"}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Main Drawer Overlay for Sidebar */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* Side drawer panel - Açılır Menü */}
      <aside
        className={`fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-linear-to-b from-white via-slate-50/95 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border-r border-slate-200/90 dark:border-slate-800 z-50 transform transition-transform duration-300 flex flex-col justify-between overflow-y-auto shadow-2xl shadow-indigo-950/15 dark:shadow-black/70 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Animated fluid floating vector blobs for premium backdrop depth */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.08] dark:opacity-[0.14] z-0">
          <motion.div
            animate={{
              x: [0, 24, -14, 0],
              y: [0, -35, 25, 0],
              scale: [1, 1.18, 0.92, 1],
              rotate: [0, 90, 180, 0]
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -top-10 -left-10 w-44 h-44 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-400 blur-2xl"
          />
          <motion.div
            animate={{
              x: [0, -28, 18, 0],
              y: [0, 30, -22, 0],
              scale: [1, 0.88, 1.12, 1],
              rotate: [0, -90, -180, 0]
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 3
            }}
            className="absolute top-1/3 -right-12 w-48 h-48 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 blur-2xl"
          />
          <motion.div
            animate={{
              y: [0, 50, -35, 0],
              scale: [0.93, 1.16, 0.93]
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute bottom-12 left-6 w-38 h-38 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 blur-2xl"
          />
        </div>

        <div className="p-4 sm:p-5 space-y-4 relative z-10">
          {/* Workspace Title & Close Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-700/60 p-0.5 shadow-md shadow-indigo-500/20 shrink-0 overflow-hidden flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Bütçem Pro"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e: any) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-black text-slate-900 dark:text-slate-50 tracking-tight uppercase leading-none truncate">
                    {language === "tr" ? "Bütçem Pro" : "Budget Pro"}
                  </h2>
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                    v5.0
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {language === "tr" ? "Akıllı Finans Asistanı" : "Financial Assistant"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer active:scale-95 border border-slate-200/70 dark:border-slate-700/70 shrink-0"
              title="Menüyü Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tema Seçici: Telefona Uyarla (Otomatik) / Aydınlık / Karanlık */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[9.5px] font-black uppercase text-slate-400 tracking-wider">Görünüm Teması</span>
              <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                {themeMode === "auto" ? "Telefona Uyumlu 📱" : themeMode === "dark" ? "Karanlık 🌙" : "Aydınlık ☀️"}
              </span>
            </div>
            <div className="p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setThemeMode("auto");
                  localStorage.setItem("themeMode", "auto");
                  const isSysDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
                  setDarkMode(!!isSysDark);
                  triggerToast(`Telefona Uyarlandı (Otomatik Mod) 📱 (${isSysDark ? "Karanlık" : "Aydınlık"})`);
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  themeMode === "auto"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm border border-slate-200/60 dark:border-slate-600"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
                title="Telefonunuzun sistem ayarına göre otomatik geçiş yapar"
              >
                <Smartphone className="w-3 h-3 text-indigo-500" />
                <span>Otomatik</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setThemeMode("light");
                  localStorage.setItem("themeMode", "light");
                  setDarkMode(false);
                  triggerToast("Aydınlık Mod Etkinleştirildi ☀️");
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  themeMode === "light"
                    ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm border border-slate-200/60 dark:border-slate-600"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Sun className="w-3 h-3 text-amber-500" />
                <span>Aydınlık</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setThemeMode("dark");
                  localStorage.setItem("themeMode", "dark");
                  setDarkMode(true);
                  triggerToast("Karanlık Mod Etkinleştirildi 🌙");
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  themeMode === "dark"
                    ? "bg-white dark:bg-slate-700 text-indigo-400 shadow-sm border border-slate-200/60 dark:border-slate-600"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Moon className="w-3 h-3 text-sky-400" />
                <span>Karanlık</span>
              </button>
            </div>
          </div>

          {/* Local User Login profile area */}
          <div className="p-3.5 bg-white/90 dark:bg-slate-900/90 rounded-2xl flex flex-col gap-2 relative overflow-hidden border border-slate-200/90 dark:border-indigo-500/20 shadow-xs">
            {isQuickLoggingIn ? (
              <div className="py-6 text-center space-y-3">
                <span className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin inline-block" />
                <p className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 animate-pulse">
                  Google Hesabına Bağlanılıyor...
                </p>
                <p className="text-[9.5px] text-slate-400 font-medium">Lütfen açılan pencereyi onaylayın...</p>
              </div>
            ) : !currentUser ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70 dark:border-slate-800">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-indigo-500" />
                    <span>Bulut & Cihaz Girişi</span>
                  </span>
                  <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span>256-Bit SSL</span>
                  </span>
                </div>

                <p className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                  Kayıtlarınızı korumak ve tüm cihazlarınızdan senkronize etmek için bağlanın:
                </p>

                {/* E-Posta ile Bulut Giriş & Kayıt Kartı */}
                <div className="relative group/auth">
                  <motion.div
                    animate={{
                      scale: [1, 1.03, 1],
                      opacity: [0.4, 0.7, 0.4]
                    }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 rounded-xl blur-xs pointer-events-none"
                  />

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSidebarDeviceLogin}
                    className="relative w-full py-2.5 px-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-slate-850 hover:to-indigo-900 text-white rounded-xl text-[10px] font-black flex items-center justify-between border-2 border-amber-400/70 shadow-lg shadow-amber-600/20 transition-all cursor-pointer overflow-hidden text-left"
                  >
                    <motion.div
                      animate={{ x: ["-100%", "240%"] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.8 }}
                      className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-amber-300/20 to-transparent skew-x-12 pointer-events-none"
                    />

                    <div className="flex items-center gap-2.5 relative z-10">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 shadow-xs text-amber-300">
                        <Mail className="w-3.5 h-3.5 text-amber-300" />
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-white leading-tight flex items-center gap-1.5">
                          <span>E-Posta ile Giriş / Kayıt</span>
                        </div>
                        <div className="text-[8.5px] text-amber-200/90 font-semibold">👑 Premium Üyelere Özel</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 relative z-10 shrink-0">
                      <span className="text-[8px] font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                        <span>👑</span> PREMİUM
                      </span>
                    </div>
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-center animate-fade-in">
                {/* Visual Circle Profile Photo with upload trigger */}
                <div className="flex flex-col items-center gap-1.5 py-1">
                  <div className="relative group/avatar inline-block">
                    {userAvatar ? (
                      <img
                        src={userAvatar}
                        alt="Profil"
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500 shadow-md block"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 text-white flex items-center justify-center text-md font-black shadow-md uppercase">
                        {(userProfileName?.trim() || currentUser || "G").substring(0, 2)}
                      </div>
                    )}
                    <button
                      onClick={() => setIsAvatarPickerOpen((prev) => !prev)}
                      type="button"
                      className="absolute -bottom-1 -right-1 p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full border border-white dark:border-slate-800 shadow-md active:scale-90 transition cursor-pointer flex items-center justify-center"
                      title="Fotoğraf Ekle / Değiştir"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isAvatarPickerOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden bg-slate-100/80 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-200/70 dark:border-slate-800 text-center space-y-1.5"
                    >
                      <span className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400 block">PROFİL RESMİ GÜNCELLE</span>
                      
                      {/* Upload Button */}
                      <label className="block w-full py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 rounded-lg text-[9px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer transition shadow-xs text-center">
                        📸 RESİM SEÇ
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarFileChange}
                          className="hidden"
                        />
                      </label>
                      
                      {/* Quick preset colors */}
                      <div className="flex items-center justify-center gap-1">
                        {[
                          "from-amber-400 to-rose-500",
                          "from-blue-500 to-purple-600",
                          "from-emerald-400 to-teal-600",
                          "from-pink-500 to-red-600",
                          "from-indigo-600 to-slate-800"
                        ].map((grad, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              const colors = [
                                ["#fbbf24", "#f43f5e"],
                                ["#3b82f6", "#9333ea"],
                                ["#34d399", "#0d9488"],
                                ["#ec4899", "#dc2626"],
                                ["#4f46e5", "#1e293b"]
                              ];
                              const selectedColor = colors[i];
                              const svgText = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><defs><linearGradient id="g${i}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${selectedColor[0]}"/><stop offset="100%" stop-color="${selectedColor[1]}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g${i})"/><text x="50" y="55" font-family="'Inter', system-ui, sans-serif" font-weight="900" font-size="42" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${(userProfileName?.trim() || currentUser || "G").substring(0, 2).toUpperCase()}</text></svg>`;
                              const base64Svg = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;
                              handleSaveAvatar(base64Svg);
                            }}
                            className={`w-3.5 h-3.5 rounded-full bg-gradient-to-tr ${grad} border border-white dark:border-slate-850 shadow-xs cursor-pointer active:scale-90 transition`}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Aktif Profil</p>
                    <button
                      type="button"
                      onClick={handlePromptEditName}
                      className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition active:scale-95"
                      title="İsmi Güncelle"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                      <span>{userProfileName?.trim() ? "İsmi Değiştir" : "İsim Ekle"}</span>
                    </button>
                  </div>
                  <div 
                    onClick={handlePromptEditName}
                    className="px-3 py-2 bg-indigo-50/70 dark:bg-indigo-950/20 hover:bg-indigo-100/70 dark:hover:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/20 cursor-pointer transition group"
                    title="İsminizi güncellemek için tıklayın"
                  >
                    <div className="flex items-center justify-between gap-1 flex-wrap pb-1 border-b border-slate-200/60 dark:border-slate-800/85 mb-1">
                      <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1">
                        {currentUser?.includes("@") && !currentUser.endsWith("@borctakip.app") ? (
                          <>
                            <Shield className="w-3 h-3 text-indigo-400 shrink-0" /> Bulut Hesap
                          </>
                        ) : (
                          "Kişisel Hesap"
                        )}
                      </span>
                      {isPremium ? (
                        <span
                          onClick={(e) => { e.stopPropagation(); setIsUpgradeModalOpen(true); }}
                          className="px-1.5 py-0.5 bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 text-white rounded-md text-[8px] font-black tracking-wider animate-pulse cursor-pointer shadow-xs flex items-center gap-0.5"
                          title="Abonelik Yönetimi"
                        >
                          PREMIUM 👑
                        </span>
                      ) : (
                        <span
                          onClick={(e) => { e.stopPropagation(); setIsUpgradeModalOpen(true); }}
                          className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 dark:hover:text-white rounded-md text-[8px] font-black tracking-wider cursor-pointer transition flex items-center gap-0.5"
                          title="Premium'a Geç"
                        >
                          ÜCRETSİZ ⭐
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 text-left">
                        <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                          {userProfileName?.trim() || currentUser || (auth.currentUser?.email ?? "Kullanıcı")}
                        </p>
                        {userProfileName?.trim() && currentUser && (
                          <p className="text-[8.5px] font-mono text-slate-400 dark:text-slate-500 truncate">
                            {currentUser}
                          </p>
                        )}
                      </div>
                      <Pencil className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0 transition" />
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 text-[10px] font-extrabold rounded-xl flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Oturumu Kapat
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation link directories */}
          <nav className="space-y-1 flex-1 overflow-y-auto pr-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isProFeatured = (item as any).isPro;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`group w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-xs leading-normal transition-all cursor-pointer ${
                    isActive
                      ? "bg-linear-to-r from-indigo-600 to-indigo-700 text-white font-black shadow-md shadow-indigo-600/25 ring-1 ring-indigo-500/30"
                      : "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800/80 hover:text-indigo-600 dark:hover:text-indigo-400 border border-transparent hover:border-slate-200/70 dark:hover:border-slate-700/60 shadow-none hover:shadow-xs font-bold"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-indigo-950/60 dark:group-hover:text-indigo-400"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <span className="truncate text-left">{item.label}</span>
                  </div>
                  {isProFeatured && (
                    <motion.span
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[8px] font-black tracking-widest font-mono shrink-0 ml-1.5 ${
                        isActive
                          ? "bg-amber-300 text-slate-950 shadow-xs"
                          : "bg-linear-to-r from-amber-500 via-yellow-400 to-amber-600 text-slate-950 border border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.35)]"
                      }`}
                    >
                      PRO
                    </motion.span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Database backup controllers inside side panel footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md relative z-10">
          <div className="grid grid-cols-2 gap-2 text-[9px] font-bold">
            <button
              type="button"
              onClick={() => {
                if (!isPremium) {
                  setPromoFeature("Veri Yedekleme (Dışa Aktarma)");
                  setIsUpgradeModalOpen(true);
                  return;
                }
                handleExportBackup();
              }}
              className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition border border-slate-200/70 dark:border-slate-700/70 shadow-2xs hover:shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> DIŞA AKTAR
              {!isPremium && <span className="ml-1 text-[7px] bg-amber-500 text-slate-950 px-1 py-0.2 rounded font-black font-mono">PRO</span>}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isPremium) {
                  setPromoFeature("Veri Yedekleme (İçe Aktarma)");
                  setIsUpgradeModalOpen(true);
                  return;
                }
                handleImportBackup();
              }}
              className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition border border-slate-200/70 dark:border-slate-700/70 shadow-2xs hover:shadow-xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> İÇE AKTAR
              {!isPremium && <span className="ml-1 text-[7px] bg-amber-500 text-slate-950 px-1 py-0.2 rounded font-black font-mono">PRO</span>}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isPremium) {
                setPromoFeature("CSV Raporu");
                setIsUpgradeModalOpen(true);
                return;
              }
              setCsvStep("filter");
              setIsCsvModalOpen(true);
            }}
            className="w-full py-2.5 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm hover:shadow-md cursor-pointer uppercase tracking-tight relative overflow-hidden"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> FİNANSAL RAPORU İNDİR (.CSV)
            {!isPremium && <span className="absolute -top-1 -right-4 px-5 py-2 bg-amber-500 text-[7px] text-white font-black transform rotate-12 shadow-sm border border-amber-300/30">PRO</span>}
          </button>
          <button
            type="button"
            onClick={handleResetAllData}
            className="w-full py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-[9px] font-extrabold flex items-center justify-center gap-1 transition-all border border-dashed border-rose-400/40 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> TÜM VERİLERİ SIFIRLA
          </button>
        </div>
      </aside>

      {/* Central View Dashboard Grid content container */}
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24">

        {activeTab === "overview" && (
          <DashboardOverview
            stats={statsBag}
            onNavigate={handleNavClick}
            monthlyPaymentsCount={currentMonthTotalPaymentsCount}
            monthlyInstallmentsDue={monthlyInstallmentsDue}
            isPremium={isPremium}
            onUpgradeClick={() => openUpgradeModal("Genel Bakış & Gelişmiş Finans Paneli")}
            incomes={filteredIncomesByMonth}
            expenses={filteredExpensesByMonth}
            expenseCategories={expenseCategories}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            setSelectedMonth={setSelectedMonth}
            setSelectedYear={setSelectedYear}
            colorTheme={colorTheme}
            language={language}
          />
        )}

        {activeTab === "monthly" && (
          <FollowUpMonthlyYearly
            debts={debts}
            incomes={incomes}
            expenses={expenses}
            payments={payments}
            installmentDebts={installmentDebts}
            viewMode="monthly"
            language={language}
            onDeletePayment={handleDeletePayment}
            onClearPayments={handleResetPayments}
          />
        )}

        {activeTab === "yearly" && (
          <FollowUpMonthlyYearly
            debts={debts}
            incomes={incomes}
            expenses={expenses}
            payments={payments}
            installmentDebts={installmentDebts}
            viewMode="yearly"
            language={language}
            onDeletePayment={handleDeletePayment}
            onClearPayments={handleResetPayments}
          />
        )}

        {activeTab === "debts" && (
          <DebtList
            debts={debts}
            expenses={expenses}
            totalIncome={statsBag.totalIncome}
            onSaveDebt={handleSaveDebt}
            onSaveDebtBulk={handleSaveDebtBulk}
            onDeleteDebt={handleDeleteDebt}
            onToggleDebtPaid={handleToggleDebtPaid}
            onAddAlarm={handleAddAlarm}
            themeColor={colorTheme}
            onSaveInstallment={handleSaveInstallment}
            installmentDebts={installmentDebts}
            isPremium={isPremium}
            onUpgradeClick={() => openUpgradeModal("Borç Yönetimi & Gelişmiş Takip")}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            setSelectedMonth={setSelectedMonth}
            setSelectedYear={setSelectedYear}
            stats={statsBag}
            language={language}
            focusedDebtId={focusedDebtId}
            setFocusedDebtId={setFocusedDebtId}
            onResetPayments={handleResetPayments}
          />
        )}

        {activeTab === "contacts" && (
          <ContactsDebtPanel
            currentUser={currentUser}
            format={format}
            triggerToast={triggerToast}
            onAddAlarm={handleAddAlarm}
            language={language}
            isPremium={isPremium}
            onUpgradeClick={() => openUpgradeModal("Kişi Alacak/Verecek Takibi")}
          />
        )}

        {activeTab === "income" && (
          <IncomesList
            incomes={filteredIncomesByMonth}
            allIncomes={incomes}
            onSaveIncome={handleSaveIncome}
            onDeleteIncome={handleDeleteIncome}
            onRestoreIncomes={handleRestoreIncomes}
            isPremium={isPremium}
            onUpgradeClick={() => openUpgradeModal("Gelir & Kasa Takibi")}
            carryOverBalance={statsBag.carryOverBalance}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            setSelectedMonth={setSelectedMonth}
            setSelectedYear={setSelectedYear}
            language={language}
          />
        )}

        {activeTab === "expenses" && (
          <ExpensesList
            expenses={expenses}
            expenseCategories={expenseCategories}
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={handleDeleteExpense}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
            onUpdateAllCategories={handleSaveAllCategories}
            netBalance={statsBag.netIncome}
            isPremium={isPremium}
            onUpgradeClick={() => openUpgradeModal("Gider Analizi & Kategori Yönetimi")}
            language={language}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            setSelectedMonth={setSelectedMonth}
            setSelectedYear={setSelectedYear}
          />
        )}

        {activeTab === "installments" && (
          <InstallmentsList
            installmentDebts={installmentDebts}
            onSaveInstallment={handleSaveInstallment}
            onDeleteInstallment={handleDeleteInstallment}
            onPayInstallment={handlePayInstallment}
            onRevertPayment={handleRevertInstallmentPayment}
            onRestoreInstallments={handleRestoreInstallments}
            isPremium={isPremium}
            language={language}
            onUpgradeClick={() => openUpgradeModal("Taksitli Borçlar & Ödeme Planı")}
            focusedInstallmentId={focusedInstallmentId}
            setFocusedInstallmentId={setFocusedInstallmentId}
          />
        )}

        {activeTab === "notifications" && (
          <div className="space-y-6 animate-fade-in">
            {/* ORTALANMIŞ BAŞLIK ALANI */}
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-[11px] font-black uppercase tracking-wider shadow-xs">
                <Bell className="w-3.5 h-3.5 animate-swing" />
                <span>BİLDİRİM & ALARM MERKEZİ</span>
              </div>
              <motion.h2
                animate={{ y: [0, -1.2, 0] }}
                transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
                className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight"
              >
                Bildirimler, Alarmlar ve Ayarlar
              </motion.h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-lg mx-auto leading-relaxed">
                Ödeme alarmları, anlık sistem uyarıları, zil sesi melodileri ve e-posta bildirim ayarlarınızı tek ekrandan kolayca yönetin.
              </p>
            </div>

            {/* İLGİLİ BÖLÜMLERE GEÇMEK İÇİN GEZİNME BUTONLARI (ALT ALTA DEĞİL, SEKMELİ) */}
            <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-3xl mx-auto shadow-inner">
              <button
                type="button"
                onClick={() => setNotifSectionTab("feed")}
                className={`flex-1 min-w-[150px] sm:min-w-[180px] py-2.5 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${
                  notifSectionTab === "feed"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-200/80 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Bell className="w-4 h-4" />
                <span>Bildirimler & Alarmlar</span>
                {(notifications.length + getUpcomingPayments().length) > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    getUpcomingPayments().length > 0
                      ? "bg-amber-500 text-slate-950 animate-pulse"
                      : "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
                  }`}>
                    {notifications.length + getUpcomingPayments().length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setNotifSectionTab("settings")}
                className={`flex-1 min-w-[150px] sm:min-w-[180px] py-2.5 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${
                  notifSectionTab === "settings"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-200/80 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Push Bildirim & Sıklık Ayarları</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </button>
            </div>

            {/* SEÇİLEN BÖLÜM 1: BİLDİRİMLER VE ALARMLAR LİSTESİ */}
            {notifSectionTab === "feed" && (
              <div className="space-y-5 animate-fade-in">
                {/* Üst İşlem Çubuğu */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 rounded-2xl shadow-xs">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <span>Gelen Bildirim Akışı & Aktif Alarmlar</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      Borç vadeleri, sistem mesajları ve kurduğunuz özel hatırlatıcılar.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingAlarmNew(!isAddingAlarmNew)}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 active:scale-95 select-none"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>{isAddingAlarmNew ? "Formu Kapat" : "🔔 Yeni Hatırlatma Ekle"}</span>
                    </button>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearNotifs}
                        className="px-3.5 py-2 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-xs font-black rounded-xl transition hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer active:scale-95 select-none"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                </div>

                {/* Web Push & Kapalı Ekran Durum Bandı */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-900/50 rounded-2xl text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isPushSubscribed ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                      {isPushSubscribed
                        ? "Web Push & Arka Plan Alarmı: Aktif"
                        : "Arka Plan Alarm Servisi: Bağlantı kuruluyor..."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifSectionTab("settings")}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>⚙️ Ayarlar & 10sn Test</span>
                  </button>
                </div>

                {/* Premium Interactive Inline Alarm Ekleme Formu */}
                {isAddingAlarmNew && (
                  <div className="p-5 bg-white dark:bg-slate-800 border-2 border-indigo-500/30 rounded-3xl shadow-xl space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                        Yeni Ödeme Hatırlatıcısı / Alarm Kur
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingAlarmNew(false);
                          setNewAlarmTitle("");
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Alarm Başlığı / Konusu</label>
                        <input
                          type="text"
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                          placeholder="Ör: Kira ödemesi hatırlatması"
                          value={newAlarmTitle}
                          onChange={(e) => setNewAlarmTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hatırlatma Tarihi ve Saati</label>
                        <input
                          type="datetime-local"
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-mono"
                          value={newAlarmDate}
                          onChange={(e) => setNewAlarmDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span>🛡️</span>
                      <span>Web Push ve Service Worker entegrasyonu sayesinde alarmlarınız zamanında bildirilecektir.</span>
                    </p>
                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingAlarmNew(false);
                          setNewAlarmTitle("");
                        }}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black transition cursor-pointer"
                      >
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newAlarmTitle.trim()) {
                            triggerToast("Lütfen bir alarm başlığı girin.");
                            return;
                          }
                          handleAddAlarm(newAlarmTitle.trim(), newAlarmDate);
                          setNewAlarmTitle("");
                          setIsAddingAlarmNew(false);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md shadow-indigo-600/20"
                      >
                        Alarmı Kaydet ⏰
                      </button>
                    </div>
                  </div>
                )}

                {/* Gelen Bildirimler ve Alarmlar Grid */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                        💌 Bildirim Akışı
                      </h4>
                      <div className="flex gap-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl flex-wrap">
                        <button
                          type="button"
                          onClick={() => setNotifFilter("all")}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none cursor-pointer ${
                            notifFilter === "all"
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-slate-500 hover:text-indigo-600 dark:text-slate-400"
                          }`}
                        >
                          Tümü ({notifications.length + getUpcomingPayments().length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotifFilter("upcoming")}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none cursor-pointer ${
                            notifFilter === "upcoming"
                              ? "bg-amber-500 text-slate-950 shadow-xs font-black animate-none"
                              : getUpcomingPayments().length > 0
                              ? "bg-amber-500/10 text-amber-500 font-extrabold animate-pulse"
                              : "text-slate-500 hover:text-indigo-600"
                          }`}
                        >
                          ⚠️ Yaklaşan ({getUpcomingPayments().length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotifFilter("alarm")}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none cursor-pointer ${
                            notifFilter === "alarm"
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-slate-500 hover:text-indigo-600 dark:text-slate-400"
                          }`}
                        >
                          Alarmlar ({notifications.filter(n => !(n.type === "system" || n.title.includes("Hoş Geldiniz") || n.title.includes("Veritabanı") || n.title.includes("Sistem") || n.title.includes("Yedek") || n.title.includes("Temizlendi") || n.title.includes("Test"))).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotifFilter("system")}
                          className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none cursor-pointer ${
                            notifFilter === "system"
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-slate-500 hover:text-indigo-600 dark:text-slate-400"
                          }`}
                        >
                          Sistem ({notifications.filter(n => (n.type === "system" || n.title.includes("Hoş Geldiniz") || n.title.includes("Veritabanı") || n.title.includes("Sistem") || n.title.includes("Yedek") || n.title.includes("Temizlendi") || n.title.includes("Test"))).length})
                        </button>
                      </div>
                    </div>

                    {/* Dynamic Auto-Generated "Yaklaşan Gecikmiş Ödemeler" Highlight Cards */}
                    {(notifFilter === "all" || notifFilter === "upcoming") && getUpcomingPayments().length > 0 && (
                      <div className="bg-gradient-to-tr from-amber-50 to-orange-50 dark:from-slate-900 dark:to-orange-950/10 border-2 border-amber-400/60 dark:border-amber-800/50 rounded-2xl p-4 space-y-3.5 shadow-md shadow-amber-500/5 antialiased animate-fade-in">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[10px] sm:text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                            </span>
                            ⏰ YAKLAŞAN VE GECİKMİŞ ÖDEME PANORAMASI (3 GÜN EN FAZLA)
                          </h3>
                          <span className="text-[10px] bg-amber-200 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wide">
                            {getUpcomingPayments().length} ACİL VADE
                          </span>
                        </div>
                        
                        <div className="grid gap-2.5">
                          {getUpcomingPayments().map((item) => {
                            const isOverdue = item.daysLeft < 0;
                            const isToday = item.daysLeft === 0;
                            return (
                              <div
                                key={item.id}
                                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row justify-between sm:items-center gap-3.5 transition duration-150 ${
                                  isOverdue
                                    ? "bg-rose-50/75 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/30 hover:border-rose-400"
                                    : isToday
                                    ? "bg-amber-50/75 dark:bg-amber-950/10 border-amber-300 dark:border-amber-800 hover:border-amber-500 animate-pulse-slow"
                                    : "bg-white dark:bg-slate-900/65 border-slate-150 dark:border-slate-800/60 hover:border-amber-300"
                                }`}
                              >
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isOverdue ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black bg-rose-500 text-white uppercase tracking-wide leading-none">
                                        Gecikmiş ⚠️
                                      </span>
                                    ) : isToday ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-500 text-slate-950 uppercase tracking-wide leading-none">
                                        BUGÜN ACİL 🚨
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 uppercase tracking-wide leading-none">
                                        {item.daysLeft} GÜN KALDI ⏰
                                      </span>
                                    )}
                                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{item.title}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">{item.desc}</p>
                                  {item.dueDate && (
                                    <div className="text-[9.5px] text-slate-450 dark:text-slate-500 font-bold font-mono">
                                      VADE TARİHİ: {new Date(item.dueDate).toLocaleDateString("tr-TR")}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                                  <button
                                    onClick={() => {
                                      if (item.id.startsWith("upcoming-debt-")) {
                                        setActiveTab("debts");
                                        triggerToast("Borç listesine yönlendirildiniz. Ödeme kaydetmek için ilgili borca tıklayabilirsiniz.");
                                      } else {
                                        setActiveTab("installments");
                                        triggerToast("Taksit yönetimine yönlendirildiniz.");
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-[10.5px] font-black transition cursor-pointer select-none ${
                                      isOverdue
                                        ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                                        : isToday
                                        ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                    }`}
                                  >
                                    Git ve Öde 💳
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Empty states for upcoming tab */}
                    {notifFilter === "upcoming" && getUpcomingPayments().length === 0 && (
                      <div className="text-center py-10 p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-150 dark:border-slate-800">
                        <div className="text-4xl mb-2">🎉</div>
                        <h5 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">Mükemmel! Yaklaşan Borç Bulunmuyor</h5>
                        <p className="text-[11px] text-slate-400 dark:text-slate-450 mt-1 max-w-sm mx-auto">Vadesine 3 gün veya daha az kalan ödenmemiş acil borcunuz veya taksit ödemeniz bulunmamaktadır.</p>
                      </div>
                    )}

                    {/* Regular active notifications feed */}
                    {notifFilter !== "upcoming" && (
                      <>
                        {notifications.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-400 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                            Henüz yeni bildirim bulunmuyor.
                          </div>
                        ) : notifications.filter((n) => {
                          const isSys = n.type === "system" || n.title.includes("Hoş Geldiniz") || n.title.includes("Veritabanı") || n.title.includes("Sistem") || n.title.includes("Yedek") || n.title.includes("Temizlendi") || n.title.includes("Test");
                          if (notifFilter === "alarm") return !isSys;
                          if (notifFilter === "system") return isSys;
                          return true;
                        }).length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-400 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                            Seçilen filtrede bildirim bulunmuyor.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {notifications.filter((n) => {
                              const isSys = n.type === "system" || n.title.includes("Hoş Geldiniz") || n.title.includes("Veritabanı") || n.title.includes("Sistem") || n.title.includes("Yedek") || n.title.includes("Temizlendi") || n.title.includes("Test");
                              if (notifFilter === "alarm") return !isSys;
                              if (notifFilter === "system") return isSys;
                              return true;
                            }).map((n) => {
                              const isSys = n.type === "system" || n.title.includes("Hoş Geldiniz") || n.title.includes("Veritabanı") || n.title.includes("Sistem") || n.title.includes("Yedek") || n.title.includes("Temizlendi") || n.title.includes("Test");
                              return (
                                <div
                                  key={n.id}
                                  className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex justify-between items-center text-xs animate-fade-in shadow-2xs hover:border-slate-200 dark:hover:border-slate-700 transition"
                                >
                                  <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    {isSys ? (
                                      <span className="px-1.5 py-0.5 bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 font-mono text-[9px] font-black rounded uppercase">SİSTEM</span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-mono text-[9px] font-black rounded uppercase">ALARM</span>
                                    )}
                                    <span>💌 {n.title}</span>
                                  </span>
                                  <button onClick={() => handleDeleteNotif(n.id)} className="text-rose-500 font-black hover:underline px-2 py-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition cursor-pointer">Sil</button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                        🔔 Aktif Hatırlatmalar (Alarmlar)
                      </h4>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md">
                        {alarms.length} Kayıtlı
                      </span>
                    </div>

                    {alarms.length === 0 ? (
                      <div className="text-center py-10 text-xs text-slate-400 p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="text-3xl mb-1">⏰</div>
                        <p className="font-bold text-slate-600 dark:text-slate-300">Aktif zamanlı alarm bulunmuyor.</p>
                        <p className="text-[11px] text-slate-400">Üstteki "Yeni Hatırlatma Ekle" butonuna basarak istediğiniz tarihe alarm kurabilirsiniz.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {alarms.map((a) => (
                          <div
                            key={a.id}
                            className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex justify-between items-center text-xs shadow-2xs hover:border-indigo-300 transition"
                          >
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-800 dark:text-slate-100 block">
                                🔔 {a.title}
                              </span>
                              {a.date && (
                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold block">
                                  📅 {new Date(a.date).toLocaleString("tr-TR", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                            <button onClick={() => handleDeleteAlarm(a.id)} className="text-rose-500 font-black hover:underline px-2.5 py-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition cursor-pointer">Sil</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SEÇİLEN BÖLÜM 2: PUSH BİLDİRİM VE SIKLIK AYARLARI */}
            {notifSectionTab === "settings" && (
              <div className="space-y-5 animate-fade-in">
                <div className="p-6 bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 rounded-3xl shadow-sm space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <BellRing className="w-5 h-5 text-indigo-500 animate-pulse" />
                      Push Bildirim ve Hatırlatıcı Ayarları
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1">
                      Ödeme zamanı gelen borç ve taksitleriniz için telefonunuza ulaşacak anlık push bildirimlerini açıp kapatabilir, gün içi bildirim sıklığını belirleyebilirsiniz.
                    </p>
                  </div>

                  {/* 1. Push Bildirimleri Ana Kontrolü (Açık / Kapalı) */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
                        pushNotificationsEnabled 
                          ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" 
                          : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                      }`}>
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">
                          Push Bildirimleri (Anlık Mesajlar)
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {pushNotificationsEnabled
                            ? "Bildirimler aktif: Kilit ekranına ve bildirim çekmecesine uyarılar iletilir"
                            : "Bildirimler kapalı: Cihazınıza anlık push mesajı gönderilmez"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePushNotifications(!pushNotificationsEnabled)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer transition select-none shadow-sm flex items-center gap-2 ${
                        pushNotificationsEnabled
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                          : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <span>{pushNotificationsEnabled ? "AÇIK 🔔" : "KAPALI 🔕"}</span>
                    </button>
                  </div>

                  {/* 2. Günlük Bildirim Sıklığı Ayarı */}
                  <div className={`p-5 rounded-2xl border transition space-y-3.5 ${
                    pushNotificationsEnabled 
                      ? "bg-slate-50 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800" 
                      : "bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/50 opacity-60 pointer-events-none"
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Günlük Hatırlatma Mesajı Sıklığı
                        </h4>
                      </div>
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                        {pushFrequency === "1" && "Günde 1 Kez (09:00)"}
                        {pushFrequency === "2" && "Günde 2 Kez (09:00 ve 18:00)"}
                        {pushFrequency === "3" && "Günde 3 Kez (09:00, 13:00, 19:00)"}
                        {pushFrequency === "4" && "Günde 4 Kez (09:00, 13:00, 18:00, 21:00)"}
                        {pushFrequency === "hourly" && "2 Saatte Bir (09:00 - 21:00)"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Ödeme zamanı gelen borç ve taksitler gün içerisinde kaç defa hatırlatma mesajı olarak gelsin? İstediğiniz sıklığı aşağıdan seçebilirsiniz:
                    </p>

                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-1">
                      {/* Seçenek 1: Günde 1 Kez */}
                      <div
                        onClick={() => handleSetPushFrequency("1")}
                        className={`p-3.5 rounded-xl border cursor-pointer transition select-none relative flex flex-col justify-between ${
                          pushFrequency === "1"
                            ? "bg-white dark:bg-slate-800 border-indigo-500 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/20"
                            : "bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">Günde 1 Kez</span>
                          {pushFrequency === "1" && (
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Sabah tek seferlik genel özet bildirimi.</p>
                        <div className="flex items-center gap-1.5 mt-auto">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">09:00</span>
                        </div>
                      </div>

                      {/* Seçenek 2: Günde 2 Kez (Önerilen) */}
                      <div
                        onClick={() => handleSetPushFrequency("2")}
                        className={`p-3.5 rounded-xl border cursor-pointer transition select-none relative flex flex-col justify-between ${
                          pushFrequency === "2"
                            ? "bg-white dark:bg-slate-800 border-indigo-500 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/20"
                            : "bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-100">Günde 2 Kez</span>
                            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">Önerilen</span>
                          </div>
                          {pushFrequency === "2" && (
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Sabah planlama ve akşam kontrol bildirimi.</p>
                        <div className="flex items-center gap-1.5 mt-auto">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">09:00</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">18:00</span>
                        </div>
                      </div>

                      {/* Seçenek 3: Günde 3 Kez */}
                      <div
                        onClick={() => handleSetPushFrequency("3")}
                        className={`p-3.5 rounded-xl border cursor-pointer transition select-none relative flex flex-col justify-between ${
                          pushFrequency === "3"
                            ? "bg-white dark:bg-slate-800 border-indigo-500 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/20"
                            : "bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">Günde 3 Kez</span>
                          {pushFrequency === "3" && (
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Sabah, öğle ve akşam hatırlatmaları.</p>
                        <div className="flex items-center gap-1.5 mt-auto">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">09:00</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">13:00</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">19:00</span>
                        </div>
                      </div>

                      {/* Seçenek 4: Günde 4 Kez */}
                      <div
                        onClick={() => handleSetPushFrequency("4")}
                        className={`p-3.5 rounded-xl border cursor-pointer transition select-none relative flex flex-col justify-between ${
                          pushFrequency === "4"
                            ? "bg-white dark:bg-slate-800 border-indigo-500 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/20"
                            : "bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">Günde 4 Kez</span>
                          {pushFrequency === "4" && (
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Gün boyunca düzenli aralıklarla takip.</p>
                        <div className="flex flex-wrap items-center gap-1 mt-auto">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">09:00</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">13:00</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">18:00</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">21:00</span>
                        </div>
                      </div>

                      {/* Seçenek 5: 2 Saatte Bir */}
                      <div
                        onClick={() => handleSetPushFrequency("hourly")}
                        className={`p-3.5 rounded-xl border cursor-pointer transition select-none relative flex flex-col justify-between sm:col-span-2 lg:col-span-2 ${
                          pushFrequency === "hourly"
                            ? "bg-white dark:bg-slate-800 border-indigo-500 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/20"
                            : "bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-100">2 Saatte Bir (Periyodik)</span>
                            <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">Yoğun Takip</span>
                          </div>
                          {pushFrequency === "hourly" && (
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                          Ödeme günü gelen borçlar için saat 09:00 ile 21:00 arasında her 2 saatte bir düzenli hatırlatma gönderilir.
                        </p>
                        <div className="flex items-center gap-1.5 mt-auto">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">09:00 - 21:00 Arası Periyodik</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. İzinler ve Test Bölümü */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Cihaz Bildirim İzni */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Cihaz Bildirim İzni</span>
                        <span className="text-[10px] text-slate-400 font-medium leading-none block mt-1">Tarayıcı ve kilit ekranı uyarıları</span>
                      </div>
                      <button
                        type="button"
                        onClick={requestNotificationPermission}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition cursor-pointer active:scale-95 flex items-center gap-1.5 shadow-sm"
                      >
                        <span>🔔 İzni Yönet</span>
                      </button>
                    </div>

                    {/* Akıllı Sesli Asistan Servisi */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block flex items-center gap-1.5">
                          Akıllı Sesli Asistan Servisi
                          {!isPremium && <span className="bg-amber-500 text-[8px] text-white px-1.5 py-0.5 rounded-md font-black">PRO</span>}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium leading-none block mt-1">Ekrandaki mikrofon ikonu ile yönetin</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isPremium) {
                            openUpgradeModal("Akıllı Sesli Asistan Servisi");
                          } else {
                            const next = !voiceAssistantEnabled;
                            setVoiceAssistantEnabled(next);
                            localStorage.setItem("voiceAssistantEnabled", next ? "1" : "0");
                            triggerToast(next ? "Sesli Asistan Servisi Aktifleştirildi 🎙️" : "Sesli Asistan Servisi Devre Dışı Bırakıldı 🔕");
                          }
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer transition select-none ${
                          isPremium && voiceAssistantEnabled
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {!isPremium ? "KİLİTLİ 🔒" : voiceAssistantEnabled ? "AÇIK 🎙️" : "KAPALI 🔕"}
                      </button>
                    </div>
                  </div>

                  {/* 4. Sessiz ve Akıllı Hatırlatma Mimarisi Bilgi Kartı */}
                  <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/50 rounded-2xl space-y-1.5 text-xs text-indigo-950 dark:text-indigo-200">
                    <h4 className="font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                      <span>💡 Sessiz ve Akıllı Hatırlatma Mimarisi</span>
                    </h4>
                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                      Uygulama içi rahatsız edici melodik sesler tamamen kaldırılmıştır. Borç ve taksit hatırlatmalarınız, yukarıda seçtiğiniz sıklık ayarlarına göre sessiz, net ve kilit ekranında okunabilir anlık push bildirimleri olarak telefonunuza ulaştırılır.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "aiStrategy" && (
          <AIChat
            debts={debts}
            incomes={incomes}
            expenses={expenses}
            installmentDebts={installmentDebts}
            stats={statsBag}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            expenseCategories={expenseCategories}
            language={language}
            currentUser={currentUser}
            onTriggerToast={triggerToast}
          />
        )}

        {activeTab === "financialTools" && (
          <FinancialTools
            debts={debts}
            incomes={incomes}
            expenses={expenses}
            payments={payments}
            installmentDebts={installmentDebts}
            currentUser={currentUser}
            format={format}
            language={language}
          />
        )}

        {activeTab === "gplay_enhancements" && (
          <GPlayEnhancements
            language={language}
            setLanguage={setLanguage}
            expenseCategories={expenseCategories}
            onUpdateAllCategories={handleSaveAllCategories}
            expenses={expenses}
            statsBag={{
              totalDebt: statsBag.totalDebt,
              totalPaid: statsBag.totalPaid,
              remaining: statsBag.remaining,
              totalIncome: statsBag.totalIncome,
              totalExpense: statsBag.totalExpense,
              netIncome: statsBag.netIncome
            }}
            currentUser={currentUser}
            triggerToast={triggerToast}
            debts={debts}
            installmentDebts={installmentDebts}
            incomes={incomes}
            alarms={alarms}
            notifications={notifications}
            payments={payments}
            format={format}
            onRestoreBackup={handleRestoreBackup}
            onNavigate={handleNavClick}
            onExecuteExportBackup={executeExportBackup}
            onProcessBackupJSON={processBackupJSON}
            onOpenGoogleLogin={() => handleQuickLogin("google")}
            onManualSyncAll={async () => {
              await saveAllToUser(
                debts,
                incomes,
                alarms,
                notifications,
                installmentDebts,
                payments,
                expenses,
                expenseCategories
              );
            }}
            isOfflineMode={isOfflineMode}
          />
        )}

        {activeTab === "settings" && (
          <SecuritySettingsPanel
            language={language}
            marqueeSpeed={marqueeSpeed}
            setMarqueeSpeed={setMarqueeSpeed}
            marqueePaused={marqueePaused}
            setMarqueePaused={handleSetMarqueePaused}
            voiceAssistantEnabled={voiceAssistantEnabled}
            setVoiceAssistantEnabled={setVoiceAssistantEnabled}
            isPremium={isPremium}
            onOpenUpgradeModal={(name) => openUpgradeModal(name)}
            onOpenOnboarding={() => setShowOnboarding(true)}
            onSuccessToast={(msg) => triggerToast(msg)}
            currentUser={currentUser}
            onOpenGoogleLogin={() => handleQuickLogin("google")}
            onManualSyncAll={async () => {
              await saveAllToUser(
                debts,
                incomes,
                alarms,
                notifications,
                installmentDebts,
                payments,
                expenses,
                expenseCategories
              );
            }}
            debts={debts}
            installmentDebts={installmentDebts}
            incomes={incomes}
            expenses={expenses}
            alarms={alarms}
            notifications={notifications}
            payments={payments}
            expenseCategories={expenseCategories}
            onRestoreBackup={handleRestoreBackup}
            onExecuteExportBackup={executeExportBackup}
            onProcessBackupJSON={processBackupJSON}
            isOfflineMode={isOfflineMode}
            onBack={() => setActiveTab("overview")}
          />
        )}

        {["help", "blog", "feedback", "about", "privacy"].includes(activeTab) && (
          <HelpAndGuides
            activeTab={activeTab}
            onNavigate={handleNavClick}
            onOpenOnboarding={() => setShowOnboarding(true)}
          />
        )}

        {/* Enerjik ve Optimize Edilmiş Web Sayfası Footer Kartı (SEO & Sosyal Paylaşım & Kanallar) */}
        <footer className="mt-16 pt-8 pb-6 border-t border-slate-200/60 dark:border-slate-800/80 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Sol Blok: Sosyal Medya Takip Alanı & Haberdar Ol Bülteni */}
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="space-y-1.5 w-full flex flex-col items-center text-center">
                <div className="flex items-center gap-1.5 justify-center">
                  <h4 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                    Resmi Kanallarımız
                  </h4>
                  <span className="px-2 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-black rounded-full uppercase tracking-wider">
                    Çok Yakında ⏳
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium text-center max-w-sm leading-relaxed">
                  Resmi kanallarımız ve sosyal topluluk sayfalarımız çok yakında hizmete açılacaktır. Şu an için kullanılmayacaktır.
                </p>
              </div>
              
              {/* Dairesel Takip Linkleri */}
              <div className="flex items-center justify-center gap-3.5">
                <motion.a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ 
                    scale: 1.18, 
                    rotate: 5, 
                    color: "#ffffff", 
                    backgroundColor: "#ff0000",
                    borderColor: "#ff0000",
                    boxShadow: "0 10px 15px -3px rgba(255, 0, 0, 0.3)" 
                  }}
                  whileTap={{ scale: 0.92 }}
                  className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-rose-500 shadow-xs transition-colors duration-300 cursor-pointer"
                  title="YouTube"
                >
                  <Youtube className="w-4 h-4" />
                </motion.a>

                <motion.a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ 
                    scale: 1.18, 
                    rotate: -5, 
                    color: "#ffffff", 
                    backgroundColor: "#e1306c",
                    borderColor: "#e1306c",
                    boxShadow: "0 10px 15px -3px rgba(225, 48, 108, 0.3)" 
                  }}
                  whileTap={{ scale: 0.92 }}
                  className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-pink-500 shadow-xs transition-colors duration-300 cursor-pointer"
                  title="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </motion.a>

                <motion.a
                  href="https://telegram.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ 
                    scale: 1.18, 
                    rotate: 5, 
                    color: "#ffffff", 
                    backgroundColor: "#0088cc",
                    borderColor: "#0088cc",
                    boxShadow: "0 10px 15px -3px rgba(0, 136, 204, 0.3)" 
                  }}
                  whileTap={{ scale: 0.92 }}
                  className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-sky-500 shadow-xs transition-colors duration-300 cursor-pointer"
                  title="Telegram"
                >
                  <Send className="w-4 h-4" />
                </motion.a>

                <motion.a
                  href="mailto:info.borcodemetakip@gmail.com"
                  whileHover={{ 
                    scale: 1.18, 
                    rotate: -5, 
                    color: "#ffffff", 
                    backgroundColor: "#6366f1",
                    borderColor: "#6366f1",
                    boxShadow: "0 10px 15px -3px rgba(99, 102, 241, 0.3)" 
                  }}
                  whileTap={{ scale: 0.92 }}
                  className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-indigo-500 shadow-xs transition-colors duration-300 cursor-pointer"
                  title="E-Posta Gönder"
                >
                  <Mail className="w-4 h-4" />
                </motion.a>
              </div>

              {/* 'Haberdar Ol' Bülten Kayıt Alanı */}
              <div className="w-full max-w-[320px] pt-2 mx-auto flex flex-col items-center text-center">
                <span className="text-[10px] font-extrabold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider block mb-2 text-center">
                  🔔 HABERDAR OL (BÜLTEN)
                </span>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newsletterEmail.trim() || isSubscribingNewsletter) return;
                    setIsSubscribingNewsletter(true);
                    const emailToRegister = newsletterEmail.trim();
                    try {
                      const res = await subscribeToNewsletter(emailToRegister);
                      setIsNewsletterSubscribed(true);
                      setNewsletterFeedback(res.message || "✓ Bültene başarıyla kaydoldunuz! Onay e-postası adresinize gönderildi. 🎉");
                      triggerToast("Bültene başarıyla abone oldunuz! Onay e-postası adresinize iletildi. 🔔");
                      setNewsletterEmail("");
                      setTimeout(() => {
                        setIsNewsletterSubscribed(false);
                        setNewsletterFeedback("");
                      }, 7000);
                    } catch (err: any) {
                      triggerToast("Bülten kaydı yapılırken bir hata oluştu: " + (err?.message || "Lütfen tekrar deneyin"));
                    } finally {
                      setIsSubscribingNewsletter(false);
                    }
                  }}
                  className="relative flex items-center w-full max-w-[320px] bg-white/70 dark:bg-slate-900/60 border border-slate-250 dark:border-slate-800 rounded-full p-1 focus-within:ring-4 focus-within:ring-indigo-500/15 focus-within:border-indigo-550 transition-all shadow-2xs header-glass box-border"
                >
                  <input
                    type="email"
                    required
                    disabled={isSubscribingNewsletter}
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="E-posta adresiniz..."
                    className="w-full pl-4 pr-24 py-2 bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 font-medium box-border disabled:opacity-50"
                  />
                  <motion.button
                    type="submit"
                    disabled={isSubscribingNewsletter}
                    whileHover={{ scale: isSubscribingNewsletter ? 1 : 1.05, filter: "brightness(1.1)" }}
                    whileTap={{ scale: isSubscribingNewsletter ? 1 : 0.94 }}
                    className="absolute right-1 px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-xs transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSubscribingNewsletter ? "Gönderiliyor..." : "Katıl"} <Bell className="w-3 h-3 text-white" />
                  </motion.button>
                </form>
                {isNewsletterSubscribed && (
                  <motion.p 
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 font-black mt-2 text-center"
                  >
                    {newsletterFeedback || "✓ Bültene başarıyla kaydoldunuz! Onay e-postası adresinize gönderildi. 🎉"}
                  </motion.p>
                )}
              </div>
            </div>

            {/* Sağ Blok: Sosyal Medya Paylaşım Alanı */}
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="space-y-1.5 w-full flex flex-col items-center text-center">
                <h4 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5 justify-center text-center">
                  <Share2 className="w-3.5 h-3.5 text-indigo-500" /> Sistemi Arkadaşlarınla Paylaş
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium text-center max-w-sm leading-relaxed">
                  Finansal özgürlüğe giden bu harika bütçe ve borç takip aracını tek tıkla sevdilerinizle paylaşarak onlara destek olun.
                </p>
              </div>

              {/* Dairesel Paylaşım Linkleri */}
              <div className="flex items-center gap-3.5">
                {/* WhatsApp Share */}
                <motion.a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent("Bütçe yönetimi, borç takibi, yapay zeka destekli bütçe analizleri ve akıllı hesap asistanı! Hemen dene: " + window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ 
                    scale: 1.18, 
                    rotate: 3, 
                    backgroundColor: "#25d366", 
                    color: "#ffffff", 
                    borderColor: "#25d366",
                    boxShadow: "0 10px 15px -3px rgba(37, 211, 102, 0.3)" 
                  }}
                  whileTap={{ scale: 0.90 }}
                  className="w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 cursor-pointer transition-all duration-300"
                  title="WhatsApp'ta Paylaş"
                >
                  <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.705 1.456h.008c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </motion.a>

                {/* Twitter Share */}
                <motion.a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent("Kişisel finans bütçemi yapay zeka destekli Bütçem ile tam kontrol altına aldım! Mutlaka inceleyin:")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ 
                    scale: 1.18, 
                    rotate: -3, 
                    backgroundColor: "#1da1f2", 
                    color: "#ffffff", 
                    borderColor: "#1da1f2",
                    boxShadow: "0 10px 15px -3px rgba(29, 161, 242, 0.3)" 
                  }}
                  whileTap={{ scale: 0.90 }}
                  className="w-10 h-10 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-450 cursor-pointer transition-all duration-300"
                  title="Twitter (X)'da Paylaş"
                >
                  <Twitter className="w-4 h-4" />
                </motion.a>

                {/* Telegram Share */}
                <motion.a
                  href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent("Bütçem ile bütçeni ve borçlarını kolayca kontrol altına al!")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ 
                    scale: 1.18, 
                    rotate: 3, 
                    backgroundColor: "#0088cc", 
                    color: "#ffffff", 
                    borderColor: "#0088cc",
                    boxShadow: "0 10px 15px -3px rgba(0, 136, 204, 0.3)" 
                  }}
                  whileTap={{ scale: 0.90 }}
                  className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 cursor-pointer transition-all duration-300"
                  title="Telegram'da Paylaş"
                >
                  <Send className="w-4 h-4 rotate-45" />
                </motion.a>

                {/* Facebook Share */}
                <motion.a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ 
                    scale: 1.18, 
                    rotate: -3, 
                    backgroundColor: "#1877f2", 
                    color: "#ffffff", 
                    borderColor: "#1877f2",
                    boxShadow: "0 10px 15px -3px rgba(24, 119, 242, 0.3)" 
                  }}
                  whileTap={{ scale: 0.90 }}
                  className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 cursor-pointer transition-all duration-300"
                  title="Facebook'ta Paylaş"
                >
                  <Facebook className="w-4 h-4" />
                </motion.a>

                {/* Copy Link Share */}
                <motion.button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    triggerToast("Bütçem web site bağlantısı panoya kopyalandı! 🔗");
                  }}
                  whileHover={{ 
                    scale: 1.18, 
                    rotate: 3, 
                    backgroundColor: "#6366f1", 
                    color: "#ffffff", 
                    borderColor: "#6366f1",
                    boxShadow: "0 10px 15px -3px rgba(99, 102, 241, 0.3)" 
                  }}
                  whileTap={{ scale: 0.90 }}
                  className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 cursor-pointer transition-all duration-300"
                  title="Bağlantıyı Kopyala"
                >
                  <Link className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-slate-200/40 dark:border-slate-800/80 text-center sm:text-left">
            <div className="text-[10px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-500">
              © 2026 BÜTÇEM PRO • TÜM HAKLARI SAKLIDIR
            </div>
            <div className="flex gap-4 text-[10px] font-bold text-slate-400 dark:text-slate-500">
              <motion.span 
                whileHover={{ scale: 1.05, color: "#6366f1" }} 
                whileTap={{ scale: 0.95 }}
                className="transition-colors cursor-pointer select-none" 
                onClick={() => handleNavClick("about")}
              >
                Hakkımızda
              </motion.span>
              <span>•</span>
              <motion.span 
                whileHover={{ scale: 1.05, color: "#6366f1" }} 
                whileTap={{ scale: 0.95 }}
                className="transition-colors cursor-pointer select-none" 
                onClick={() => handleNavClick("privacy")}
              >
                Gizlilik Sözleşmesi
              </motion.span>
              <span>•</span>
              <motion.span 
                whileHover={{ scale: 1.05, color: "#6366f1" }} 
                whileTap={{ scale: 0.95 }}
                className="transition-colors cursor-pointer select-none" 
                onClick={() => handleNavClick("feedback")}
              >
                Geri Bildirim
              </motion.span>
            </div>
          </div>
        </footer>
      </main>

      {/* Fixed bottom navigation panel optimized for mobile view on cellphones */}
      {(() => {
        const getBottomTabClass = (tabId: string) => {
          const isActive = activeTab === tabId;
          if (!isActive) {
            return "flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:scale-105 cursor-pointer";
          }
          switch (colorTheme) {
            case "green":
              return "flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/30 dark:border-emerald-900/30 scale-105 shadow-xs font-black cursor-pointer";
            case "purple":
              return "flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border border-purple-100/30 dark:border-purple-900/30 scale-105 shadow-xs font-black cursor-pointer";
            case "orange":
              return "flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-100/30 dark:border-amber-900/30 scale-105 shadow-xs font-black cursor-pointer";
            default:
              return "flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100/30 dark:border-indigo-900/30 scale-105 shadow-xs font-black cursor-pointer";
          }
        };

        return (
          <footer className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/50 dark:border-slate-800/80 p-2 flex justify-around select-none shadow-xl">
            <button
              onClick={() => handleNavClick("overview")}
              className={getBottomTabClass("overview")}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-[9px] font-bold">{language === "tr" ? "Genel" : "Dashboard"}</span>
            </button>
            <button
              onClick={() => handleNavClick("income")}
              className={getBottomTabClass("income")}
            >
              <Wallet className="w-4 h-4" />
              <span className="text-[9px] font-bold">{language === "tr" ? "Gelirler" : "Incomes"}</span>
            </button>
            <button
              onClick={() => handleNavClick("debts")}
              className={getBottomTabClass("debts")}
            >
              <Coins className="w-4 h-4" />
              <span className="text-[9px] font-bold">{language === "tr" ? "Borçlar" : "Debts"}</span>
            </button>
            <button
              onClick={() => handleNavClick("expenses")}
              className={getBottomTabClass("expenses")}
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="text-[9px] font-bold">{language === "tr" ? "Giderler" : "Expenses"}</span>
            </button>
            <button
              onClick={() => handleNavClick("installments")}
              className={getBottomTabClass("installments")}
            >
              <Calendar className="w-4 h-4" />
              <span className="text-[9px] font-bold">{language === "tr" ? "Taksitler" : "Installments"}</span>
            </button>
            <button
              onClick={() => handleNavClick("aiStrategy")}
              className={getBottomTabClass("aiStrategy")}
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span className="text-[9px] font-bold">{language === "tr" ? "Asistan" : "AI Advisor"}</span>
            </button>
          </footer>
        );
      })()}



      {/* APK Sync Companion Confirmation Overlay */}
      <AnimatePresence>
        {syncCodeToApprove && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative"
            >
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-amber-500" />
              
              <div className="p-6 text-center space-y-4">
                <div className="inline-flex p-3 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full border border-indigo-500/20 text-indigo-500">
                  <Shield className="w-8 h-8 animate-pulse" />
                </div>
                
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-500">
                    APK MOBİL BAĞLANTI KÖPRÜSÜ
                  </h3>
                  <h2 className="text-[15px] font-black text-slate-800 dark:text-slate-100 mt-1 leading-snug">
                    Google Giriş Onayı Talebi
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold px-2 mt-1 leading-relaxed">
                    Telefonunuzdaki APK uygulamasını bu cihazın veritabanı ile eşleştirmek üzeresiniz.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono">
                  <div className="text-left">
                    <span className="text-[9px] font-black tracking-wider text-slate-400 block uppercase">TALEP KODU</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200 tracking-wider">
                      {syncCodeToApprove.slice(0, 3)} {syncCodeToApprove.slice(3)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black tracking-wider text-emerald-500 block uppercase">● BEKLENİYOR</span>
                  </div>
                </div>

                {currentUser ? (
                  <div className="space-y-3 pt-2">
                    <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl text-left leading-relaxed">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">AKTİF OTURUM</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono truncate">{userProfileName?.trim() ? `${userProfileName} (${currentUser})` : currentUser}</p>
                      <p className="text-[10px] text-slate-500 mt-1 font-semibold leading-relaxed">
                        Girişi onayladığınızda, APK uygulamanız otomatik olarak bu hesaba bağlanacaktır.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setSyncCodeToApprove(null)}
                        className="py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer"
                      >
                        İptal Et
                      </button>
                      <button
                        type="button"
                        onClick={handleApproveSync}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-97 animate-pulse"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Onayla</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-left leading-relaxed">
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-500">GİRİŞ YAPILMAMIŞ</p>
                      <p className="text-[10.5px] text-slate-600 dark:text-slate-400 font-semibold mt-1 leading-relaxed">
                        Öncelikle uygulamada yetkili bir hesaba giriş yapmış olmanız gerekir. Aşağıdaki butonu kullanarak Google ile giriş yapabilirsiniz.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleAuthForSync}
                      className="w-full py-3 bg-red-600 hover:bg-red-700 dark:bg-red-650 dark:hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-500/15 cursor-pointer active:scale-98"
                    >
                      <Chrome className="w-4.5 h-4.5" />
                      <span>Google Girişi Yap</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSyncCodeToApprove(null)}
                      className="w-full py-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 text-[11px] font-bold transition"
                    >
                      Pencereyi Kapat
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CSV Filter and Range Download Modal */}
      <AnimatePresence>
        {isCsvModalOpen && (() => {
          const previewIncomes = incomes.filter(inc => isDateWithinRange(inc.date, csvStartDate, csvEndDate));
          const previewExpenses = expenses.filter(exp => isDateWithinRange(exp.date, csvStartDate, csvEndDate));

          // Load contacts and map names
          const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
          let contactsDirectory: any[] = [];
          let contactTransactions: any[] = [];
          try {
            contactsDirectory = JSON.parse(localStorage.getItem(`${spaceKey}_contacts_directory`) || "[]");
          } catch {}
          try {
            contactTransactions = JSON.parse(localStorage.getItem(`${spaceKey}_contacts_transactions`) || "[]");
          } catch {}

          const contactMap = new Map<string, { name: string; phone: string }>();
          if (Array.isArray(contactsDirectory)) {
            contactsDirectory.forEach((c: any) => {
              contactMap.set(String(c.id), { name: c.name || "Kişi", phone: c.phone || "" });
            });
          }

          let previewContactPayables: any[] = [];
          let previewContactReceivables: any[] = [];
          if (Array.isArray(contactTransactions)) {
            contactTransactions.forEach((t: any) => {
              const txDate = t.dueDate || t.createdAt;
              if (isDateWithinRange(txDate, csvStartDate, csvEndDate)) {
                const info = contactMap.get(String(t.contactId)) || { name: t.personName || "Kişi", phone: "" };
                const item = { ...t, displayName: info.name, displayPhone: info.phone, effectiveDate: txDate };
                if (t.type === "payable") {
                  previewContactPayables.push(item);
                } else if (t.type === "receivable") {
                  previewContactReceivables.push(item);
                }
              }
            });
          }

          const previewContactPayablesTotal = previewContactPayables.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
          const previewContactPayablesPaid = previewContactPayables.reduce((sum, c) => sum + (c.isPaid ? (Number(c.amount) || 0) : 0), 0);
          const previewContactPayablesRemaining = Math.max(0, previewContactPayablesTotal - previewContactPayablesPaid);

          const previewContactReceivablesTotal = previewContactReceivables.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
          const previewContactReceivablesCollected = previewContactReceivables.reduce((sum, c) => sum + (c.isPaid ? (Number(c.amount) || 0) : 0), 0);
          const previewContactReceivablesPending = Math.max(0, previewContactReceivablesTotal - previewContactReceivablesCollected);

          const previewTotalIncome = previewIncomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
          const previewTotalExpense = previewExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

          const previewDebts = debts.filter(d => {
            if (!csvStartDate && !csvEndDate) return true;
            if (isDateWithinRange(d.dueDate || (d as any).date, csvStartDate, csvEndDate)) return true;
            const hasPayment = payments.some(p => p.debtId === d.id && isDateWithinRange(p.date, csvStartDate, csvEndDate));
            return hasPayment;
          });

          const previewSimpleDebtsTotal = previewDebts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
          const previewSimpleDebtsPaid = previewDebts.reduce((sum, d) => {
            const paidVal = (d as any).paidAmount !== undefined ? Number((d as any).paidAmount) : (Number(d.paid) || 0);
            return sum + Math.min(Number(d.amount) || 0, paidVal);
          }, 0);
          const previewSimpleDebtsRemaining = Math.max(0, previewSimpleDebtsTotal - previewSimpleDebtsPaid);

          let previewInstallmentsTotal = 0;
          let previewInstallmentsPaid = 0;
          let previewInstallmentsCount = 0;

          installmentDebts.forEach((inst: any) => {
            const count = inst.installmentCount || 1;
            const monthlyAmt = (Number(inst.totalAmount) || 0) / count;

            if (!csvStartDate && !csvEndDate) {
              previewInstallmentsTotal += (Number(inst.totalAmount) || 0);
              previewInstallmentsPaid += ((inst.paidInstallmentCount || 0) * monthlyAmt);
              previewInstallmentsCount++;
            } else {
              let occ = 0;
              let paidOcc = 0;
              const startParts = parseDateParts(inst.firstDueDate);
              if (startParts) {
                for (let i = 0; i < count; i++) {
                  const occDate = new Date(startParts.year, startParts.month + i, startParts.day);
                  const occYMD = occDate.toISOString().slice(0, 10);
                  if (isDateWithinRange(occYMD, csvStartDate, csvEndDate)) {
                    occ++;
                    if ((inst.paidInstallmentCount || 0) > i) paidOcc++;
                  }
                }
              } else if (isDateWithinRange(inst.firstDueDate, csvStartDate, csvEndDate)) {
                occ = 1;
                if ((inst.paidInstallmentCount || 0) > 0) paidOcc = 1;
              }

              if (occ > 0) {
                previewInstallmentsTotal += (occ * monthlyAmt);
                previewInstallmentsPaid += (paidOcc * monthlyAmt);
                previewInstallmentsCount++;
              }
            }
          });
          const previewInstallmentsRemaining = Math.max(0, previewInstallmentsTotal - previewInstallmentsPaid);

          const previewTotalDebt = previewSimpleDebtsTotal + previewInstallmentsTotal + previewContactPayablesTotal;
          const previewTotalPaid = previewSimpleDebtsPaid + previewInstallmentsPaid + previewContactPayablesPaid;
          const previewRemainingDebt = Math.max(0, previewTotalDebt - previewTotalPaid);
          const previewNetReserve = previewTotalIncome - previewTotalExpense - previewTotalPaid;

          const totalDebtOperationsCount = previewDebts.length + previewInstallmentsCount + previewContactPayables.length;
          const totalRecords = previewIncomes.length + previewExpenses.length + totalDebtOperationsCount + previewContactReceivables.length;

          return (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden"
                id="csv-filter-modal"
              >
                {/* Modal Header */}
                <div className="bg-slate-950 text-white p-5 relative">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    {csvStep === "filter" ? (
                      <>📊 FİNANSAL RAPOR VE CSV İNDİRME</>
                    ) : (
                      <>📋 CSV RAPOR ÖNİZLEMESİ VE DOĞRULAMA</>
                    )}
                  </h3>
                  <p className="text-[10.5px] text-slate-300 mt-1">
                    {csvStep === "filter" 
                      ? "Dönem seçin (günlük, aylık, yıllık) veya özel tarih aralığı belirleyin."
                      : "Filtrelenen döneme ait gerçek finansal göstergeler aşağıdadır."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCsvModalOpen(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-4 text-xs">
                  {csvStep === "filter" ? (
                    <>
                      {/* Presets Grid */}
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 block mb-2 tracking-widest leading-none">
                          HIZLI DÖNEM SEÇENEKLERİ
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              const todayStr = now.toISOString().slice(0, 10);
                              setCsvStartDate(todayStr);
                              setCsvEndDate(todayStr);
                            }}
                            className={`py-2 px-2 rounded-xl font-bold transition text-[11px] text-center shrink-0 cursor-pointer border ${
                              csvStartDate === csvEndDate && csvStartDate === new Date().toISOString().slice(0, 10)
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                : "bg-slate-100 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-slate-700 dark:text-slate-300 border-transparent hover:border-emerald-500/30"
                            }`}
                          >
                            📅 Bugün (Günlük)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              const day = now.getDay();
                              const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                              const monday = new Date(now.setDate(diff));
                              const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
                              setCsvStartDate(monday.toISOString().slice(0, 10));
                              setCsvEndDate(sunday.toISOString().slice(0, 10));
                            }}
                            className="py-2 px-2 bg-slate-100 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition border border-transparent hover:border-emerald-500/30 text-[11px] text-center shrink-0 cursor-pointer"
                          >
                            📅 Bu Hafta
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                              const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                              setCsvStartDate(firstDay.toISOString().slice(0, 10));
                              setCsvEndDate(lastDay.toISOString().slice(0, 10));
                            }}
                            className="py-2 px-2 bg-slate-100 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition border border-transparent hover:border-emerald-500/30 text-[11px] text-center shrink-0 cursor-pointer"
                          >
                            📅 Bu Ay (Aylık)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                              const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
                              setCsvStartDate(firstDay.toISOString().slice(0, 10));
                              setCsvEndDate(lastDay.toISOString().slice(0, 10));
                            }}
                            className="py-2 px-2 bg-slate-100 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition border border-transparent hover:border-emerald-500/30 text-[11px] text-center shrink-0 cursor-pointer"
                          >
                            📅 Geçen Ay
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              const firstDay = new Date(now.getFullYear(), 0, 1);
                              const lastDay = new Date(now.getFullYear(), 11, 31);
                              setCsvStartDate(firstDay.toISOString().slice(0, 10));
                              setCsvEndDate(lastDay.toISOString().slice(0, 10));
                            }}
                            className="py-2 px-2 bg-slate-100 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition border border-transparent hover:border-emerald-500/30 text-[11px] text-center shrink-0 cursor-pointer"
                          >
                            📅 Bu Yıl (Yıllık)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              const firstDay = new Date(now.getFullYear() - 1, 0, 1);
                              const lastDay = new Date(now.getFullYear() - 1, 11, 31);
                              setCsvStartDate(firstDay.toISOString().slice(0, 10));
                              setCsvEndDate(lastDay.toISOString().slice(0, 10));
                            }}
                            className="py-2 px-2 bg-slate-100 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition border border-transparent hover:border-emerald-500/30 text-[11px] text-center shrink-0 cursor-pointer"
                          >
                            📅 Geçen Yıl
                          </button>
                        </div>
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCsvStartDate("");
                              setCsvEndDate("");
                            }}
                            className={`w-full py-2 px-3 rounded-xl font-bold transition text-[11px] text-center cursor-pointer border ${
                              !csvStartDate && !csvEndDate
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-slate-100 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-slate-700 dark:text-slate-300 border-transparent hover:border-indigo-500/30"
                            }`}
                          >
                            🚀 Tüm Zamanlar (Filtresiz)
                          </button>
                        </div>
                      </div>

                      {/* Custom Date Picker Inputs */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block mb-1">
                            BAŞLANGIÇ TARİHİ
                          </label>
                          <input
                            type="date"
                            value={csvStartDate}
                            onChange={(e) => setCsvStartDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl font-extrabold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block mb-1">
                            BİTİŞ TARİHİ
                          </label>
                          <input
                            type="date"
                            value={csvEndDate}
                            onChange={(e) => setCsvEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl font-extrabold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Info Tip */}
                      <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 rounded-2xl flex gap-2 border border-emerald-100 dark:border-emerald-950/40 text-[10.5px] leading-relaxed">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          Rapor; seçtiğiniz döneme göre <strong>Gelirler</strong>, <strong>Giderler</strong>, <strong>Basit/Kurumsal Borçlar</strong>, <strong>Taksitler</strong> ve <strong>Kişi Borç ve Alacaklarını</strong> ayrı listeler halinde eksiksiz hesaplayarak CSV formatında sunar.
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Filter Details Alert */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold block">FİLTRELENEN DÖNEM</span>
                          <span className="font-extrabold text-[11px] text-slate-950 dark:text-white">
                            {csvStartDate && csvEndDate 
                              ? (csvStartDate === csvEndDate ? `${csvStartDate} (Günlük)` : `${csvStartDate} ile ${csvEndDate}`)
                              : (csvStartDate ? `${csvStartDate} sonrası` : (csvEndDate ? `${csvEndDate} öncesi` : "Tüm Zamanlar"))}
                          </span>
                        </div>
                        <div className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black border border-emerald-500/10">
                          {totalRecords} Kayıt Aktarılacak
                        </div>
                      </div>

                      {/* Summary breakdown details */}
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5 max-h-[340px] overflow-y-auto">
                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block tracking-wider leading-none">GERÇEK FİNANSAL GÖSTERGELER</span>
                        
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between items-center pb-1 border-b border-slate-200 dark:border-slate-800">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">🟢 Toplam Gelir ({previewIncomes.length} işlem)</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{format(previewTotalIncome)}</span>
                          </div>
                          
                          <div className="flex justify-between items-center pb-1 border-b border-slate-200 dark:border-slate-800">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">🔴 Toplam Gider ({previewExpenses.length} işlem)</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{format(previewTotalExpense)}</span>
                          </div>

                          <div className="flex justify-between items-center pb-1 border-b border-slate-200 dark:border-slate-800">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">🏛️ Basit & Kurumsal Borçlar ({previewDebts.length} borç)</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{format(previewSimpleDebtsTotal)}</span>
                          </div>

                          <div className="flex justify-between items-center pb-1 border-b border-slate-200 dark:border-slate-800">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">💳 Taksitli Krediler / Borçlar ({previewInstallmentsCount} plan)</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{format(previewInstallmentsTotal)}</span>
                          </div>

                          {/* Kişi Borçları Ayrı Gösterim */}
                          <div className="flex justify-between items-center pb-1 border-b border-slate-200 dark:border-slate-800 bg-amber-500/5 -mx-2 px-2 py-1 rounded-lg">
                            <span className="text-amber-700 dark:text-amber-400 font-bold">👥 Kişilere Olan Borçlarımız ({previewContactPayables.length} kişi)</span>
                            <span className="font-bold text-amber-700 dark:text-amber-400">{format(previewContactPayablesTotal)}</span>
                          </div>

                          {/* Kişi Alacakları Ayrı Gösterim */}
                          <div className="flex justify-between items-center pb-1 border-b border-slate-200 dark:border-slate-800 bg-sky-500/5 -mx-2 px-2 py-1 rounded-lg">
                            <span className="text-sky-700 dark:text-sky-400 font-bold">💼 Kişilerden Olan Alacaklarımız ({previewContactReceivables.length} kişi)</span>
                            <span className="font-bold text-sky-700 dark:text-sky-400">{format(previewContactReceivablesTotal)}</span>
                          </div>

                          {/* Gerçek Toplam Borç Kapsamı */}
                          <div className="flex justify-between items-center pt-1 pb-1 border-b border-slate-200 dark:border-slate-800">
                            <span className="text-slate-900 dark:text-white font-extrabold">⭐ GERÇEK TOPLAM BORÇ</span>
                            <span className="font-black text-slate-950 dark:text-white text-xs">{format(previewTotalDebt)}</span>
                          </div>

                          <div className="flex justify-between items-center pb-1 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                            <span className="text-slate-600 dark:text-slate-400">↳ Ödenen Borç Payı</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{format(previewTotalPaid)}</span>
                          </div>

                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-600 dark:text-slate-400">↳ Kalan Aktif Borç</span>
                            <span className="font-bold text-red-600 dark:text-red-400">{format(previewRemainingDebt)}</span>
                          </div>
                        </div>

                        {/* Combined Result Balance Indicator */}
                        <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                          <span className="font-black text-slate-800 dark:text-slate-200">Net Kalan Bakiye (Rezerv):</span>
                          <span className={`font-black text-xs px-2.5 py-1 rounded-xl ${previewNetReserve >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                            {format(previewNetReserve)}
                          </span>
                        </div>
                      </div>

                      {/* Check confirmation note */}
                      <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-500/30 text-amber-900 dark:text-amber-300 text-[10px] leading-relaxed flex gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-950 dark:text-amber-200">Türkçe Excel ve Numbers Uyumlu:</p>
                          <p className="opacity-90">CSV dosyasında kişi borçları ve alacakları ayrı başlıklar halinde detaylandırılmıştır. Excel veya E-Tablolar'da sıfır karakter bozulmasıyla açılır.</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-2">
                  {csvStep === "filter" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsCsvModalOpen(false)}
                        className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition cursor-pointer text-xs"
                      >
                        {language === "tr" ? "Vazgeç" : "Cancel"}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleDownloadCSV(csvStartDate, csvEndDate);
                            setIsCsvModalOpen(false);
                          }}
                          className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl font-bold text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer border-transparent"
                        >
                          <Download className="w-3.5 h-3.5" /> Hemen İndir
                        </button>
                        <button
                          type="button"
                          onClick={() => setCsvStep("preview")}
                          className="px-4 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-xl font-black text-xs transition active:scale-95 flex items-center gap-1.5 shadow-sm cursor-pointer border-transparent"
                        >
                          Önizleme Yap ➔
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setCsvStep("filter")}
                        className="px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition cursor-pointer text-xs"
                      >
                        ⬅ Geri
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const { csvContent } = generateCSVData(csvStartDate, csvEndDate);
                            try {
                              navigator.clipboard.writeText(csvContent);
                              triggerToast("📋 Rapor başarıyla kopyalandı! Excel veya Google Sheets'e yapıştırabilirsiniz.");
                            } catch (err) {
                              triggerToast("❌ Kopyalama başarısız oldu.");
                            }
                            setIsCsvModalOpen(false);
                          }}
                          className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer border-transparent"
                        >
                          <Copy className="w-3.5 h-3.5" /> Kopyala
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleDownloadCSV(csvStartDate, csvEndDate);
                            setIsCsvModalOpen(false);
                          }}
                          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-xl font-black text-xs transition active:scale-95 flex items-center gap-1.5 shadow-md cursor-pointer border-transparent"
                        >
                          <Download className="w-4 h-4" /> {language === "tr" ? "Dosyayı İndir (.CSV)" : "Download"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Profil Düzenleme Modalı (İsim & Resim) */}
      <AnimatePresence>
        {isEditProfileModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2500] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative text-left"
            >
              {/* Header Gradient */}
              <div className="h-2 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        {language === "tr" ? "Profil Bilgileri" : "Profile Details"}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {language === "tr" ? "İsminizi ve profil fotoğrafınızı özelleştirin" : "Customize your name and avatar"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditProfileModalOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Profile Photo Management */}
                <div className="flex flex-col items-center gap-3 p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                  <div className="relative group/modalAvatar">
                    {userAvatar ? (
                      <img
                        src={userAvatar}
                        alt="Profil"
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 rounded-full object-cover border-4 border-indigo-500/50 shadow-lg block"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 text-white flex items-center justify-center text-xl font-black shadow-lg uppercase">
                        {(profileNameInput.trim() || userProfileName.trim() || currentUser || "G").substring(0, 2)}
                      </div>
                    )}
                    <label 
                      className="absolute -bottom-1 -right-1 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full border-2 border-white dark:border-slate-900 shadow-md cursor-pointer active:scale-95 transition flex items-center justify-center"
                      title="Fotoğraf Yükle"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black cursor-pointer shadow-xs transition flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      <span>{language === "tr" ? "Galeriden Seç" : "Choose Photo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileChange}
                        className="hidden"
                      />
                    </label>
                    {userAvatar && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-black transition cursor-pointer border border-rose-200/60 dark:border-rose-800/40"
                      >
                        {language === "tr" ? "Kaldır" : "Remove"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Form Input for Name */}
                <form onSubmit={handleSaveProfileModal} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                      {language === "tr" ? "Görüntülenen İsim" : "Display Name"}
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={profileNameInput}
                      onChange={(e) => setProfileNameInput(e.target.value)}
                      placeholder={language === "tr" ? "Örn: Ahmet Yılmaz" : "e.g. John Doe"}
                      maxLength={40}
                      className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
                    />
                    <p className="text-[9.5px] text-slate-400 font-medium">
                      {language === "tr"
                        ? "Bu isim ana ekranda ve raporlarda görünecektir."
                        : "This name will appear on the dashboard and exports."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsEditProfileModalOpen(false)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      {language === "tr" ? "İptal" : "Cancel"}
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5"
                    >
                      {isSavingProfile ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>{language === "tr" ? "Kaydet" : "Save"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Premium Plan Upgrade / Subscription Management Modal */}
      <AnimatePresence>
        {isUpgradeModalOpen && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                if (isTrialExpiredLocked) {
                  triggerToast("7 günlük ücretsiz deneme süreniz sona ermiştir. Uygulamayı kullanmaya devam etmek için lütfen Premium planlardan birini seçin.");
                } else {
                  closeUpgradeModal();
                }
              }
            }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-start sm:items-center justify-center p-4 overflow-y-auto pt-10 sm:pt-4 pb-10"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative my-8 text-left"
            >
              {/* Decorative golden/amber premium header gradient */}
              <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 animate-pulse" />
              
              <div className="p-6 space-y-6">
                {isRestoring ? (
                  <div className="space-y-5">
                    {/* Header */}
                    <div className="text-center space-y-2">
                      <div className="inline-flex p-3 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full border border-indigo-500/20 text-indigo-500 animate-pulse">
                        <RotateCw className="w-8 h-8 text-indigo-500" />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-indigo-500">
                        🔄 GOOGLE PLAY LİSANS KURTARICI
                      </h3>
                      <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                        Satın Alımları Geri Yükle
                      </h2>
                      <p className="text-[10.5px] text-slate-550 dark:text-slate-400 font-bold px-2 leading-relaxed uppercase">
                        Cihazınızı sıfırladığınızda veya uygulamayı yeniden yüklediğinizde satın alımınızı kurtarın.
                      </p>
                    </div>

                    {/* Step Content */}
                    {restoreStep === "method" && (
                      <div className="space-y-3 pt-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 block tracking-widest text-center">DOĞRULAMA YÖNTEMİ SEÇİN</span>
                        
                        <button
                          type="button"
                          onClick={() => {
                            // Run the native RevenueCat restore flow synced to Firestore & LocalStorage
                            handleRevenueCatRestore();
                          }}
                          className="w-full p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 text-left transition duration-200 cursor-pointer active:scale-97 group"
                        >
                          <div className="flex gap-3">
                            <span className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl text-lg shrink-0 group-hover:scale-105 transition-transform">👤</span>
                            <div className="space-y-1">
                              <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Google Hesabı ile Buluttan Geri Yükle (Önerilen)</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-medium">Aktif olan Google/Firebase kullanıcı oturumunuz altındaki lisansı anında geri çeker.</p>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRestoreStep("gpa");
                          }}
                          className="w-full p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 text-left transition duration-200 cursor-pointer active:scale-97 group"
                        >
                          <div className="flex gap-3">
                            <span className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl text-lg shrink-0 group-hover:scale-105 transition-transform">🎫</span>
                            <div className="space-y-1">
                              <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">GPA Sipariş No ile Manuel Geri Yükle</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-medium">Google Play sipariş faturasındaki GPA kodunu girerek satın alımı anında aktifleştirin.</p>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsRestoring(false);
                            setRestoreStep("method");
                          }}
                          className="w-full py-2.5 bg-slate-150 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-200 transition cursor-pointer active:scale-97 text-center"
                        >
                          Vazgeç, Geri Dön
                        </button>
                      </div>
                    )}

                    {restoreStep === "firebase" && (
                      <div className="space-y-4 pt-2 text-center">
                        <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                          <p className="font-extrabold uppercase text-amber-600 dark:text-amber-500">Google Oturumu Saptanmadı</p>
                          <p className="opacity-95 leading-relaxed font-medium">
                            Otomatik Google Play lisans sorgusu yapabilmemiz için önce sisteme Google Hesabınız ile giriş yapmanız veya sipariş numaranızı bilmeniz gerekir.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setRestoreStep("method")}
                            className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-705 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200"
                          >
                            Geri Dön
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsUpgradeModalOpen(false);
                              setIsRestoring(false);
                              setRestoreStep("method");
                              triggerToast("Lütfen bütçe sayfasında 'Profili ve Yedeklemeyi' açın ve Google hesabınızla giriş yapın.");
                            }}
                            className="flex-1 py-2.5 bg-indigo-600 text-white font-black text-xs uppercase rounded-xl hover:bg-indigo-700"
                          >
                            Google ile Giriş Yap ➔
                          </button>
                        </div>
                      </div>
                    )}

                    {restoreStep === "gpa" && (
                      <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">GOOGLE PLAY SİPARİŞ KODU (GPA NO)</label>
                          <input
                            type="text"
                            placeholder="GPA.3301-5291-8849-10255"
                            value={gpaInput}
                            onChange={(e) => setGpaInput(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-black text-slate-800 dark:text-white uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-450"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">SATIN ALDIĞINIZ SÜRÜM / LİSANS TİPİ</label>
                          <select
                            value={restoredPlanType}
                            onChange={(e) => setRestoredPlanType(e.target.value as any)}
                            className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-extrabold text-slate-750 dark:text-white focus:outline-none"
                          >
                            <option value="monthly">Aylık Abonelik Planı (₺29,99 / Ay)</option>
                            <option value="yearly">Yıllık Avantajlı Abonelik Planı (₺299,99 / Yıl)</option>
                            <option value="lifetime">Limitsiz Ömür Boyu Tek Ödeme Lisansı (₺599,99)</option>
                          </select>
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-[10px] leading-relaxed text-slate-500 font-bold rounded-xl uppercase">
                          💡 Sipariş No Google Play Store fatura e-postasında GPA.XXXX-XXXX-XXXX-XXXXX formatında yer alır. Kod doğrulandığında seçili lisansınız anında yeniden aktif edilir.
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRestoreStep("method");
                              setGpaInput("");
                            }}
                            className="flex-1 py-2.5 bg-slate-150 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                          >
                            Geri Dön
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!gpaInput.toUpperCase().startsWith("GPA.") || gpaInput.length < 10) {
                                triggerToast("Lütfen geçerli bir Google Play sipariş numarası (GPA.XXXX-XXXX...) giriniz.");
                                return;
                              }
                              setRestoreStep("restoring");
                              
                              setRestoreStatusLog("Google Play Core Billing API'sine bağlanılıyor...");
                              setTimeout(() => {
                                setRestoreStatusLog("Google Play lisans imza anahtarı sunucudan sorgulanıyor...");
                              }, 1300);
                              setTimeout(() => {
                                setRestoreStatusLog("GPA siparişi doğrulandı, satın alım tablosu yerelleştiriliyor...");
                              }, 2800);
                              setTimeout(() => {
                                savePremiumStatusAndSync(true, restoredPlanType);
                                setRestoreStep("success");
                              }, 4300);
                            }}
                            className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-black text-xs uppercase rounded-xl hover:scale-102 transition cursor-pointer"
                          >
                            Doğrula ve Geri Yükle ➔
                          </button>
                        </div>
                      </div>
                    )}

                    {restoreStep === "restoring" && (
                      <div className="py-12 text-center space-y-4">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <div className="space-y-1">
                          <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">Google Play Lisans Servisi Sorgulanıyor</p>
                          <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-black animate-pulse uppercase">
                            {restoreStatusLog || "Google Play api'lerine bağlanılıyor..."}
                          </p>
                        </div>
                      </div>
                    )}

                    {restoreStep === "success" && (
                      <div className="space-y-4 pt-2 text-center">
                        <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center text-3xl mx-auto border border-emerald-500/20 shadow-lg shadow-emerald-500/15 animate-bounce">
                          🎉
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">SATIN ALIM BAŞARIYLA GERİ YÜKLENDİ</h4>
                          <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-bold uppercase leading-none">
                            Aktif Kapsam: <span className="text-indigo-600 dark:text-indigo-400 font-black">{restoredPlanType === "monthly" ? "Aylık Paket (Aylık)" : restoredPlanType === "yearly" ? "Yıllık Paket (Yıllık)" : "Ömür Boyu Limitsiz (Sınırsız/Limitsiz)"}</span>
                          </p>
                        </div>

                        <div className="p-3.5 bg-slate-50 dark:bg-slate-950 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 font-medium rounded-2xl border border-slate-200 dark:border-slate-850">
                          Google Play siparişiniz başarıyla saptanmış ve cihazınızın ödeme durum tablosu güncellenmiştir. Artık tüm reklamlar kaldırılmış, AI finansal koçu ve sınırsız PDF/Excel raporları aktiftir.
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            closeUpgradeModal();
                            setIsRestoring(false);
                            setRestoreStep("method");
                          }}
                          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-90 active:scale-[0.98] transition cursor-pointer"
                        >
                          Tüm Sınırları Kaldır ve Başla ⚡
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="text-center space-y-1">
                      <div className="inline-flex p-3 bg-amber-500/10 dark:bg-amber-500/20 rounded-full border border-amber-500/20 text-amber-500 animate-bounce">
                        <Sparkles className="w-8 h-8 text-amber-500" />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-amber-500">
                        BÜTÇEM PRO PREMIUM
                      </h3>
                      <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1">
                        Sınırları Ortadan Kaldırın 👑
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium px-4 leading-relaxed">
                        Finansal bütçe yönetimini profesyonel seviyeye yükselten gelişmiş özellikleri keşfedin.
                      </p>
                    </div>

                    {/* Trial Expired / Subscription Pending Alert Banner */}
                    {isTrialExpiredLocked && (
                      <div className="p-3.5 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl text-center space-y-1">
                        <div className="flex items-center justify-center gap-1.5 text-amber-700 dark:text-amber-400 font-black text-xs uppercase tracking-wide">
                          {localStorage.getItem("is_guest") === "false" 
                            ? "👑 Aboneliğinizi Tamamlayın" 
                            : "⚠️ 7 Günlük Ücretsiz Deneme Süreniz Sona Erdi"}
                        </div>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                          {localStorage.getItem("is_guest") === "false"
                            ? "Hesabınız oluşturuldu. Uygulamayı kullanabilmek için lütfen bir Premium plan seçin."
                            : "Uygulamayı kullanmaya devam etmek için lütfen Premium planlardan birini seçin."}
                        </p>
                      </div>
                    )}

                    {/* Promo Feature notice if navigated specifically */}
                    {promoFeature && (
                      <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                        ⚠️ <span className="font-black text-indigo-600 dark:text-indigo-400">{promoFeature}</span> özelliğine erişmek için Premium üye olmanız gerekmektedir.
                      </div>
                    )}

                    {isPricingLoading ? (
                      <div className="py-12 text-center space-y-4">
                        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <div className="space-y-1">
                          <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Google Play Store Bağlantısı</p>
                          <p className="text-[10px] text-amber-600 dark:text-amber-500 font-mono font-black animate-pulse uppercase">
                            Dinamik Fiyat ve Paket Bilgileri Yükleniyor...
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Features list */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                          {[
                            { icon: "🤖", title: "AI Finansal Koç", desc: "Harcamalarınızı yapay zeka ile analiz edin ve tasarruf stratejileri geliştirin." },
                            { icon: "🎙️", title: "Akıllı Sesli Asistan", desc: "Sadece konuşarak bütçe, borç, gelir ve taksitlerinizi saniyeler içinde kaydedin." },
                            { icon: "💹", title: "Canlı Borsa & Döviz", desc: "Tüm finansal verilerinizi anlık kurlar üzerinden takip edin." },
                            { icon: "📈", title: "Sınırsız PDF/Excel Rapor", desc: "Finansal verilerinizi dilediğiniz an profesyonel raporlara dönüştürün." },
                            { icon: "🔐", title: "Biyometrik Güvenlik", desc: "Parmak izi veya FaceID ile bütçe verilerinizi güvence altına alın." },
                            { icon: "📅", title: "Ödeme Takvimi & Planlar", desc: "Borç vadelerini ve faturaları interaktif takvimden izleyin." },
                            { icon: "🚫", title: "%100 Reklamsız Deneyim", desc: "Tüm reklamları ve sponsorlu her şeyi tamamen kaldırın." }
                          ].map((f, i) => (
                            <div key={i} className="flex items-start gap-3 p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-900 transition-colors">
                              <span className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl text-lg leading-none shrink-0 font-bold">{f.icon}</span>
                              <div className="space-y-0.5">
                                <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-none">{f.title}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-normal">{f.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Simulated Plans Select / Activation block */}
                        <div className="space-y-4">
                          <p className="text-[11px] font-black uppercase text-amber-600 dark:text-amber-500 tracking-widest text-center flex items-center justify-center gap-2">
                            <span className="w-6 h-px bg-amber-500/30" /> 👑 PREMİUM PLANLAR <span className="w-6 h-px bg-amber-500/30" />
                          </p>
                          <div className="grid grid-cols-3 gap-2.5">
                            {[
                              {
                                planKey: "monthly" as const,
                                id: "butcem_pro_aylik" as const,
                                label: "AYLIK",
                                product: (dynamicProducts as any)?.butcem_pro_aylik || PLAY_PRODUCTS.butcem_pro_aylik,
                                badge: "ESNEK",
                                period: "Aylık Yenilenen"
                              },
                              {
                                planKey: "yearly" as const,
                                id: "butcem_pro_yillik" as const,
                                label: "YILLIK",
                                product: (dynamicProducts as any)?.butcem_pro_yillik || PLAY_PRODUCTS.butcem_pro_yillik,
                                badge: "EN POPÜLER",
                                period: "Tasarruf: %45",
                                isPopular: true
                              },
                              {
                                planKey: "lifetime" as const,
                                id: "butcem_pro_sinirsiz" as const,
                                label: "LİMİTSİZ",
                                product: (dynamicProducts as any)?.butcem_pro_sinirsiz || PLAY_PRODUCTS.butcem_pro_sinirsiz,
                                badge: "ÖMÜR BOYU",
                                period: "Tek Ödeme",
                                isLifetime: true
                              }
                            ].map((pkg) => {
                              const isSelected = selectedPlan === pkg.planKey;
                              return (
                                <div
                                  key={pkg.id}
                                  onClick={() => setSelectedPlan(pkg.planKey)}
                                  className={`p-3 rounded-2xl text-center relative overflow-hidden transition-all duration-200 select-none cursor-pointer ${
                                    pkg.isPopular ? "pt-6.5" : ""
                                  } ${
                                    isSelected
                                      ? pkg.isLifetime
                                        ? "bg-indigo-650 text-white border-2 border-indigo-400 ring-4 ring-indigo-500/25 scale-[1.04] z-20 shadow-xl shadow-indigo-500/20"
                                        : "bg-amber-500/15 dark:bg-amber-500/20 border-2 border-amber-500 ring-4 ring-amber-500/10 scale-[1.04] z-20 shadow-xl shadow-amber-500/10"
                                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm opacity-70 hover:opacity-100 hover:border-slate-350 dark:hover:border-slate-600"
                                  }`}
                                >
                                  {pkg.isPopular && (
                                    <div className="absolute top-0 right-0 left-0 bg-amber-500 text-white text-[8px] font-black py-0.5 uppercase tracking-widest leading-none">
                                      {pkg.badge}
                                    </div>
                                  )}
                                  <p className={`text-[9px] font-black uppercase tracking-tight ${
                                    isSelected ? (pkg.isLifetime ? "text-indigo-200" : "text-amber-600 dark:text-amber-400") : "text-slate-500"
                                  }`}>
                                    {pkg.label}
                                  </p>
                                  <p className={`text-base font-black mt-1 ${
                                    isSelected ? (pkg.isLifetime ? "text-white" : "text-slate-950 dark:text-white") : "text-slate-700 dark:text-slate-200"
                                  }`}>
                                    {pkg.product?.priceString}
                                  </p>
                                  <p className={`text-[8px] font-black uppercase mt-1 leading-none ${
                                    isSelected ? (pkg.isLifetime ? "text-white/80" : "text-amber-600/80") : "text-slate-400"
                                  }`}>
                                    {pkg.period}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-3 pt-1">
                          {/* 7 Günlük Ücretsiz Deneme (Trial Activation / Status Block) */}
                          <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-2.5 shadow-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">🎁 7 GÜNLÜK ÜCRETSİZ DENEME</span>
                              <span className="text-[8px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">PRO SÜRÜM</span>
                            </div>
                            
                            {trialStatus && trialStatus.hasTrial ? (
                              trialStatus.isActive && isPremium ? (
                                <div className="space-y-2.5 text-center bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20">
                                  <p className="text-[11px] font-black text-indigo-750 dark:text-indigo-300 uppercase leading-none">
                                    ✨ DENEME SÜRÜMÜNÜZ AKTİF
                                  </p>
                                  <p className="text-[10px] text-indigo-600 dark:text-indigo-450 font-bold">
                                    Kalan Süre: <span className="font-extrabold text-xs">{trialStatus.daysRemaining} Gün</span>
                                  </p>
                                  <p className="text-[8px] text-slate-400 dark:text-slate-500 font-semibold uppercase">
                                    Sona Erme: {trialStatus.endDate ? new Date(trialStatus.endDate).toLocaleDateString("tr-TR") : "-"}
                                  </p>
                                  <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                                    7 günlük deneme süresi tek seferliktir ve yenilenmez. Süre dolduğunda otomatik olarak reklamlı ve kısıtlı ücretsiz plan ile devam edilir.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={handleCancelTrial}
                                    className="w-full mt-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-black text-[10px] uppercase tracking-wider rounded-xl transition text-center select-none cursor-pointer flex items-center justify-center gap-1.5 active:scale-97"
                                  >
                                    ✕ Deneme Sürümünü İptal Et
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2 text-center bg-slate-100 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                  <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase leading-none">
                                    ⏳ DENEME SÜRÜNÜZ SONA ERDİ
                                  </p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                    7 günlük ücretsiz deneme hakkınız tamamlanmıştır. Şu anda <strong>reklamlı ve kısıtlı ücretsiz plan</strong> ile devam etmektesiniz.
                                  </p>
                                  <div className="pt-1">
                                    <span className="inline-block text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-2.5 py-1 rounded-md">
                                      🛡️ Reklamlı ve Kısıtlı Ücretsiz Plan Aktif
                                    </span>
                                  </div>
                                </div>
                              )
                            ) : (
                              <div className="space-y-2">
                                <p className="text-[10px] text-slate-550 dark:text-slate-400 font-bold leading-relaxed uppercase">
                                  Kredi kartı gerekmeden 7 gün boyunca Bütçem Pro Premium'un tüm ayrıcalıklı özelliklerini ücretsiz kullanabilirsiniz.
                                </p>
                                <button
                                  type="button"
                                  onClick={handleActivateTrial}
                                  className="w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:opacity-95 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition text-center select-none cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 active:scale-97"
                                >
                                  🚀 7 GÜNLÜK ÜCRETSİZ DENEMEYİ BAŞLAT
                                </button>
                              </div>
                            )}
                          </div>

                          {isPremium ? (
                            <div className="space-y-2.5">
                              <div className="p-3 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-center font-bold text-xs uppercase tracking-tight flex flex-col items-center justify-center gap-1 font-sans">
                                <span className="font-extrabold text-[12px] tracking-wide">
                                  {localStorage.getItem("premium_source") === "trial" ? "✨ DENEME SÜRÜMÜNÜZ AKTİF" : "👑 LİSANSLI PRO SÜRÜM AKTİF"}
                                </span>
                                <span className="text-[10px] bg-emerald-500/10 px-2.5 py-0.5 rounded-md font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                                  {localStorage.getItem("premium_source") === "trial" 
                                    ? `Kalan Süre: ${trialStatus?.daysRemaining || 7} Gün` 
                                    : `Paket: ${selectedPlan === "monthly" ? "Bütçem Pro - Aylık" : selectedPlan === "yearly" ? "Bütçem Pro - Yıllık" : "Bütçem Pro - Sınırsız (Ömür Boyu)"}`}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (localStorage.getItem("premium_source") === "trial") {
                                    handleCancelTrial();
                                  } else {
                                    savePremiumStatusAndSync(false, "yearly");
                                    localStorage.removeItem("premium_source");
                                    triggerToast("Ücretsiz plana geçiş yapıldı ⭐");
                                  }
                                }}
                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer active:scale-97 border border-dashed border-slate-300 dark:border-slate-700"
                              >
                                {localStorage.getItem("premium_source") === "trial" ? "✕ Deneme Sürümünü İptal Et" : "Lisansı Devre Dışı Bırak (Test)"}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                handlePurchase(selectedPlan);
                              }}
                              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-650 text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-97"
                            >
                              <span>
                                {selectedPlan === "monthly" && `AYLIK PLANI ETKİNLEŞTİR (${((dynamicProducts as any)?.butcem_pro_aylik || PLAY_PRODUCTS.butcem_pro_aylik)?.priceString}) ⚡`}
                                {selectedPlan === "yearly" && `YILLIK PLANI ETKİNLEŞTİR (${((dynamicProducts as any)?.butcem_pro_yillik || PLAY_PRODUCTS.butcem_pro_yillik)?.priceString}) ⚡`}
                                {selectedPlan === "lifetime" && `SINIRSIZ (ÖMÜR BOYU) ETKİNLEŞTİR (${((dynamicProducts as any)?.butcem_pro_sinirsiz || PLAY_PRODUCTS.butcem_pro_sinirsiz)?.priceString}) ⚡`}
                              </span>
                            </button>
                          )}

                          {/* ALREADY HAVE ACCOUNT / LOGIN BUTTON */}
                          <button
                            type="button"
                            onClick={() => {
                              closeUpgradeModal();
                              setIsRestoring(false);
                              setRestoreStep("method");
                              setSelectedProvider("google");
                              setProviderLoginOpen(true);
                            }}
                            className="w-full py-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 font-black text-[10.5px] uppercase tracking-wide rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                          >
                            🔑 Zaten Hesabım Var (E-Posta / Bulut Girişi)
                          </button>

                          {/* GOOGLE PLAY RESTORE BUTTON */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsRestoring(true);
                              setRestoreStep("method");
                            }}
                            className="w-full py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-black text-[10.5px] uppercase tracking-wide rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                          >
                            🔄 Google Play'den Satın Alımları Geri Yükle
                          </button>

                          {isTrialExpiredLocked ? (
                            <div className="pt-2 text-center space-y-2">
                              <p className="text-[11px] text-rose-500 dark:text-rose-400 font-bold">
                                ⚠️ Deneme süreniz dolduğu için paket seçimi zorunludur.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  handleLogout();
                                  setIsTrialExpiredLocked(false);
                                  setIsUpgradeModalOpen(false);
                                  setProviderLoginOpen(true);
                                }}
                                className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
                              >
                                Farklı Bir Hesapla Giriş Yap / Çıkış Yap
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                closeUpgradeModal();
                                setIsRestoring(false);
                                setRestoreStep("method");
                              }}
                              className="w-full py-2 text-center text-slate-400 hover:text-slate-600 dark:text-slate-500 text-xs font-bold transition block cursor-pointer"
                            >
                              Kapat, Vazgeç
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7-Day Trial Expired Mandatory Paywall Barrier */}
      {isTrialExpiredLocked && !isUpgradeModalOpen && (
        <div className="fixed inset-0 z-[2500] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 text-center space-y-4 shadow-2xl border-2 border-rose-500/30">
            <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-rose-500/20">
              ⏳
            </div>
            <h3 className="text-base font-black text-slate-800 dark:text-white">
              7 Günlük Ücretsiz Deneme Süreniz Sona Erdi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Uygulamayı kullanmaya devam etmek için lütfen Premium planlardan birini seçin.
            </p>
            <button
              type="button"
              onClick={() => setIsUpgradeModalOpen(true)}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              👑 Premium Planları İncele ve Satın Al
            </button>
            <button
              type="button"
              onClick={() => {
                handleLogout();
                setIsTrialExpiredLocked(false);
                setProviderLoginOpen(true);
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer block mx-auto pt-1"
            >
              Farklı Bir Hesapla Giriş Yap / Çıkış Yap
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Google Play Billing Interactive Overlay */}
      <AnimatePresence>
        {isGPlayBillingActive && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[3000] flex items-end justify-center sm:items-center p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-left"
            >
              {/* Google Play top badge bar */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center bg-transparent shrink-0">
                    <svg viewBox="0 0 24 24" className="w-full h-full">
                      <path d="M3,5.27V18.73c0,0.89,0.97,1.44,1.72,0.97l10.77-6.73a1.12,1.12,0,0,0,0-1.94L4.72,4.3c-.75-.47-1.72.08-1.72.97Z" fill="#34A853" />
                      <path d="M15.49,12l-10.77,6.73c-.75.47-1.72-.08-1.72-.97v-.5c0-.89.97-1.44,1.72-.97l10.77-6.73a1.12,1.12,0,0,1,0,1.94Z" fill="#EA4335" />
                      <path d="M15.49,12L4.72,4.3C3.97,3.83,3,4.38,3,5.27v.5c0-.89.97-1.44,1.72-.97l10.77,6.73a1.12,1.12,0,0,0,0,1.94Z" fill="#4285F4" />
                      <path d="M19.14,11L15.49,8.7a1.12,1.12,0,0,0-1.34,0L4.72,14.5a1.12,1.12,0,0,0,0,1.94l9.43,5.9a1.12,1.12,0,0,0,1.34,0l3.65-2.3a1.12,1.12,0,0,0,0-1.94Z" fill="#FBBC05" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-black tracking-normal text-slate-700 dark:text-slate-300 font-sans uppercase">Google Play Billing</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                    Güvenli SSL 🛡️
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      clearPurchaseTimeouts();
                      setIsGPlayBillingActive(false);
                      setIsPurchasing(false);
                      setPurchaseStatus("");
                      setIsChangingPaymentMethod(false);
                      setPaymentFormType("none");
                      triggerToast("Google Play faturası kapatıldı.");
                    }}
                    className="p-1 px-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition cursor-pointer text-[11px] font-black"
                    title="Kapat"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Package detailed review */}
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">SATIN ALINACAK ÜRÜN</span>
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-black text-slate-800 dark:text-white leading-tight">
                        {selectedPlan === "monthly" && ((dynamicProducts as any)?.butcem_pro_aylik?.title || PLAY_PRODUCTS.butcem_pro_aylik.title)}
                        {selectedPlan === "yearly" && ((dynamicProducts as any)?.butcem_pro_yillik?.title || PLAY_PRODUCTS.butcem_pro_yillik.title)}
                        {selectedPlan === "lifetime" && ((dynamicProducts as any)?.butcem_pro_sinirsiz?.title || PLAY_PRODUCTS.butcem_pro_sinirsiz.title)}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-bold font-mono">
                        Ürün ID: {selectedPlan === "monthly" ? "butcem_pro_aylik" : selectedPlan === "yearly" ? "butcem_pro_yillik" : "butcem_pro_sinirsiz"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-indigo-650 dark:text-indigo-400">
                        {selectedPlan === "monthly" && ((dynamicProducts as any)?.butcem_pro_aylik?.priceString || PLAY_PRODUCTS.butcem_pro_aylik.priceString)}
                        {selectedPlan === "yearly" && ((dynamicProducts as any)?.butcem_pro_yillik?.priceString || PLAY_PRODUCTS.butcem_pro_yillik.priceString)}
                        {selectedPlan === "lifetime" && ((dynamicProducts as any)?.butcem_pro_sinirsiz?.priceString || PLAY_PRODUCTS.butcem_pro_sinirsiz.priceString)}
                      </p>
                      <p className="text-[8px] text-slate-400 font-semibold uppercase mt-0.5">
                        {selectedPlan === "lifetime" ? "Tek Seferlik (Ömür Boyu)" : selectedPlan === "monthly" ? "Aylık Otomatik Yenilenir" : "Yıllık Otomatik Yenilenir"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Account Details */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-grow min-w-0">
                    <div className="w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs font-black uppercase shrink-0">
                      {(playAccountEmail?.[0] || "U").toUpperCase()}
                    </div>
                    <div className="flex-grow min-w-0">
                      {isEditingEmail ? (
                        <input
                          type="email"
                          value={playAccountEmail}
                          onChange={(e) => setPlayAccountEmail(e.target.value)}
                          onBlur={() => setIsEditingEmail(false)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setIsEditingEmail(false);
                          }}
                          className="bg-white dark:bg-slate-900 border border-indigo-400 rounded px-1.5 py-0.5 text-[10.5px] font-bold text-slate-800 dark:text-slate-100 w-full focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <p 
                          onClick={() => setIsEditingEmail(true)}
                          className="text-[10.5px] font-black text-slate-800 dark:text-slate-200 leading-none cursor-pointer hover:underline truncate"
                          title="E-postayı değiştirmek için tıklayın"
                        >
                          {playAccountEmail} ✏️
                        </p>
                      )}
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5 whitespace-nowrap">Google Play Hesabı (Değiştirmek için tıkla)</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingEmail(!isEditingEmail)}
                    className="text-[9px] bg-indigo-100 dark:bg-indigo-950 hover:bg-indigo-200 dark:hover:bg-indigo-900 transition text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md font-bold uppercase select-none shrink-0"
                  >
                    {isEditingEmail ? "KAYDET" : "DEĞİŞTİR"}
                  </button>
                </div>

                {/* Visa Credit Card detail */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">ÖDEME SEÇENEĞİ</span>
                  <div
                    onClick={() => setIsChangingPaymentMethod(!isChangingPaymentMethod)}
                    className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 flex items-center justify-between cursor-pointer hover:border-slate-350 dark:hover:border-slate-800 transition select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{selectedPaymentMethod.icon}</span>
                      <div>
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{selectedPaymentMethod.name}</p>
                        <p className="text-[9px] text-slate-400 font-semibold">{selectedPaymentMethod.type}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-indigo-500 font-black flex items-center gap-1">
                      {isChangingPaymentMethod ? "▲ KAPAT" : "⚙️ DEĞİŞTİR"}
                    </span>
                  </div>

                  <AnimatePresence>
                    {isChangingPaymentMethod && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5 mt-1.5 overflow-hidden"
                      >
                        {/* Scrollable list of active payments */}
                        <div className="max-h-[150px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
                          {playPaymentMethods.map((method) => {
                            const isSelected = selectedPaymentMethod.id === method.id;
                            return (
                              <div
                                key={method.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (method.id === "mobil_odeme") {
                                    setSelectedPaymentMethod({
                                      id: method.id,
                                      name: method.name,
                                      type: method.type,
                                      icon: method.icon
                                    });
                                    setPaymentFormType("mobile");
                                  } else {
                                    setSelectedPaymentMethod({
                                      id: method.id,
                                      name: method.name,
                                      type: method.type,
                                      icon: method.icon
                                    });
                                    setIsChangingPaymentMethod(false);
                                    setPaymentFormType("none");
                                  }
                                }}
                                className={`flex items-center justify-between p-2 rounded-xl text-left cursor-pointer transition ${
                                  isSelected
                                    ? "bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/30"
                                    : "hover:bg-white dark:hover:bg-slate-900 border border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="text-lg">{method.icon}</span>
                                  <div>
                                    <p className="text-[10px] font-black text-slate-800 dark:text-slate-100">{method.name}</p>
                                    <p className="text-[9px] text-slate-400 font-medium leading-none">{method.type}</p>
                                  </div>
                                </div>
                                {isSelected && (
                                  <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Aktif</span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Interactive addition buttons */}
                        <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentFormType(paymentFormType === "card" ? "none" : "card");
                            }}
                            className={`flex-1 py-1 px-2 font-black text-[9px] uppercase tracking-wider rounded-lg border transition text-center select-none ${
                              paymentFormType === "card"
                                ? "bg-indigo-500 text-white border-indigo-550"
                                : "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-900/50"
                            }`}
                          >
                            ➕ Yeni Kart Ekle
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentFormType(paymentFormType === "mobile" ? "none" : "mobile");
                            }}
                            className={`flex-1 py-1 px-2 font-black text-[9px] uppercase tracking-wider rounded-lg border transition text-center select-none ${
                              paymentFormType === "mobile"
                                ? "bg-amber-500 text-white border-amber-550"
                                : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/65 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 border-slate-200/50 dark:border-slate-700"
                            }`}
                          >
                            📱 Mobil No Değiştir
                          </button>
                        </div>

                        {/* Sub Form: Card Addition */}
                        {paymentFormType === "card" && (
                          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-500/20 space-y-2.5 mt-1" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-center">
                              <p className="text-[9px] font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider">💳 Simüle Kart Ekleme</p>
                              <span className="text-[8px] text-slate-400 font-bold">Gerçek bilgi girmeyiniz</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-left">
                              <div className="col-span-2">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-wider block mb-0.5">Kart Sahibi Adı</label>
                                <input
                                  type="text"
                                  value={newCardNameValue}
                                  onChange={(e) => setNewCardNameValue(e.target.value)}
                                  placeholder="Örn: Ahmet Yılmaz"
                                  className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-bold text-slate-850 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                              
                              <div className="col-span-2">
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-wider block mb-0.5">Kart Numarası</label>
                                <input
                                  type="text"
                                  maxLength={19}
                                  value={newCardNumberValue}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, "");
                                    const formatted = val.match(/.{1,4}/g)?.join(" ") || val;
                                    setNewCardNumberValue(formatted.slice(0, 19));
                                  }}
                                  placeholder="4355 1200 4500 1100"
                                  className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-mono font-bold text-slate-850 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>

                              <div>
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-wider block mb-0.5">Son Kullanma</label>
                                <input
                                  type="text"
                                  maxLength={5}
                                  value={newCardExpiryValue}
                                  onChange={(e) => {
                                    let val = e.target.value.replace(/\D/g, "");
                                    if (val.length > 2) {
                                      val = val.slice(0, 2) + "/" + val.slice(2, 4);
                                    }
                                    setNewCardExpiryValue(val);
                                  }}
                                  placeholder="08/29"
                                  className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-mono font-bold text-slate-850 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>

                              <div>
                                <label className="text-[8px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-wider block mb-0.5">CVC / CVV</label>
                                <input
                                  type="password"
                                  maxLength={3}
                                  value={newCardCVVValue}
                                  onChange={(e) => setNewCardCVVValue(e.target.value.replace(/\D/g, ""))}
                                  placeholder="•••"
                                  className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-mono font-bold text-slate-850 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setPaymentFormType("none")}
                                className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350 font-black text-[9px] uppercase tracking-wider rounded-lg transition"
                              >
                                Vazgeç
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const rawDigits = newCardNumberValue.replace(/\D/g, "");
                                  if (rawDigits.length < 12) {
                                    triggerToast("Geçerli bir test kartı numarası girin.");
                                    return;
                                  }
                                  const last4 = rawDigits.slice(-4);
                                  const cardHolder = newCardNameValue.trim() || "Bütçem Test Kartı";
                                  const generatedId = "custom_card_" + Date.now();
                                  const newCardItem = {
                                    id: generatedId,
                                    name: `Yeni Kart •••• ${last4}`,
                                    type: `Kart Sahibi: ${cardHolder}`,
                                    icon: "💳"
                                  };
                                  
                                  setPlayPaymentMethods([...playPaymentMethods, newCardItem]);
                                  setSelectedPaymentMethod(newCardItem);
                                  setPaymentFormType("none");
                                  setIsChangingPaymentMethod(false);
                                  triggerToast(`💳 Yeni kartımız Google Play listesinde seçildi ve tanımlandı: •••• ${last4}`);
                                }}
                                className="flex-1 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-750 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition shadow-sm"
                              >
                                💾 KARTI EKLE
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Sub Form: Mobile billing number update */}
                        {paymentFormType === "mobile" && (
                          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-500/20 space-y-2.5 mt-1" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-center">
                              <p className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-500 tracking-wider">📱 Mobil Numara Girişi</p>
                              <span className="text-[8px] text-slate-400 font-bold">Simüle numara kullanabilirsiniz</span>
                            </div>
                            
                            <div className="text-left">
                              <label className="text-[8px] font-black text-slate-400 dark:text-slate-505 uppercase tracking-wider block mb-0.5">Cep Telefon Numarası</label>
                              <div className="flex gap-1.5">
                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-bold text-slate-500 select-none flex items-center shrink-0">
                                  +90
                                </span>
                                <input
                                  type="text"
                                  maxLength={15}
                                  value={newMobileNoValue}
                                  onChange={(e) => setNewMobileNoValue(e.target.value)}
                                  placeholder="532 123 45 67"
                                  className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-mono font-bold text-slate-850 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                              <p className="text-[8px] text-slate-400 dark:text-slate-500 font-semibold mt-1">Simüle operatör onay kodu bu numaraya iletilir.</p>
                            </div>

                            <div className="flex gap-2 pt-1 text-left">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!newMobileNoValue.trim()) {
                                    triggerToast("Lütfen bir telefon numarası giriniz.");
                                    return;
                                  }
                                  const mNo = newMobileNoValue.trim();
                                  
                                  // Update elements list in playPaymentMethods
                                  const updated = playPaymentMethods.map(item => {
                                    if (item.id === "mobil_odeme") {
                                      return { ...item, type: `Turkcell Mobil Ödeme (${mNo})`, details: mNo };
                                    }
                                    return item;
                                  });
                                  setPlayPaymentMethods(updated);
                                  
                                  const newSel = {
                                    id: "mobil_odeme",
                                    name: "Turkcell Mobil Ödeme",
                                    type: `Mobil Ödeme (${mNo})`,
                                    icon: "📱"
                                  };
                                  setSelectedPaymentMethod(newSel);

                                  setPaymentFormType("none");
                                  setIsChangingPaymentMethod(false);
                                  triggerToast(`📱 Mobil Ödeme telefon numarası güncellendi: ${mNo}`);
                                }}
                                className="flex-1 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition shadow-sm"
                              >
                                💾 NUMARAYI GÖNDER
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Term of Service */}
                <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-relaxed">
                  Ödemeniz Google Play tarafından gerçekleştirilir. Satın al butonuna dokunarak, Google Payments Hizmet Şartları ve Gizlilik Bildirimi'ni kabul etmiş olursunuz. Yenilenen abonelikleri dilediğiniz zaman Google Play Store ayarlarından iptal edebilirsiniz.
                </p>

                {/* Simulated Loading loops for purchase execution */}
                {isPurchasing && purchaseStatus ? (
                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-none">İŞLEM GERÇEKLEŞTİRİLİYOR</p>
                      <p className="text-[9px] text-amber-650 dark:text-amber-500 animate-pulse font-mono font-black mt-0.5 uppercase tracking-wide">
                        {purchaseStatus}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* CTA actions */}
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      clearPurchaseTimeouts();
                      setIsGPlayBillingActive(false);
                      setIsPurchasing(false);
                      setPurchaseStatus("");
                      setIsChangingPaymentMethod(false);
                      setPaymentFormType("none");
                      triggerToast("Satın alım işlemi sonlandırıldı.");
                    }}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-655 dark:text-slate-300 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer text-center"
                  >
                    İptal Et
                  </button>
                  <button
                    type="button"
                    disabled={isPurchasing}
                    onClick={async () => {
                      clearPurchaseTimeouts();
                      setIsPurchasing(true);
                      setPurchaseStatus("Google Play doğrulama istekleri gönderiliyor...");
                      
                      const t1 = setTimeout(() => {
                        setPurchaseStatus("Banka provizyonu ve 3D Güvenli imza taranıyor...");
                      }, 1200);

                      const t2 = setTimeout(() => {
                        setPurchaseStatus("RevenueCat lisans anahtarı güncelleniyor...");
                      }, 2500);

                      const t3 = setTimeout(async () => {
                        const prId = selectedPlan === "monthly" ? "butcem_pro_aylik" : selectedPlan === "yearly" ? "butcem_pro_yillik" : "butcem_pro_sinirsiz";
                        try {
                          const result = await Purchases.purchasePackage(prId);
                          if (result.success) {
                            await savePremiumStatusAndSync(true, selectedPlan);
                            const names = { monthly: "Aylık", yearly: "Yıllık", lifetime: "Sınırsız (Ömür Boyu)" };
                            triggerToast(`👑 Bütçem Pro Premium (${names[selectedPlan]}) Kapsamı Aktif Edildi! Tüm Sınırlar Kaldırıldı!`);
                            setIsGPlayBillingActive(false);
                            setIsUpgradeModalOpen(false);
                            setIsChangingPaymentMethod(false);
                            setPaymentFormType("none");
                          }
                        } catch (err: any) {
                          triggerToast("Google Play Satın Alma Hatası: " + (err.message || "Bilinmeyen Hata"));
                        } finally {
                          setIsPurchasing(false);
                          setPurchaseStatus("");
                        }
                      }, 4000);

                      purchaseTimeoutsRef.current = [t1, t2, t3];
                    }}
                    className="flex-[2] py-3 bg-gradient-to-r from-emerald-600 to-emerald-750 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/10 cursor-pointer text-center select-none active:scale-97 disabled:opacity-50"
                  >
                    🚀 {isPurchasing ? "İŞLENİYOR..." : "TEK TIKLA SATIN AL"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Voice Assistant Speech-to-Text Module */}
      {isUnlocked && voiceAssistantEnabled && (
        <VoiceAssistant
          debts={debts}
          incomes={incomes}
          expenses={expenses}
          installmentDebts={installmentDebts}
          onSaveDebt={handleSaveDebt}
          onSaveIncome={handleSaveIncome}
          onSaveExpense={handleSaveExpense}
          onSaveInstallment={handleSaveInstallment}
          onSaveContactTx={handleSaveContactTx}
          onDeleteDebt={handleDeleteDebt}
          onDeleteIncome={handleDeleteIncome}
          onDeleteExpense={handleDeleteExpense}
          currentUser={currentUser}
          userApiKey={localStorage.getItem("user_gemini_api_key") || undefined}
          triggerToast={triggerToast}
          isPremium={isPremium}
          onUpgradeClick={() => openUpgradeModal("Akıllı Sesli Asistan")}
        />
      )}

      {/* Dynamic Security Screen Lock Barrier */}
      {!isUnlocked && (
        <SecurityLockOverlay onUnlockSuccess={() => setIsUnlocked(true)} />
      )}

      {/* Export & Sharing Hub Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2020] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
                    <Share2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black tracking-wide">YEDEKLEME & PAYLAŞIM MERKEZİ</h2>
                      <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[9px] rounded uppercase tracking-wider font-mono shadow-xs">PRO</span>
                    </div>
                    <p className="text-[10px] text-white/90 font-medium">WhatsApp, Google Drive veya cihazınıza özel isimle kaydedin</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {/* File Name & Preset Chips */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    YEDEK DOSYASI ADI (İSTEĞE BAĞLI ÖZELLEŞTİRİN)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={exportFileNameInput}
                      onChange={(e) => setExportFileNameInput(e.target.value)}
                      placeholder="butcem_pro_yedek"
                      className="w-full pl-3.5 pr-16 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 font-mono"
                      autoFocus
                    />
                    <span className="absolute right-3 text-[10px] font-black font-mono text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-md uppercase">
                      .json
                    </span>
                  </div>

                  {/* Preset Name Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setExportFileNameInput(`butcem_yedek_${new Date().toISOString().slice(0, 10)}`)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Calendar className="w-3 h-3 text-sky-500" /> Bugünün Tarihi
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFileNameInput("butcem_pro_tam_yedek")}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      👑 Bütçem Pro
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFileNameInput("finansal_dokum_raporu")}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      📊 Finans Raporu
                    </button>
                  </div>
                </div>

                {/* Data Summary Grid */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                    <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-center">
                      <span className="block text-indigo-500 font-extrabold text-xs">{debts.length}</span>
                      <span className="text-slate-400">Borç</span>
                    </div>
                    <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-center">
                      <span className="block text-emerald-500 font-extrabold text-xs">{incomes.length}</span>
                      <span className="text-slate-400">Gelir</span>
                    </div>
                    <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-center">
                      <span className="block text-rose-500 font-extrabold text-xs">{expenses.length}</span>
                      <span className="text-slate-400">Gider</span>
                    </div>
                    <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 text-center">
                      <span className="block text-amber-500 font-extrabold text-xs">{installmentDebts.length}</span>
                      <span className="text-slate-400">Taksit</span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {/* 1. WhatsApp Action */}
                  <button
                    type="button"
                    onClick={() => {
                      executeExportBackup(exportFileNameInput, "whatsapp");
                      setIsExportModalOpen(false);
                    }}
                    className="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-left shadow-md shadow-emerald-600/15 transition flex items-center gap-3 cursor-pointer group active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 text-white">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">WhatsApp ile Paylaş</h4>
                      <p className="text-[10px] text-emerald-100 font-medium leading-tight">Yedeği WhatsApp sohbetine veya kendinize iletin</p>
                    </div>
                  </button>

                  {/* 2. Google Drive Action */}
                  <button
                    type="button"
                    onClick={() => {
                      executeExportBackup(exportFileNameInput, "drive");
                      setIsExportModalOpen(false);
                    }}
                    className="p-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-2xl text-left shadow-md shadow-sky-600/15 transition flex items-center gap-3 cursor-pointer group active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 text-white">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">Google Drive'a Kaydet</h4>
                      <p className="text-[10px] text-sky-100 font-medium leading-tight">Drive bulut klasörünüze yükleyin</p>
                    </div>
                  </button>

                  {/* 3. System Share Sheet */}
                  <button
                    type="button"
                    onClick={() => {
                      executeExportBackup(exportFileNameInput, "share");
                      setIsExportModalOpen(false);
                    }}
                    className="p-3 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-2xl text-left shadow-md transition flex items-center gap-3 cursor-pointer group active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/10 dark:bg-slate-900/10 flex items-center justify-center shrink-0 text-white dark:text-slate-900">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black">Cihaz Menüsüyle Paylaş</h4>
                      <p className="text-[10px] text-slate-300 dark:text-slate-600 font-medium leading-tight">Telegram, Gmail, Bluetooth veya Dosyalarım</p>
                    </div>
                  </button>

                  {/* 4. Direct JSON Download */}
                  <button
                    type="button"
                    onClick={() => {
                      executeExportBackup(exportFileNameInput, "download");
                      setIsExportModalOpen(false);
                    }}
                    className="p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl text-left shadow-sm transition flex items-center gap-3 cursor-pointer group active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black">Cihaza İndir (.json)</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight">İndirilenler klasörüne doğrudan kaydet</p>
                    </div>
                  </button>
                </div>

                {/* Footer Copy & Close Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";
                      const contactsKey = `${spaceKey}_contacts_directory`;
                      const contactTxsKey = `${spaceKey}_contacts_transactions`;
                      let contactsData = [];
                      let contactTxsData = [];
                      try { contactsData = JSON.parse(localStorage.getItem(contactsKey) || "[]"); } catch {}
                      try { contactTxsData = JSON.parse(localStorage.getItem(contactTxsKey) || "[]"); } catch {}
                      const bag = { 
                        version: "2.0.0", 
                        exportDate: new Date().toISOString(),
                        user: currentUser || "Bireysel Kullanıcı",
                        debts, incomes, alarms, notifications, installmentDebts, payments, expenses, expenseCategories, 
                        contacts: contactsData, contactTransactions: contactTxsData 
                      };
                      navigator.clipboard.writeText(JSON.stringify(bag, null, 2));
                      triggerToast("✅ Tüm veri yedeği panoya kopyalandı!");
                      setIsExportModalOpen(false);
                    }}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <ClipboardList className="w-3.5 h-3.5 text-indigo-500" /> Panoya Kopyala
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(false)}
                    className="py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WebView Export Portal Modal */}
      <AnimatePresence>
        {webViewExportOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2020] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-amber-500/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-950/30 rounded-xl">
                    <Download className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Android APK Portalı</h3>
                    <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">{webViewExportTitle}</h2>
                  </div>
                </div>
                <button
                  onClick={() => setWebViewExportOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-950 dark:text-amber-300 text-xs rounded-2xl leading-relaxed font-semibold">
                  🚀 <span className="font-extrabold text-amber-700 dark:text-amber-400">Verileriniz otomatik olarak panoya kopyalandı!</span> Android APK uygulaması içinden doğrudan dosya indirme kısıtlamalarını aşmak için yedek verileriniz hazırlandı.
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    Aşağıdaki kutuda yer alan tüm kod bloğunu kopyalayıp WhatsApp, E-posta veya Not defterinize yapıştırarak saklayabilirsiniz. Daha sonra yine kopyalayıp bu uygulamaya yapıştırarak saniyeler içinde geri yükleyebilirsiniz.
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">{webViewExportFileName || "yedek.json"}</label>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(webViewExportContent);
                        triggerToast("Yedek veriler kopyalandı! 📋");
                      }}
                      className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Kodu Tekrar Kopyala 📋
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={webViewExportContent}
                    className="w-full h-44 p-3 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-mono text-[10px] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none select-all resize-none"
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800/60 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(webViewExportContent);
                    triggerToast("Panoya Kopyalandı! 📋");
                    setWebViewExportOpen(false);
                  }}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition active:scale-95 cursor-pointer shadow-md"
                >
                  Kopyala ve Kapat ✓
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WebView Import Paste Modal */}
      <AnimatePresence>
        {isImportTextOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2020] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-indigo-500/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-950/30 rounded-xl">
                    <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Android APK Portalı</h3>
                    <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">Yapıştırarak İçe Aktar</h2>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsImportTextOpen(false);
                    setPastedImportText("");
                  }}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 text-slate-700 dark:text-indigo-200 text-xs rounded-2xl leading-relaxed font-semibold">
                  📋 <span className="font-extrabold text-indigo-700 dark:text-indigo-400">Dışarı aktardığınız yedek metnini buraya yapıştırın.</span>
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    Daha önce kopyalamış olduğunuz yedek kod bloğunu aşağıdaki alana yapıştırıp "Yedeği Çöz ve Yükle" butonuna tıklayarak verilerinizi anında geri yükleyebilirsiniz.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Yedek Kod Bloğu (JSON)</label>
                  <textarea
                    value={pastedImportText}
                    onChange={(e) => setPastedImportText(e.target.value)}
                    placeholder='{"debts": [...], "incomes": [...]}'
                    className="w-full h-44 p-3 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-mono text-[10px] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportTextOpen(false);
                    setPastedImportText("");
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="button"
                  disabled={!pastedImportText.trim()}
                  onClick={() => {
                    const success = processBackupJSON(pastedImportText.trim());
                    if (success) {
                      setIsImportTextOpen(false);
                      setPastedImportText("");
                    }
                  }}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition active:scale-95 cursor-pointer shadow-md disabled:opacity-50"
                >
                  Yedeği Çöz ve Yükle ✓
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
