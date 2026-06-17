// Bütçem Pro Service Worker for Local & Native Android Push Notifications and Background Alarms
const ALARMS_CACHE_NAME = "butcempro-alarms-cache";
const ALARMS_URL = "/scheduled-alarms.json";

let activeAlarms = [];
let alarmTimers = [];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      loadAndScheduleCachedAlarms()
    ])
  );
});

// Reschedule the scheduled alarms inside the Service Worker thread
function rescheduleAlarms() {
  alarmTimers.forEach(t => clearTimeout(t));
  alarmTimers = [];
  
  const now = Date.now();
  const appIcon = self.location.origin + "/logo.png";
  const appBadge = self.location.origin + "/logo.png";

  activeAlarms.forEach((alarm) => {
    if (!alarm || !alarm.date) return;
    
    let alarmTime = NaN;
    try {
      // Direct parsing of ISO/Standard formats
      alarmTime = new Date(alarm.date).getTime();
      
      // Secondary fallback parser for custom formats Turkish locale dates like "26.05.2026 14:00:00"
      if (isNaN(alarmTime)) {
        const parts = alarm.date.trim().split(" ");
        if (parts.length === 2) {
          const datePart = parts[0]; // "dd.mm.yyyy" or "yyyy-mm-dd"
          const timePart = parts[1]; // "hh:mm:ss"
          
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
          
          alarmTime = new Date(y, m, d, hr, min, sec).getTime();
        }
      }
    } catch(e) {
      console.error("Error parsing date inside background worker", e);
    }
    
    if (isNaN(alarmTime)) return;
    
    const delay = alarmTime - now;

    // 1. Check if Notification Triggers are natively supported (PWA offline scheduled notifications when closed)
    if (delay > 0 && 'showTrigger' in self.Notification.prototype && typeof self.TimestampTrigger !== 'undefined') {
      try {
        self.registration.showNotification("Butcem Pro", {
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
          data: { url: "/" },
          showTrigger: new self.TimestampTrigger(alarmTime)
        });
        console.log(`PWA native TimestampTrigger scheduled successfully for: ${new Date(alarmTime).toString()}`);
        return; // Scheduled via native API! No need to run setTimeout
      } catch (triggerErr) {
        console.warn("TimestampTrigger constructor call failed, using setTimeout fallback...", triggerErr);
      }
    }

    // 2. Fallback to active background setTimeout for live sessions
    if (delay > 0) {
      const timerId = setTimeout(() => {
        // Trigger background Android status bar notification
        self.registration.showNotification("Butcem Pro", {
          body: alarm.title,
          icon: appIcon,
          badge: appBadge,
          vibrate: [200, 100, 200, 100, 300],
          tag: `alarm-${alarm.id}`,
          renotify: true,
          requireInteraction: true,
          silent: false,
          timestamp: Date.now(),
          actions: [{ action: "open_app", title: "Uygulamayı Aç" }],
          data: { url: "/" }
        });
        
        // Update device app icon badge count for a notification dot
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

// Main event dispatcher to sync alarms from React components
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SYNC_ALARMS") {
    activeAlarms = event.data.alarms || [];
    rescheduleAlarms();
    saveAlarmsToCache(activeAlarms);
  }
});

// Handle real background push notifications received from Google FCM server when application is closed
self.addEventListener("push", (event) => {
  let data = { title: "Butcem Pro", body: "Ödeme Vaktiniz Geldi! ⏰" };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Butcem Pro", body: event.data.text() };
    }
  }

  // Update app icon notification badge
  if (self.navigator && self.navigator.setAppBadge) {
    self.navigator.setAppBadge(1).catch((err) => console.log("Badge error:", err));
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
    data: { url: "/" }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Butcem Pro", options)
  );
});

// Handle notification click routing securely (Open PWA window or bring to focus)
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


