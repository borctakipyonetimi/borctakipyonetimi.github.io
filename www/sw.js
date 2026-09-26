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
      loadCachedInstallments(),
      loadPushSettingsFromCache()
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

/**
 * Ödenmemiş tüm borçlar için son ödeme tarihine 3 gün kaladan son güne kadar
 * her gün saat 09:30'a otomatik yerel alarm nesneleri üretir.
 */
function buildAutoDebtAlarms() {
  const autoAlarms = [];
  const now = Date.now();

  // 1. Normal Borçlar İçin Otomatik Alarm
  if (Array.isArray(activeDebts)) {
    activeDebts.forEach((debt) => {
      if (!debt) return;
      const isPaid = debt.isPaid === true || debt.durum === "odendi" || debt.status === "paid" || Number(debt.paid || 0) >= Number(debt.amount || 0);
      if (isPaid) return;
      const remaining = (Number(debt.amount) || 0) - (Number(debt.paid) || 0);
      if (remaining <= 0) return;

      if (debt.dueDate) {
        const dueTime = parseDateRobust(debt.dueDate);
        if (!isNaN(dueTime)) {
          for (let dayOffset = 3; dayOffset >= 0; dayOffset--) {
            const targetDate = new Date(dueTime - (dayOffset * 24 * 60 * 60 * 1000));
            targetDate.setHours(9, 30, 0, 0);
            const triggerTime = targetDate.getTime();

            if (triggerTime > now) {
              const debtName = debt.name || "Borç";
              const title = dayOffset === 0
                ? `🚨 Son Ödeme Günü Bugün! (${debtName})`
                : `⏰ Son ${dayOffset} Gün Kaldı! (${debtName})`;
              const body = `${debtName} için son ${dayOffset === 0 ? "gün bugün" : dayOffset + " gün kaldı"}. Tutar: ${Math.round(remaining).toLocaleString("tr-TR")} TL`;

              autoAlarms.push({
                id: `auto-debt-${debt.id || Math.random()}-${dayOffset}`,
                debtId: debt.id,
                title,
                body,
                date: new Date(triggerTime).toISOString(),
                timestamp: triggerTime,
                isAuto: true,
                silent: false
              });
            }
          }
        }
      }
    });
  }

  // 2. Taksitli Borçlar İçin Otomatik Alarm
  if (Array.isArray(activeInstallments)) {
    activeInstallments.forEach((inst) => {
      if (!inst) return;
      const count = Number(inst.installmentCount) || 1;
      const paid = Number(inst.paidInstallmentCount) || 0;
      const isPaid = inst.isPaid === true || inst.durum === "odendi" || inst.status === "paid" || paid >= count;
      if (isPaid) return;
      const total = Number(inst.totalAmount) || 0;
      const perInst = count > 0 ? total / count : 0;

      if (paid < count && inst.firstDueDate) {
        const bDate = new Date(inst.firstDueDate);
        if (!isNaN(bDate.getTime())) {
          bDate.setMonth(bDate.getMonth() + paid);
          const dueTime = new Date(bDate.getFullYear(), bDate.getMonth(), bDate.getDate()).getTime();
          const instTitle = `${inst.title || inst.name || "Taksit"} (${paid + 1}/${count}. Taksit)`;

          for (let dayOffset = 3; dayOffset >= 0; dayOffset--) {
            const targetDate = new Date(dueTime - (dayOffset * 24 * 60 * 60 * 1000));
            targetDate.setHours(9, 30, 0, 0);
            const triggerTime = targetDate.getTime();

            if (triggerTime > now) {
              const title = dayOffset === 0
                ? `🚨 Taksit Günü Bugün! (${instTitle})`
                : `⏰ Taksite Son ${dayOffset} Gün! (${instTitle})`;
              const body = `${instTitle} taksit ödemeniz için son gün yaklaştı. Tutar: ${Math.round(perInst).toLocaleString("tr-TR")} TL`;

              autoAlarms.push({
                id: `auto-inst-${inst.id || Math.random()}-${dayOffset}`,
                debtId: inst.id,
                title,
                body,
                date: new Date(triggerTime).toISOString(),
                timestamp: triggerTime,
                isAuto: true,
                silent: false
              });
            }
          }
        }
      }
    });
  }

  return autoAlarms;
}

// Reschedule both manual and automatic scheduled alarms inside the Service Worker thread
function rescheduleAlarms() {
  alarmTimers.forEach(t => clearTimeout(t));
  alarmTimers = [];

  const now = Date.now();
  const appIcon = self.location.origin + "/logo.png";

  const autoDebtAlarms = buildAutoDebtAlarms();
  const allAlarmsToSchedule = [...(activeAlarms || []), ...autoDebtAlarms];

  allAlarmsToSchedule.forEach((alarm) => {
    if (!alarm || !alarm.date) return;

    const alarmTime = alarm.timestamp || parseDateRobust(alarm.date);
    if (isNaN(alarmTime)) return;

    const delay = alarmTime - now;

    if (delay > 0 && 'showTrigger' in self.Notification.prototype && typeof self.TimestampTrigger !== 'undefined') {
      try {
        self.registration.showNotification(alarm.title || "🚨 Bütçem Pro: Ödeme Hatırlatıcı!", {
          body: alarm.body || alarm.title || "Planlanmış ödeme hatırlatıcı zamanı!",
          icon: appIcon,
          vibrate: alarm.silent ? [] : [200, 100, 200, 100, 300],
          tag: `alarm-${alarm.id || Date.now()}`,
          renotify: true,
          requireInteraction: !alarm.silent,
          silent: !!alarm.silent,
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

    if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
      const timerId = setTimeout(() => {
        self.registration.showNotification(alarm.title || "🚨 Bütçem Pro: Ödeme Hatırlatıcı!", {
          body: alarm.body || alarm.title || "Hatırlatıcı zamanı geldi! ⏰",
          icon: appIcon,
          vibrate: alarm.silent ? [] : [300, 100, 300, 100, 400],
          tag: `alarm-${alarm.id || Date.now()}`,
          renotify: true,
          requireInteraction: !alarm.silent,
          silent: !!alarm.silent,
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
const LAST_TWICE_DAILY_NOTIF_TIME_URL = "/last-twice-daily-notif-time.json";

function getNotificationPeriodMs(frequency) {
  if (!frequency) return 12 * 60 * 60 * 1000;
  const str = String(frequency).trim().toLowerCase();

  if (str === "1") {
    return 24 * 60 * 60 * 1000;
  } else if (str === "2") {
    return 12 * 60 * 60 * 1000;
  } else if (str === "3") {
    return 8 * 60 * 60 * 1000;
  } else if (str === "4") {
    return 6 * 60 * 60 * 1000;
  } else if (str === "hourly") {
    return 2 * 60 * 60 * 1000;
  } else {
    const num = parseFloat(str);
    if (!isNaN(num) && num > 0) {
      if (num === 1) return 24 * 60 * 60 * 1000;
      else if (num === 2) return 12 * 60 * 60 * 1000;
      else if (num === 3) return 8 * 60 * 60 * 1000;
      else if (num === 4) return 6 * 60 * 60 * 1000;
      else return (24 / num) * 60 * 60 * 1000;
    }
    return 12 * 60 * 60 * 1000;
  }
}

async function saveCachedLastTwiceDailyNotificationTime(timestamp) {
  try {
    const cache = await caches.open(SETTINGS_CACHE_NAME);
    await cache.put(
      LAST_TWICE_DAILY_NOTIF_TIME_URL,
      new Response(JSON.stringify({ timestamp }), {
        headers: { "Content-Type": "application/json" }
      })
    );
  } catch (err) {
    console.error("Failed to save last twice daily notif time to cache:", err);
  }
}

async function getCachedLastTwiceDailyNotificationTime() {
  try {
    const cache = await caches.open(SETTINGS_CACHE_NAME);
    const response = await cache.match(LAST_TWICE_DAILY_NOTIF_TIME_URL);
    if (response) {
      const data = await response.json();
      return Number(data.timestamp || 0);
    }
  } catch (err) {
    console.error("Failed to get last twice daily notif time from cache:", err);
  }
  return 0;
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
async function handleBackgroundSync(tag) {
  console.log(`[Service Worker] Executing background sync listener for tag: "${tag}"`);

  if (pushSettings && pushSettings.enabled === false) {
    console.log("[Service Worker] Push notifications are disabled by user, skipping sync alerts.");
    return;
  }

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

  let triggeredAlarmCount = 0;
  const allCurrentAlarms = [...(activeAlarms || []), ...buildAutoDebtAlarms()];

  if (Array.isArray(allCurrentAlarms)) {
    allCurrentAlarms.forEach((alarm) => {
      if (!alarm || !alarm.date) return;
      const alarmTime = alarm.timestamp || parseDateRobust(alarm.date);
      if (!isNaN(alarmTime) && alarmTime <= now && (now - alarmTime < 2 * 60 * 60 * 1000)) {
        const safeAlarmId = Math.abs(Number(alarm.debtId || alarm.id)) || 1;
        self.registration.showNotification(alarm.title || "Bütçem Pro Hatırlatıcı ⏰", {
          body: alarm.body || alarm.title || "Vadesi gelen ödeme / alarm hatırlatması!",
          icon: appIcon,
          vibrate: alarm.silent ? [] : [300, 100, 300, 100, 400],
          tag: `alarm-${safeAlarmId}`,
          renotify: false,
          requireInteraction: !alarm.silent,
          silent: !!alarm.silent,
          actions: [{ action: "open_app", title: "Uygulamayı Aç" }],
          data: { url: "/?tab=notifications", alarmId: safeAlarmId }
        });
        triggeredAlarmCount++;
      }
    });
  }

  const selectedPeriodMs = getNotificationPeriodMs(pushSettings.frequency || "2");
  const lastGeneralTime = await getCachedLastGeneralNotificationTime();

  if (lastGeneralTime > 0 && (now - lastGeneralTime) < selectedPeriodMs) {
    const remainingWaitMin = Math.ceil((selectedPeriodMs - (now - lastGeneralTime)) / 60000);
    console.log(`[SW Sıklık Kontrolü] Ayarlanan periyot (${selectedPeriodMs / 3600000} saat) henüz dolmadı (${remainingWaitMin} dk kaldı). Bildirim gönderme ertelendi.`);
    return;
  }

  const overdueList = [];
  const dueTodayList = [];
  const upcomingThreeDaysList = [];

  if (Array.isArray(activeDebts)) {
    activeDebts.forEach((debt) => {
      if (!debt) return;
      const isPaid = debt.isPaid === true || debt.durum === "odendi" || debt.status === "paid" || Number(debt.paid || 0) >= Number(debt.amount || 0);
      if (isPaid) return;
      const remaining = (Number(debt.amount) || 0) - (Number(debt.paid) || 0);
      if (remaining <= 0) return;

      if (debt.dueDate) {
        const dueTime = parseDateRobust(debt.dueDate);
        if (!isNaN(dueTime)) {
          if (dueTime >= todayStart && dueTime < todayEnd) {
            dueTodayList.push({ name: debt.name || "Borç", category: debt.category || "", amount: remaining });
          } else if (dueTime < todayStart) {
            const daysLate = Math.max(1, Math.floor((todayStart - dueTime) / (1000 * 60 * 60 * 24)));
            overdueList.push({ name: debt.name || "Borç", category: debt.category || "", amount: remaining, daysLate, isOverdue: true });
          } else if (dueTime >= todayEnd && dueTime <= (todayStart + 3 * 24 * 60 * 60 * 1000)) {
            const daysLeft = Math.ceil((dueTime - todayStart) / (1000 * 60 * 60 * 24));
            upcomingThreeDaysList.push({ name: debt.name || "Borç", category: debt.category || "", amount: remaining, daysLeft });
          }
        }
      }
    });
  }

  if (Array.isArray(activeInstallments)) {
    activeInstallments.forEach((inst) => {
      if (!inst) return;
      const count = Number(inst.installmentCount) || 1;
      const paid = Number(inst.paidInstallmentCount) || 0;
      const isPaid = inst.isPaid === true || inst.durum === "odendi" || inst.status === "paid" || paid >= count;
      if (isPaid) return;
      const total = Number(inst.totalAmount) || 0;
      const perInst = count > 0 ? total / count : 0;

      if (paid < count && inst.firstDueDate) {
        const bDate = new Date(inst.firstDueDate);
        if (!isNaN(bDate.getTime())) {
          bDate.setMonth(bDate.getMonth() + paid);
          const dueTime = new Date(bDate.getFullYear(), bDate.getMonth(), bDate.getDate()).getTime();
          const instTitle = `${inst.title || inst.name || "Taksit"} (${paid + 1}/${count}. Taksit)`;

          if (dueTime >= todayStart && dueTime < todayEnd) {
            dueTodayList.push({ name: instTitle, category: "taksit", amount: perInst });
          } else if (dueTime < todayStart) {
            const daysLate = Math.max(1, Math.floor((todayStart - dueTime) / (1000 * 60 * 60 * 24)));
            overdueList.push({ name: instTitle, category: "taksit", amount: perInst, daysLate, isOverdue: true });
          } else if (dueTime >= todayEnd && dueTime <= (todayStart + 3 * 24 * 60 * 60 * 1000)) {
            const daysLeft = Math.ceil((dueTime - todayStart) / (1000 * 60 * 60 * 24));
            upcomingThreeDaysList.push({ name: instTitle, category: "taksit", amount: perInst, daysLeft });
          }
        }
      }
    });
  }

  if (overdueList.length > 0) {
    const overdueTotal = overdueList.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const overdueSummary = overdueList.slice(0, 3).map(d => {
      const emoji = getDebtCategoryEmoji(d.name, d.category);
      return `${emoji} ${d.name}: ${Math.round(Number(d.amount)).toLocaleString("tr-TR")} TL (${d.daysLate} gün gecikti)`;
    }).join("\n");

    await self.registration.showNotification("⚠️ Bütçem Pro: Vadesi Geçmiş Ödemeler", {
      body: `Ödenmemiş vadesi geçmiş ${overdueList.length} adet borcunuz bulunmaktadır:\n${overdueSummary}\nToplam Geciken: ${Math.round(overdueTotal).toLocaleString("tr-TR")} TL\nFaiz ve cezalardan kaçınmak için kontrol ediniz.`,
      icon: appIcon,
      vibrate: [],
      tag: "butcempro-silent-overdue-reminder",
      renotify: false,
      requireInteraction: false,
      silent: true,
      actions: [{ action: "open_app", title: "Borçları Gör" }],
      data: { url: "/?tab=debts" }
    });
  }

  const activeAlerts = [...dueTodayList, ...upcomingThreeDaysList];
  if (activeAlerts.length > 0) {
    const topItems = activeAlerts.slice(0, 4);
    const totalDue = activeAlerts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const toplamMiktar = Math.round(totalDue).toLocaleString("tr-TR");
    const dateFormatted = today.toLocaleDateString("tr-TR");

    const userProfile = await loadCachedUserProfile();
    const rawName = (userProfile && userProfile.name ? userProfile.name.trim() : "") || (userProfile && userProfile.email ? userProfile.email.trim() : "");
    const safeUser = rawName ? rawName.toUpperCase() : "BÜTÇEM PRO KULLANICISI";

    const borcListesiMetni = topItems
      .map((d) => {
        const emoji = getDebtCategoryEmoji(d.name, d.category);
        const statusText = d.daysLeft ? `Son ${d.daysLeft} gün` : "Vadesi BUGÜN";
        return `${emoji} ${d.name}: ${Math.round(Number(d.amount)).toLocaleString("tr-TR")} TL (${statusText})`;
      })
      .concat(activeAlerts.length > topItems.length ? [`...ve ${activeAlerts.length - topItems.length} adet daha`] : [])
      .join("\n");

    const bildirimBasligi = "📊 Bütçem Pro: Yaklaşan Ödeme Bildirimi";
    const bildirimIcerigi = `👤 SN. ${safeUser}\n` +
      `📅 Tarih: ${dateFormatted}\n\n` +
      `📌 YAKLAŞAN / BUGÜNKÜ ÖDEMELERİNİZ:\n` +
      `${borcListesiMetni}\n\n` +
      `💰 Toplam Tutar: ${toplamMiktar} TL\n\n` +
      `⚠️ Son ödeme tarihini kaçırmamak için ödemenizi yapmayı unutmayınız.`;

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
  }

  await saveCachedLastGeneralNotificationTime(now);
  await saveCachedLastTwiceDailyNotificationTime(now);

  const allClients = await self.clients.matchAll();
  allClients.forEach(c => {
    c.postMessage({ type: "UPDATE_LAST_NOTIFICATION_TIME", timestamp: now });
  });

  if (self.navigator && self.navigator.setAppBadge) {
    const totalBadge = (triggeredAlarmCount > 0 ? triggeredAlarmCount : 0) + overdueList.length + activeAlerts.length;
    if (totalBadge > 0) {
      self.navigator.setAppBadge(totalBadge).catch(() => {});
    }
  }
}

self.addEventListener("sync", (event) => {
  console.log(`[Service Worker] Background 'sync' event triggered with tag: "${event.tag}"`);
  event.waitUntil(handleBackgroundSync(event.tag));
});

self.addEventListener("periodicsync", (event) => {
  console.log(`[Service Worker] 'periodicsync' event triggered with tag: "${event.tag}"`);
  event.waitUntil(handleBackgroundSync(event.tag));
});

self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SYNC_ALL_DATA") {
    if (event.data.debts) {
      activeDebts = event.data.debts;
      saveDebtsToCache(activeDebts);
    }
    if (event.data.installmentDebts) {
      activeInstallments = event.data.installmentDebts;
      saveInstallmentsToCache(activeInstallments);
    }
    if (event.data.alarms) {
      activeAlarms = event.data.alarms;
      saveAlarmsToCache(activeAlarms);
    }
    rescheduleAlarms();
  }

  if (event.data.type === "SYNC_ALARMS") {
    activeAlarms = event.data.alarms || [];
    saveAlarmsToCache(activeAlarms);
    rescheduleAlarms();
  }

  if (event.data.type === "SYNC_DEBTS") {
    activeDebts = event.data.debts || [];
    saveDebtsToCache(activeDebts);
    rescheduleAlarms();
  }

  if (event.data.type === "SYNC_INSTALLMENTS") {
    activeInstallments = event.data.installmentDebts || [];
    saveInstallmentsToCache(activeInstallments);
    rescheduleAlarms();
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
    if (event.data.sonGundeIkiBildirimZamani) {
      saveCachedLastTwiceDailyNotificationTime(event.data.sonGundeIkiBildirimZamani);
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
      saveCachedLastTwiceDailyNotificationTime(event.data.timestamp);
    }
  }

  if (event.data.type === "TRIGGER_MANUAL_SYNC" || event.data.type === "CHECK_NOW") {
    handleBackgroundSync("manual-sync");
  }
});

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

  const notifOptions = {
    body: data.body || "Planlanmış alarm / ödeme hatırlatması! ⏰",
    icon: data.icon || appIcon,
    vibrate: data.silent ? [] : (data.vibrate || [500, 150, 500, 150, 400, 100, 200, 100, 500]),
    tag: data.tag || `alarm-${data.alarmId || Date.now()}`,
    renotify: true,
    requireInteraction: !data.silent,
    silent: !!data.silent,
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

  const notificationPromise = self.registration.showNotification(
    data.title || "Bütçem Pro: Ödeme Vakti Geldi! ⏰",
    notifOptions
  ).then(() => {
    console.log("[Service Worker] Notification displayed successfully:", data.title);
  }).catch((err) => {
    console.error("[Service Worker] Failed to display notification:", err);
  });

  const backgroundPromise = (async () => {
    if (self.navigator && self.navigator.setAppBadge) {
      try {
        await self.navigator.setAppBadge(1);
      } catch (e) {}
    }

    if (data.alarmId) {
      try {
        activeAlarms = activeAlarms.filter(a => String(a.id) !== String(data.alarmId));
        await saveAlarmsToCache(activeAlarms);
      } catch (err) {
        console.warn("[Service Worker] Error removing fired alarm from cache:", err);
      }
    }

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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const targetUrl = event.notification.data?.url || "/?tab=notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client && targetUrl) {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
