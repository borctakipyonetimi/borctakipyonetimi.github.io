import { Device } from "@capacitor/device";
import { signOut } from "firebase/auth";
import { 
  firestore, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  auth, 
  db,
  ref,
  set,
  update
} from "./firebase";

/**
 * Cihazın donanımsal veya kalıcı benzersiz kimliğini (UUID) döndürür.
 * Android üzerinde @capacitor/device Device.getId() çağrısını kullanır.
 * Web veya hata durumunda yerel depolamadaki kalıcı UUID'yi kullanır.
 */
export async function getDeviceUuid(): Promise<string> {
  try {
    const info = await Device.getId();
    if (info && info.identifier && typeof info.identifier === "string" && info.identifier.trim().length > 0) {
      const cleanId = info.identifier.trim();
      localStorage.setItem("butcem_device_uuid", cleanId);
      return cleanId;
    }
  } catch (err) {
    console.warn("[DeviceSession] Device.getId okunamadı, yerel UUID kullanılıyor:", err);
  }

  let localUuid = localStorage.getItem("butcem_device_uuid");
  if (!localUuid || localUuid.trim().length === 0) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      localUuid = "dev_" + crypto.randomUUID();
    } else {
      localUuid = "dev_" + Math.random().toString(36).substring(2, 12) + "_" + Date.now().toString(36);
    }
    localStorage.setItem("butcem_device_uuid", localUuid);
  }
  return localUuid;
}

export interface SaveSessionParams {
  userId: string;
  email: string;
  isPremium: boolean;
  isGuest: boolean;
  deviceId?: string;
}

/**
 * Kullanıcı giriş yaptığında veya kaydolduğunda Firestore (users/{userId}) dokümanını günceller.
 * - Misafir için: isPremium: false, isGuest: true
 * - Premium için: isPremium: true, isGuest: false, activeDeviceId: [cihaz UUID]
 */
export async function saveUserSessionToFirestore(params: SaveSessionParams): Promise<void> {
  const { userId, email, isPremium, isGuest, deviceId } = params;
  const cleanEmail = (email || "").trim().toLowerCase();
  const now = new Date().toISOString();

  const userDocData: Record<string, any> = {
    email: cleanEmail,
    userUid: userId,
    isPremium: isPremium === true,
    isGuest: isGuest === true,
    updatedAt: now,
    lastLoginAt: now
  };

  if (isPremium === true && deviceId) {
    userDocData.activeDeviceId = deviceId;
  }

  try {
    // 1. Firestore users/{userId} dokümanına kaydet
    const userDocRef = doc(firestore, "users", userId);
    await setDoc(userDocRef, userDocData, { merge: true });
    console.log("[DeviceSession] Firestore kullanıcı oturumu güncellendi:", {
      userId,
      isPremium,
      isGuest,
      activeDeviceId: userDocData.activeDeviceId || "YOK (Misafir/Kısıtlama Yok)"
    });
  } catch (firestoreErr) {
    console.error("[DeviceSession] Firestore kullanıcı kaydı hatası:", firestoreErr);
  }

  // 2. Geriye dönük uyumluluk için Realtime Database senkronizasyonu
  try {
    await update(ref(db, `users/${userId}`), {
      isPremium: isPremium === true,
      isGuest: isGuest === true,
      updatedAt: now,
      ...(isPremium && deviceId ? { activeDeviceId: deviceId } : {})
    });
    await update(ref(db, `kullanicilar/${userId}`), {
      isPremium: isPremium === true,
      isGuest: isGuest === true,
      updatedAt: now,
      ...(isPremium && deviceId ? { activeDeviceId: deviceId } : {})
    });
  } catch (rtdbErr) {
    console.warn("[DeviceSession] RTDB profil yedekleme uyarısı:", rtdbErr);
  }
}

/**
 * Premium kullanıcılar için Firestore'daki activeDeviceId alanını gerçek zamanlı izler.
 * Başka bir cihazda oturum açıldığında veritabanındaki activeDeviceId değişeceğinden,
 * bu cihazdaki oturumu anında sonlandırır ve kullanıcıyı uyarır.
 * 
 * NOT: isPremium: false olan Misafir hesaplarında tek cihaz kısıtlaması ÇALIŞMAZ.
 */
export function startDeviceSessionWatcher(
  userId: string,
  onTerminated: (reason: string) => void
): () => void {
  if (!userId) return () => {};

  let isTerminated = false;

  const checkDeviceMatch = async (activeDeviceId?: string, isUserPremium?: boolean) => {
    if (isTerminated) return;
    // SADECE isPremium: true olan kullanıcılar için tek cihaz kısıtlaması uygulanır
    if (isUserPremium !== true || !activeDeviceId) {
      return;
    }

    try {
      const myDeviceId = await getDeviceUuid();
      if (activeDeviceId !== myDeviceId) {
        console.warn("[DeviceSession] Eşzamanlı tek cihaz kısıtlaması tetiklendi!", {
          serverActiveDeviceId: activeDeviceId,
          currentDeviceUuid: myDeviceId
        });
        isTerminated = true;

        // Oturumu güvenli şekilde kapat
        try {
          await signOut(auth);
        } catch (e) {
          console.warn("[DeviceSession] signOut hatası:", e);
        }

        // Yerel önbelleği temizle
        localStorage.removeItem("currentUser");
        localStorage.setItem("is_premium", "false");
        localStorage.removeItem("premium_source");

        onTerminated("Oturumunuz başka bir cihazda açıldığı için sonlandırıldı.");
      }
    } catch (err) {
      console.error("[DeviceSession] Cihaz eşleştirme kontrol hatası:", err);
    }
  };

  // 1. Gerçek zamanlı Firestore dinleyicisi (onSnapshot)
  const userDocRef = doc(firestore, "users", userId);
  const unsubscribeSnapshot = onSnapshot(
    userDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        checkDeviceMatch(data.activeDeviceId, data.isPremium);
      }
    },
    (err) => {
      console.warn("[DeviceSession] Firestore onSnapshot izleme uyarısı:", err);
    }
  );

  // 2. Uygulama arka plandan ön plana geldiğinde (visibilitychange / focus) anında kontrol
  const handleAppResume = async () => {
    if (document.visibilityState === "visible" && !isTerminated) {
      try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const data = snap.data();
          checkDeviceMatch(data.activeDeviceId, data.isPremium);
        }
      } catch (resumeErr) {
        console.warn("[DeviceSession] Ön plana gelme sorgulama uyarısı:", resumeErr);
      }
    }
  };

  document.addEventListener("visibilitychange", handleAppResume);
  window.addEventListener("focus", handleAppResume);

  // Periyodik yedek kontrol (30 saniyede bir)
  const intervalId = window.setInterval(async () => {
    if (document.visibilityState === "visible" && !isTerminated) {
      try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const data = snap.data();
          checkDeviceMatch(data.activeDeviceId, data.isPremium);
        }
      } catch (_) {}
    }
  }, 30000);

  return () => {
    isTerminated = true;
    unsubscribeSnapshot();
    document.removeEventListener("visibilitychange", handleAppResume);
    window.removeEventListener("focus", handleAppResume);
    clearInterval(intervalId);
  };
}
