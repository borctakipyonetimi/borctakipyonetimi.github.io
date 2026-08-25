// Bütçem Pro Service Worker with SyncManager API, Background Sync, Periodic Sync, and Native Push Notifications
const ALARMS_CACHE_NAME = "butcempro-alarms-cache";
const ALARMS_URL = "/scheduled-alarms.json";
const DEBTS_CACHE_NAME = "butcempro-debts-cache";
const DEBTS_URL = "/cached-debts.json";

let activeAlarms = [];
let activeDebts = [];
let alarmTimers = [];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      loadAndScheduleCachedAlarms(),
      loadCachedDebts()
    ])
  );
});

// Helper to parse dates formatted in ISO or Turkish locale (dd.mm.yyyy hh:mm:ss or yyyy-mm-dd)
function parseDateRobust(dateStr) {
  if (!dateStr) return NaN;
  let parsed = new Date(dateStr).getTime();
  if (!isNaN(parsed)) return parsed;

  try {
    const parts = dateStr.trim().split(" ");
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
        self.registration.showNotification("Bütçem Pro", {
          body: alarm.title,
          icon: appIcon,
          badge: appBadge,
          vibrate: [200, 100, 200, 100, 300],
          tag: `alarm-${alarm.id}`,
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
        self.registration.showNotification("Bütçem Pro", {
          body: alarm.title || "Hatırlatıcı zamanı geldi! ⏰",
          icon: appIcon,
          badge: appBadge,
          vibrate: [200, 100, 200, 100, 300],
          tag: `alarm-${alarm.id}`,
          renotify: true,
          requireInteraction: true,
          silent: false,
          timestamp: Date.now(),
          actions: [{ action: "open_app", title: "Uygulamayı Aç" }],
          data: { url: "/?tab=notifications" }
        });

        if (self.navigator && self.navigator.setAppBadge) {
          self.navigator.setAppBadge(1).catch(err => console.log("Set badge err:", err));
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

// --- SYNCMANAGER API IMPLEMENTATION ---
// Handles background sync events when application is closed or returning online
async function handleBackgroundSync(tag) {
  console.log(`[Service Worker] Executing background sync for tag: "${tag}"`);

  // 1. Reload latest cached alarms and debts
  await Promise.all([
    loadAndScheduleCachedAlarms(),
    loadCachedDebts()
  ]);

  const now = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);
  const appIcon = self.location.origin + "/logo.png";
  const appBadge = self.location.origin + "/logo.png";

  // 2. Check for any due alarms right now
  let triggeredAlarmCount = 0;
  activeAlarms.forEach((alarm) => {
    if (!alarm || !alarm.date) return;
    const alarmTime = parseDateRobust(alarm.date);
    if (!isNaN(alarmTime) && alarmTime <= now && (now - alarmTime < 24 * 60 * 60 * 1000)) {
      // Trigger notification for this due alarm
      self.registration.showNotification("Bütçem Pro Hatırlatıcı ⏰", {
        body: alarm.title || "Vadesi gelen ödeme hatırlatması!",
        icon: appIcon,
        badge: appBadge,
        vibrate: [200, 100, 200, 100, 300],
        tag: `alarm-${alarm.id}`,
        renotify: true,
        requireInteraction: true,
        data: { url: "/?tab=notifications" }
      });
      triggeredAlarmCount++;
    }
  });

  // 3. Check for overdue debts or debts due today
  if (Array.isArray(activeDebts) && activeDebts.length > 0) {
    const overdueList = [];
    const dueTodayList = [];

    activeDebts.forEach((debt) => {
      if (debt.isPaid) return;
      const remaining = (debt.amount || 0) - (debt.paid || 0);
      if (remaining <= 0) return;

      if (debt.dueDate) {
        const dueTime = parseDateRobust(debt.dueDate);
        if (!isNaN(dueTime)) {
          const debtDateStr = new Date(dueTime).toISOString().slice(0, 10);
          if (debtDateStr === todayStr) {
            dueTodayList.push({ name: debt.name || "Borç", amount: remaining });
          } else if (dueTime < now) {
            const daysLate = Math.max(1, Math.floor((now - dueTime) / (1000 * 60 * 60 * 24)));
            overdueList.push({ name: debt.name || "Borç", amount: remaining, daysLate });
          }
        }
      }
    });

    if (overdueList.length > 0) {
      const top = overdueList[0];
      const totalOverdue = overdueList.reduce((s, d) => s + d.amount, 0);
      self.registration.showNotification(`⚠️ Gecikmiş Borç Uyarısı (${overdueList.length} Adet)`, {
        body: `"${top.name}" için ₺${top.amount.toLocaleString("tr-TR")} tutarında ödeme ${top.daysLate} gün gecikti! Toplam geciken: ₺${totalOverdue.toLocaleString("tr-TR")}.`,
        icon: appIcon,
        badge: appBadge,
        vibrate: [200, 100, 200, 100, 300],
        tag: "sw-overdue-sync-" + todayStr,
        renotify: true,
        requireInteraction: true,
        actions: [{ action: "open_app", title: "Borçları Görüntüle" }],
        data: { url: "/?tab=debts" }
      });
    } else if (dueTodayList.length > 0) {
      const top = dueTodayList[0];
      self.registration.showNotification("🚨 Bugün Vadesi Gelen Ödemeniz Var!", {
        body: `"${top.name}" için ₺${top.amount.toLocaleString("tr-TR")} tutarındaki ödemenizin vadesi bugün!`,
        icon: appIcon,
        badge: appBadge,
        vibrate: [200, 100, 200, 100, 300],
        tag: "sw-duetoday-sync-" + todayStr,
        renotify: true,
        requireInteraction: true,
        actions: [{ action: "open_app", title: "Ödemeyi Yap" }],
        data: { url: "/?tab=debts" }
      });
    }
  }

  // 4. Update badge
  if (self.navigator && self.navigator.setAppBadge) {
    self.navigator.setAppBadge(triggeredAlarmCount > 0 ? triggeredAlarmCount : 1).catch(() => {});
  }
}

// Listen to standard Background Sync events (SyncManager API)
self.addEventListener("sync", (event) => {
  console.log(`[Service Worker] 'sync' event triggered with tag: ${event.tag}`);
  event.waitUntil(handleBackgroundSync(event.tag));
});

// Listen to Periodic Background Sync events (PeriodicSyncManager API)
self.addEventListener("periodicsync", (event) => {
  console.log(`[Service Worker] 'periodicsync' event triggered with tag: ${event.tag}`);
  event.waitUntil(handleBackgroundSync(event.tag));
});

// Main message listener from React client
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SYNC_ALARMS") {
    activeAlarms = event.data.alarms || [];
    rescheduleAlarms();
    saveAlarmsToCache(activeAlarms);
  }

  if (event.data.type === "SYNC_DEBTS") {
    activeDebts = event.data.debts || [];
    saveDebtsToCache(activeDebts);
  }

  if (event.data.type === "TRIGGER_MANUAL_SYNC") {
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

  if (self.navigator && self.navigator.setAppBadge) {
    self.navigator.setAppBadge(1).catch(() => {});
  }

  const appIcon = self.location.origin + "/logo.png";
  const appBadge = self.location.origin + "/logo.png";

  const options = {
    body: data.body,
    icon: appIcon,
    badge: appBadge,
    vibrate: [200, 100, 200, 100, 300],
    tag: data.tag || "butcempro-alarm",
    renotify: true,
    requireInteraction: true,
    silent: false,
    timestamp: Date.now(),
    actions: [{ action: "open_app", title: "Uygulamayı Aç" }],
    data: { url: data.url || "/" }
  };

  // When push triggers while app is closed, also request a background sync if SyncManager is available
  if (self.registration && self.registration.sync) {
    self.registration.sync.register("sync-alarms").catch(() => {});
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Bütçem Pro", options)
  );
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
