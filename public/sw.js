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

// Reschedule the scheduled alarms inside the Service Worker thread
function rescheduleAlarms() {
  alarmTimers.forEach(t => clearTimeout(t));
  alarmTimers = [];

  const now = Date.now();
  const appIcon = self.location.origin + "/logo.png";
  const appBadge = self.location.origin + "/logo.png";

  activeAlarms.forEach((alarm) => {
    if (!alarm || !alarm.date) return;

    const alarmTime = parseDateRobust(alarm.date);
    if (isNaN(alarmTime)) return;

    const delay = alarmTime - now;

    // 1. Check if Notification Triggers are natively supported (PWA offline scheduled notifications when closed)
    if (delay > 0 && 'showTrigger' in self.Notification.prototype && typeof self.TimestampTrigger !== 'undefined') {
      try {
        self.registration.showNotification("Bütçem Pro Hatırlatıcı ⏰", {
          body: alarm.title || "Planlanmış alarm zamanı!",
          icon: appIcon,
          badge: appBadge,
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
        self.registration.showNotification("Bütçem Pro Hatırlatıcı ⏰", {
          body: alarm.title || "Hatırlatıcı zamanı geldi! ⏰",
          icon: appIcon,
          badge: appBadge,
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

// --- SYNCMANAGER API IMPLEMENTATION ---
// Handles background sync and periodic sync events when application is in background or closed
async function handleBackgroundSync(tag) {
  console.log(`[Service Worker] Executing background sync listener for tag: "${tag}"`);

  // 1. Reload latest cached alarms, debts, and installments
  await Promise.all([
    loadAndScheduleCachedAlarms(),
    loadCachedDebts(),
    loadCachedInstallments()
  ]);

  const now = Date.now();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;
  const todayStr = today.toISOString().slice(0, 10);
  const appIcon = self.location.origin + "/logo.png";
  const appBadge = self.location.origin + "/logo.png";

  // 2. Check for any active alarms due right now (within past 2 hours or due immediately)
  let triggeredAlarmCount = 0;
  if (Array.isArray(activeAlarms)) {
    activeAlarms.forEach((alarm) => {
      if (!alarm || !alarm.date) return;
      const alarmTime = parseDateRobust(alarm.date);
      if (!isNaN(alarmTime) && alarmTime <= now && (now - alarmTime < 2 * 60 * 60 * 1000)) {
        self.registration.showNotification("Bütçem Pro Hatırlatıcı ⏰", {
          body: alarm.title || "Vadesi gelen ödeme / alarm hatırlatması!",
          icon: appIcon,
          badge: appBadge,
          vibrate: [300, 100, 300, 100, 400],
          tag: `alarm-${alarm.id || Date.now()}`,
          renotify: true,
          requireInteraction: true,
          silent: false,
          actions: [{ action: "open_app", title: "Uygulamayı Aç" }],
          data: { url: "/?tab=notifications" }
        });
        triggeredAlarmCount++;
      }
    });
  }

  // 3. Check standard debts
  const overdueList = [];
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
            dueTodayList.push({ name: debt.name || "Borç", amount: remaining });
          } else if (dueTime < todayStart) {
            const daysLate = Math.max(1, Math.floor((todayStart - dueTime) / (1000 * 60 * 60 * 24)));
            overdueList.push({ name: debt.name || "Borç", amount: remaining, daysLate });
          }
        }
      }
    });
  }

  // 4. Check installment debts (taksitli borçlar)
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
          const instTitle = `${inst.title || "Taksit"} (${paid + 1}/${count}. Taksit)`;

          if (dueTime >= todayStart && dueTime < todayEnd) {
            dueTodayList.push({ name: instTitle, amount: perInst });
          } else if (dueTime < todayStart) {
            const daysLate = Math.max(1, Math.floor((todayStart - dueTime) / (1000 * 60 * 60 * 24)));
            overdueList.push({ name: instTitle, amount: perInst, daysLate });
          }
        }
      }
    });
  }

  // 5. Trigger notifications for overdue / due-today debts
  const dateFormatted = today.toLocaleDateString("tr-TR");
  if (overdueList.length > 0) {
    const top = overdueList[0];
    const totalOverdue = overdueList.reduce((s, d) => s + d.amount, 0);
    const smsBody = `SN. DEĞERLİ KULLANICIMIZ\n${dateFormatted} TARİHLİ GECİKMİŞ BORÇ UYARISI:\n- ${top.name}: ₺${top.amount.toLocaleString("tr-TR")} (${top.daysLate} gün gecikti)\n- Toplam geciken borç tutarı: ₺${totalOverdue.toLocaleString("tr-TR")}\n- Gecikme faizlerinden korunmak için ödemenizi yapmanızı rica ederiz.\nBÜTÇEM PRO - İYİ GÜNLER DİLERİZ B001`;

    self.registration.showNotification(`Bütçem Pro - Gecikmiş Borç Uyarısı ⚠️`, {
      body: smsBody,
      icon: appIcon,
      badge: appBadge,
      vibrate: [300, 100, 300, 100, 400],
      tag: "sw-overdue-sync-" + todayStr,
      renotify: true,
      requireInteraction: true,
      silent: false,
      actions: [{ action: "open_app", title: "Ödemeyi Gör" }],
      data: { url: "/?tab=debts" }
    });
  } else if (dueTodayList.length > 0) {
    const top = dueTodayList[0];
    const totalDueToday = dueTodayList.reduce((s, d) => s + d.amount, 0);
    const smsBody = `SN. DEĞERLİ KULLANICIMIZ\n${dateFormatted} TARİHLİ VADE HATIRLATMASI:\n- ${top.name}: ₺${top.amount.toLocaleString("tr-TR")} (Vadesi Bugün)\n- Toplam ödenecek tutar: ₺${totalDueToday.toLocaleString("tr-TR")}\n- Ödemenizi zamanında tamamlamanızı rica ederiz.\nBÜTÇEM PRO - İYİ GÜNLER DİLERİZ B001`;

    self.registration.showNotification("Bütçem Pro - Vade Hatırlatması ⏰", {
      body: smsBody,
      icon: appIcon,
      badge: appBadge,
      vibrate: [300, 100, 300, 100, 400],
      tag: "sw-duetoday-sync-" + todayStr,
      renotify: true,
      requireInteraction: true,
      silent: false,
      actions: [{ action: "open_app", title: "Ödemeyi Gör" }],
      data: { url: "/?tab=debts" }
    });
  }

  // 6. Update App icon badge count
  if (self.navigator && self.navigator.setAppBadge) {
    const totalBadge = (triggeredAlarmCount > 0 ? triggeredAlarmCount : 0) + (overdueList.length > 0 ? overdueList.length : 0);
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

  if (event.data.type === "TRIGGER_MANUAL_SYNC" || event.data.type === "CHECK_NOW") {
    handleBackgroundSync("manual-sync");
  }
});

// Handle push notifications received from Web Push / FCM
self.addEventListener("push", (event) => {
  let data = { title: "Bütçem Pro", body: "Ödeme Vaktiniz Geldi! ⏰", url: "/" };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Bütçem Pro", body: event.data.text(), url: "/" };
    }
  }

  const syncTag = data.syncTag || (data.action === "trigger-sync" ? "server-cron-sync" : "push-cron-sync");

  const syncPromise = (async () => {
    // 1. When server cron job push triggers while app is closed, register SyncManager sync if supported
    if (self.registration && self.registration.sync) {
      try {
        await self.registration.sync.register(syncTag);
      } catch (err) {}
    }

    // 2. Try background sync routine safely
    try {
      await handleBackgroundSync(syncTag);
    } catch (bgErr) {
      console.warn("[Service Worker] Background sync error:", bgErr);
    }

    // 3. Always show notification on device lockscreen / drawer
    const appIcon = self.location.origin + "/logo.png";
    const appBadge = self.location.origin + "/logo.png";

    if (self.navigator && self.navigator.setAppBadge) {
      try {
        await self.navigator.setAppBadge(1);
      } catch (e) {}
    }

    if (data.title || data.body) {
      const options = {
        body: data.body || "Vadesi gelen ödeme / borç hatırlatıcısı!",
        icon: appIcon,
        badge: appBadge,
        vibrate: [300, 100, 300, 100, 400],
        tag: data.tag || `alarm-${Date.now()}`,
        renotify: true,
        requireInteraction: true,
        silent: false,
        timestamp: Date.now(),
        actions: [{ action: "open_app", title: "Uygulamayı Aç" }],
        data: { url: data.url || "/" }
      };

      try {
        await self.registration.showNotification(data.title || "Bütçem Pro Hatırlatıcı ⏰", options);
        console.log("[Service Worker] Successfully displayed notification to user tray:", data.title);
      } catch (notifErr) {
        console.error("[Service Worker] Failed to display notification:", notifErr);
      }
    }
  })();

  event.waitUntil(syncPromise);
});

// Handle notification click routing
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].url.includes(targetUrl) || clientList[i].focused) {
            client = clientList[i];
            break;
          }
        }
        return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
