// Bütçem Pro Service Worker with SyncManager API, Background Sync, Periodic Sync, and Native Push Notifications
const ALARMS_CACHE_NAME = "butcempro-alarms-cache";
const ALARMS_URL = "/scheduled-alarms.json";
const DEBTS_CACHE_NAME = "butcempro-debts-cache";
const DEBTS_URL = "/cached-debts.json";
const INSTALLMENTS_CACHE_NAME = "butcempro-installments-cache";
const INSTALLMENTS_URL = "/cached-installments.json";

let activeAlarms = [];
let activeDebts = [];
let activeInstallments = [];
let alarmTimers = [];
let pushSettings = { enabled: true, frequency: "2" };

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      loadAndScheduleCachedAlarms(),
      loadCachedDebts(),
      loadCachedInstallments()
    ])
  );
});

// Helper to parse dates formatted in ISO, timestamp or Turkish locale (dd.mm.yyyy hh:mm:ss or yyyy-mm-dd)
function parseDateRobust(dateStr) {
  if (!dateStr) return NaN;
  if (typeof dateStr === "number") return dateStr;
  let parsed = new Date(dateStr).getTime();
  if (!isNaN(parsed)) return parsed;

  try {
    const parts = String(dateStr).trim().split(" ");
    const datePart = parts[0];
    const timePart = parts[1] || "00:00:00";

    let y, m, d;
    if (datePart.includes(".")) {
      const dp = datePart.split(".");
      d = parseInt(dp[0], 10);
      m = parseInt(dp[1], 10) - 1;
      y = parseInt(dp[2], 10);
    } else if (datePart.includes("-")) {
      const dp = datePart.split("-");
      y = parseInt(dp[0], 10);
      m = parseInt(dp[1], 10) - 1;
      d = parseInt(dp[2], 10);
    }

    const tp = timePart.split(":");
    const hr = parseInt(tp[0], 10) || 0;
    const min = parseInt(tp[1], 10) || 0;
    const sec = parseInt(tp[2], 10) || 0;

    return new Date(y, m, d, hr, min, sec).getTime();
  } catch (e) {
    return NaN;
  }
}

// Helper to determine category emoji for debt notification
function getDebtCategoryEmoji(name = "", category = "") {
  const combined = `${name || ""} ${category || ""}`.toLowerCase();
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
}

// Reschedule the scheduled alarms inside the Service Worker thread
function rescheduleAlarms() {
  alarmTimers.forEach(t => clearTimeout(t));
  alarmTimers = [];

  const now = Date.now();
  const appIcon = self.location.origin + "/logo.png";

  activeAlarms.forEach((alarm) => {
    if (!alarm || !alarm.date) return;

    const alarmTime = parseDateRobust(alarm.date);
    if (isNaN(alarmTime)) return;

    const delay = alarmTime - now;

    // 1. Check if Notification Triggers are natively supported (PWA offline scheduled notifications when closed)
    if (delay > 0 && 'showTrigger' in self.Notification.prototype && typeof self.TimestampTrigger !== 'undefined') {
      try {
        self.registration.showNotification("🚨 Bütçem Pro: Ödeme Hatırlatıcı!", {
          body: alarm.title || "Planlanmış ödeme hatırlatıcı zamanı!",
          icon: appIcon,
          vibrate: [200, 100, 200, 100, 300],
          tag: `alarm-${alarm.id || Date.now()}`,
          renotify: true,
          requireInteraction: true,
          silent: false,
          timestamp: alarmTime,
          actions: [{ action: "open_app", title: "Uygulamayı Aç" }],
          data: { url: "/?tab=notifications" },
          showTrigger: new self.TimestampTrigger(alarmTime)
        });
        return;
      } catch (triggerErr) {
        console.warn("TimestampTrigger failed, using fallback timer:", triggerErr);
      }
    }

    // 2. Active background setTimeout fallback
    if (delay > 0) {
      const timerId = setTimeout(() => {
        self.registration.showNotification("🚨 Bütçem Pro: Ödeme Hatırlatıcı!", {
          body: alarm.title || "Hatırlatıcı zamanı geldi! ⏰",
          icon: appIcon,
          vibrate: [300, 100, 300, 100, 400],
          tag: `alarm-${alarm.id || Date.now()}`,
          renotify: true,
          requireInteraction: true,
          silent: false,
          timestamp: Date.now(),
          actions: [{ action: "open_app", title: "Uygulamayı Aç" }],
          data: { url: "/?tab=notifications" }
        });

        if (self.navigator && self.navigator.setAppBadge) {
          self.navigator.setAppBadge(1).catch(() => {});
        }
      }, delay);
      alarmTimers.push(timerId);
    }
  });
}

// Persist active-sync list of alarms to Cache Storage
async function saveAlarmsToCache(alarms) {
  try {
    const cache = await caches.open(ALARMS_CACHE_NAME);
    const response = new Response(JSON.stringify(alarms), {
      headers: { "Content-Type": "application/json" }
    });
    await cache.put(ALARMS_URL, response);
  } catch (err) {
    console.error("Failed to save alarms to background cache:", err);
  }
}

// Retrieve alarms from cache and trigger timers inside workers
async function loadAndScheduleCachedAlarms() {
  try {
    const cache = await caches.open(ALARMS_CACHE_NAME);
    const response = await cache.match(ALARMS_URL);
    if (response) {
      const alarms = await response.json();
      activeAlarms = alarms || [];
      rescheduleAlarms();
    }
  } catch (err) {
    console.error("Failed to load cached alarms in background worker:", err);
  }
}

// Save debts to cache for background checking
async function saveDebtsToCache(debts) {
  try {
    const cache = await caches.open(DEBTS_CACHE_NAME);
    const response = new Response(JSON.stringify(debts), {
      headers: { "Content-Type": "application/json" }
    });
    await cache.put(DEBTS_URL, response);
  } catch (err) {
    console.error("Failed to save debts to background cache:", err);
  }
}

// Load debts from cache
async function loadCachedDebts() {
  try {
    const cache = await caches.open(DEBTS_CACHE_NAME);
    const response = await cache.match(DEBTS_URL);
    if (response) {
      const debts = await response.json();
      activeDebts = debts || [];
    }
  } catch (err) {
    console.error("Failed to load cached debts:", err);
  }
}

// Save installment debts to cache
async function saveInstallmentsToCache(installments) {
  try {
    const cache = await caches.open(INSTALLMENTS_CACHE_NAME);
    const response = new Response(JSON.stringify(installments), {
      headers: { "Content-Type": "application/json" }
    });
    await cache.put(INSTALLMENTS_URL, response);
  } catch (err) {
    console.error("Failed to save installments to background cache:", err);
  }
}

// Load installment debts from cache
async function loadCachedInstallments() {
  try {
    const cache = await caches.open(INSTALLMENTS_CACHE_NAME);
    const response = await cache.match(INSTALLMENTS_URL);
    if (response) {
      const installments = await response.json();
      activeInstallments = installments || [];
    }
  } catch (err) {
    console.error("Failed to load cached installments:", err);
  }
}

const SETTINGS_CACHE_NAME = "butcempro-settings-cache";
const SETTINGS_URL = "/push-settings.json";
const LAST_NOTIF_TIME_URL = "/last-general-notif-time.json";

function getNotificationPeriodMs(frequency) {
  if (!frequency) return 2 * 60 * 60 * 1000; // 2 saat = 7.200.000 ms
  const str = String(frequency).trim().toLowerCase();
  if (str === "hourly" || str === "2") return 2 * 60 * 60 * 1000; // 2 saat = 7.200.000 ms
  if (str === "4") return 3 * 60 * 60 * 1000; // 3 saat = 10.800.000 ms
  if (str === "3") return 4 * 60 * 60 * 1000; // 4 saat = 14.400.000 ms
  if (str === "1") return 24 * 60 * 60 * 1000; // 24 saat = 86.400.000 ms
  const num = parseFloat(str);
  if (!isNaN(num) && num > 0) {
    return num * 60 * 60 * 1000;
  }
  return 2 * 60 * 60 * 1000; // 7.200.000 ms
}

async function savePushSettingsToCache(settings) {
  try {
    const cache = await caches.open(SETTINGS_CACHE_NAME);
    await cache.put(
      SETTINGS_URL,
      new Response(JSON.stringify(settings), {
        headers: { "Content-Type": "application/json" }
      })
    );
  } catch (err) {
    console.error("Failed to save push settings to cache:", err);
  }
}

async function loadPushSettingsFromCache() {
  try {
    const cache = await caches.open(SETTINGS_CACHE_NAME);
    const response = await cache.match(SETTINGS_URL);
    if (response) {
      const data = await response.json();
      if (data) {
        pushSettings = { ...pushSettings, ...data };
      }
    }
  } catch (err) {
    console.error("Failed to load push settings from cache:", err);
  }
}

const USER_PROFILE_URL = "/_app_cache_user_profile";

async function saveUserProfileToCache(profile) {
  try {
    const cache = await caches.open(SETTINGS_CACHE_NAME);
    await cache.put(
      USER_PROFILE_URL,
      new Response(JSON.stringify(profile || {}), {
        headers: { "Content-Type": "application/json" }
      })
    );
  } catch (err) {
    console.error("Failed to save user profile to cache:", err);
  }
}

async function loadCachedUserProfile() {
  try {
    const cache = await caches.open(SETTINGS_CACHE_NAME);
    const response = await cache.match(USER_PROFILE_URL);
    if (response) {
      return await response.json();
    }
  } catch (err) {
    console.error("Failed to load user profile from cache:", err);
  }
  return null;
}

async function saveCachedLastGeneralNotificationTime(timestamp) {
  try {
    const cache = await caches.open(SETTINGS_CACHE_NAME);
    await cache.put(
      LAST_NOTIF_TIME_URL,
      new Response(JSON.stringify({ timestamp }), {
        headers: { "Content-Type": "application/json" }
      })
    );
  } catch (err) {
    console.error("Failed to save last general notif time to cache:", err);
  }
}

async function getCachedLastGeneralNotificationTime() {
  try {
    const cache = await caches.open(SETTINGS_CACHE_NAME);
    const response = await cache.match(LAST_NOTIF_TIME_URL);
    if (response) {
      const data = await response.json();
      return Number(data.timestamp || 0);
    }
  } catch (err) {
    console.error("Failed to get last general notif time from cache:", err);
  }
  return 0;
}

// --- SYNCMANAGER API IMPLEMENTATION ---
// Handles background sync and periodic sync events when application is in background or closed
async function handleBackgroundSync(tag) {
  console.log(`[Service Worker] Executing background sync listener for tag: "${tag}"`);

  // If push notifications are turned off by user, do not send any alerts
  if (pushSettings && pushSettings.enabled === false) {
    console.log("[Service Worker] Push notifications are disabled by user, skipping sync alerts.");
    return;
  }

  // 1. Reload latest cached alarms, debts, installments, and settings
  await Promise.all([
    loadAndScheduleCachedAlarms(),
    loadCachedDebts(),
    loadCachedInstallments(),
    loadPushSettingsFromCache()
  ]);

  const now = Date.now();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;
  const appIcon = self.location.origin + "/logo.png";

  // 2. Check for any active alarms due right now (Özel Alarmlar)
  // Sabit ve benzersiz id parametresi verilir; mükerrer basımı engeller
  let triggeredAlarmCount = 0;
  if (Array.isArray(activeAlarms)) {
    activeAlarms.forEach((alarm) => {
      if (!alarm || !alarm.date) return;
      const alarmTime = parseDateRobust(alarm.date);
      if (!isNaN(alarmTime) && alarmTime <= now && (now - alarmTime < 2 * 60 * 60 * 1000)) {
        const safeAlarmId = Math.abs(Number(alarm.debtId || alarm.id)) || 1;
        self.registration.showNotification("Bütçem Pro Hatırlatıcı ⏰", {
          body: alarm.title || "Vadesi gelen ödeme / alarm hatırlatması!",
          icon: appIcon,
          vibrate: [300, 100, 300, 100, 400],
          tag: `alarm-${safeAlarmId}`,
          renotify: false, // Ekrana aynı anda 2 defa düşmesini engeller
          requireInteraction: true,
          silent: false,
          actions: [{ action: "open_app", title: "Uygulamayı Aç" }],
          data: { url: "/?tab=notifications", alarmId: safeAlarmId }
        });
        triggeredAlarmCount++;
      }
    });
  }

  // --- 3. AKILLI ENGEL: Gecikmiş/Yaklaşan Borç Döngüsünü Seçilen Saate Sabitle (15 Dk Engelini Aş) ---
  // Kullanıcının seçtiği bildirim periyodu saatini (ör. 2 saat = 7.200.000 ms) milisaniye cinsinden oku
  const selectedPeriodMs = getNotificationPeriodMs(pushSettings.frequency || "2");
  const lastGeneralTime = await getCachedLastGeneralNotificationTime();

  // Arka plan servisi Android yüzünden 15 dakikada bir uyandığında kontrol et:
  // Şimdiki Zaman - sonGenelBildirimZamani.
  // Eğer aradan geçen süre kullanıcının seçtiği saat periyodundan az ise
  // bildirim fırlatma fonksiyonunu doğrudan İPTAL ET ve uykuya dön!
  if (lastGeneralTime > 0 && (now - lastGeneralTime) < selectedPeriodMs) {
    const remainingWaitMin = Math.ceil((selectedPeriodMs - (now - lastGeneralTime)) / 60000);
    console.log(`[SW Akıllı Engel] Arka plan servisi 15 dk döngüsünde uyandı fakat seçilen periyot dolmadı (${remainingWaitMin} dk kaldı). Bildirim fırlatma İPTAL EDİLDİ ve uykuya dönüldü.`);
    return;
  }

  // 4. Check standard debts
  const overdueMoreThanWeekList = [];
  const recentOverdueList = [];
  const dueTodayList = [];

  if (Array.isArray(activeDebts)) {
    activeDebts.forEach((debt) => {
      if (!debt || debt.isPaid) return;
      const remaining = (Number(debt.amount) || 0) - (Number(debt.paid) || 0);
      if (remaining <= 0) return;

      if (debt.dueDate) {
        const dueTime = parseDateRobust(debt.dueDate);
        if (!isNaN(dueTime)) {
          if (dueTime >= todayStart && dueTime < todayEnd) {
            dueTodayList.push({ name: debt.name || "Borç", category: debt.category || "", amount: remaining, sonBildirimZamani: debt.sonBildirimZamani });
          } else if (dueTime < todayStart) {
            const daysLate = Math.max(1, Math.floor((todayStart - dueTime) / (1000 * 60 * 60 * 24)));
            if (daysLate > 7) {
              overdueMoreThanWeekList.push({ name: debt.name || "Borç", category: debt.category || "", amount: remaining, daysLate, sonGecikmeBildirimZamani: debt.sonGecikmeBildirimZamani });
            } else {
              recentOverdueList.push({ name: debt.name || "Borç", category: debt.category || "", amount: remaining, daysLate, sonBildirimZamani: debt.sonBildirimZamani });
            }
          }
        }
      }
    });
  }

  // 5. Check installment debts (taksitli borçlar)
  if (Array.isArray(activeInstallments)) {
    activeInstallments.forEach((inst) => {
      if (!inst) return;
      const count = Number(inst.installmentCount) || 1;
      const paid = Number(inst.paidInstallmentCount) || 0;
      const total = Number(inst.totalAmount) || 0;
      const perInst = count > 0 ? total / count : 0;

      if (paid < count && inst.firstDueDate) {
        const bDate = new Date(inst.firstDueDate);
        if (!isNaN(bDate.getTime())) {
          bDate.setMonth(bDate.getMonth() + paid);
          const dueTime = new Date(bDate.getFullYear(), bDate.getMonth(), bDate.getDate()).getTime();
          const instTitle = `${inst.title || inst.name || "Taksit"} (${paid + 1}/${count}. Taksit)`;

          if (dueTime >= todayStart && dueTime < todayEnd) {
            dueTodayList.push({ name: instTitle, category: "taksit", amount: perInst, sonBildirimZamani: inst.sonBildirimZamani });
          } else if (dueTime < todayStart) {
            const daysLate = Math.max(1, Math.floor((todayStart - dueTime) / (1000 * 60 * 60 * 24)));
            if (daysLate > 7) {
              overdueMoreThanWeekList.push({ name: instTitle, category: "taksit", amount: perInst, daysLate, sonGecikmeBildirimZamani: inst.sonGecikmeBildirimZamani });
            } else {
              recentOverdueList.push({ name: instTitle, category: "taksit", amount: perInst, daysLate, sonBildirimZamani: inst.sonBildirimZamani });
            }
          }
        }
      }
    });
  }

  // 6. Yalnızca seçilen süre dolduğunda TEK BİR ÖZET BİLDİRİM fırlat
  const allDueItems = [...dueTodayList, ...recentOverdueList, ...overdueMoreThanWeekList];
  if (allDueItems.length > 0) {
    const topItems = allDueItems.slice(0, 4);
    const totalDue = allDueItems.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const toplamMiktar = Math.round(totalDue).toLocaleString("tr-TR");
    const dateFormatted = today.toLocaleDateString("tr-TR");
    
    // Kullanıcının kayıtlı ismi veya e-postasına göre hitap et
    const userProfile = await loadCachedUserProfile();
    const rawName = (userProfile && userProfile.name ? userProfile.name.trim() : "") || (userProfile && userProfile.email ? userProfile.email.trim() : "");
    const safeUser = rawName ? rawName.toUpperCase() : "SERKAN SAĞLAM";

    const borcListesiMetni = topItems
      .map((d) => {
        const emoji = getDebtCategoryEmoji(d.name, d.category);
        const statusText = d.daysLate ? `${d.daysLate} gün gecikti` : "Vadesi BUGÜN";
        return `${emoji} ${d.name}: ${Math.round(Number(d.amount)).toLocaleString("tr-TR")} TL (${statusText})`;
      })
      .concat(allDueItems.length > topItems.length ? [`...ve ${allDueItems.length - topItems.length} adet daha`] : [])
      .join("\n");

    // Başlık alanını net ve tek bir defa tanımlıyoruz
    const bildirimBasligi = "📊 Bütçem Pro: Güncel Vade Özeti";

    // İçerik alanını jilet gibi alt alta emojilerle grupluyoruz
    const bildirimIcerigi = `👤 SN. ${safeUser}\n` +
      `📅 Rapor Tarihi: ${dateFormatted}\n\n` +
      `📌 AKTİF BORÇ LİSTENİZ:\n` +
      `${borcListesiMetni}\n\n` +
      `💰 Toplam Geciken/Vadesi Gelen: ${toplamMiktar} TL\n\n` +
      `⚠️ Vade gecikme faizlerinden korunmak için ödemelerinizi zamanında yapmanızı rica ederiz. İyi günler dileriz. B001`;

    await self.registration.showNotification(bildirimBasligi, {
      body: bildirimIcerigi,
      icon: appIcon,
      vibrate: [300, 100, 300, 100, 400],
      tag: "butcempro-general-summary",
      renotify: false,
      requireInteraction: true,
      silent: false,
      actions: [{ action: "open_app", title: "Ödemeyi Gör" }],
      data: { url: "/?tab=debts" }
    });

    // Damgayı kaydet
    await saveCachedLastGeneralNotificationTime(now);

    // İstemcileri bilgilendir
    const allClients = await self.clients.matchAll();
    allClients.forEach(c => {
      c.postMessage({ type: "UPDATE_LAST_NOTIFICATION_TIME", timestamp: now });
    });
  }

  // 7. Update App icon badge count
  if (self.navigator && self.navigator.setAppBadge) {
    const totalBadge = (triggeredAlarmCount > 0 ? triggeredAlarmCount : 0) + (allDueItems.length > 0 ? allDueItems.length : 0);
    if (totalBadge > 0) {
      self.navigator.setAppBadge(totalBadge).catch(() => {});
    }
  }
}

// Listen to standard Background Sync events (SyncManager API)
self.addEventListener("sync", (event) => {
  console.log(`[Service Worker] Background 'sync' event triggered with tag: "${event.tag}"`);
  event.waitUntil(handleBackgroundSync(event.tag));
});

// Listen to Periodic Background Sync events (PeriodicSyncManager API)
self.addEventListener("periodicsync", (event) => {
  console.log(`[Service Worker] 'periodicsync' event triggered with tag: "${event.tag}"`);
  event.waitUntil(handleBackgroundSync(event.tag));
});

// Main message listener from React client for instant syncing of debtsRef & alarmsRef
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SYNC_ALL_DATA") {
    if (event.data.alarms) {
      activeAlarms = event.data.alarms;
      rescheduleAlarms();
      saveAlarmsToCache(activeAlarms);
    }
    if (event.data.debts) {
      activeDebts = event.data.debts;
      saveDebtsToCache(activeDebts);
    }
    if (event.data.installmentDebts) {
      activeInstallments = event.data.installmentDebts;
      saveInstallmentsToCache(activeInstallments);
    }
  }

  if (event.data.type === "SYNC_ALARMS") {
    activeAlarms = event.data.alarms || [];
    rescheduleAlarms();
    saveAlarmsToCache(activeAlarms);
  }

  if (event.data.type === "SYNC_DEBTS") {
    activeDebts = event.data.debts || [];
    saveDebtsToCache(activeDebts);
  }

  if (event.data.type === "SYNC_INSTALLMENTS") {
    activeInstallments = event.data.installmentDebts || [];
    saveInstallmentsToCache(activeInstallments);
  }

  if (event.data.type === "SYNC_PUSH_SETTINGS") {
    pushSettings = {
      enabled: event.data.enabled !== false,
      frequency: event.data.frequency || "2"
    };
    savePushSettingsToCache(pushSettings);
    if (event.data.sonGenelBildirimZamani) {
      saveCachedLastGeneralNotificationTime(event.data.sonGenelBildirimZamani);
    }
    console.log("[Service Worker] Push settings updated & cached:", pushSettings);
  }

  if (event.data.type === "SYNC_USER_PROFILE") {
    const profile = {
      name: event.data.name || "",
      email: event.data.email || ""
    };
    saveUserProfileToCache(profile);
    console.log("[Service Worker] User profile cached for personalized notifications:", profile);
  }

  if (event.data.type === "SYNC_LAST_NOTIFICATION_TIME") {
    if (event.data.timestamp) {
      saveCachedLastGeneralNotificationTime(event.data.timestamp);
    }
  }

  if (event.data.type === "TRIGGER_MANUAL_SYNC" || event.data.type === "CHECK_NOW") {
    handleBackgroundSync("manual-sync");
  }
});

// Handle push notifications received from Web Push / FCM
self.addEventListener("push", (event) => {
  let data = {
    title: "Bütçem Pro: Ödeme Vakti Geldi! ⏰",
    body: "Planlanmış borç veya taksit hatırlatıcınızın zamanı geldi!",
    url: "/?tab=notifications"
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: "Bütçem Pro: Ödeme Vakti Geldi! ⏰",
        body: event.data.text() || "Ödeme vaktiniz geldi!",
        url: "/?tab=notifications"
      };
    }
  }

  const appIcon = self.location.origin + "/logo.png";
  const targetUrl = data.url || "/?tab=notifications";

  // Build high-urgency lockscreen notification options
  const notifOptions = {
    body: data.body || "Planlanmış alarm / ödeme hatırlatması! ⏰",
    icon: data.icon || appIcon,
    vibrate: data.vibrate || [500, 150, 500, 150, 400, 100, 200, 100, 500],
    tag: data.tag || `alarm-${data.alarmId || Date.now()}`,
    renotify: true,
    requireInteraction: true,
    silent: false,
    timestamp: Date.now(),
    actions: [
      { action: "open_app", title: "Uygulamayı Aç" },
      { action: "dismiss", title: "Kapat" }
    ],
    data: {
      url: targetUrl,
      alarmId: data.alarmId,
      type: data.type || "alarm"
    }
  };

  // STEP 1: Immediately show notification to the device lock screen & notification drawer
  const notificationPromise = self.registration.showNotification(
    data.title || "Bütçem Pro: Ödeme Vakti Geldi! ⏰",
    notifOptions
  ).then(() => {
    console.log("[Service Worker] Lockscreen alarm notification displayed successfully:", data.title);
  }).catch((err) => {
    console.error("[Service Worker] Failed to display notification:", err);
  });

  // STEP 2: Background state updates (App badge, removing triggered alarm from cache, background debt sync)
  const backgroundPromise = (async () => {
    // 2.1 Update device app icon badge
    if (self.navigator && self.navigator.setAppBadge) {
      try {
        await self.navigator.setAppBadge(1);
      } catch (e) {}
    }

    // 2.2 If this was a specific alarm, remove it from active alarms cache to prevent duplicates
    if (data.alarmId) {
      try {
        activeAlarms = activeAlarms.filter(a => String(a.id) !== String(data.alarmId));
        await saveAlarmsToCache(activeAlarms);
      } catch (err) {
        console.warn("[Service Worker] Error removing fired alarm from cache:", err);
      }
    }

    // 2.3 If server triggered a background sync tag, run background sync safely
    if (data.action === "trigger-sync" || data.syncTag) {
      try {
        await handleBackgroundSync(data.syncTag || "push-sync");
      } catch (bgErr) {
        console.warn("[Service Worker] Background sync error during push:", bgErr);
      }
    }
  })();

  event.waitUntil(Promise.all([notificationPromise, backgroundPromise]));
});

// Handle notification click routing
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const targetUrl = event.notification.data?.url || "/?tab=notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window client is already open, focus and navigate it
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client && targetUrl) {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
