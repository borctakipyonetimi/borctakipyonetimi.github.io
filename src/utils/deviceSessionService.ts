import { Device } from "@capacitor/device";
import { signOut } from "firebase/auth";
import { 
  firestore, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  collection,
  query,
  where,
  getDocs,
  auth, 
  db,
  ref,
  get,
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
 * - info.borcodemetakip@gmail.com hesabı için doğrudan isPremium: true atanır.
 * - Misafir için: isPremium: false, isGuest: true
 * - Premium için: isPremium: true, isGuest: false, activeDeviceId: [cihaz UUID]
 * - Ağ gecikmelerinde veya Android WebView'da ekranın takılı kalmaması için süre kısıtı (timeout) ile korunmuştur.
 */
export async function saveUserSessionToFirestore(params: SaveSessionParams): Promise<void> {
  const { userId, email, isPremium, isGuest, deviceId } = params;
  const cleanEmail = (email || "").trim().toLowerCase();
  const isSuperTestEmail = cleanEmail === "info.borcodemetakip@gmail.com";
  const now = new Date().toISOString();

  const effectivePremium = isSuperTestEmail ? true : (isPremium === true);
  const effectiveGuest = isSuperTestEmail ? false : (isGuest === true);

  const userDocData: Record<string, any> = {
    email: cleanEmail,
    userUid: userId,
    isPremium: effectivePremium,
    isGuest: effectiveGuest,
    updatedAt: now,
    lastLoginAt: now
  };

  if (effectivePremium && deviceId) {
    userDocData.activeDeviceId = deviceId;
  }

  // 1. Firestore users/{userId} dokümanına kaydet (Maksimum 1200ms zaman aşımı koruması)
  try {
    const userDocRef = doc(firestore, "users", userId);
    await Promise.race([
      setDoc(userDocRef, userDocData, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore timeout")), 1200))
    ]);
    console.log("[DeviceSession] Firestore kullanıcı oturumu güncellendi:", {
      userId,
      isPremium: effectivePremium,
      isGuest: effectiveGuest,
      activeDeviceId: userDocData.activeDeviceId || "YOK"
    });
  } catch (firestoreErr) {
    console.warn("[DeviceSession] Firestore kullanıcı kaydı (hızlı devam):", firestoreErr);
  }

  // 2. Geriye dönük uyumluluk için Realtime Database senkronizasyonu (Arka planda, arayüzü bekletmez)
  try {
    const rtdbPayload = {
      isPremium: effectivePremium,
      isGuest: effectiveGuest,
      updatedAt: now,
      ...(effectivePremium && deviceId ? { activeDeviceId: deviceId } : {})
    };
    Promise.race([
      Promise.all([
        update(ref(db, `users/${userId}`), rtdbPayload),
        update(ref(db, `kullanicilar/${userId}`), rtdbPayload)
      ]),
      new Promise((_, reject) => setTimeout(() => reject(new Error("RTDB timeout")), 1000))
    ]).catch(() => {});
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

    // info.borcodemetakip@gmail.com test hesabı için serbest geliştirici testi (asla oturum sonlandırmaz)
    const currentEmail = (auth.currentUser?.email || localStorage.getItem("currentUser") || "").toLowerCase();
    if (currentEmail === "info.borcodemetakip@gmail.com") {
      return;
    }

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

/**
 * Şifre sıfırlama (Password Reset) öncesinde e-postanın Firestore veritabanında (users veya email_subscribers koleksiyonlarında)
 * kayıtlı olup olmadığını ve "isPremium" değerinin TRUE olup olmadığını doğrular.
 * 
 * - Eğer bu e-posta adresi veritabanında mevcut DEĞİLSE veya mevcut olup da "isPremium" değeri TRUE değilse,
 *   şifre sıfırlama maili gönderilemez.
 * - Yalnızca ve sadece "isPremium": true olan kayıtlı e-postalar için doğrulama başarılı döner.
 */
export async function checkIsPremiumEmailInFirestore(email: string): Promise<{ exists: boolean; isPremium: boolean }> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { exists: false, isPremium: false };
  }

  // 0. info.borcodemetakip@gmail.com doğrudan geliştirici/test hesabı olduğu için anında doğrulanır
  if (cleanEmail === "info.borcodemetakip@gmail.com") {
    console.log("[DeviceSession] Test geliştirici hesabı doğrudan Premium doğrulandı:", cleanEmail);
    return { exists: true, isPremium: true };
  }

  let foundUser = false;
  let isPremiumUser = false;

  // 1. ADIM: Firestore 'users' koleksiyonunda email alanına göre sorgula
  try {
    const usersCol = collection(firestore, "users");
    const qUsers = query(usersCol, where("email", "==", cleanEmail));
    const usersSnap = await getDocs(qUsers);

    if (!usersSnap.empty) {
      foundUser = true;
      for (const docItem of usersSnap.docs) {
        const data = docItem.data();
        if (data && data.isPremium === true) {
          isPremiumUser = true;
          console.log("[DeviceSession] users koleksiyonunda Premium kullanıcı bulundu:", cleanEmail);
          return { exists: true, isPremium: true };
        }
      }
    }
  } catch (err) {
    console.warn("[DeviceSession] users query uyarısı:", err);
  }

  // 1.b Doğrudan doküman ID ile users kontrolü (email_xxx veya ham email)
  if (!isPremiumUser) {
    try {
      const sanitizedId = "email_" + cleanEmail.replace(/[^a-zA-Z0-9_]/g, "_");
      const directDocRef = doc(firestore, "users", sanitizedId);
      const directSnap = await getDoc(directDocRef);
      if (directSnap.exists()) {
        foundUser = true;
        const data = directSnap.data();
        if (data && data.isPremium === true) {
          isPremiumUser = true;
          console.log("[DeviceSession] users direct doc ile Premium kullanıcı bulundu:", cleanEmail);
          return { exists: true, isPremium: true };
        }
      }
    } catch (err) {
      console.warn("[DeviceSession] users direct doc uyarısı:", err);
    }
  }

  // 2. ADIM: Firestore 'email_subscribers' koleksiyonunu sorgula
  if (!isPremiumUser) {
    try {
      const subscribersCol = collection(firestore, "email_subscribers");
      const qSubs = query(subscribersCol, where("email", "==", cleanEmail));
      const subsSnap = await getDocs(qSubs);

      if (!subsSnap.empty) {
        foundUser = true;
        for (const docItem of subsSnap.docs) {
          const data = docItem.data();
          if (data && data.isPremium === true) {
            isPremiumUser = true;
            console.log("[DeviceSession] email_subscribers koleksiyonunda Premium kullanıcı bulundu:", cleanEmail);
            return { exists: true, isPremium: true };
          }
        }
      }
    } catch (err) {
      console.warn("[DeviceSession] email_subscribers query uyarısı:", err);
    }
  }

  // 2.b email_subscribers doğrudan doküman kontrolü
  if (!isPremiumUser) {
    try {
      const subSanitizedId = cleanEmail.replace(/[^a-zA-Z0-9_]/g, "_");
      const subDocRef = doc(firestore, "email_subscribers", subSanitizedId);
      const subSnap = await getDoc(subDocRef);
      if (subSnap.exists()) {
        foundUser = true;
        const data = subSnap.data();
        if (data && data.isPremium === true) {
          isPremiumUser = true;
          console.log("[DeviceSession] email_subscribers direct doc ile Premium kullanıcı bulundu:", cleanEmail);
          return { exists: true, isPremium: true };
        }
      }
    } catch (err) {
      console.warn("[DeviceSession] email_subscribers direct doc uyarısı:", err);
    }
  }

  // 3. ADIM: Realtime Database 'users' veya 'kullanicilar' yedeğini kontrol et
  if (!isPremiumUser) {
    try {
      const rtdbKey = cleanEmail.replace(/[\.\$\#\[\]\/]/g, "_");
      const rtdbSnap = await get(ref(db, `users/${rtdbKey}`));
      if (rtdbSnap.exists()) {
        foundUser = true;
        const val = rtdbSnap.val();
        if (val && val.isPremium === true) {
          isPremiumUser = true;
          return { exists: true, isPremium: true };
        }
      }
    } catch (err) {
      console.warn("[DeviceSession] RTDB users yedek sorgu uyarısı:", err);
    }
  }

  // 4. ADIM: Sunucu API endpoint sorgusu (ekstra doğrulama)
  if (!isPremiumUser) {
    try {
      const res = await fetch(`/api/auth/verify-premium-email?email=${encodeURIComponent(cleanEmail)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.exists) foundUser = true;
        if (json.isPremium) {
          isPremiumUser = true;
          return { exists: true, isPremium: true };
        }
      }
    } catch (_) {}
  }

  return {
    exists: foundUser,
    isPremium: isPremiumUser
  };
}

