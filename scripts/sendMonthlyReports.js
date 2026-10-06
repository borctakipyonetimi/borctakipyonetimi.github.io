/**
 * Bütçem Pro - Aylık Finansal Rapor E-posta Gönderim Betiği (Cron)
 * 
 * GitHub Actions ve cron tetiklemeleri için tasarlanmıştır.
 * Aktif Premium kullanıcıların (isPremium == true) bir önceki aya ait
 * Gerçek Gelir, Gider ve Ödenen Borç verilerini derler, dinamik HTML
 * şablonunu oluşturur ve Resend (veya Nodemailer) ile iletir.
 * 
 * NOT: Bu betik sunucu ortamında çalıştığı için sadece ve doğrudan
 * Firebase Admin SDK (firebase-admin) kullanır.
 */

import { generateMonthlyReportEmail } from "./templates/monthlyReportTemplate.js";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Tarih ayrıştırıcı (Zaman dilimi kaymalarını önleyen güvenli fonksiyon)
function parseDateParts(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (!str) return null;

  const isoPart = str.split("T")[0];
  const dashParts = isoPart.split("-");
  if (dashParts.length === 3) {
    const y = parseInt(dashParts[0], 10);
    const m = parseInt(dashParts[1], 10) - 1; // 0-indexed ay
    const d = parseInt(dashParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && y > 1900 && m >= 0 && m <= 11) {
      return { year: y, month: m, day: d };
    }
  }

  const dotParts = isoPart.split(".");
  if (dotParts.length === 3) {
    const d = parseInt(dotParts[0], 10);
    const m = parseInt(dotParts[1], 10) - 1;
    const y = parseInt(dotParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && y > 1900 && m >= 0 && m <= 11) {
      return { year: y, month: m, day: d };
    }
  }

  try {
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) {
      return { year: dt.getFullYear(), month: dt.getMonth(), day: dt.getDate() };
    }
  } catch {}

  return null;
}

const MONTH_NAMES_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

// CLI argümanlarını ve ortam değişkenlerini ayrıştır
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run") || process.env.DRY_RUN === "true";
const isMockMode = args.includes("--mock");

// Hedef test kullanıcısı (--user=... veya TARGET_USER env)
let rawTargetUser = (
  args.find(a => a.startsWith("--user="))?.replace("--user=", "") ||
  process.env.TARGET_USER ||
  ""
).trim();
rawTargetUser = rawTargetUser.replace(/^["']|["']$/g, "").trim();
const targetEmailArg = rawTargetUser;

const monthArg = (args.find(a => a.startsWith("--month=")) || "").replace("--month=", "").trim();
const yearArg = (args.find(a => a.startsWith("--year=")) || "").replace("--year=", "").trim();

// Raporlanacak dönemi belirle (Varsayılan: Bir önceki ay)
const now = new Date();
let targetYear = now.getFullYear();
let targetMonth = now.getMonth() - 1; // 0-indexed önceki ay

if (targetMonth < 0) {
  targetMonth = 11;
  targetYear -= 1;
}

if (monthArg !== "") {
  const m = parseInt(monthArg, 10);
  if (!isNaN(m) && m >= 0 && m <= 11) targetMonth = m;
}

if (yearArg !== "") {
  const y = parseInt(yearArg, 10);
  if (!isNaN(y) && y > 2000) targetYear = y;
}

const reportMonthTitle = `${MONTH_NAMES_TR[targetMonth]} ${targetYear}`;

// Hedef Firestore koleksiyonları (İstemci uygulamasında kullanılan koleksiyon adları)
const PRIMARY_COLLECTION = "users";
const FALLBACK_COLLECTIONS = ["users", "kullanicilar", "profiles"];

console.log("==================================================");
console.log("🚀 BÜTÇEM PRO - AYLIK FİNANSAL RAPOR GÖNDERİM MOTORU");
console.log(`📅 Rapor Dönemi: ${reportMonthTitle} (Ay: ${targetMonth + 1}, Yıl: ${targetYear})`);
console.log(`⚙️ Mod: ${isDryRun ? "DRY RUN (Test Modu - E-posta gönderilmeyecek)" : "CANLI (E-postalar gönderilecek)"}`);
if (targetEmailArg) console.log(`🎯 Hedef Test Kullanıcısı: ${targetEmailArg}`);
console.log("==================================================");

/**
 * Güvenli Servis Hesabı Ayrıştırıcı
 */
function parseServiceAccount(rawCred) {
  if (!rawCred) return null;
  let str = String(rawCred).trim();

  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.substring(1, str.length - 1).trim();
  }

  if (!str.startsWith("{")) {
    try {
      const decoded = Buffer.from(str, "base64").toString("utf-8").trim();
      if (decoded.startsWith("{")) {
        str = decoded;
      }
    } catch {}
  }

  try {
    const parsed = JSON.parse(str);
    if (parsed.private_key && typeof parsed.private_key === "string" && parsed.private_key.includes("\\n")) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (err) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT JSON parse hatası: ${err.message}`);
  }
}

/**
 * Firebase Admin SDK Başlatıcı (Çoklu Veritabanı ve Proje Destekli)
 */
function initFirebaseAdmin() {
  const rawCred = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawCred) {
    if (isMockMode) {
      console.log("ℹ️ FIREBASE_SERVICE_ACCOUNT tanımlanmamış, ancak --mock modunda çalışıldığı için devam ediliyor.");
      return null;
    }
    throw new Error("FIREBASE_SERVICE_ACCOUNT gizli anahtarı bulunamadı! Lütfen GitHub Secrets içerisine ekleyin.");
  }

  const serviceAccount = parseServiceAccount(rawCred);
  if (!serviceAccount || !serviceAccount.project_id) {
    throw new Error("Geçerli bir Firebase Servis Hesabı JSON nesnesi ayrıştırılamadı!");
  }

  // 1. Proje ID'sini belirle: Servis hesabındaki proje ID en yetkili kaynaktır
  const credProjectId = serviceAccount.project_id;
  const envProjectId = (process.env.FIREBASE_PROJECT_ID || "").trim();
  const primaryProjectId = credProjectId || envProjectId || "borc-takip-pro-f6936";

  // 2. Veritabanı ID'sini belirle (Varsayılan: '(default)')
  const customDbId = (process.env.FIREBASE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || "").trim();
  const effectiveDbId = (customDbId && customDbId !== "(default)") ? customDbId : "(default)";

  const credential = cert(serviceAccount);

  // Birincil App başlat
  let app;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    app = initializeApp({
      credential,
      projectId: primaryProjectId
    });
  }

  // Firestore DB nesnesi al (Custom Database ID desteği ile)
  let db;
  if (effectiveDbId && effectiveDbId !== "(default)") {
    console.log(`ℹ️ Özel Firestore Database ID kullanılıyor: '${effectiveDbId}'`);
    db = getFirestore(app, effectiveDbId);
  } else {
    db = getFirestore(app);
  }

  // admin nesnesi geriye dönük uyumluluk köprüsü
  if (!admin.credential) {
    admin.credential = { cert };
  }
  admin.firestore = (appInstance, databaseId) => {
    const targetApp = appInstance || app;
    const targetDbId = databaseId || effectiveDbId;
    if (targetDbId && targetDbId !== "(default)") {
      return getFirestore(targetApp, targetDbId);
    }
    return getFirestore(targetApp);
  };

  console.log(`🔥 Firebase Admin SDK başlatıldı.`);
  console.log(`   Proje ID: ${primaryProjectId}`);
  console.log(`   Database ID: ${effectiveDbId}`);
  if (envProjectId && envProjectId !== primaryProjectId) {
    console.log(`   Alternatif Proje ID: ${envProjectId}`);
  }

  return {
    db,
    app,
    primaryProjectId,
    effectiveDbId,
    serviceAccount,
    credential
  };
}

/**
 * E-posta Gönderici Servisi (Resend / Nodemailer)
 */
async function sendEmail({ to, subject, html, text }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Bütçem Pro <onboarding@resend.dev>";

  if (resendApiKey) {
    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
      text
    });

    if (error) {
      throw new Error(`Resend API Hatası: ${error.message || JSON.stringify(error)}`);
    }
    return { provider: "resend", id: data?.id };
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Bütçem Pro" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text
    });
    return { provider: "nodemailer", id: info.messageId };
  }

  throw new Error("E-posta sağlayıcısı bulunamadı! Lütfen RESEND_API_KEY veya SMTP ortam değişkenlerini tanımlayın.");
}

/**
 * Kullanıcı dokümanından önceki aya ait gerçek finansal rakamları hesaplar
 */
function calculateUserMonthlyFinances(userData, month, year) {
  const incomes = Array.isArray(userData.incomes) ? userData.incomes : [];
  const expenses = Array.isArray(userData.expenses) ? userData.expenses : [];
  const debts = Array.isArray(userData.debts) ? userData.debts : [];
  const installmentDebts = Array.isArray(userData.installmentDebts) ? userData.installmentDebts : [];
  const payments = Array.isArray(userData.payments) ? userData.payments : [];

  // 1. Toplam Gelir
  let totalIncome = 0;
  incomes.forEach((inc) => {
    const amt = Number(inc.amount) || 0;
    if (amt <= 0) return;
    const p = parseDateParts(inc.date);

    if (inc.isRecurring !== false) {
      if (!p) {
        totalIncome += amt;
      } else {
        const incTime = p.year * 12 + p.month;
        const targetTime = year * 12 + month;
        if (targetTime >= incTime) {
          totalIncome += amt;
        }
      }
    } else {
      if (p && p.year === year && p.month === month) {
        totalIncome += amt;
      }
    }
  });

  // 2. Toplam Gider
  let totalExpense = 0;
  expenses.forEach((exp) => {
    const amt = Number(exp.amount) || 0;
    if (amt <= 0) return;
    const p = parseDateParts(exp.date);

    if (exp.isRecurring === true) {
      if (!p) {
        totalExpense += amt;
      } else {
        const expTime = p.year * 12 + p.month;
        const targetTime = year * 12 + month;
        if (targetTime >= expTime) {
          totalExpense += amt;
        }
      }
    } else {
      if (p && p.year === year && p.month === month) {
        totalExpense += amt;
      }
    }
  });

  // 3. Ödenen Borçlar ve Taksitler
  let paidDebts = 0;

  const hasPaymentLogs = payments.length > 0;
  payments.forEach((pay) => {
    const amt = Number(pay.amount) || 0;
    if (amt <= 0) return;
    const p = parseDateParts(pay.date);
    if (p && p.year === year && p.month === month) {
      paidDebts += amt;
    }
  });

  if (!hasPaymentLogs) {
    debts.forEach((d) => {
      const p = parseDateParts(d.dueDate || d.date);
      if (p && p.year === year && p.month === month) {
        paidDebts += Number(d.paid) || 0;
      }
    });

    installmentDebts.forEach((inst) => {
      const perMonth = (Number(inst.totalAmount) || 0) / (Number(inst.installmentCount) || 1);
      const startP = parseDateParts(inst.firstDueDate);
      if (startP) {
        const startTime = startP.year * 12 + startP.month;
        const targetTime = year * 12 + month;
        const monthDiff = targetTime - startTime;
        if (monthDiff >= 0 && monthDiff < (inst.installmentCount || 1)) {
          if ((inst.paidInstallmentCount || 0) > monthDiff) {
            paidDebts += perMonth;
          }
        }
      }
    });
  }

  const netBalance = totalIncome - totalExpense - paidDebts;

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    paidDebts: Math.round(paidDebts * 100) / 100,
    netBalance: Math.round(netBalance * 100) / 100
  };
}

/**
 * Belirli bir e-posta adresine ait kullanıcı dokümanını doğrudan arar (Fallback / Direct search)
 */
async function findUserByEmailDirectly(db, emailToFind, colName = "users") {
  const targetClean = emailToFind.trim();
  const targetLower = targetClean.toLowerCase();

  // 1. email == targetClean
  try {
    const q1 = await db.collection(colName).where("email", "==", targetClean).get();
    if (!q1.empty) {
      const doc = q1.docs[0];
      return { id: doc.id, ...doc.data() };
    }
  } catch (err) {
    console.error(`❌ [Hata] '${colName}' koleksiyonunda 'email == ${targetClean}' sorgusu başarısız:`, err.message);
    console.error(`   Hata Kodu: ${err.code || 'Bilinmiyor'}`);
    console.error(`   Stack Trace:\n${err.stack || err}`);
  }

  // 2. emailLower == targetLower
  try {
    const q2 = await db.collection(colName).where("emailLower", "==", targetLower).get();
    if (!q2.empty) {
      const doc = q2.docs[0];
      return { id: doc.id, ...doc.data() };
    }
  } catch (err) {
    console.error(`❌ [Hata] '${colName}' koleksiyonunda 'emailLower == ${targetLower}' sorgusu başarısız:`, err.message);
  }

  // 3. email == targetLower
  if (targetClean !== targetLower) {
    try {
      const q3 = await db.collection(colName).where("email", "==", targetLower).get();
      if (!q3.empty) {
        const doc = q3.docs[0];
        return { id: doc.id, ...doc.data() };
      }
    } catch (err) {
      console.error(`❌ [Hata] '${colName}' koleksiyonunda lowercase email sorgusu başarısız:`, err.message);
    }
  }

  // 4. Doğrudan Doküman ID Kontrolü (Doc ID = email veya UID)
  try {
    const docSnap = await db.collection(colName).doc(targetClean).get();
    if (docSnap.exists) {
      return { id: docSnap.id, ...docSnap.data() };
    }
  } catch (err) {
    // docSnap hata logu
  }

  // 5. 'email_' önekli ID kontrolü (Güvenlik kurallarındaki email_ formatı)
  try {
    const safeEmailId = `email_${targetLower.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const docSnap2 = await db.collection(colName).doc(safeEmailId).get();
    if (docSnap2.exists) {
      return { id: docSnap2.id, ...docSnap2.data() };
    }
  } catch (err) {}

  // 6. Koleksiyonu tarama (fallback)
  try {
    const allSnap = await db.collection(colName).limit(100).get();
    for (const doc of allSnap.docs) {
      const data = doc.data() || {};
      const docEmail = String(data.email || data.emailLower || "").trim().toLowerCase();
      if (docEmail === targetLower) {
        return { id: doc.id, ...data };
      }
    }
  } catch (err) {}

  return null;
}

/**
 * Firestore'dan kullanıcıları yükler
 */
async function loadUsersFromFirestore(firebaseContext) {
  if (isMockMode || !firebaseContext) {
    console.log("🧪 [--mock modu aktif] Test amaçlı örnek kullanıcı verileri yükleniyor...");
    return [
      {
        id: "mock_user_1",
        email: targetEmailArg || "info.borcodemetakip@gmail.com",
        userName: "Ahmet Yılmaz",
        isPremium: true,
        incomes: [
          { amount: 50000, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-05`, isRecurring: true },
          { amount: 5000, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-15`, isRecurring: false }
        ],
        expenses: [
          { amount: 18000, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-02`, isRecurring: true },
          { amount: 4500, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-10`, isRecurring: false },
          { amount: 3200, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-20`, isRecurring: false }
        ],
        payments: [
          { amount: 6500, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-12`, type: "debt" },
          { amount: 4800, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-18`, type: "installment" }
        ]
      }
    ];
  }

  const { db, app, primaryProjectId, effectiveDbId, serviceAccount, credential } = firebaseContext;

  // DB bağlantı fallback yardımcısı (5 NOT_FOUND durumunda alternatif DB / Proje dener)
  const getFallbackDb = (altProjectId, altDbId) => {
    try {
      const appName = `alt_${altProjectId}_${altDbId || "default"}`;
      let altApp;
      try {
        altApp = getApp(appName);
      } catch {
        altApp = initializeApp({ credential, projectId: altProjectId }, appName);
      }
      return (altDbId && altDbId !== "(default)") ? getFirestore(altApp, altDbId) : getFirestore(altApp);
    } catch {
      return null;
    }
  };

  // 1. ÖNCELİK: Test kullanıcısı argümanı verilmişse (--user=...)
  if (targetEmailArg) {
    console.log(`🎯 Test Kullanıcısı Modu: '${targetEmailArg}' aranıyor...`);

    // Sırasıyla candidate koleksiyonları dene: 'users', 'kullanicilar', 'profiles'
    for (const col of FALLBACK_COLLECTIONS) {
      console.log(`🔍 '${col}' koleksiyonunda doğrudan test kullanıcısı taranıyor...`);
      try {
        const found = await findUserByEmailDirectly(db, targetEmailArg, col);
        if (found) {
          console.log(`✅ Test kullanıcısı '${col}' koleksiyonunda bulundu: ${found.userName || found.email || found.id}`);
          console.log(`   Veri: ${found.incomes?.length || 0} gelir, ${found.expenses?.length || 0} gider, ${found.debts?.length || 0} borç, ${found.installmentDebts?.length || 0} taksit.`);
          if (!found.email) found.email = targetEmailArg;
          return [found];
        }
      } catch (err) {
        console.error(`❌ [Firestore Sorgu Hatası] Koleksiyon: '${col}', Hedef: '${targetEmailArg}'`);
        console.error(`   Hata Mesajı: ${err.message}`);
        console.error(`   Hata Kodu: ${err.code || 'Bilinmiyor'}`);
        console.error(`   Stack Trace:\n${err.stack || err}`);
      }
    }

    // Alternatif proje ID'si varsa dene (borc-takip-f6936 <-> borc-takip-pro-f6936)
    const altProj = (primaryProjectId.includes("-pro-")) 
      ? primaryProjectId.replace("-pro-", "-") 
      : primaryProjectId.replace("-takip-", "-takip-pro-");

    if (altProj && altProj !== primaryProjectId) {
      console.log(`🔄 Alternatif Proje ID ('${altProj}') ile test kullanıcısı sorgusu deneniyor...`);
      const altDb = getFallbackDb(altProj, effectiveDbId);
      if (altDb) {
        for (const col of FALLBACK_COLLECTIONS) {
          try {
            const found = await findUserByEmailDirectly(altDb, targetEmailArg, col);
            if (found) {
              console.log(`✅ Test kullanıcısı alternatif projede ('${altProj}', '${col}') bulundu!`);
              if (!found.email) found.email = targetEmailArg;
              return [found];
            }
          } catch (altErr) {
            console.error(`❌ [Alternatif Proje Hatası] Proje: '${altProj}', Koleksiyon: '${col}':`, altErr.message);
          }
        }
      }
    }

    console.warn(`⚠️ Veritabanında '${targetEmailArg}' adresine ait kullanıcı kaydı bulunamadı.`);
    console.log(`💡 Test gönderimini tamamlamak için sıfır bakiyeli test şablonu oluşturuluyor.`);
    return [{
      id: "test_" + targetEmailArg.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      email: targetEmailArg,
      userName: targetEmailArg.split("@")[0],
      isPremium: true,
      incomes: [],
      expenses: [],
      debts: [],
      installmentDebts: [],
      payments: []
    }];
  }

  // 2. NORMAL CRON ÇALIŞMASI: Aktif Premium kullanıcılar sorgulanıyor (isPremium == true)
  const users = [];
  let querySucceeded = false;

  for (const colName of FALLBACK_COLLECTIONS) {
    console.log(`🔍 '${colName}' koleksiyonunda aktif Premium kullanıcılar sorgulanıyor (isPremium == true)...`);
    try {
      const snapshot = await db.collection(colName).where("isPremium", "==", true).get();
      querySucceeded = true;
      if (!snapshot.empty) {
        snapshot.forEach((doc) => {
          users.push({ id: doc.id, ...doc.data() });
        });
        console.log(`📊 '${colName}' koleksiyonundan ${snapshot.size} aktif Premium kullanıcı çekildi.`);
        break; // İlk başarılı ve dolu koleksiyonda tamamla
      } else {
        console.log(`ℹ️ '${colName}' koleksiyonunda 'isPremium == true' filtresine uyan kullanıcı bulunamadı.`);
      }
    } catch (err) {
      console.error(`❌ [Firestore Sorgu Hatası] Koleksiyon: '${colName}', Filtre: 'isPremium == true'`);
      console.error(`   Proje ID: ${primaryProjectId}`);
      console.error(`   Database ID: ${effectiveDbId}`);
      console.error(`   Hata Mesajı: ${err.message}`);
      console.error(`   Hata Kodu: ${err.code || 'Bilinmiyor'}`);
      console.error(`   Hata Detayı (Stack Trace):\n${err.stack || err}`);

      if (err.code === 5 || String(err.message).includes("NOT_FOUND")) {
        console.warn(`💡 [5 NOT_FOUND Teşhisi]:
   - '${primaryProjectId}' projesinde '${effectiveDbId}' veritabanı bulunamadı veya henüz oluşturulmadı.
   - Alternatif veritabanı / proje deneniyor...`);
      }
    }
  }

  // Eğer ana sorgular başarısız olduysa ve alternatif proje ID mevcutsa alternatif projeyi dene
  if (!querySucceeded || users.length === 0) {
    const altProj = (primaryProjectId.includes("-pro-")) 
      ? primaryProjectId.replace("-pro-", "-") 
      : primaryProjectId.replace("-takip-", "-takip-pro-");

    if (altProj && altProj !== primaryProjectId) {
      console.log(`🔄 Alternatif Proje ID ('${altProj}') ile toplu sorgu deneniyor...`);
      const altDb = getFallbackDb(altProj, effectiveDbId);
      if (altDb) {
        for (const colName of FALLBACK_COLLECTIONS) {
          try {
            const snap = await altDb.collection(colName).where("isPremium", "==", true).get();
            if (!snap.empty) {
              snap.forEach((doc) => users.push({ id: doc.id, ...doc.data() }));
              console.log(`📊 Alternatif projeden ('${altProj}', '${colName}') ${snap.size} kullanıcı çekildi.`);
              break;
            }
          } catch (altErr) {
            console.error(`❌ [Alternatif Proje Hatası] Proje: '${altProj}', Koleksiyon: '${colName}':`, altErr.message);
          }
        }
      }
    }
  }

  return users;
}

/**
 * Ana Gönderim Döngüsü
 */
async function run() {
  const startTime = Date.now();

  // Firebase Admin SDK ve Firestore bağlantısını kur
  const firebaseContext = initFirebaseAdmin();

  // Kullanıcıları yükle
  const users = await loadUsersFromFirestore(firebaseContext);

  if (!users || users.length === 0) {
    console.log("ℹ️ Gönderilecek aktif kullanıcı bulunamadı.");
    return;
  }

  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    const email = (user.email || user.emailLower || "").trim();
    const userName = user.userName || user.name || user.displayName || user.user || email.split("@")[0] || "Değerli Kullanıcımız";

    if (!email || !email.includes("@")) {
      console.log(`⚠️ Kullanıcı '${userName}' (${user.id}) geçerli bir e-posta adresine sahip değil, atlandı.`);
      skippedCount++;
      continue;
    }

    try {
      // Kullanıcının hedef aya ait gerçek finansal hesaplamasını yap
      const { totalIncome, totalExpense, paidDebts, netBalance } = calculateUserMonthlyFinances(user, targetMonth, targetYear);

      // Dinamik modern HTML şablonunu oluştur
      const emailHtml = generateMonthlyReportEmail({
        user_name: userName,
        report_month: reportMonthTitle,
        total_income: totalIncome,
        total_expense: totalExpense,
        paid_debts: paidDebts,
        net_balance: netBalance
      });

      const subject = `📊 ${reportMonthTitle} Finansal Faaliyet Raporunuz Hazır - Bütçem Pro`;
      const textFallback = `Merhaba ${userName},\n\n${reportMonthTitle} dönemi finansal özetiniz:\n- Toplam Gelir: ₺${totalIncome}\n- Toplam Gider: ₺${totalExpense}\n- Ödenen Borçlar: ₺${paidDebts}\n- Net Kalan Bakiye: ₺${netBalance}\n\nDetayları incelemek için Bütçem Pro'yu ziyaret edin.`;

      if (isDryRun) {
        console.log(`\n🔍 [DRY-RUN] Kullanıcı: ${userName} <${email}>`);
        console.log(`   Gelir: ₺${totalIncome} | Gider: ₺${totalExpense} | Ödenen Borç: ₺${paidDebts} | Net Bakiye: ₺${netBalance}`);
        console.log(`   E-posta Konusu: "${subject}"`);
        successCount++;
      } else {
        console.log(`📧 Gönderiliyor: ${userName} <${email}>...`);
        const result = await sendEmail({
          to: email,
          subject,
          html: emailHtml,
          text: textFallback
        });
        console.log(`✅ Başarıyla iletildi (${result.provider}): ${email} (Mesaj ID: ${result.id || "N/A"})`);
        successCount++;

        // Rate limit sınırlarına takılmamak için kısa bekleme (150ms)
        await new Promise((res) => setTimeout(res, 150));
      }
    } catch (userErr) {
      // HATA TOLERANSI: Tek kullanıcının hatası diğer gönderimleri aksatmaz!
      console.error(`❌ [Hata] '${email}' kullanıcısına rapor gönderilemedi:`, userErr.message);
      console.error(`   Stack Trace:\n${userErr.stack || userErr}`);
      failureCount++;
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n==================================================");
  console.log("🏁 RAPOR GÖNDERİM İŞLEMİ TAMAMLANDI");
  console.log(`⏱️ Süre: ${durationSec} saniye`);
  console.log(`✅ Başarılı Gönderim: ${successCount}`);
  console.log(`❌ Hatalı Gönderim: ${failureCount}`);
  console.log(`⏭️ Atlanan: ${skippedCount}`);
  console.log("==================================================");
}

run().catch((err) => {
  console.error("💥 Kritik betik hatası:", err.message || err);
  if (err.stack) console.error("Stack Trace:\n" + err.stack);
  process.exit(1);
});
