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
  email?: string;
  isPremium: boolean;
  isGuest?: boolean;
  deviceId?: string;
  premiumType?: "monthly" | "yearly" | "lifetime";
  premiumExpiryDate?: string;
  productId?: string;
  createdAt?: string;
  hasUsedTrial?: boolean;
  trialStartDate?: string;
}

/**
 * Kullanıcı giriş yaptığında veya kaydolduğunda Firestore (users/{userId}) dokümanını günceller.
 * - info.borcodemetakip@gmail.com hesabı için doğrudan isPremium: true atanır.
 * - Misafir için: isPremium: false, isGuest: true
 * - Premium için: isPremium: true, isGuest: false, activeDeviceId: [cihaz UUID], premiumType ve premiumExpiryDate
 * - createdAt alanı ilk kayıt zamanını temsil eder ve 7 günlük ücretsiz deneme hesabı için temel referanstır.
 * - Ağ gecikmelerinde veya Android WebView'da ekranın takılı kalmaması için süre kısıtı (timeout) ile korunmuştur.
 */
export async function saveUserSessionToFirestore(params: SaveSessionParams): Promise<void> {
  const { userId, email, isPremium, isGuest, deviceId, premiumType, premiumExpiryDate, productId, createdAt } = params;
  const cleanEmail = (email || "").trim().toLowerCase();
  const isSuperTestEmail = cleanEmail === "info.borcodemetakip@gmail.com";
  const now = new Date().toISOString();

  const effectivePremium = isSuperTestEmail ? true : (isPremium === true);
  const effectiveGuest = isSuperTestEmail ? false : (isGuest === true);

  // Var olan createdAt alanını korumak için kontrol et
  let determinedCreatedAt = createdAt;
  const userDocRef = doc(firestore, "users", userId);

  if (!determinedCreatedAt) {
    try {
      const existingSnap = await Promise.race([
        getDoc(userDocRef),
        new Promise<null>(res => setTimeout(() => res(null), 800))
      ]);
      if (existingSnap && existingSnap.exists()) {
        const exData = existingSnap.data();
        if (exData?.createdAt) {
          determinedCreatedAt = exData.createdAt;
        }
      }
    } catch {
      // devam et
    }
  }

  // Eğer hâlâ belirlenmediyse ve Firebase Auth metadata varsa oradan al, yoksa şimdiki zamanı ata
  if (!determinedCreatedAt) {
    if (auth.currentUser?.metadata?.creationTime) {
      determinedCreatedAt = new Date(auth.currentUser.metadata.creationTime).toISOString();
    } else {
      determinedCreatedAt = now;
    }
  }

  const userDocData: Record<string, any> = {
    email: cleanEmail,
    userUid: userId,
    isPremium: effectivePremium,
    isGuest: effectiveGuest,
    createdAt: determinedCreatedAt,
    updatedAt: now,
    lastLoginAt: now
  };

  if (params.hasUsedTrial !== undefined) {
    userDocData.hasUsedTrial = params.hasUsedTrial;
  }
  if (params.trialStartDate !== undefined) {
    userDocData.trialStartDate = params.trialStartDate;
  }

  if (effectivePremium) {
    if (premiumType) userDocData.premiumType = premiumType;
    if (premiumExpiryDate) userDocData.premiumExpiryDate = premiumExpiryDate;
    if (productId) userDocData.productId = productId;
    userDocData.premiumPlan = premiumType || "yearly";
  }

  if (effectivePremium && deviceId) {
    userDocData.activeDeviceId = deviceId;
  }

  // 1. Firestore users/{userId} dokümanına kaydet (Maksimum 1200ms zaman aşımı koruması)
  try {
    await Promise.race([
      setDoc(userDocRef, userDocData, { merge: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore timeout")), 1200))
    ]);
    console.log("[DeviceSession] Firestore kullanıcı oturumu güncellendi:", {
      userId,
      isPremium: effectivePremium,
      isGuest: effectiveGuest,
      hasUsedTrial: userDocData.hasUsedTrial,
      trialStartDate: userDocData.trialStartDate,
      createdAt: determinedCreatedAt,
      premiumType: userDocData.premiumType || "belirtilmedi",
      premiumExpiryDate: userDocData.premiumExpiryDate || "belirtilmedi",
      activeDeviceId: userDocData.activeDeviceId || "YOK"
    });
  } catch (firestoreErr) {
    console.warn("[DeviceSession] Firestore kullanıcı kaydı (hızlı devam):", firestoreErr);
  }

  // 2. Geriye dönük uyumluluk için Realtime Database senkronizasyonu (Arka planda, arayüzü bekletmez)
  try {
    const rtdbPayload: Record<string, any> = {
      isPremium: effectivePremium,
      isGuest: effectiveGuest,
      createdAt: determinedCreatedAt,
      updatedAt: now,
      ...(params.hasUsedTrial !== undefined ? { hasUsedTrial: params.hasUsedTrial } : {}),
      ...(params.trialStartDate !== undefined ? { trialStartDate: params.trialStartDate } : {}),
      ...(effectivePremium && deviceId ? { activeDeviceId: deviceId } : {}),
      ...(effectivePremium && premiumType ? { premiumType, premiumPlan: premiumType } : {}),
      ...(effectivePremium && premiumExpiryDate ? { premiumExpiryDate } : {}),
      ...(effectivePremium && productId ? { productId } : {})
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

/**
 * Kullanıcının e-posta adresi veya UID'sine bağlı 7 günlük deneme hakkını (hasUsedTrial) Firestore ve RTDB'den sorgular.
 * 1 E-posta = 1 Deneme Hakkı kuralını katı şekilde uygular.
 */
export async function checkUserTrialUsedInFirestore(
  emailOrUid: string
): Promise<{ hasUsedTrial: boolean; trialStartDate?: string; isExpired?: boolean; daysRemaining?: number }> {
  const cleanInput = (emailOrUid || "").trim().toLowerCase();
  if (!cleanInput) {
    return { hasUsedTrial: false };
  }

  // info.borcodemetakip@gmail.com geliştirici hesabıdır
  if (cleanInput === "info.borcodemetakip@gmail.com") {
    return { hasUsedTrial: false, isExpired: false, daysRemaining: 7 };
  }

  try {
    // 1. Eğer e-posta içeriyorsa users koleksiyonunda sorgula
    if (cleanInput.includes("@")) {
      const usersCol = collection(firestore, "users");
      const qUsers = query(usersCol, where("email", "==", cleanInput));
      const qSnap = await getDocs(qUsers);
      for (const d of qSnap.docs) {
        const u = d.data();
        if (u?.hasUsedTrial === true || u?.trialStartDate) {
          const startMs = new Date(u.trialStartDate || u.createdAt || Date.now()).getTime();
          const diffDays = (Date.now() - startMs) / (1000 * 60 * 60 * 24);
          return {
            hasUsedTrial: true,
            trialStartDate: u.trialStartDate || u.createdAt,
            isExpired: diffDays >= 7,
            daysRemaining: Math.max(0, Math.ceil(7 - diffDays))
          };
        }
      }

      // email_xxx doğrudan doküman ID kontrolü
      const emailDocId = "email_" + cleanInput.replace(/[^a-zA-Z0-9_]/g, "_");
      const directSnap = await getDoc(doc(firestore, "users", emailDocId));
      if (directSnap.exists()) {
        const u = directSnap.data();
        if (u?.hasUsedTrial === true || u?.trialStartDate) {
          const startMs = new Date(u.trialStartDate || u.createdAt || Date.now()).getTime();
          const diffDays = (Date.now() - startMs) / (1000 * 60 * 60 * 24);
          return {
            hasUsedTrial: true,
            trialStartDate: u.trialStartDate || u.createdAt,
            isExpired: diffDays >= 7,
            daysRemaining: Math.max(0, Math.ceil(7 - diffDays))
          };
        }
      }
    }

    // 2. Doğrudan UID dokümanı kontrolü
    const uidSnap = await getDoc(doc(firestore, "users", cleanInput));
    if (uidSnap.exists()) {
      const u = uidSnap.data();
      if (u?.hasUsedTrial === true || u?.trialStartDate) {
        const startMs = new Date(u.trialStartDate || u.createdAt || Date.now()).getTime();
        const diffDays = (Date.now() - startMs) / (1000 * 60 * 60 * 24);
        return {
          hasUsedTrial: true,
          trialStartDate: u.trialStartDate || u.createdAt,
          isExpired: diffDays >= 7,
          daysRemaining: Math.max(0, Math.ceil(7 - diffDays))
        };
      }
    }

    // 3. Realtime Database kontrolü
    const rtdbKey = cleanInput.replace(/[\.\$\#\[\]\/]/g, "_");
    const rSnap = await get(ref(db, `users/${rtdbKey}`));
    if (rSnap.exists()) {
      const val = rSnap.val();
      if (val?.hasUsedTrial === true || val?.trialStartDate) {
        const startMs = new Date(val.trialStartDate || val.createdAt || Date.now()).getTime();
        const diffDays = (Date.now() - startMs) / (1000 * 60 * 60 * 24);
        return {
          hasUsedTrial: true,
          trialStartDate: val.trialStartDate || val.createdAt,
          isExpired: diffDays >= 7,
          daysRemaining: Math.max(0, Math.ceil(7 - diffDays))
        };
      }
    }
  } catch (err) {
    console.warn("[DeviceSession] checkUserTrialUsedInFirestore uyarısı:", err);
  }

  return { hasUsedTrial: false };
}

/**
 * Kullanıcı "7 Günlük Denemeyi Başlat" butonuna ilk kez tıkladığında
 * veritabanında (Firestore users/{userId}, direct doc ve RTDB) hasUsedTrial = true ve trialStartDate alanlarını kalıcı olarak işaretler.
 */
export async function markTrialUsedInFirestore(
  userId: string,
  email?: string,
  trialStartDate?: string
): Promise<void> {
  const cleanEmail = (email || "").trim().toLowerCase();
  const startDate = trialStartDate || new Date().toISOString();
  const updatePayload = {
    hasUsedTrial: true,
    trialStartDate: startDate,
    updatedAt: new Date().toISOString()
  };

  try {
    // 1. users/{userId} güncelle
    if (userId) {
      await setDoc(doc(firestore, "users", userId), updatePayload, { merge: true });
    }
    // 2. email varsa email_xxx dokümanını da güncelle
    if (cleanEmail) {
      const emailDocId = "email_" + cleanEmail.replace(/[^a-zA-Z0-9_]/g, "_");
      await setDoc(doc(firestore, "users", emailDocId), { ...updatePayload, email: cleanEmail }, { merge: true });
    }
    // 3. Realtime Database güncelle
    if (userId) {
      await update(ref(db, `kullanicilar/${userId}`), updatePayload).catch(() => {});
      await update(ref(db, `users/${userId}`), updatePayload).catch(() => {});
    }
    if (cleanEmail) {
      const rtdbKey = cleanEmail.replace(/[\.\$\#\[\]\/]/g, "_");
      await update(ref(db, `users/${rtdbKey}`), updatePayload).catch(() => {});
    }
    localStorage.setItem("has_used_trial", "true");
  } catch (err) {
    console.warn("[DeviceSession] markTrialUsedInFirestore uyarısı:", err);
  }
}


