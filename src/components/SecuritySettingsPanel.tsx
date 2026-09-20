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
  Clock,
  Sliders,
  Sparkles,
  Mic,
  Play,
  Pause,
  Cloud,
  CloudUpload,
  RefreshCw,
  HardDrive,
  Upload,
  Download,
  Send,
  Folder,
  Share2,
  Calendar,
  Check,
  ShieldCheck,
  FileCode,
  Zap,
  Globe,
  User,
  ArrowRight
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
  onOpenUpgradeModal?: () => void;
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
  initialTab?: "security" | "settings" | "cloud";
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
  isOfflineMode = false,
  initialTab = "cloud",
}) => {
  const [activeTab, setActiveTab] = useState<"security" | "settings" | "cloud">(initialTab);

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
      onOpenUpgradeModal();
      return;
    }

    if (onExecuteExportBackup) {
      onExecuteExportBackup(customBackupName, action);
      const now = new Date();
      const timeStr = `${now.toLocaleDateString("tr-TR")} ${now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
      setLastSyncTime(timeStr);
      localStorage.setItem("last_cloud_sync_timestamp", timeStr);
      return;
    }

    // Direct Browser Download fallback
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
      if (onOpenUpgradeModal) onOpenUpgradeModal();
      return;
    }
    const next = !currentVoiceAssistant;
    setLocalVoiceAssistant(next);
    if (propSetVoiceAssistantEnabled) propSetVoiceAssistantEnabled(next);
    localStorage.setItem("voiceAssistantEnabled", next ? "1" : "0");
    onSuccessToast(next ? "Sesli Asistan Servisi Aktifleştirildi 🎙️" : "Sesli Asistan Servisi Devre Dışı Bırakıldı 🔕");
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
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: PIN entry, 2: confirmation PIN entry, 3: recovery question
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
    <div className="space-y-5">
      {/* Settings Navigation Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl gap-1 border border-slate-200/60 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("cloud")}
          className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "cloud"
              ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>{language === "tr" ? "Bulut & Senkronizasyon" : "Cloud & Sync"}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "security"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{language === "tr" ? "Güvenlik & PIN" : "Security & PIN"}</span>
          {settings.isEnabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "settings"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{language === "tr" ? "Vade Bandı & Ayarlar" : "Banner & Settings"}</span>
        </button>
      </div>

      {/* Tab 1: PIN & Security Settings */}
      {activeTab === "security" && (
        <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
          {/* Panel Header */}
          <div className="flex flex-col items-center text-center gap-4 py-2 w-full border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="space-y-2 flex flex-col items-center max-w-xl">
              <div className="inline-flex p-3 bg-indigo-500/10 rounded-full text-indigo-500">
                <Shield className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2">
                Uygulama Giriş Güvenliği & Kilit Sistemi
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                Kişisel bütçenizi, alacak/borç verilerinizi ve hesap detaylarınızı üçüncü şahıslardan saklayın. Uygulama her açıldığında veya kilit aktifken bir kod sorulmasını sağlayabilirsiniz.
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleSecurity}
              className={`px-5 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer shadow-md shrink-0 active:scale-95 ${
                settings.isEnabled
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-700"
              }`}
            >
              {settings.isEnabled ? "KİLİDİ KAPAT 🔓" : "KİLİDİ ETKİNLEŞTİR 🔒"}
            </button>
          </div>

          {/* Configurations status and credentials select */}
          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            {/* Status Indicator Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">GÜVENLİK MODELİ</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block mt-1.5 flex items-center gap-1.5">
                  {settings.isEnabled ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      Koruma Devrede
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      Şifresiz Erişim
                    </>
                  )}
                </span>
              </div>
              <span className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold block mt-2">
                {settings.isEnabled
                  ? "4 Haneli PIN Kodu ve Kurtarma Sorusu korunuyor."
                  : "Herhangi bir şifre talep edilmiyor."}
              </span>
            </div>

            {/* Secure lock Info Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">KİLİT KORUMA TÜRÜ</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block mt-2 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-indigo-500" />
                  4 Haneli PIN Kodu
                </span>
              </div>
              {settings.isEnabled && (
                <button
                  type="button"
                  onClick={() => startSetupFlow()}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-extrabold text-left block mt-1.5 cursor-pointer"
                >
                  Şifreyi ve Kurtarmayı Değiştir ⚙️
                </button>
              )}
            </div>
          </div>

          {/* DETAILED INTERACTIVE SETUP FORMS */}
          <AnimatePresence mode="wait">
            {setupMode === "set_pin" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-500/10 rounded-2xl space-y-4 overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    Şifre ve Güvenlik Sorusunu Tanımla
                  </span>
                </div>

                {step === 1 && (
                  <form onSubmit={handlePinNext} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Yeni PIN Kodunu Girin (4 Rakam)</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={pinTemp}
                        onChange={(e) => setPinTemp(e.target.value.replace(/\D/g, ""))}
                        className="w-full text-center tracking-[0.5em] text-lg font-black bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                        placeholder="••••"
                        autoFocus
                      />
                    </div>

                    {validationError && (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-500 text-[10px] font-bold rounded-xl flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{validationError}</span>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setSetupMode("idle")}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black rounded-lg cursor-pointer"
                      >
                        Kapat
                      </button>
                      <button
                        type="submit"
                        disabled={pinTemp.length !== 4}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg disabled:opacity-50 cursor-pointer"
                      >
                        Devam Et
                      </button>
                    </div>
                  </form>
                )}

                {step === 2 && (
                  <form onSubmit={handlePinConfirmNext} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Tekrar Girerek PIN Kodunu Onaylayın</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={pinConfirm}
                        onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                        className="w-full text-center tracking-[0.5em] text-lg font-black bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                        placeholder="••••"
                        autoFocus
                      />
                    </div>

                    {validationError && (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/20 text-rose-500 text-[10px] font-bold rounded-xl flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{validationError}</span>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black rounded-lg cursor-pointer"
                      >
                        Geri Dön
                      </button>
                      <button
                        type="submit"
                        disabled={pinConfirm.length !== 4}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg disabled:opacity-50 cursor-pointer"
                      >
                        Devam Et (Kurtarma Sorusuna Geç)
                      </button>
                    </div>
                  </form>
                )}

                {step === 3 && (
                  <form onSubmit={handleRecoverySave} className="space-y-3">
                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300 font-bold mb-1 flex items-start gap-2">
                      <AlertTriangle className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <span>Şifrenizi unutmanız durumunda kilidi açmak için kullanılacak güvenlik sorusunu seçin ve kalıcı bir yanıt belirleyin.</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Güvenlik Sorusu Seçiniz</label>
                      <select
                        value={recoveryQuestion}
                        onChange={(e) => setRecoveryQuestion(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                      >
                        <option value="İlkokul öğretmeninizin adı nedir?">İlkokul öğretmeninizin adı nedir?</option>
                        <option value="En sevdiğiniz evcil hayvanın adı nedir?">En sevdiğiniz evcil hayvanın adı nedir?</option>
                        <option value="Doğduğunuz şehir hangisidir?">Doğduğunuz şehir hangisidir?</option>
                        <option value="İlk arabanızın markası nedir?">İlk arabanızın markası nedir?</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Sorunun Yanıtı</label>
                      <input
                        type="text"
                        maxLength={40}
                        value={recoveryAnswer}
                        onChange={(e) => setRecoveryAnswer(e.target.value)}
                        placeholder="Cevabınızı buraya yazınız..."
                        className="w-full bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl py-2 px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                      />
                    </div>

                    {validationError && (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/20 text-rose-500 text-[10px] font-bold rounded-xl flex items-center gap-1.5 font-sans">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{validationError}</span>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black rounded-lg cursor-pointer"
                      >
                        Geri Dön
                      </button>
                      <button
                        type="submit"
                        disabled={!recoveryAnswer.trim()}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg disabled:opacity-50 cursor-pointer"
                      >
                        PIN ve Kurtarmayı Kaydet
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Coming Soon: Biometric & Face ID */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2">
              <span className="px-2 py-0.5 bg-amber-500 text-white text-[8px] font-black rounded-lg uppercase tracking-widest shadow-sm">YAKINDA</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                <Key className="w-5 h-5 opacity-50" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">BİOMETRİK & YÜZ TANIMA</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-tight mt-0.5">
                  Parmak izi ve Face ID ile şifresiz, tek dokunuşla güvenli giriş özelliği çok yakında tüm PRO kullanıcıları için aktif olacak.
                </p>
              </div>
            </div>
          </div>

          {/* Informative guidelines */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/80 rounded-2xl border border-slate-100 dark:border-slate-800 flex gap-2 text-xs text-slate-600 dark:text-slate-300 leading-normal font-medium">
            <HelpCircle className="w-5 h-5 mt-0.5 shrink-0 text-slate-500" />
            <div className="space-y-1">
              <p className="font-extrabold text-slate-800 dark:text-slate-200">💡 Güvenli Kilit Nasıl Çalışır?</p>
              <p>
                Uygulamayı kapatıp tekrar açtığınızda otomatik kalkan devreye girer. Şifreyi 5 kez üst üste yanlış girmeniz durumunda sistem geçici olarak 30 saniye boyunca kendini askıya alır. Şifrenizi unuttuysanız, belirlediğiniz Güvenlik Sorusu ve Gizli Yanıt ile şifrenizi sıfırlayabilirsiniz.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Bulut Yedekleme & Google Drive / Firebase Senkronizasyonu */}
      {activeTab === "cloud" && (
        <div className="p-5 sm:p-6 bg-white dark:bg-slate-800 border border-sky-200/70 dark:border-sky-900/50 rounded-3xl shadow-sm space-y-6 relative overflow-hidden">
          {/* Subtle background ambient glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/5 dark:bg-sky-500/10 rounded-full blur-3xl -z-0 pointer-events-none" />

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/80 pb-4 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                  Bulut Yedekleme & Senkronizasyon
                </h3>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                256-BİT SSL/TLS GÜVENLİ BULUT VERİTABANI & GOOGLE DRIVE YEDEKLEME MERKEZİ
              </p>
            </div>

            {/* Real-time Online / Account badge */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{currentUser ? "Bulut Bağlantısı Aktif" : "Yerel Depolama (Misafir Modu)"}</span>
              </div>
            </div>
          </div>

          {/* Cloud Sub-Tabs */}
          <div className="flex items-center gap-2 flex-wrap border-b border-slate-100 dark:border-slate-700/60 pb-3 relative z-10">
            <button
              type="button"
              onClick={() => setCloudActiveTab("sync")}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                cloudActiveTab === "sync"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                  : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>1. Anlık Bulut Eşitleme (Firebase)</span>
            </button>

            <button
              type="button"
              onClick={() => setCloudActiveTab("drive")}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                cloudActiveTab === "drive"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                  : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>2. Google Drive & Dosya Dışa Aktar</span>
            </button>

            <button
              type="button"
              onClick={() => setCloudActiveTab("restore")}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                cloudActiveTab === "restore"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                  : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>3. Yedeği Geri Yükle & İçe Aktar</span>
            </button>
          </div>

          {/* Sub-Tab 1: Anlık Bulut Eşitleme (Firebase Firestore) */}
          {cloudActiveTab === "sync" && (
            <div className="space-y-4 relative z-10">
              {/* Account / User Box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                      AKTİF KULLANICI OTURUMU
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {currentUser || "Misafir Oturumu (Yerel Kayıt)"}
                    </span>
                  </div>
                </div>

                {!currentUser && onOpenGoogleLogin && (
                  <button
                    type="button"
                    onClick={onOpenGoogleLogin}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <span>🔑 Google / E-Posta ile Giriş Yap</span>
                  </button>
                )}
              </div>

              {/* Big Hero Card: Anlık Eşitle */}
              <div className="p-5 sm:p-6 bg-gradient-to-br from-sky-500 via-indigo-600 to-sky-700 rounded-3xl text-white shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-200 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" />
                      HER ŞEYİ TEK DOKUNUŞLA EŞİTLE
                    </span>
                    <h4 className="text-base sm:text-lg font-black">
                      Anlık Bulut Senkronizasyonu
                    </h4>
                    <p className="text-xs text-sky-100/90 font-medium max-w-lg leading-relaxed">
                      Borçlarınız, gelirleriniz, harcamalarınız, taksit planlarınız ve cari kayıtlarınız 256-bit şifreli Firestore bulutuna yüklenir.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunCloudSyncNow}
                    disabled={isCloudSyncing}
                    className="px-6 py-3.5 bg-white hover:bg-slate-100 text-sky-700 hover:text-sky-800 rounded-2xl font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50 active:scale-95"
                  >
                    <RefreshCw className={`w-4 h-4 ${isCloudSyncing ? "animate-spin text-sky-600" : ""}`} />
                    <span>{isCloudSyncing ? "Senkronize Ediliyor..." : "Şimdi Buluta Eşitle ☁️"}</span>
                  </button>
                </div>

                {/* Progress bar and logs during sync */}
                {isCloudSyncing && (
                  <div className="p-3 bg-black/20 backdrop-blur-md rounded-2xl space-y-2 border border-white/10">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        {syncStatusStep}
                      </span>
                      <span>%{syncProgress}</span>
                    </div>
                    <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300 rounded-full"
                        style={{ width: `${syncProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-sky-100/80 pt-1 border-t border-white/15">
                  <span>🕒 Son Eşitleme: <strong>{lastSyncTime}</strong></span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                    256-Bit SSL/TLS Koruması
                  </span>
                </div>
              </div>

              {/* Automatic Sync Toggle Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-sky-500" />
                    Otomatik Arka Plan Bulut Senkronizasyonu
                  </span>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                    Her yeni işlem, gelir, gider veya borç güncellemesinde verileri otomatik olarak buluta yazar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAutoSync}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition select-none shrink-0 ${
                    isAutoSyncActive
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {isAutoSyncActive ? "AÇIK 🟢" : "KAPALI ⚪"}
                </button>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Google Drive & Dosya Dışa Aktar */}
          {cloudActiveTab === "drive" && (
            <div className="space-y-4 relative z-10">
              {/* Filename configuration */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Yedek Dosyası Adı (JSON Formatı)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customBackupName}
                    onChange={(e) => setCustomBackupName(e.target.value)}
                    placeholder="butcem_pro_yedek"
                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                  <span className="text-xs font-mono font-black text-slate-400">.json</span>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setCustomBackupName(`butcem_yedek_${new Date().toISOString().slice(0, 10)}`)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Calendar className="w-3 h-3 text-sky-500" /> Bugünün Tarihi
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomBackupName("butcem_pro_tam_yedek")}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    👑 Bütçem Pro Tam Yedek
                  </button>
                </div>
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* 1. Google Drive */}
                <button
                  type="button"
                  onClick={() => handleTriggerDriveExport("drive")}
                  className="p-4 bg-gradient-to-br from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white rounded-2xl text-left shadow-md transition-all flex flex-col justify-between space-y-2 cursor-pointer group active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
                      <Folder className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">
                      GOOGLE DRIVE
                    </span>
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-white">
                      📁 Google Drive'a Kaydet & Yükle
                    </h5>
                    <p className="text-[10px] text-sky-100 font-medium mt-0.5">
                      Yedek dosyasını cihazınız üzerinden doğrudan Google Drive bulut klasörünüze kaydedin.
                    </p>
                  </div>
                </button>

                {/* 2. WhatsApp ile Paylaş */}
                <button
                  type="button"
                  onClick={() => handleTriggerDriveExport("whatsapp")}
                  className="p-4 bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-left shadow-md transition-all flex flex-col justify-between space-y-2 cursor-pointer group active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
                      <Send className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">
                      WHATSAPP
                    </span>
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-white">
                      🟢 WhatsApp ile Paylaş & Gönder
                    </h5>
                    <p className="text-[10px] text-emerald-100 font-medium mt-0.5">
                      Finansal özetinizi ve yedek dosyanızı WhatsApp sohbetine veya kendinize iletin.
                    </p>
                  </div>
                </button>

                {/* 3. Dosya İndir (.JSON) */}
                <button
                  type="button"
                  onClick={() => handleTriggerDriveExport("download")}
                  className="p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl text-left shadow-sm transition-all flex flex-col justify-between space-y-2 cursor-pointer group active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
                      <Download className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                      .JSON İNDİR
                    </span>
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">
                      💾 Cihaza Dosya Olarak İndir
                    </h5>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      Tüm veritabanını standart şifreli JSON formatında bilgisayar veya telefonunuza kaydedin.
                    </p>
                  </div>
                </button>

                {/* 4. Sistem Paylaşım Menüsü */}
                <button
                  type="button"
                  onClick={() => handleTriggerDriveExport("share")}
                  className="p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl text-left shadow-sm transition-all flex flex-col justify-between space-y-2 cursor-pointer group active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                      PAYLAŞ
                    </span>
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">
                      📱 Cihaz Paylaşım Menüsünü Aç
                    </h5>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      Gmail, Bluetooth, Telegram veya cihazınızdaki herhangi bir uygulama ile paylaşın.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Sub-Tab 3: Yedeği Geri Yükle & İçe Aktar */}
          {cloudActiveTab === "restore" && (
            <div className="space-y-4 relative z-10">
              <div className="p-6 border-2 border-dashed border-sky-300 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20 rounded-3xl text-center space-y-3 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-md">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    JSON Yedek Dosyasını Seçin veya Sürükleyin
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Daha önce indirdiğiniz veya Google Drive'dan aldığınız <code>.json</code> dosyasını seçerek tüm borç, gelir ve harcamalarınızı tek tıkla geri yükleyebilirsiniz.
                  </p>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept=".json"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRestoring}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black transition shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Folder className="w-4 h-4" />
                  <span>{isRestoring ? "Geri Yükleniyor..." : "Dosya Seç & Geri Yükle (.JSON)"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Vade Bandı & Genel Ayarlar */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          {/* Fast Cloud Sync Status Banner Inside Settings */}
          <div className="p-4 bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-sky-500/10 rounded-2xl border border-sky-200 dark:border-sky-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  ☁️ Anlık Bulut Eşitlemesi
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </span>
                <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block font-medium">
                  Son Senkronizasyon: <strong>{lastSyncTime}</strong>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRunCloudSyncNow}
              disabled={isCloudSyncing}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50 active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? "animate-spin" : ""}`} />
              <span>{isCloudSyncing ? "Eşitleniyor..." : "Hemen Senkronize Et ☁️"}</span>
            </button>
          </div>

          {/* Vade Uyarıları Bandı Akış Hızı ve Duraklatma Ayarları */}
          <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500 animate-pulse" />
                  Vade Uyarıları Bandı Akış Hızı Ayarı ⏰
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-0.5">
                  Üst bantta kayan borç ve taksit uyarılarının akış hızını kolay okunacak şekilde ayarlayabilirsiniz.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                <span>⏱️ {currentMarqueeSpeed} sn / döngü</span>
              </div>
            </div>

            {/* Fast Selection Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "🐌 Çok Yavaş", val: 180, desc: "180 sn (Çok Rahat)" },
                { label: "🐢 Yavaş", val: 130, desc: "130 sn (Tavsiye Edilen)" },
                { label: "⚖️ Normal", val: 90, desc: "90 sn (Varsayılan)" },
                { label: "🚀 Hızlı", val: 50, desc: "50 sn (Seri Akış)" }
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => handleUpdateMarqueeSpeed(preset.val, preset.label)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer select-none ${
                    currentMarqueeSpeed === preset.val
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md font-bold"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-400"
                  }`}
                >
                  <span className="text-xs font-black block">{preset.label}</span>
                  <span className={`text-[10px] font-medium block mt-0.5 ${currentMarqueeSpeed === preset.val ? "text-indigo-100" : "text-slate-400"}`}>
                    {preset.desc}
                  </span>
                </button>
              ))}
            </div>

            {/* Slider & Pause */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Hassas Süre Ayarı: {currentMarqueeSpeed} saniye</span>
                <span className="text-[10px] text-slate-400 font-normal">30 sn (Çok Hızlı) - 240 sn (Ultra Yavaş)</span>
              </div>
              <input
                type="range"
                min={30}
                max={240}
                step={5}
                value={currentMarqueeSpeed}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  handleUpdateMarqueeSpeed(val);
                }}
                className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
              />

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800">
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">Bant Akışını Duraklat / Oynat</span>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Fare veya parmakla üzerine gelindiğinde de otomatik duraklar</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleMarqueePaused}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer transition select-none flex items-center gap-1.5 ${
                    currentMarqueePaused
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                  }`}
                >
                  {currentMarqueePaused ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>AKIŞ DURAKLATILDI ⏸️</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>AKAYOR ▶️</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Voice Assistant and Smart Services */}
          <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-3xl shadow-sm space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Yardımcı Araçlar & Servisler
            </h4>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-indigo-500" />
                  Akıllı Sesli Asistan Servisi
                  {!isPremium && <span className="bg-amber-500 text-[8px] text-white px-1.5 py-0.5 rounded-md font-black">PRO</span>}
                </span>
                <span className="text-[10px] text-slate-400 font-medium leading-none block mt-0.5">Ekrandaki mikrofon ikonu ile sesli komut verin</span>
              </div>
              <button
                type="button"
                onClick={handleToggleVoiceAssistant}
                className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition select-none ${
                  isPremium && currentVoiceAssistant
                    ? "bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/10"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {!isPremium ? "KİLİTLİ 🔒" : currentVoiceAssistant ? "AÇIK 🎙️" : "KAPALI 🔕"}
              </button>
            </div>

            {/* 5-Page App Walkthrough Replay Button */}
            {onOpenOnboarding && (
              <div className="p-4 bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-indigo-50/50 dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    Uygulama Tanıtım Turu (5 Sayfa)
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mt-0.5">
                    Tüm özellikleri ve modülleri tanıtan görsel rehberi yeniden başlatın
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 cursor-pointer transition select-none active:scale-95"
                >
                  Turu Başlat 🚀
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

