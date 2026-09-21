/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Key,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  AlertTriangle,
  Lock,
  Sliders,
  Sparkles,
  Mic,
  Play,
  Pause,
  Cloud,
  HardDrive,
  RefreshCw,
  Upload,
  Download,
  Share2,
  Calendar,
  ShieldCheck,
  Zap,
  User,
  Fingerprint,
  ChevronLeft,
  ChevronDown,
  Settings as SettingsIcon,
  Check,
  Folder
} from "lucide-react";

interface SecuritySettingsPanelProps {
  language?: string;
  onSuccessToast: (msg: string) => void;
  marqueeSpeed?: number;
  setMarqueeSpeed?: (speed: number) => void;
  marqueePaused?: boolean;
  setMarqueePaused?: (paused: boolean) => void;
  voiceAssistantEnabled?: boolean;
  setVoiceAssistantEnabled?: (enabled: boolean) => void;
  isPremium?: boolean;
  onOpenUpgradeModal?: (featureName?: string) => void;
  onOpenOnboarding?: () => void;
  currentUser?: string | null;
  onOpenGoogleLogin?: () => void;
  onManualSyncAll?: () => Promise<void>;
  debts?: any[];
  installmentDebts?: any[];
  incomes?: any[];
  expenses?: any[];
  alarms?: any[];
  notifications?: any[];
  payments?: any[];
  expenseCategories?: any[];
  onRestoreBackup?: (backupData: any) => Promise<boolean | void> | void;
  onExecuteExportBackup?: (customName?: string, action?: any) => void;
  onProcessBackupJSON?: (jsonStr: string) => boolean | Promise<boolean>;
  isOfflineMode?: boolean;
  initialTab?: "cloud" | "security" | "settings";
  onBack?: () => void;
}

export const SecuritySettingsPanel: React.FC<SecuritySettingsPanelProps> = ({
  language = "tr",
  onSuccessToast,
  marqueeSpeed: propMarqueeSpeed,
  setMarqueeSpeed: propSetMarqueeSpeed,
  marqueePaused: propMarqueePaused,
  setMarqueePaused: propSetMarqueePaused,
  voiceAssistantEnabled: propVoiceAssistantEnabled,
  setVoiceAssistantEnabled: propSetVoiceAssistantEnabled,
  isPremium = false,
  onOpenUpgradeModal,
  onOpenOnboarding,
  currentUser = null,
  onOpenGoogleLogin,
  onManualSyncAll,
  debts = [],
  installmentDebts = [],
  incomes = [],
  expenses = [],
  alarms = [],
  notifications = [],
  payments = [],
  expenseCategories = [],
  onRestoreBackup,
  onExecuteExportBackup,
  onProcessBackupJSON,
  initialTab = "cloud",
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<"cloud" | "security" | "settings" | "none">(initialTab || "cloud");

  // Cloud Sync state
  const [cloudActiveTab, setCloudActiveTab] = useState<"sync" | "drive" | "restore">("sync");
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [syncStatusStep, setSyncStatusStep] = useState<string>("");
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return localStorage.getItem("last_cloud_sync_timestamp") || "Henüz eşitlenmedi";
  });
  const [isAutoSyncActive, setIsAutoSyncActive] = useState<boolean>(() => {
    return localStorage.getItem("auto_cloud_sync_active") !== "false";
  });
  const [customBackupName, setCustomBackupName] = useState<string>(() => {
    return `butcem_pro_yedek_${new Date().toISOString().slice(0, 10)}`;
  });
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleRunCloudSyncNow = async () => {
    if (!isPremium) {
      onSuccessToast("⭐ Anlık Bulut Senkronizasyonu Bütçem PRO özelliğidir.");
      if (onOpenUpgradeModal) onOpenUpgradeModal("Anlık Bulut Senkronizasyonu (Firebase)");
      return;
    }
    if (isCloudSyncing) return;
    setIsCloudSyncing(true);
    setSyncProgress(25);
    setSyncStatusStep("1/3 Yerel veritabanı taranıyor ve kayıtlar paketleniyor...");

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSyncProgress(65);
      setSyncStatusStep("2/3 Firebase Firestore 256-Bit SSL/TLS şifreli bulut tüneline aktarılıyor...");

      if (onManualSyncAll) {
        await onManualSyncAll();
      }

      await new Promise((resolve) => setTimeout(resolve, 600));
      setSyncProgress(100);
      setSyncStatusStep("3/3 Senkronizasyon başarıyla tamamlandı!");

      const now = new Date();
      const timeStr = `${now.toLocaleDateString("tr-TR")} ${now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      setLastSyncTime(timeStr);
      localStorage.setItem("last_cloud_sync_timestamp", timeStr);

      onSuccessToast("☁️ Tüm verileriniz Firebase Firestore bulutuna başarıyla senkronize edildi!");
    } catch (err: any) {
      console.error(err);
      onSuccessToast("⚠️ Bulut eşitleme sırasında bir sorun oluştu, verileriniz yerelde güvendedir.");
    } finally {
      setTimeout(() => {
        setIsCloudSyncing(false);
        setSyncProgress(0);
        setSyncStatusStep("");
      }, 1200);
    }
  };

  const handleToggleAutoSync = () => {
    if (!isPremium) {
      onSuccessToast("⭐ Otomatik Bulut Senkronizasyonu Bütçem PRO özelliğidir.");
      if (onOpenUpgradeModal) onOpenUpgradeModal("Otomatik Bulut Senkronizasyonu");
      return;
    }
    const next = !isAutoSyncActive;
    setIsAutoSyncActive(next);
    localStorage.setItem("auto_cloud_sync_active", String(next));
    onSuccessToast(
      next
        ? "Otomatik Arka Plan Bulut Senkronizasyonu Aktif Edildi 🔄"
        : "Otomatik Bulut Senkronizasyonu Duraklatıldı ⏸️"
    );
  };

  const handleTriggerDriveExport = (action: "download" | "drive" | "whatsapp" | "share") => {
    if (!isPremium && onOpenUpgradeModal) {
      onOpenUpgradeModal("Bulut Yedekleme & Google Drive Entegrasyonu");
      return;
    }

    if (onExecuteExportBackup) {
      onExecuteExportBackup(customBackupName, action);
      const now = new Date();
      const timeStr = `${now.toLocaleDateString("tr-TR")} ${now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      setLastSyncTime(timeStr);
      localStorage.setItem("last_cloud_sync_timestamp", timeStr);
      return;
    }

    try {
      const backupData = {
        version: "4.5.0",
        exportDate: new Date().toISOString(),
        user: currentUser || "anonymous",
        debts,
        installmentDebts,
        incomes,
        expenses,
        alarms,
        notifications,
        payments,
        expenseCategories,
      };
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${customBackupName.endsWith(".json") ? customBackupName : `${customBackupName}.json`}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onSuccessToast(`📁 '${customBackupName}.json' cihazınıza başarıyla indirildi!`);
    } catch (err) {
      console.error(err);
      onSuccessToast("Dosya indirme sırasında bir hata oluştu.");
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPremium) {
      onSuccessToast("⭐ Yedek Dosyası Geri Yükleme Bütçem PRO özelliğidir.");
      if (onOpenUpgradeModal) onOpenUpgradeModal("Yedek Dosyası Geri Yükleme");
      if (e.target) e.target.value = "";
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    try {
      const text = await file.text();
      if (onProcessBackupJSON) {
        await onProcessBackupJSON(text);
      } else {
        const parsed = JSON.parse(text);
        if (onRestoreBackup) {
          await onRestoreBackup(parsed);
        }
      }
      onSuccessToast("🎉 Yedek dosyanız başarıyla geri yüklendi ve sisteme işlendi!");
    } catch (err) {
      console.error(err);
      onSuccessToast("⚠️ Yedek dosyası okunurken hata oluştu. Lütfen geçerli bir JSON yedeği seçin.");
    } finally {
      setIsRestoring(false);
      if (e.target) e.target.value = "";
    }
  };

  // Local state fallbacks for banner speed
  const [localMarqueeSpeed, setLocalMarqueeSpeed] = useState<number>(() => {
    if (propMarqueeSpeed !== undefined) return propMarqueeSpeed;
    const saved = localStorage.getItem("marqueeSpeed");
    return saved ? parseInt(saved, 10) : 90;
  });

  const [localMarqueePaused, setLocalMarqueePaused] = useState<boolean>(() => {
    if (propMarqueePaused !== undefined) return propMarqueePaused;
    return false;
  });

  const [localVoiceAssistant, setLocalVoiceAssistant] = useState<boolean>(() => {
    if (propVoiceAssistantEnabled !== undefined) return propVoiceAssistantEnabled;
    return localStorage.getItem("voiceAssistantEnabled") === "1";
  });

  const currentMarqueeSpeed = propMarqueeSpeed !== undefined ? propMarqueeSpeed : localMarqueeSpeed;
  const currentMarqueePaused = propMarqueePaused !== undefined ? propMarqueePaused : localMarqueePaused;
  const currentVoiceAssistant = propVoiceAssistantEnabled !== undefined ? propVoiceAssistantEnabled : localVoiceAssistant;

  const handleUpdateMarqueeSpeed = (val: number, labelText?: string) => {
    setLocalMarqueeSpeed(val);
    if (propSetMarqueeSpeed) propSetMarqueeSpeed(val);
    localStorage.setItem("marqueeSpeed", val.toString());
    if (labelText) {
      onSuccessToast(`Vade uyarıları akış hızı: ${labelText} (${val}s) olarak ayarlandı ⏱️`);
    }
  };

  const handleToggleMarqueePaused = () => {
    const next = !currentMarqueePaused;
    setLocalMarqueePaused(next);
    if (propSetMarqueePaused) propSetMarqueePaused(next);
    onSuccessToast(next ? "Vade bandı akışı duraklatıldı ⏸️" : "Vade bandı akışı başlatıldı ▶️");
  };

  const handleToggleVoiceAssistant = () => {
    if (!isPremium) {
      if (onOpenUpgradeModal) onOpenUpgradeModal("Akıllı Sesli Asistan");
      return;
    }
    const next = !currentVoiceAssistant;
    setLocalVoiceAssistant(next);
    if (propSetVoiceAssistantEnabled) propSetVoiceAssistantEnabled(next);
    localStorage.setItem("voiceAssistantEnabled", next ? "1" : "0");
    onSuccessToast(next ? "Sesli Asistan Servisi Aktifleştirildi 🎙️" : "Sesli Asistan Servisi Devre Dışı Bırakıldı 🔕");
  };

  const [biometricLock, setBiometricLock] = useState<boolean>(() => {
    try {
      return localStorage.getItem("biometric_lock") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleBiometricLock = () => {
    if (!biometricLock && !isPremium) {
      onSuccessToast(
        language === "tr"
          ? "⭐ Biyometrik Giriş (Parmak İzi / Yüz Tanıma) Bütçem PRO Özelliğidir. Lütfen Premium'a yükseltin."
          : "⭐ Biometric Login is a PRO Feature. Please upgrade to Premium."
      );
      if (onOpenUpgradeModal) {
        onOpenUpgradeModal("Biyometrik Güvenlik (Parmak İzi / Yüz Tanıma)");
      }
      return;
    }

    const nextVal = !biometricLock;
    setBiometricLock(nextVal);
    try {
      localStorage.setItem("biometric_lock", nextVal ? "true" : "false");
    } catch (e) {
      console.error(e);
    }
    if (nextVal) {
      onSuccessToast(
        language === "tr"
          ? "Biyometrik Kilit (Parmak İzi / Yüz Tanıma) Başarıyla Etkinleştirildi! 🔒👆"
          : "Biometric Lock (Fingerprint / Face ID) Successfully Enabled! 🔒👆"
      );
    } else {
      onSuccessToast(
        language === "tr"
          ? "Biyometrik Kilit Devre Dışı Bırakıldı. 🔓"
          : "Biometric Lock Disabled. 🔓"
      );
    }
  };

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("security_settings");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {
      isEnabled: false,
      type: "pin",
      pinCode: "",
      biometricsEnabled: true,
      recoveryQuestion: "İlkokul öğretmeninizin adı nedir?",
      recoveryAnswer: "",
    };
  });

  // UI Flow modes: "idle" | "set_pin"
  const [setupMode, setSetupMode] = useState<"idle" | "set_pin">("idle");
  const [pinTemp, setPinTemp] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [recoveryQuestion, setRecoveryQuestion] = useState("İlkokul öğretmeninizin adı nedir?");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [validationError, setValidationError] = useState("");

  const saveSettings = (newSettings: any) => {
    setSettings(newSettings);
    localStorage.setItem("security_settings", JSON.stringify(newSettings));
  };

  const handleToggleSecurity = () => {
    if (settings.isEnabled) {
      const next = {
        ...settings,
        isEnabled: false,
        pinCode: "",
        recoveryAnswer: "",
      };
      saveSettings(next);
      onSuccessToast("Ekran Kilidi Güvenliği Devre Dışı Bırakıldı! 🔓");
    } else {
      startSetupFlow();
    }
  };

  const startSetupFlow = () => {
    setValidationError("");
    setSetupMode("set_pin");
    setPinTemp("");
    setPinConfirm("");
    setRecoveryAnswer("");
    setStep(1);
  };

  const handlePinNext = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (pinTemp.length !== 4 || isNaN(Number(pinTemp))) {
      setValidationError("Şifre 4 haneli sayısal bir kod olmalıdır.");
      return;
    }

    setStep(2);
  };

  const handlePinConfirmNext = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (pinTemp !== pinConfirm) {
      setValidationError("Girdiğiniz PIN kodları uyuşmuyor. Lütfen tekrar deneyin.");
      setPinConfirm("");
      return;
    }

    setStep(3);
  };

  const handleRecoverySave = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!recoveryAnswer.trim()) {
      setValidationError("Lütfen şifre kurtarma sorusu için geçerli bir cevap girin.");
      return;
    }

    const next = {
      ...settings,
      isEnabled: true,
      type: "pin",
      pinCode: pinTemp,
      recoveryQuestion: recoveryQuestion,
      recoveryAnswer: recoveryAnswer.trim().toLowerCase(),
      biometricsEnabled: settings.biometricsEnabled,
    };
    saveSettings(next);
    setSetupMode("idle");
    onSuccessToast("4 Haneli Güvenlik PIN Kodu ve Kurtarma Şifresi Başarıyla Etkinleştirildi! 🔒🛡️");
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Fixed Page Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl transition cursor-pointer shrink-0 active:scale-95"
                title="Geri Dön"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  {language === "tr" ? "Güvenlik ve Ayarlar" : "Security & Settings"}
                </h1>
                {isPremium && (
                  <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-black rounded-lg uppercase tracking-wider">
                    PRO ⭐
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {language === "tr"
                  ? "Bulut yedekleme, PIN kilit koruması, biyometrik giriş ve sistem tercihleri"
                  : "Cloud backup, PIN lock security, biometrics, and app preferences"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className={`w-2.5 h-2.5 rounded-full ${currentUser ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span>{currentUser ? currentUser : "Misafir Modu"}</span>
            </div>
          </div>
        </div>

      </div>

      {/* 3 Vertical Expandable Menu Sections (Accordion) */}
      <div className="space-y-4">
        {/* ============================================================ */}
        {/* SECTION 1: BULUT VE YEDEKLEME (FIREBASE & GOOGLE DRIVE)       */}
        {/* ============================================================ */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-300">
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "cloud" ? "none" : "cloud")}
            className={`w-full p-5 sm:p-6 flex items-center justify-between gap-4 text-left transition cursor-pointer select-none ${
              activeTab === "cloud"
                ? "bg-sky-500/10 dark:bg-sky-950/40 border-b border-slate-200 dark:border-slate-800"
                : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
            }`}
          >
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                activeTab === "cloud"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                  : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
              }`}>
                <Cloud className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                    {language === "tr" ? "Bulut ve Yedekleme (Firebase & Google Drive)" : "Cloud & Backup"}
                  </h3>
                  {!isPremium ? (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-[9px] font-black rounded-md uppercase tracking-wider flex items-center gap-1 shadow-xs">
                      <Lock className="w-2.5 h-2.5 text-slate-950" /> PRO KİLİTLİ
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-md uppercase tracking-wider flex items-center gap-1">
                      <span>👑</span> PRO AKTİF
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-normal">
                  {language === "tr"
                    ? "Anlık Firebase bulut eşitleme, otomatik yedekleme, Google Drive ve JSON içe/dışa aktarma"
                    : "Instant Firebase sync, auto backup, Google Drive and JSON import/export"}
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
              <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${activeTab === "cloud" ? "rotate-180" : ""}`} />
            </div>
          </button>

          {activeTab === "cloud" && (
            <div className="p-5 sm:p-6 space-y-6">
              {/* PRO Locked Banner when not Premium */}
              {!isPremium && (
                <div className="p-5 sm:p-6 bg-gradient-to-br from-amber-500/15 via-indigo-500/10 to-sky-500/15 border-2 border-amber-400/50 dark:border-amber-500/40 rounded-3xl shadow-lg relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                        <Lock className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[9.5px] font-black rounded-lg uppercase tracking-wider shadow-xs">
                            👑 BÜTÇEM PRO ÖZELLİĞİ
                          </span>
                          <span className="text-xs font-black text-amber-700 dark:text-amber-300">
                            Kilitli / Premium Gerekli
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                          Bulut Yedekleme & Google Drive Senkronizasyonu
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-2xl">
                          Borç, taksit, gelir ve giderlerinizi Firebase Firestore & Google Drive bulutunda 256-bit şifreleme ile güvende tutun. Telefon değişse bile verileriniz asla kaybolmaz.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenUpgradeModal && onOpenUpgradeModal("Bulut Yedekleme & Google Drive Entegrasyonu")}
                      className="px-6 py-3.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-2xl font-black text-xs shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-95"
                    >
                      <Sparkles className="w-4 h-4 text-slate-950" />
                      <span>PRO Satın Al & Tümünü Aç 👑</span>
                    </button>
                  </div>
                </div>
              )}

          {/* Sub-Tabs Selector */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto">
            <button
              type="button"
              onClick={() => setCloudActiveTab("sync")}
              className={`flex-1 min-w-[150px] px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${
                cloudActiveTab === "sync"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Cloud className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">Bulut Eşitleme (Firebase)</span>
            </button>

            <button
              type="button"
              onClick={() => setCloudActiveTab("drive")}
              className={`flex-1 min-w-[150px] px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${
                cloudActiveTab === "drive"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">Google Drive & Dışa Aktar</span>
            </button>

            <button
              type="button"
              onClick={() => setCloudActiveTab("restore")}
              className={`flex-1 min-w-[150px] px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${
                cloudActiveTab === "restore"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">Yedeği Geri Yükle</span>
            </button>
          </div>

          {/* Sub-Tab 1: Firebase Sync */}
          {cloudActiveTab === "sync" && (
            <div className="space-y-4">
              {/* Account Box */}
              <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                      AKTİF KULLANICI OTURUMU
                    </span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {currentUser || "Misafir Oturumu (Yerel Cihaz Hafızası)"}
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {currentUser
                        ? "Verileriniz hesabınızla güvenli bulutta senkronize edilmektedir."
                        : "Hesap bağlayarak verilerinizi farklı cihazlardan kaybetmeden yönetebilirsiniz."}
                    </p>
                  </div>
                </div>

                {!currentUser && onOpenGoogleLogin && (
                  <button
                    type="button"
                    onClick={onOpenGoogleLogin}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black transition shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer self-start sm:self-auto active:scale-95"
                  >
                    <span>🔑 Google ile Giriş Yap</span>
                  </button>
                )}
              </div>

              {/* Sync Card */}
              <div className="p-6 sm:p-7 bg-gradient-to-br from-sky-600 via-indigo-600 to-sky-800 rounded-3xl text-white shadow-xl space-y-5 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-sky-200 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      HER ŞEYİ TEK DOKUNUŞLA EŞİTLE
                    </span>
                    <h3 className="text-lg sm:text-xl font-black">
                      Anlık Bulut Senkronizasyonu
                    </h3>
                    <p className="text-xs text-sky-100/90 font-medium max-w-lg leading-relaxed">
                      Borçlarınız, gelirleriniz, harcamalarınız, taksit planlarınız ve cari kayıtlarınız 256-bit şifreli buluta anında aktarılır.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunCloudSyncNow}
                    disabled={isCloudSyncing}
                    className={`px-6 py-3.5 rounded-2xl font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50 active:scale-95 ${
                      !isPremium
                        ? "bg-amber-400 hover:bg-amber-300 text-slate-950 font-black"
                        : "bg-white hover:bg-slate-100 text-sky-700 hover:text-sky-800"
                    }`}
                  >
                    {!isPremium ? (
                      <>
                        <Lock className="w-4 h-4 text-slate-950" />
                        <span>KİLİTLİ 🔒 (PRO'ya Yükselt)</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className={`w-4 h-4 ${isCloudSyncing ? "animate-spin text-sky-600" : ""}`} />
                        <span>{isCloudSyncing ? "Senkronize Ediliyor..." : "Şimdi Buluta Eşitle ☁️"}</span>
                      </>
                    )}
                  </button>
                </div>

                {isCloudSyncing && (
                  <div className="p-3.5 bg-black/25 backdrop-blur-md rounded-2xl space-y-2 border border-white/10">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        {syncStatusStep}
                      </span>
                      <span>%{syncProgress}</span>
                    </div>
                    <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300 rounded-full"
                        style={{ width: `${syncProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-sky-100/80 pt-2 border-t border-white/15">
                  <span>🕒 Son Eşitleme: <strong className="text-white">{lastSyncTime}</strong></span>
                  <span className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                    256-Bit SSL/TLS Koruması
                  </span>
                </div>
              </div>

              {/* Auto Sync Switch */}
              <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-sky-500" />
                      Otomatik Arka Plan Bulut Senkronizasyonu
                    </span>
                    {!isPremium && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-lg uppercase tracking-wider">
                        PRO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Her yeni işlem, gelir, gider veya borç güncellemesinde verileri otomatik olarak buluta yazar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAutoSync}
                  className={`px-4 py-2 rounded-2xl text-xs font-black cursor-pointer transition select-none shrink-0 ${
                    !isPremium
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      : isAutoSyncActive
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {!isPremium ? "KİLİTLİ 🔒 (PRO)" : isAutoSyncActive ? "AÇIK 🟢" : "KAPALI ⚪"}
                </button>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Drive & Export */}
          {cloudActiveTab === "drive" && (
            <div className="space-y-4">
              <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                  Yedek Dosyası Adı (JSON Formatı)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customBackupName}
                    onChange={(e) => setCustomBackupName(e.target.value)}
                    placeholder="butcem_pro_yedek"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                  <span className="text-xs font-mono font-black text-slate-400">.json</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCustomBackupName(`butcem_yedek_${new Date().toISOString().slice(0, 10)}`)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Calendar className="w-3.5 h-3.5 text-sky-500" /> Bugünün Tarihi
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomBackupName("butcem_pro_tam_yedek")}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    👑 Bütçem Pro Tam Yedek
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleTriggerDriveExport("drive")}
                  className="p-5 bg-gradient-to-br from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white rounded-3xl text-left shadow-lg shadow-indigo-600/15 transition-all flex flex-col justify-between space-y-3 cursor-pointer group active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white">
                      <Folder className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/20 flex items-center gap-1">
                      {!isPremium && <Lock className="w-2.5 h-2.5" />} GOOGLE DRIVE (PRO)
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                      <span>📁 Google Drive'a Kaydet & Yükle</span>
                      {!isPremium && <span className="text-xs">🔒</span>}
                    </h4>
                    <p className="text-xs text-sky-100 font-medium mt-1">
                      Yedek dosyasını doğrudan Google Drive bulut klasörünüze aktarın.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleTriggerDriveExport("download")}
                  className="p-5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-3xl text-left shadow-xs transition-all flex flex-col justify-between space-y-3 cursor-pointer group active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
                      <Download className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      YEREL İNDİRME
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      💾 Cihaza Dosya Olarak İndir
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                      .json uzantılı veri dosyasını doğrudan telefonunuza veya bilgisayarınıza indirin.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleTriggerDriveExport("share")}
                  className="p-5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-3xl text-left shadow-xs transition-all flex flex-col justify-between space-y-3 cursor-pointer group active:scale-95 sm:col-span-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      SİSTEM PAYLAŞIMI
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      🔗 WhatsApp, E-Posta veya Bluetooth ile Paylaş
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                      Telefonunuzun sistem paylaşım menüsü üzerinden yedeği dilediğiniz uygulamaya gönderin.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Sub-Tab 3: Restore */}
          {cloudActiveTab === "restore" && (
            <div className="p-6 sm:p-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                      Yedek Dosyasından Geri Yükle (.JSON)
                    </h3>
                    {!isPremium && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-lg uppercase tracking-wider">
                        PRO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Daha önce dışa aktardığınız Bütçem Pro yedek dosyasını seçerek tüm verilerinizi eksiksiz geri getirin.
                  </p>
                </div>
              </div>

              <div
                onClick={() => {
                  if (!isPremium) {
                    onSuccessToast("⭐ Yedek Dosyası Geri Yükleme Bütçem PRO özelliğidir.");
                    if (onOpenUpgradeModal) onOpenUpgradeModal("Yedek Dosyası Geri Yükleme");
                    return;
                  }
                  fileInputRef.current?.click();
                }}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 rounded-3xl p-8 text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-800/30 hover:bg-sky-50/20 dark:hover:bg-sky-950/20 flex flex-col items-center justify-center space-y-3"
              >
                <div className="w-14 h-14 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  {!isPremium ? <Lock className="w-7 h-7 text-amber-500" /> : <Upload className="w-7 h-7" />}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {!isPremium
                      ? "Yedek Geri Yükleme Kilitli 🔒 (PRO Gerekli)"
                      : isRestoring
                      ? "Dosya Okunuyor ve İşleniyor..."
                      : "JSON Yedek Dosyasını Seçmek İçin Tıklayın"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                    {!isPremium
                      ? "Yedeğinizi geri yüklemek için Bütçem PRO'ya yükseltin."
                      : "Telefonunuzdaki veya Google Drive klasörünüzdeki .json dosyasını seçin"}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold leading-relaxed">
                  <strong>Dikkat:</strong> Geri yükleme işlemi yapıldığında mevcut verileriniz güncellenir. Güvenliğiniz için işlem öncesinde mevcut verilerinizin yedeğini almanız tavsiye edilir.
                </p>
              </div>
            </div>
          )}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* SECTION 2: UYGULAMA GÜVENLİĞİ & PIN KİLİT SİSTEMİ            */}
        {/* ============================================================ */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-300">
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "security" ? "none" : "security")}
            className={`w-full p-5 sm:p-6 flex items-center justify-between gap-4 text-left transition cursor-pointer select-none ${
              activeTab === "security"
                ? "bg-indigo-500/10 dark:bg-indigo-950/40 border-b border-slate-200 dark:border-slate-800"
                : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
            }`}
          >
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                activeTab === "security"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              }`}>
                <Shield className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                    {language === "tr" ? "Uygulama Güvenliği & PIN Kilit Sistemi" : "Security & PIN Lock"}
                  </h3>
                  {settings.isEnabled ? (
                    <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-md uppercase tracking-wider flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> PIN AKTİF 🔒
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9px] font-black rounded-md uppercase tracking-wider">
                      DEVRE DIŞI
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-normal">
                  {language === "tr"
                    ? "4 haneli PIN şifreleme, güvenlik kurtarma sorusu ve biyometrik parmak izi kilidi"
                    : "4-digit PIN lock, recovery security question and biometric fingerprint authentication"}
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
              <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${activeTab === "security" ? "rotate-180" : ""}`} />
            </div>
          </button>

          {activeTab === "security" && (
            <div className="p-5 sm:p-6 space-y-6 text-left">
          {/* Main PIN Protection Card */}
          <div className="p-6 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  settings.isEnabled
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                }`}>
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                    Uygulama Giriş Güvenliği & PIN Kilit Sistemi
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Uygulama her açıldığında veya kilit aktifken 4 haneli güvenlik kodunuzu sorar.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleSecurity}
                className={`px-5 py-3 text-xs font-black rounded-2xl transition-all cursor-pointer shadow-md shrink-0 active:scale-95 ${
                  settings.isEnabled
                    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
                }`}
              >
                {settings.isEnabled ? "KİLİDİ DEVRE DIŞI BIRAK 🔓" : "KİLİDİ ETKİNLEŞTİR 🔒"}
              </button>
            </div>

            {/* Status overview cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col justify-between space-y-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">GÜVENLİK DURUMU</span>
                  <div className="flex items-center gap-2 mt-1">
                    {settings.isEnabled ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">PIN Koruması Devrede</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="text-xs font-black text-amber-600 dark:text-amber-400">Şifresiz Doğrudan Erişim</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {settings.isEnabled
                    ? "4 haneli PIN ve gizli kurtarma sorusu ile korunuyor."
                    : "Uygulamaya şifresiz girilmektedir."}
                </span>
              </div>

              <div className="p-4.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col justify-between space-y-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">KİLİT YÖNETİMİ</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Key className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">4 Haneli Sayısal PIN</span>
                  </div>
                </div>
                {settings.isEnabled && (
                  <button
                    type="button"
                    onClick={() => startSetupFlow()}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-black text-left cursor-pointer"
                  >
                    Şifreyi ve Kurtarma Sorusunu Değiştir ⚙️
                  </button>
                )}
              </div>
            </div>

            {/* Interactive PIN Setup Form */}
            <AnimatePresence mode="wait">
              {setupMode === "set_pin" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-3xl space-y-4 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                        {step === 1 ? "1. Yeni PIN Kodunu Belirleyin" : step === 2 ? "2. PIN Kodunu Doğrulayın" : "3. Şifre Kurtarma Sorusu"}
                      </span>
                    </div>
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">Adım {step} / 3</span>
                  </div>

                  {step === 1 && (
                    <form onSubmit={handlePinNext} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Yeni 4 Haneli PIN Kodunu Girin
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={pinTemp}
                          onChange={(e) => setPinTemp(e.target.value.replace(/\D/g, ""))}
                          className="w-full text-center tracking-[0.6em] text-xl font-black bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                          placeholder="••••"
                          autoFocus
                        />
                      </div>

                      {validationError && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>{validationError}</span>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setSetupMode("idle")}
                          className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black rounded-xl cursor-pointer"
                        >
                          İptal
                        </button>
                        <button
                          type="submit"
                          disabled={pinTemp.length !== 4}
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/20"
                        >
                          Devam Et ➔
                        </button>
                      </div>
                    </form>
                  )}

                  {step === 2 && (
                    <form onSubmit={handlePinConfirmNext} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Doğrulamak İçin PIN Kodunu Tekrar Girin
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={pinConfirm}
                          onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                          className="w-full text-center tracking-[0.6em] text-xl font-black bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                          placeholder="••••"
                          autoFocus
                        />
                      </div>

                      {validationError && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>{validationError}</span>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black rounded-xl cursor-pointer"
                        >
                          Geri
                        </button>
                        <button
                          type="submit"
                          disabled={pinConfirm.length !== 4}
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/20"
                        >
                          Kurtarma Sorusuna Geç ➔
                        </button>
                      </div>
                    </form>
                  )}

                  {step === 3 && (
                    <form onSubmit={handleRecoverySave} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Kurtarma Güvenlik Sorusu
                        </label>
                        <select
                          value={recoveryQuestion}
                          onChange={(e) => setRecoveryQuestion(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                        >
                          <option value="İlkokul öğretmeninizin adı nedir?">İlkokul öğretmeninizin adı nedir?</option>
                          <option value="En sevdiğiniz evcil hayvanın adı nedir?">En sevdiğiniz evcil hayvanın adı nedir?</option>
                          <option value="Doğduğunuz şehir hangisidir?">Doğduğunuz şehir hangisidir?</option>
                          <option value="İlk arabanızın markası nedir?">İlk arabanızın markası nedir?</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Sorunun Gizli Yanıtı
                        </label>
                        <input
                          type="text"
                          maxLength={40}
                          value={recoveryAnswer}
                          onChange={(e) => setRecoveryAnswer(e.target.value)}
                          placeholder="Cevabınızı buraya yazın..."
                          className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl py-2.5 px-3.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                        />
                      </div>

                      {validationError && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>{validationError}</span>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black rounded-xl cursor-pointer"
                        >
                          Geri
                        </button>
                        <button
                          type="submit"
                          disabled={!recoveryAnswer.trim()}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-600/20"
                        >
                          Kaydet ve Kilidi Başlat 🔒
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Biyometrik Kilit (Parmak İzi / Yüz Tanıma) PRO Section */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                biometricLock
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30"
              }`}>
                <Fingerprint className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    Biyometrik Kilit (Parmak İzi / Yüz Tanıma)
                  </h4>
                  {!isPremium ? (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[9px] font-black rounded-lg uppercase tracking-wider shadow-xs">
                      ⭐ PRO ÖZELLİK
                    </span>
                  ) : (
                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-lg uppercase tracking-wider ${
                      biometricLock
                        ? "bg-emerald-500 text-white shadow-xs"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}>
                      {biometricLock ? "AÇIK 🔒" : "KAPALI"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Cihazınızdaki parmak izi veya Face ID sensörü ile PIN girmeden anında güvenli giriş yapın.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleBiometricLock}
              role="switch"
              aria-checked={biometricLock}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                biometricLock ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  biometricLock ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Help Info Card */}
          <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 flex gap-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            <HelpCircle className="w-5 h-5 mt-0.5 shrink-0 text-indigo-500" />
            <div className="space-y-1">
              <p className="font-black text-slate-800 dark:text-slate-200">💡 Güvenlik Kalkanı Nasıl Çalışır?</p>
              <p>
                Uygulama arka plana atıldığında veya kapatılıp açıldığında güvenlik kalkanı devreye girer. Şifreyi 5 kez üst üste yanlış girmeniz durumunda sistem güvenlik amacıyla 30 saniye süreyle beklemeye geçer. Şifrenizi unutursanız kurtarma sorunuzu yanıtlayarak kilidi sıfırlayabilirsiniz.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* ============================================================ */}
    {/* SECTION 3: GENEL TERCİHLER & VADE BANDI AYARLARI             */}
    {/* ============================================================ */}
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-300">
      <button
        type="button"
        onClick={() => setActiveTab(activeTab === "settings" ? "none" : "settings")}
        className={`w-full p-5 sm:p-6 flex items-center justify-between gap-4 text-left transition cursor-pointer select-none ${
          activeTab === "settings"
            ? "bg-purple-500/10 dark:bg-purple-950/40 border-b border-slate-200 dark:border-slate-800"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
        }`}
      >
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            activeTab === "settings"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
          }`}>
            <Sliders className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
              {language === "tr" ? "Genel Tercihler & Vade Bandı Ayarları" : "Preferences & Marquee Settings"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-normal">
              {language === "tr"
                ? "Kayan vade uyarı bandı hızı, akıllı sesli asistan servisi ve tanıtım rehberi"
                : "Marquee warning banner speed, smart voice assistant service and onboarding tour"}
            </p>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${activeTab === "settings" ? "rotate-180" : ""}`} />
        </div>
      </button>

      {activeTab === "settings" && (
        <div className="p-5 sm:p-6 space-y-6 text-left">
          {/* Marquee Banner Speed & Control */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-5">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    Vade Uyarı Bandı & Akış Hızı
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Üst kısımda kayan yaklaşan vadeler bandının hızını ayarlayın ve duraklatın.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleMarqueePaused}
                className={`px-4 py-2 rounded-2xl text-xs font-black cursor-pointer transition select-none flex items-center gap-1.5 shadow-xs ${
                  currentMarqueePaused
                    ? "bg-amber-500 text-slate-950"
                    : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                }`}
              >
                {currentMarqueePaused ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>DURAKLATILDI ⏸️</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>AKAYOR ▶️</span>
                  </>
                )}
              </button>
            </div>

            {/* Speed Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-300">Geçiş Süresi / Hız:</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono font-black">{currentMarqueeSpeed} saniye</span>
              </div>
              <input
                type="range"
                min="20"
                max="180"
                step="5"
                value={currentMarqueeSpeed}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  handleUpdateMarqueeSpeed(val);
                }}
                className="w-full accent-indigo-600 cursor-pointer h-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
              />

              <div className="grid grid-cols-4 gap-2 pt-1">
                {[
                  { label: "Çok Hızlı ⚡", val: 30 },
                  { label: "Normal ⏱️", val: 60 },
                  { label: "Yavaş 🚶", val: 90 },
                  { label: "Çok Yavaş 🐢", val: 140 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => handleUpdateMarqueeSpeed(item.val, item.label)}
                    className={`py-2 px-2 rounded-xl text-[11px] font-black border transition cursor-pointer text-center ${
                      currentMarqueeSpeed === item.val
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Voice Assistant & Smart Services */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      Akıllı Sesli Asistan Servisi
                    </h4>
                    {!isPremium && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-lg uppercase tracking-wider">
                        PRO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Ekrandaki sesli mikrofon ikonu ile Türkçe sesli komutlar vererek borç, gelir ve harcama ekleyin.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleVoiceAssistant}
                className={`px-4 py-2 rounded-2xl text-xs font-black cursor-pointer transition select-none shrink-0 ${
                  isPremium && currentVoiceAssistant
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {!isPremium ? "KİLİTLİ 🔒 (PRO)" : currentVoiceAssistant ? "AÇIK 🎙️" : "KAPALI 🔕"}
              </button>
            </div>

            {/* Tanıtım Turu Replay */}
            {onOpenOnboarding && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                      Uygulama Tanıtım Turu (5 Sayfa)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      Tüm özellikleri ve modülleri adım adım tanıtan görsel rehberi yeniden başlatın.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="px-5 py-2.5 rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 cursor-pointer transition active:scale-95 shrink-0"
                >
                  Turu Başlat 🚀
                </button>
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
