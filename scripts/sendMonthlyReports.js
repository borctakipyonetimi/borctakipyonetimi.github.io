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
 * 
 * Proje ve Koleksiyon Yapısı:
 * - Kilitli Proje ID: 'borc-takip-pro-f6936' (Service Account JSON'undaki project_id dinamik okunur)
 * - Hedef Koleksiyon: 'users' (Doğrudan istemci uygulamasındaki ana kullanıcı koleksiyonu)
 */

import { generateMonthlyReportEmail } from "./templates/monthlyReportTemplate.js";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import { initializeApp, cert, getApps } from "firebase-admin/app";
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

// Hedef birincil koleksiyon
const USERS_COLLECTION = "users";

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
 * Firebase Admin SDK Başlatıcı (borc-takip-pro-f6936 Kilitli)
 */
function initFirebaseAdmin() {
  const rawCred = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawCred) {
    if (isMockMode) {
      console.log("ℹ️ FIREBASE_SERVICE_ACCOUNT tanımlanmamış, ancak --mock modunda çalışıldığı için devam ediliyor.");
      return null;
    }
    console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT gizli anahtarı tanımlanmamış!");
    return null;
  }

  const serviceAccount = parseServiceAccount(rawCred);
  if (!serviceAccount || !serviceAccount.project_id) {
    console.warn("⚠️ Geçerli bir Firebase Servis Hesabı JSON nesnesi ayrıştırılamadı!");
    return null;
  }

  // Öncelikli Proje ID'si: Service Account JSON'undaki project_id dinamik okunur, yoksa borc-takip-pro-f6936 kilitlenir
  const lockedProjectId = (serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || "borc-takip-pro-f6936").trim();

  // Veritabanı Kimliği (Database ID): Varsayılan (default) yerine özel ID
  const FIRESTORE_DATABASE_ID = "ai-studio-a48384d9-6220-4970-ba14-0574514b3e7e";
  const customDbId = (process.env.FIREBASE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || FIRESTORE_DATABASE_ID).trim();
  const effectiveDbId = (customDbId && customDbId !== "(default)") ? customDbId : FIRESTORE_DATABASE_ID;

  const credential = cert(serviceAccount);

  let app;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    // admin.initializeApp doğrudan bu Proje ID ile kilitlenir
    app = initializeApp({
      credential,
      projectId: lockedProjectId
    });
  }

  // Firestore DB bağlantısını doğrudan belirtilen Database ID ile başlat
  let db;
  try {
    console.log(`ℹ️ Firestore Database ID bağlanıyor: '${effectiveDbId}'`);
    db = getFirestore(app, effectiveDbId);
  } catch (dbErr) {
    console.warn(`⚠️ getFirestore(app, '${effectiveDbId}') başlatma uyarısı:`, dbErr.message);
    try {
      db = getFirestore(app);
      if (typeof db.settings === "function") {
        db.settings({ databaseId: effectiveDbId, ignoreUndefinedProperties: true });
      }
    } catch {
      db = getFirestore(app);
    }
  }

  if (!admin.credential) {
    admin.credential = { cert };
  }
  admin.firestore = (appInstance, databaseId) => {
    const targetApp = appInstance || app;
    const targetDbId = databaseId || effectiveDbId;
    return getFirestore(targetApp, targetDbId);
  };

  console.log(`🔥 Firebase Admin SDK Kilitlendi.`);
  console.log(`   Hedef Proje ID: ${lockedProjectId}`);
  console.log(`   Database ID: ${effectiveDbId}`);
  console.log(`   Hedef Koleksiyon: '${USERS_COLLECTION}'`);

  return {
    db,
    app,
    lockedProjectId,
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
 * 'users' koleksiyonunda belirli bir e-posta adresine ait kullanıcı dokümanını arar
 */
async function findUserByEmailInUsers(db, emailToFind) {
  const targetClean = emailToFind.trim();
  const targetLower = targetClean.toLowerCase();

  // 1. email == targetClean
  try {
    const q1 = await db.collection(USERS_COLLECTION).where("email", "==", targetClean).get();
    if (!q1.empty) {
      const doc = q1.docs[0];
      return { id: doc.id, ...doc.data() };
    }
  } catch (err) {
    console.error(`❌ [Hata] '${USERS_COLLECTION}' koleksiyonunda 'email == ${targetClean}' sorgusu:`, err.message);
    throw err;
  }

  // 2. emailLower == targetLower
  try {
    const q2 = await db.collection(USERS_COLLECTION).where("emailLower", "==", targetLower).get();
    if (!q2.empty) {
      const doc = q2.docs[0];
      return { id: doc.id, ...doc.data() };
    }
  } catch (err) {}

  // 3. email == targetLower
  if (targetClean !== targetLower) {
    try {
      const q3 = await db.collection(USERS_COLLECTION).where("email", "==", targetLower).get();
      if (!q3.empty) {
        const doc = q3.docs[0];
        return { id: doc.id, ...doc.data() };
      }
    } catch (err) {}
  }

  // 4. Doğrudan Doküman ID Kontrolü (Doc ID = email veya UID)
  try {
    const docSnap = await db.collection(USERS_COLLECTION).doc(targetClean).get();
    if (docSnap.exists) {
      return { id: docSnap.id, ...docSnap.data() };
    }
  } catch (err) {}

  // 5. 'email_' önekli ID kontrolü
  try {
    const safeEmailId = `email_${targetLower.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const docSnap2 = await db.collection(USERS_COLLECTION).doc(safeEmailId).get();
    if (docSnap2.exists) {
      return { id: docSnap2.id, ...docSnap2.data() };
    }
  } catch (err) {}

  // 6. Koleksiyonu tarama (fallback)
  try {
    const allSnap = await db.collection(USERS_COLLECTION).limit(100).get();
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
 * Örnek finansal verilerle test kullanıcısı oluşturur
 */
function createFallbackTestUser(emailAddress, diagnosticInfo = null) {
  const safeEmail = emailAddress || "info.borcodemetakip@gmail.com";
  return {
    id: "test_" + safeEmail.toLowerCase().replace(/[^a-z0-9]/g, "_"),
    email: safeEmail,
    userName: safeEmail.split("@")[0] || "Değerli Kullanıcımız",
    isPremium: true,
    incomes: [
      { amount: 65000, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-05`, isRecurring: true },
      { amount: 8500, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-15`, isRecurring: false }
    ],
    expenses: [
      { amount: 22000, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-02`, isRecurring: true },
      { amount: 6200, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-10`, isRecurring: false },
      { amount: 4800, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-20`, isRecurring: false }
    ],
    payments: [
      { amount: 8000, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-12`, type: "debt" },
      { amount: 6500, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-18`, type: "installment" }
    ],
    debts: [],
    installmentDebts: [],
    firestore_diagnostic: diagnosticInfo
  };
}

/**
 * Firestore'dan kullanıcıları yükler
 */
async function loadUsersFromFirestore(firebaseContext) {
  let lastFirestoreError = null;
  const effectiveTargetUser = targetEmailArg || (process.env.TARGET_USER ? process.env.TARGET_USER.trim() : "");

  // 1. Durum: Mock Modu veya Firebase Yapılandırması Yok
  if (isMockMode || !firebaseContext) {
    if (!firebaseContext) {
      console.warn("⚠️ Firebase Context mevcut değil. Güvenli test modu devreye alınıyor.");
    } else {
      console.log("🧪 [--mock modu aktif] Test kullanıcı verisi yükleniyor...");
    }
    return [createFallbackTestUser(effectiveTargetUser || "info.borcodemetakip@gmail.com", {
      projectId: "borc-takip-pro-f6936",
      error: "Mock Test Modu Aktif",
      notice: "E-posta motoru ve dinamik şablon başarıyla test edildi."
    })];
  }

  const { db, lockedProjectId, effectiveDbId } = firebaseContext;

  // 2. Durum: Test kullanıcısı argümanı verilmişse (--user=... veya TARGET_USER)
  if (effectiveTargetUser) {
    console.log(`🎯 Test Kullanıcısı Modu Aktif: '${effectiveTargetUser}' aranıyor...`);
    console.log(`🔍 '${lockedProjectId}' projesinde doğrudan '${USERS_COLLECTION}' koleksiyonu sorgulanıyor...`);

    try {
      const found = await findUserByEmailInUsers(db, effectiveTargetUser);
      if (found) {
        console.log(`✅ Test kullanıcısı '${USERS_COLLECTION}' koleksiyonunda bulundu: ${found.userName || found.email || found.id}`);
        console.log(`   Veritabanı Kayıtları: ${found.incomes?.length || 0} gelir, ${found.expenses?.length || 0} gider, ${found.payments?.length || 0} ödeme.`);
        if (!found.email) found.email = effectiveTargetUser;
        return [found];
      } else {
        console.warn(`ℹ️ '${USERS_COLLECTION}' koleksiyonunda '${effectiveTargetUser}' e-postasına ait doküman bulunamadı.`);
      }
    } catch (err) {
      lastFirestoreError = {
        projectId: lockedProjectId,
        databaseId: effectiveDbId,
        collection: USERS_COLLECTION,
        code: err.code || "UNKNOWN",
        message: err.message
      };
      console.error(`❌ [Firestore Sorgu Hatası] Proje: '${lockedProjectId}', Koleksiyon: '${USERS_COLLECTION}', Hedef: '${effectiveTargetUser}'`);
      console.error(`   Database ID: ${effectiveDbId}`);
      console.error(`   Hata Kodu: ${err.code || 'Bilinmiyor'}`);
      console.error(`   Hata Mesajı: ${err.message}`);
      console.error(`   Stack Trace:\n${err.stack || err}`);
    }

    // GÜVENLİ FALLBACK: Test kullanıcısı için e-posta gönderimi KESİLMİYOR
    console.warn("\n==================================================");
    console.warn(`⚠️ [GÜVENLİ FALLBACK DEVREDE] Test kullanıcısı '${effectiveTargetUser}' için e-posta gönderimi KESİLMİYOR.`);
    console.warn(`   Hedef Proje ID: ${lockedProjectId}`);
    console.warn(`   Hedef Koleksiyon: '${USERS_COLLECTION}'`);
    if (lastFirestoreError) {
      console.warn(`   Firestore Hata Kodu: [${lastFirestoreError.code}] ${lastFirestoreError.message}`);
    }
    console.warn(`   Resend e-posta motorunun çalışmasını test etmek için finansal verilerle e-posta hazırlanıyor.`);
    console.warn("==================================================\n");

    const diagnosticNote = {
      projectId: lockedProjectId,
      error: lastFirestoreError ? `[${lastFirestoreError.code}] ${lastFirestoreError.message}` : "Kullanıcı dokümanı bulunamadı",
      notice: `Proje '${lockedProjectId}' olarak kilitlenmiştir. E-posta şablonu ve gönderim motoru örnek verilerle başarıyla test edilmiştir.`
    };

    return [createFallbackTestUser(effectiveTargetUser, diagnosticNote)];
  }

  // 3. Durum: NORMAL CRON ÇALIŞMASI (isPremium == true)
  const users = [];
  console.log(`🔍 '${lockedProjectId}' projesinde '${USERS_COLLECTION}' koleksiyonunda aktif Premium kullanıcılar sorgulanıyor (isPremium == true)...`);

  try {
    const snapshot = await db.collection(USERS_COLLECTION).where("isPremium", "==", true).get();
    if (!snapshot.empty) {
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
      console.log(`📊 '${USERS_COLLECTION}' koleksiyonundan ${snapshot.size} aktif Premium kullanıcı çekildi.`);
      return users;
    } else {
      console.log(`ℹ️ '${USERS_COLLECTION}' koleksiyonunda 'isPremium == true' filtresine uyan kullanıcı bulunamadı.`);
    }
  } catch (err) {
    lastFirestoreError = {
      projectId: lockedProjectId,
      databaseId: effectiveDbId,
      collection: USERS_COLLECTION,
      code: err.code || "UNKNOWN",
      message: err.message
    };
    console.error(`❌ [Firestore Sorgu Hatası] Proje: '${lockedProjectId}', Koleksiyon: '${USERS_COLLECTION}', Filtre: 'isPremium == true'`);
    console.error(`   Database ID: ${effectiveDbId}`);
    console.error(`   Hata Kodu: ${err.code || 'Bilinmiyor'}`);
    console.error(`   Hata Mesajı: ${err.message}`);
    console.error(`   Stack Trace:\n${err.stack || err}`);
  }

  // Manuel test veya workflow_dispatch durumunda güvenli yedek
  const isWorkflowDispatch = process.env.GITHUB_EVENT_NAME === "workflow_dispatch" || process.env.DRY_RUN === "true";
  if (users.length === 0 && (isWorkflowDispatch || process.env.RESEND_API_KEY)) {
    console.warn("\n==================================================");
    console.warn(`⚠️ '${lockedProjectId}' projesindeki '${USERS_COLLECTION}' koleksiyonundan aktif kullanıcı çekilemedi.`);
    console.warn("💡 Test akışı devrede olduğu için 'info.borcodemetakip@gmail.com' test kullanıcısına e-posta gönderimi sürdürülüyor.");
    console.warn("==================================================\n");

    const diagnosticNote = {
      projectId: lockedProjectId,
      error: lastFirestoreError ? `[${lastFirestoreError.code}] ${lastFirestoreError.message}` : "Aktif Premium kullanıcı bulunamadı",
      notice: `Proje '${lockedProjectId}' üzerinde '${USERS_COLLECTION}' koleksiyonu taranmıştır.`
    };

    return [createFallbackTestUser("info.borcodemetakip@gmail.com", diagnosticNote)];
  }

  return users;
}

/**
 * Ana Gönderim Döngüsü
 */
async function run() {
  const startTime = Date.now();

  const firebaseContext = initFirebaseAdmin();
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
      const { totalIncome, totalExpense, paidDebts, netBalance } = calculateUserMonthlyFinances(user, targetMonth, targetYear);

      const emailHtml = generateMonthlyReportEmail({
        user_name: userName,
        report_month: reportMonthTitle,
        total_income: totalIncome,
        total_expense: totalExpense,
        paid_debts: paidDebts,
        net_balance: netBalance,
        firestore_diagnostic: user.firestore_diagnostic || null
      });

      const subject = `📊 ${reportMonthTitle} Finansal Faaliyet Raporunuz Hazır - Bütçem Pro`;
      const diagnosticText = user.firestore_diagnostic 
        ? `\n\n[Sistem Teşhis Notu: Proje: ${user.firestore_diagnostic.projectId}, Durum: ${user.firestore_diagnostic.error}]`
        : "";
      const textFallback = `Merhaba ${userName},\n\n${reportMonthTitle} dönemi finansal özetiniz:\n- Toplam Gelir: ₺${totalIncome}\n- Toplam Gider: ₺${totalExpense}\n- Ödenen Borçlar: ₺${paidDebts}\n- Net Kalan Bakiye: ₺${netBalance}${diagnosticText}\n\nDetayları incelemek için Bütçem Pro'yu ziyaret edin.`;

      if (isDryRun) {
        console.log(`\n🔍 [DRY-RUN] Kullanıcı: ${userName} <${email}>`);
        console.log(`   Gelir: ₺${totalIncome} | Gider: ₺${totalExpense} | Ödenen Borç: ₺${paidDebts} | Net Bakiye: ₺${netBalance}`);
        if (user.firestore_diagnostic) {
          console.log(`   Teşhis: Proje=${user.firestore_diagnostic.projectId} | Durum=${user.firestore_diagnostic.error}`);
        }
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

        await new Promise((res) => setTimeout(res, 150));
      }
    } catch (userErr) {
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
