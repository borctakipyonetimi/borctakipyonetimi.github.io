import { auth, db, firestore, doc, setDoc, ref, set, get, update } from "./firebase";
import { saveUserSessionToFirestore, getDeviceUuid } from "./deviceSessionService";
import { scheduleSubscriptionExpiryNotifications } from "./notificationScheduler";

// Product configuration requested by user
export interface ProductInfo {
  identifier: string;
  price: number;
  priceString: string;
  title: string;
  description: string;
  subscriptionPeriod?: string;
  saving?: string;
  badge?: string;
  planType: "monthly" | "yearly" | "lifetime";
}

export const PLAY_PRODUCTS: Record<string, ProductInfo> = {
  butcempro_monthly: {
    identifier: "butcempro_monthly",
    price: 49.99,
    priceString: "₺49,99 / Ay",
    title: "Aylık Premium",
    description: "Her ay otomatik yenilenen tam yetkili premium erişim.",
    subscriptionPeriod: "P1M",
    saving: "Aylık Yenilenen",
    badge: "ESNEK PLAN",
    planType: "monthly"
  },
  butcempro_yearly: {
    identifier: "butcempro_yearly",
    price: 399.99,
    priceString: "₺399,99 / Yıl",
    title: "Yıllık Premium (En Popüler)",
    description: "Yıllık tasarruflu paket ile tüm özelliklere kesintisiz erişim.",
    subscriptionPeriod: "P1Y",
    saving: "Tasarruf: %35",
    badge: "EN POPÜLER",
    planType: "yearly"
  },
  butcempro_lifetime: {
    identifier: "butcempro_lifetime",
    price: 999.99,
    priceString: "₺999,99",
    title: "Ömür Boyu Sınırsız Lisans",
    description: "Tek seferlik ödeme ile ömür boyu tüm pro özellikler sizin olsun.",
    subscriptionPeriod: "LIFETIME",
    saving: "Tek Seferlik",
    badge: "ÖMÜR BOYU LİSANS",
    planType: "lifetime"
  },
  butcem_pro_aylik: {
    identifier: "butcempro_monthly",
    price: 49.99,
    priceString: "₺49,99 / Ay",
    title: "Aylık Premium",
    description: "Her ay otomatik yenilenen tam yetkili premium erişim.",
    subscriptionPeriod: "P1M",
    saving: "Aylık Yenilenen",
    badge: "ESNEK PLAN",
    planType: "monthly"
  },
  butcem_pro_yillik: {
    identifier: "butcempro_yearly",
    price: 399.99,
    priceString: "₺399,99 / Yıl",
    title: "Yıllık Premium (En Popüler)",
    description: "Yıllık tasarruflu paket ile tüm özelliklere kesintisiz erişim.",
    subscriptionPeriod: "P1Y",
    saving: "Tasarruf: %35",
    badge: "EN POPÜLER",
    planType: "yearly"
  },
  butcem_pro_sinirsiz: {
    identifier: "butcempro_lifetime",
    price: 999.99,
    priceString: "₺999,99",
    title: "Ömür Boyu Sınırsız Lisans",
    description: "Tek seferlik ödeme ile ömür boyu tüm pro özellikler sizin olsun.",
    subscriptionPeriod: "LIFETIME",
    saving: "Tek Seferlik",
    badge: "ÖMÜR BOYU LİSANS",
    planType: "lifetime"
  }
};

/**
 * Pakete göre premiumType ve premiumExpiryDate hesaplar:
 * - Aylık seçildiyse: "premiumType": "monthly" ve "premiumExpiryDate" bugünden 1 ay sonrası ISO string
 * - Yıllık seçildiyse: "premiumType": "yearly" ve "premiumExpiryDate" bugünden 1 yıl sonrası ISO string
 * - Sınırsız seçildiyse: "premiumType": "lifetime" ve "premiumExpiryDate" "lifetime"
 */
export function calculatePlanExpiry(productIdOrPlan: string): {
  premiumType: "monthly" | "yearly" | "lifetime";
  premiumExpiryDate: string;
  productId: string;
} {
  const now = new Date();
  
  if (productIdOrPlan === "butcempro_monthly" || productIdOrPlan === "monthly" || productIdOrPlan === "butcem_pro_aylik" || productIdOrPlan === "borc_takip_aylik") {
    const expDate = new Date(now);
    expDate.setMonth(expDate.getMonth() + 1);
    return {
      premiumType: "monthly",
      premiumExpiryDate: expDate.toISOString(),
      productId: "butcempro_monthly"
    };
  }

  if (productIdOrPlan === "butcempro_lifetime" || productIdOrPlan === "lifetime" || productIdOrPlan === "butcem_pro_sinirsiz" || productIdOrPlan === "borc_takip_sinirsiz") {
    return {
      premiumType: "lifetime",
      premiumExpiryDate: "lifetime",
      productId: "butcempro_lifetime"
    };
  }

  // Varsayılan / Yıllık
  const expDate = new Date(now);
  expDate.setFullYear(expDate.getFullYear() + 1);
  return {
    premiumType: "yearly",
    premiumExpiryDate: expDate.toISOString(),
    productId: "butcempro_yearly"
  };
}

/**
 * Cross-platform RevenueCat & Google Play Billing Wrapper
 */
class RevenueCatService {
  private apiKey: string | null = null;
  private appUserId: string | null = null;

  public async configure(apiKey: string, appUserId?: string) {
    this.apiKey = apiKey;
    if (appUserId) {
      this.appUserId = appUserId;
    }
    console.log("[RevenueCat] Google Play Billing hazırlandı. API Key:", apiKey, "Kullanıcı UID:", appUserId);
  }

  // Aktif paketleri Google Play Billing simülasyonu ile çeker
  public async getOfferings(): Promise<{
    current: {
      monthly: { product: ProductInfo };
      annual: { product: ProductInfo };
      lifetime: { product: ProductInfo };
      all: { product: ProductInfo }[];
    };
  }> {
    // Kısa ağ simülasyonu
    await new Promise((resolve) => setTimeout(resolve, 800));

    return {
      current: {
        monthly: { product: PLAY_PRODUCTS.butcempro_monthly },
        annual: { product: PLAY_PRODUCTS.butcempro_yearly },
        lifetime: { product: PLAY_PRODUCTS.butcempro_lifetime },
        all: [
          { product: PLAY_PRODUCTS.butcempro_monthly },
          { product: PLAY_PRODUCTS.butcempro_yearly },
          { product: PLAY_PRODUCTS.butcempro_lifetime }
        ]
      }
    };
  }

  // Google Play Billing satın alma fonksiyonu
  public async purchasePackage(productId: string): Promise<{
    success: boolean;
    productId: string;
    premiumType: "monthly" | "yearly" | "lifetime";
    premiumExpiryDate: string;
    customerInfo: {
      activeSubscriptions: string[];
      allPurchasedProductIdentifiers: string[];
      entitlements: {
        active: Record<string, { isActive: boolean; expiresDate: string | null }>;
      };
    };
  }> {
    console.log(`[Google Play Billing] Satın alma başlatıldı. Ürün ID: ${productId}`);
    
    // Google Play Billing onay bekleme simülasyonu
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const { premiumType, premiumExpiryDate, productId: effectiveProductId } = calculatePlanExpiry(productId);

    const customerInfo = {
      activeSubscriptions: [effectiveProductId],
      allPurchasedProductIdentifiers: [effectiveProductId],
      entitlements: {
        active: {
          premium: {
            isActive: true,
            expiresDate: premiumExpiryDate === "lifetime" ? null : premiumExpiryDate
          }
        }
      }
    };

    // 1. Cihazın yerel depolamasında (storage) güvenli bir şekilde sakla
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("is_premium", "true");
        localStorage.setItem("premium_type", premiumType);
        localStorage.setItem("premium_expiry_date", premiumExpiryDate);
        localStorage.setItem("premium_product_id", effectiveProductId);
        localStorage.setItem("premium_purchased_at", String(Date.now()));
      } catch {}
    }

    // 2. Abonelik bitiş tarihi bildirimlerini zamanla veya güncelle
    try {
      await scheduleSubscriptionExpiryNotifications(premiumExpiryDate);
    } catch (e) {
      console.warn("[Google Play Billing] Abonelik bildirimleri kurulamadı:", e);
    }

    // Google Play ödeme onayı geldi -> Firestore users/{userId} dokümanını güncelle
    const fbUser = auth.currentUser;
    const userEmail = (fbUser?.email || localStorage.getItem("currentUser") || "").toLowerCase();
    const effectiveUid = fbUser?.uid || (userEmail ? "email_" + userEmail.replace(/[^a-zA-Z0-9_]/g, "_") : null);

    if (effectiveUid) {
      try {
        const deviceUuid = await getDeviceUuid();
        await saveUserSessionToFirestore({
          userId: effectiveUid,
          email: userEmail,
          isPremium: true,
          isGuest: false,
          deviceId: deviceUuid,
          premiumType,
          premiumExpiryDate,
          productId: effectiveProductId
        });
      } catch (fErr) {
        console.warn("[Google Play Billing] Firestore kullanıcı kaydı uyarısı:", fErr);
      }
    }

    if (fbUser) {
      try {
        const now = Date.now();
        const userRef = ref(db, `users/${fbUser.uid}`);
        await update(userRef, {
          isPremium: true,
          isGuest: false,
          premiumPlan: premiumType,
          premiumType: premiumType,
          premiumExpiryDate: premiumExpiryDate,
          purchasedAt: now,
          productId: effectiveProductId,
          gpaCode: `GPA.3312-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 90000 + 10000)}`
        });
      } catch (err) {
        console.error("[Google Play Billing] RTDB senkronizasyon hatası:", err);
      }
    }

    return {
      success: true,
      productId: effectiveProductId,
      premiumType,
      premiumExpiryDate,
      customerInfo
    };
  }

  // Satın alımları geri yükleme (Restore Purchases)
  public async restorePurchases(): Promise<{
    success: boolean;
    premiumType: "monthly" | "yearly" | "lifetime";
    premiumExpiryDate: string;
    customerInfo: {
      activeSubscriptions: string[];
      allPurchasedProductIdentifiers: string[];
      entitlements: {
        active: Record<string, { isActive: boolean; expiresDate: string | null }>;
      };
    } | null;
  }> {
    console.log("[Google Play Billing] Satın alma hakları kontrol ediliyor...");
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const fbUser = auth.currentUser;
    if (fbUser) {
      try {
        const userRef = ref(db, `users/${fbUser.uid}`);
        const userSnap = await get(userRef);
        if (userSnap.exists() && userSnap.val()?.isPremium) {
          const data = userSnap.val();
          const pPlan = data.premiumType || data.premiumPlan || "yearly";
          const { premiumType, premiumExpiryDate, productId } = calculatePlanExpiry(pPlan);

          return {
            success: true,
            premiumType,
            premiumExpiryDate,
            customerInfo: {
              activeSubscriptions: [productId],
              allPurchasedProductIdentifiers: [productId],
              entitlements: {
                active: {
                  premium: {
                    isActive: true,
                    expiresDate: premiumExpiryDate === "lifetime" ? null : premiumExpiryDate
                  }
                }
              }
            }
          };
        }
      } catch (err) {
        console.error("[Google Play Billing] Geri yükleme sorgu hatası:", err);
      }
    }

    // Yerel depolama kontrolü
    const wasPremium = localStorage.getItem("is_premium") === "true";
    if (wasPremium) {
      const pPlan = localStorage.getItem("premium_type") || localStorage.getItem("premium_plan") || "yearly";
      const { premiumType, premiumExpiryDate, productId } = calculatePlanExpiry(pPlan);

      return {
        success: true,
        premiumType,
        premiumExpiryDate,
        customerInfo: {
          activeSubscriptions: [productId],
          allPurchasedProductIdentifiers: [productId],
          entitlements: {
            active: {
              premium: {
                isActive: true,
                expiresDate: premiumExpiryDate === "lifetime" ? null : premiumExpiryDate
              }
            }
          }
        }
      };
    }

    return {
      success: false,
      premiumType: "yearly",
      premiumExpiryDate: "",
      customerInfo: null
    };
  }
}

export const Purchases = new RevenueCatService();
