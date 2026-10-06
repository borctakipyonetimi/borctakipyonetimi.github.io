/**
 * Bütçem Pro - Aylık Finansal Rapor E-posta Gönderim Betiği (Cron)
 * 
 * GitHub Actions ve cron tetiklemeleri için tasarlanmıştır.
 * Aktif Premium kullanıcıların (isPremium == true) bir önceki aya ait
 * Gerçek Gelir, Gider ve Ödenen Borç verilerini derler, dinamik HTML
 * şablonunu oluşturur ve Resend (veya Nodemailer) ile iletir.
 * 
 * Veritabanı Yapılandırması:
 * - Proje ID: 'borc-takip-pro-f6936'
 * - Database ID: 'ai-studio-a48384d9-6220-4970-ba14-0574514b3e7e'
 * - Ana Koleksiyon: 'users' ve ilgili alt koleksiyonlar (incomes, expenses, debts, etc.)
 */

import { generateMonthlyReportEmail } from "./templates/monthlyReportTemplate.js";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

// Firestore Veritabanı ve Koleksiyon Sabitleri
const FIRESTORE_DATABASE_ID = "ai-studio-a48384d9-6220-4970-ba14-0574514b3e7e";
const USERS_COLLECTION = "users";

console.log("==================================================");
console.log("🚀 BÜTÇEM PRO - AYLIK FİNANSAL RAPOR GÖNDERİM MOTORU");
console.log(`📅 Rapor Dönemi: ${reportMonthTitle} (Hedef Ay: ${targetMonth + 1}/${targetYear})`);
console.log(`⚙️ Mod: ${isDryRun ? "DRY RUN (Test Modu - E-posta gönderilmeyecek)" : "CANLI (E-postalar gönderilecek)"}`);
if (targetEmailArg) console.log(`🎯 Hedef Test Kullanıcısı: ${targetEmailArg}`);
console.log("==================================================");

/**
 * 1. ESNEK TARİH DÖNÜŞTÜRÜCÜ
 * Firebase Timestamp (seconds / _seconds), ISO string, YYYY-MM-DD, DD.MM.YYYY,
 * DD/MM/YYYY, epoch sayıları (ms ve sec) ve JS Date objelerini güvenle ayrıştırır.
 */
function parseFlexibleDate(rawDate) {
  if (!rawDate && rawDate !== 0) return null;

  // A) Firebase Timestamp nesnesi veya Date objesi
  if (typeof rawDate === "object") {
    if (typeof rawDate.toDate === "function") {
      try {
        const d = rawDate.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) {
          return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), dateObj: d };
        }
      } catch {}
    }
    const sec = rawDate.seconds ?? rawDate._seconds;
    if (typeof sec === "number") {
      const d = new Date(sec * 1000);
      if (!isNaN(d.getTime())) {
        return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), dateObj: d };
      }
    }
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      return { year: rawDate.getFullYear(), month: rawDate.getMonth(), day: rawDate.getDate(), dateObj: rawDate };
    }
  }

  // B) Epoch zaman damgası (sayı)
  if (typeof rawDate === "number") {
    const ms = rawDate < 10000000000 ? rawDate * 1000 : rawDate;
    const d = new Date(ms);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970 && d.getFullYear() < 2100) {
      return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), dateObj: d };
    }
  }

  // C) String biçimleri
  if (typeof rawDate === "string") {
    let str = rawDate.trim();
    if (!str) return null;

    // Epoch sayısal string (örn: "1726358400000")
    if (/^\d{10,13}$/.test(str)) {
      const num = parseInt(str, 10);
      const ms = num < 10000000000 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), dateObj: d };
      }
    }

    const isoPart = str.split("T")[0].split(" ")[0];

    // YYYY-MM-DD veya YYYY/MM/DD veya YYYY.MM.DD
    const ymdMatch = isoPart.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (ymdMatch) {
      const y = parseInt(ymdMatch[1], 10);
      const m = parseInt(ymdMatch[2], 10) - 1; // 0-indexed
      const d = parseInt(ymdMatch[3], 10);
      if (y > 1900 && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
        return { year: y, month: m, day: d, dateObj: new Date(y, m, d) };
      }
    }

    // DD.MM.YYYY veya DD/MM/YYYY veya DD-MM-YYYY
    const dmyMatch = isoPart.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10) - 1;
      const y = parseInt(dmyMatch[3], 10);
      if (y > 1900 && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
        return { year: y, month: m, day: d, dateObj: new Date(y, m, d) };
      }
    }

    // Standart Date parse
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
        return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), dateObj: d };
      }
    } catch {}
  }

  return null;
}

/**
 * 2. ESNEK TUTAR / MİKTAR ÇIKARICI
 * amount, tutar, price, value, miktar, totalAmount, toplamTutar, paid vb.
 * alanları ve string ("15.000,50 ₺", "1500,50") formatlarını güvenle sayıya çevirir.
 */
function extractAmount(item) {
  if (!item || typeof item !== "object") return 0;

  const raw = item.amount ?? 
              item.tutar ?? 
              item.price ?? 
              item.value ?? 
              item.miktar ?? 
              item.totalAmount ?? 
              item.toplamTutar ?? 
              item.cost ?? 
              item.odenenTutar ?? 
              item.paidAmount ?? 
              item.paid ??
              0;

  if (typeof raw === "number") {
    return isNaN(raw) ? 0 : raw;
  }

  if (typeof raw === "string") {
    let clean = raw.replace(/[^\d.,-]/g, "").trim();
    if (clean.includes(",") && clean.includes(".")) {
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else if (clean.includes(",")) {
      clean = clean.replace(",", ".");
    }
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

/**
 * Kayıttan tarih alanını çıkarır
 */
function extractItemDate(item) {
  if (!item || typeof item !== "object") return null;

  const raw = item.date ?? 
              item.tarih ?? 
              item.dueDate ?? 
              item.vadeTarihi ?? 
              item.firstDueDate ?? 
              item.paymentDate ?? 
              item.odemeTarihi ?? 
              item.createdAt ?? 
              item.olusturmaTarihi ?? 
              item.timestamp ?? 
              item.zaman;

  return parseFlexibleDate(raw);
}

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
 * Firebase Admin SDK Başlatıcı (Kilitli Proje ve Database ID)
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

  const lockedProjectId = (serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || "borc-takip-pro-f6936").trim();
  const customDbId = (process.env.FIREBASE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || FIRESTORE_DATABASE_ID).trim();
  const effectiveDbId = (customDbId && customDbId !== "(default)") ? customDbId : FIRESTORE_DATABASE_ID;

  const credential = cert(serviceAccount);

  let app;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    app = initializeApp({
      credential,
      projectId: lockedProjectId
    });
  }

  let db;
  try {
    console.log(`ℹ️ Firestore Database ID bağlanıyor: '${effectiveDbId}'`);
    db = getFirestore(app, effectiveDbId);
  } catch (dbErr) {
    console.warn(`⚠️ getFirestore(app, '${effectiveDbId}') uyarısı:`, dbErr.message);
    db = getFirestore(app);
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
 * 3. KAPSAMLI KULLANICI FİNANSAL VERİLERİNİ TOPLAYICI
 * Kullanıcı doküman dizilerini, alt koleksiyonlarını (subcollections) ve kök koleksiyonları
 * birleştirip tek bir nesne olarak döndürür.
 */
async function fetchCompleteUserData(db, userDocSnap) {
  const userId = userDocSnap.id;
  const docData = userDocSnap.data() || {};
  const userRef = userDocSnap.ref;

  console.log(`\n==================================================`);
  console.log(`🔍 [KULLANICI VERİLERİ DETAYLI ANALİZİ]`);
  console.log(`👤 Doküman ID: ${userId}`);
  console.log(`📧 E-posta: ${docData.email || docData.emailLower || "Bilinmiyor"}`);
  console.log(`--------------------------------------------------`);

  // A) Ana Doküman Dizileri
  let incomes = Array.isArray(docData.incomes) ? [...docData.incomes] : (Array.isArray(docData.gelirler) ? [...docData.gelirler] : []);
  let expenses = Array.isArray(docData.expenses) ? [...docData.expenses] : (Array.isArray(docData.giderler) ? [...docData.giderler] : []);
  let debts = Array.isArray(docData.debts) ? [...docData.debts] : (Array.isArray(docData.borclar) ? [...docData.borclar] : []);
  let installmentDebts = Array.isArray(docData.installmentDebts) ? [...docData.installmentDebts] : (Array.isArray(docData.taksitler) ? [...docData.taksitler] : []);
  let payments = Array.isArray(docData.payments) ? [...docData.payments] : (Array.isArray(docData.odemeler) ? [...docData.odemeler] : []);

  console.log(`📁 Ana Doküman İçi Veriler:`);
  console.log(`   - incomes: ${incomes.length} kayıt`);
  console.log(`   - expenses: ${expenses.length} kayıt`);
  console.log(`   - debts: ${debts.length} kayıt`);
  console.log(`   - installmentDebts: ${installmentDebts.length} kayıt`);
  console.log(`   - payments: ${payments.length} kayıt`);

  // B) Alt Koleksiyon Kontrolü (Sub-collections: users/{userId}/incomes vb.)
  const checkSubCollection = async (subName) => {
    try {
      const snap = await userRef.collection(subName).get();
      if (!snap.empty) {
        console.log(`   ✨ Alt Koleksiyon Bulundu: 'users/${userId}/${subName}' (${snap.size} doküman)`);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch {}
    return [];
  };

  const subIncomes = await checkSubCollection("incomes");
  const subGelirler = await checkSubCollection("gelirler");
  const subExpenses = await checkSubCollection("expenses");
  const subGiderler = await checkSubCollection("giderler");
  const subDebts = await checkSubCollection("debts");
  const subBorclar = await checkSubCollection("borclar");
  const subInstallments = await checkSubCollection("installmentDebts");
  const subTaksitler = await checkSubCollection("taksitler");
  const subPayments = await checkSubCollection("payments");
  const subOdemeler = await checkSubCollection("odemeler");

  // Alt koleksiyonları ana listeye birleştir
  const mergeById = (existing, incoming) => {
    const map = new Map();
    existing.forEach(item => {
      const key = item.id || JSON.stringify(item);
      map.set(key, item);
    });
    incoming.forEach(item => {
      const key = item.id || JSON.stringify(item);
      map.set(key, item);
    });
    return Array.from(map.values());
  };

  incomes = mergeById(incomes, [...subIncomes, ...subGelirler]);
  expenses = mergeById(expenses, [...subExpenses, ...subGiderler]);
  debts = mergeById(debts, [...subDebts, ...subBorclar]);
  installmentDebts = mergeById(installmentDebts, [...subInstallments, ...subTaksitler]);
  payments = mergeById(payments, [...subPayments, ...subOdemeler]);

  // C) Kök Koleksiyon Kontrolü (root: incomes, expenses where userId == ... veya email == ...)
  const userEmail = docData.email || docData.emailLower || targetEmailArg;
  const checkRootCollection = async (colName) => {
    try {
      const docs = [];
      const qUser = await db.collection(colName).where("userId", "==", userId).get();
      qUser.forEach(d => docs.push({ id: d.id, ...d.data() }));
      if (userEmail) {
        const qEmail = await db.collection(colName).where("email", "==", userEmail).get();
        qEmail.forEach(d => docs.push({ id: d.id, ...d.data() }));
      }
      if (docs.length > 0) {
        console.log(`   ✨ Kök Koleksiyon Bulundu: '${colName}' (${docs.length} doküman)`);
      }
      return docs;
    } catch {
      return [];
    }
  };

  const rootIncomes = await checkRootCollection("incomes");
  const rootGelirler = await checkRootCollection("gelirler");
  const rootExpenses = await checkRootCollection("expenses");
  const rootGiderler = await checkRootCollection("giderler");
  const rootDebts = await checkRootCollection("debts");
  const rootBorclar = await checkRootCollection("borclar");
  const rootInstallments = await checkRootCollection("installmentDebts");
  const rootTaksitler = await checkRootCollection("taksitler");
  const rootPayments = await checkRootCollection("payments");
  const rootOdemeler = await checkRootCollection("odemeler");

  incomes = mergeById(incomes, [...rootIncomes, ...rootGelirler]);
  expenses = mergeById(expenses, [...rootExpenses, ...rootGiderler]);
  debts = mergeById(debts, [...rootDebts, ...rootBorclar]);
  installmentDebts = mergeById(installmentDebts, [...rootInstallments, ...rootTaksitler]);
  payments = mergeById(payments, [...rootPayments, ...rootOdemeler]);

  // D) İLK HAM VERİLERİ TERMİNALE YAZDIR (Debug İsteği 1)
  console.log(`\n📊 [BİRLEŞTİRİLMİŞ TOPLAM KAYIT SAYILARI]:`);
  console.log(`   - Toplam Gelir: ${incomes.length}`);
  if (incomes.length > 0) {
    console.log(`🔍 [İLK GELİR HAM VERİSİ]:`, JSON.stringify(incomes[0], null, 2));
  }
  console.log(`   - Toplam Gider: ${expenses.length}`);
  if (expenses.length > 0) {
    console.log(`🔍 [İLK GİDER HAM VERİSİ]:`, JSON.stringify(expenses[0], null, 2));
  }
  console.log(`   - Toplam Borç: ${debts.length}`);
  if (debts.length > 0) {
    console.log(`🔍 [İLK BORÇ HAM VERİSİ]:`, JSON.stringify(debts[0], null, 2));
  }
  console.log(`   - Toplam Taksit: ${installmentDebts.length}`);
  if (installmentDebts.length > 0) {
    console.log(`🔍 [İLK TAKSİT HAM VERİSİ]:`, JSON.stringify(installmentDebts[0], null, 2));
  }
  console.log(`   - Toplam Ödeme: ${payments.length}`);
  if (payments.length > 0) {
    console.log(`🔍 [İLK ÖDEME HAM VERİSİ]:`, JSON.stringify(payments[0], null, 2));
  }
  console.log(`==================================================\n`);

  return {
    ...docData,
    id: userId,
    email: userEmail,
    incomes,
    expenses,
    debts,
    installmentDebts,
    payments
  };
}

/**
 * 4. HEDEF AYA AİT GERÇEK FİNANSAL RAKAMLARI HESAPLAR
 */
function calculateUserMonthlyFinances(userData, month, year) {
  const incomes = Array.isArray(userData.incomes) ? userData.incomes : [];
  const expenses = Array.isArray(userData.expenses) ? userData.expenses : [];
  const debts = Array.isArray(userData.debts) ? userData.debts : [];
  const installmentDebts = Array.isArray(userData.installmentDebts) ? userData.installmentDebts : [];
  const payments = Array.isArray(userData.payments) ? userData.payments : [];

  const targetPeriodText = `${MONTH_NAMES_TR[month]} ${year} (Ay İndeksi: ${month}, Yıl: ${year})`;
  console.log(`🧮 [FİNANSAL HESAPLAMA BAŞLATILDI] Hedef: ${targetPeriodText}`);

  // 1. Toplam Gelir
  let totalIncome = 0;
  incomes.forEach((inc, idx) => {
    const amt = extractAmount(inc);
    if (amt <= 0) return;
    const p = extractItemDate(inc);
    const isRecurring = inc.isRecurring !== false && inc.duzenli !== false && inc.tekrarlayan !== false;

    if (isRecurring) {
      if (!p) {
        totalIncome += amt;
        console.log(`   🟢 [Düzenli Gelir Eklendi]: ₺${amt} (Tarihsiz düzenli gelir)`);
      } else {
        const incTime = p.year * 12 + p.month;
        const targetTime = year * 12 + month;
        if (targetTime >= incTime) {
          totalIncome += amt;
          console.log(`   🟢 [Düzenli Gelir Eklendi]: ₺${amt} (Başlangıç: ${p.day}.${p.month + 1}.${p.year})`);
        } else {
          console.log(`   ⏳ [İleri Tarihli Düzenli Gelir]: ₺${amt} (Başlangıç: ${p.day}.${p.month + 1}.${p.year} > Hedef)`);
        }
      }
    } else {
      if (p && p.year === year && p.month === month) {
        totalIncome += amt;
        console.log(`   🟢 [Tek Seferlik Gelir Eklendi]: ₺${amt} (Tarih: ${p.day}.${p.month + 1}.${p.year})`);
      } else {
        console.log(`   ℹ️ [Gelir Dönem Dışı]: #${idx + 1} Tutar: ₺${amt}, Tarih: ${p ? `${p.day}.${p.month + 1}.${p.year}` : 'Geçersiz'}`);
      }
    }
  });

  // 2. Toplam Gider
  let totalExpense = 0;
  expenses.forEach((exp, idx) => {
    const amt = extractAmount(exp);
    if (amt <= 0) return;
    const p = extractItemDate(exp);
    const isRecurring = exp.isRecurring === true || exp.duzenli === true || exp.tekrarlayan === true;

    if (isRecurring) {
      if (!p) {
        totalExpense += amt;
        console.log(`   🔴 [Düzenli Gider Eklendi]: ₺${amt} (Tarihsiz düzenli gider)`);
      } else {
        const expTime = p.year * 12 + p.month;
        const targetTime = year * 12 + month;
        if (targetTime >= expTime) {
          totalExpense += amt;
          console.log(`   🔴 [Düzenli Gider Eklendi]: ₺${amt} (Başlangıç: ${p.day}.${p.month + 1}.${p.year})`);
        } else {
          console.log(`   ⏳ [İleri Tarihli Düzenli Gider]: ₺${amt} (Başlangıç: ${p.day}.${p.month + 1}.${p.year} > Hedef)`);
        }
      }
    } else {
      if (p && p.year === year && p.month === month) {
        totalExpense += amt;
        console.log(`   🔴 [Tek Seferlik Gider Eklendi]: ₺${amt} (Tarih: ${p.day}.${p.month + 1}.${p.year})`);
      } else {
        console.log(`   ℹ️ [Gider Dönem Dışı]: #${idx + 1} Tutar: ₺${amt}, Tarih: ${p ? `${p.day}.${p.month + 1}.${p.year}` : 'Geçersiz'}`);
      }
    }
  });

  // 3. Ödenen Borçlar ve Taksitler
  let paidDebts = 0;

  // Payments kayıtları
  payments.forEach((pay, idx) => {
    const amt = extractAmount(pay);
    if (amt <= 0) return;
    const p = extractItemDate(pay);
    if (p && p.year === year && p.month === month) {
      paidDebts += amt;
      console.log(`   🔵 [Ödeme Eklendi]: ₺${amt} (Tarih: ${p.day}.${p.month + 1}.${p.year})`);
    } else {
      console.log(`   ℹ️ [Ödeme Dönem Dışı]: #${idx + 1} Tutar: ₺${amt}, Tarih: ${p ? `${p.day}.${p.month + 1}.${p.year}` : 'Geçersiz'}`);
    }
  });

  // Basit borçlar (Eğer detaylı payment logu bu borç için yoksa)
  debts.forEach((d) => {
    const p = extractItemDate(d);
    const paidAmt = extractAmount({ amount: d.paid ?? d.odenen ?? d.odenenTutar ?? 0 });
    if (p && p.year === year && p.month === month && paidAmt > 0) {
      paidDebts += paidAmt;
      console.log(`   🔵 [Borç Ödemesi Eklendi]: ₺${paidAmt} (Vade: ${p.day}.${p.month + 1}.${p.year})`);
    }
  });

  // Taksitler
  installmentDebts.forEach((inst) => {
    const totalInstAmt = extractAmount(inst);
    const instCount = Number(inst.installmentCount || inst.taksitSayisi) || 1;
    const perMonth = totalInstAmt / instCount;
    const startP = extractItemDate({ date: inst.firstDueDate || inst.ilkVadeTarihi || inst.date || inst.startDate });

    if (startP) {
      const startTime = startP.year * 12 + startP.month;
      const targetTime = year * 12 + month;
      const monthDiff = targetTime - startTime;
      if (monthDiff >= 0 && monthDiff < instCount) {
        const paidCount = Number(inst.paidInstallmentCount || inst.odenenTaksitSayisi) || 0;
        if (paidCount > monthDiff) {
          paidDebts += perMonth;
          console.log(`   🔵 [Taksit Ödemesi Eklendi]: ₺${perMonth.toFixed(2)} (Taksit #${monthDiff + 1}/${instCount})`);
        }
      }
    }
  });

  const netBalance = totalIncome - totalExpense - paidDebts;

  const results = {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    paidDebts: Math.round(paidDebts * 100) / 100,
    netBalance: Math.round(netBalance * 100) / 100
  };

  console.log(`\n📊 [HESAPLAMA SONUÇLARI]:`);
  console.log(`   🟢 Toplam Gelir: ₺${results.totalIncome}`);
  console.log(`   🔴 Toplam Gider: ₺${results.totalExpense}`);
  console.log(`   🔵 Ödenen Borç: ₺${results.paidDebts}`);
  console.log(`   ⭐ Net Bakiye: ₺${results.netBalance}\n`);

  return results;
}

/**
 * 'users' koleksiyonunda hedef e-posta adresini arar
 */
async function findUserDocByEmail(db, emailToFind) {
  const targetClean = emailToFind.trim();
  const targetLower = targetClean.toLowerCase();

  // 1. email == targetClean
  try {
    const q1 = await db.collection(USERS_COLLECTION).where("email", "==", targetClean).get();
    if (!q1.empty) return q1.docs[0];
  } catch (err) {
    console.error(`❌ [Hata] '${USERS_COLLECTION}' koleksiyonunda 'email == ${targetClean}' sorgusu:`, err.message);
    throw err;
  }

  // 2. emailLower == targetLower
  try {
    const q2 = await db.collection(USERS_COLLECTION).where("emailLower", "==", targetLower).get();
    if (!q2.empty) return q2.docs[0];
  } catch (err) {}

  // 3. email == targetLower
  if (targetClean !== targetLower) {
    try {
      const q3 = await db.collection(USERS_COLLECTION).where("email", "==", targetLower).get();
      if (!q3.empty) return q3.docs[0];
    } catch (err) {}
  }

  // 4. Doğrudan Doküman ID (Doc ID = email veya UID)
  try {
    const docSnap = await db.collection(USERS_COLLECTION).doc(targetClean).get();
    if (docSnap.exists) return docSnap;
  } catch (err) {}

  // 5. 'email_' önekli ID (src/App.tsx içerisindeki format)
  try {
    const safeEmailId = `email_${targetLower.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const docSnap2 = await db.collection(USERS_COLLECTION).doc(safeEmailId).get();
    if (docSnap2.exists) return docSnap2;
  } catch (err) {}

  // 6. Koleksiyonu tara
  try {
    const allSnap = await db.collection(USERS_COLLECTION).limit(100).get();
    for (const doc of allSnap.docs) {
      const data = doc.data() || {};
      const docEmail = String(data.email || data.emailLower || "").trim().toLowerCase();
      if (docEmail === targetLower) return doc;
    }
  } catch (err) {}

  return null;
}

/**
 * Örnek finansal verilerle test kullanıcısı oluşturur (Son çare fallback)
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

  if (isMockMode || !firebaseContext) {
    if (!firebaseContext) {
      console.warn("⚠️ Firebase Context mevcut değil. Mock test modu aktif.");
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

  // 1. Durum: Hedef test kullanıcısı argümanı verilmişse
  if (effectiveTargetUser) {
    console.log(`🎯 Test Kullanıcısı Modu Aktif: '${effectiveTargetUser}' aranıyor...`);
    console.log(`🔍 '${lockedProjectId}' projesinde ('${effectiveDbId}') doğrudan '${USERS_COLLECTION}' koleksiyonu taranıyor...`);

    try {
      const userDocSnap = await findUserDocByEmail(db, effectiveTargetUser);
      if (userDocSnap) {
        console.log(`✅ Test kullanıcısı dokümanı '${USERS_COLLECTION}' koleksiyonunda bulundu: ${userDocSnap.id}`);
        // Kullanıcının alt koleksiyonlarını ve ana doküman verilerini eksiksiz çek
        const completeUserData = await fetchCompleteUserData(db, userDocSnap);
        return [completeUserData];
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
      console.error(`❌ [Firestore Sorgu Hatası] Proje: '${lockedProjectId}', Database: '${effectiveDbId}', Koleksiyon: '${USERS_COLLECTION}'`);
      console.error(`   Hata Kodu: ${err.code || 'Bilinmiyor'}`);
      console.error(`   Hata Mesajı: ${err.message}`);
      console.error(`   Stack Trace:\n${err.stack || err}`);
    }

    // GÜVENLİ FALLBACK: Kullanıcı dokümanı bulunamazsa veya hata olursa e-posta sürecini KESME
    console.warn("\n==================================================");
    console.warn(`⚠️ [GÜVENLİ FALLBACK DEVREDE] Test kullanıcısı '${effectiveTargetUser}' için e-posta gönderimi KESİLMİYOR.`);
    console.warn(`   Hedef Proje: ${lockedProjectId}`);
    console.warn(`   Database ID: ${effectiveDbId}`);
    if (lastFirestoreError) {
      console.warn(`   Firestore Hata Kodu: [${lastFirestoreError.code}] ${lastFirestoreError.message}`);
    }
    console.warn(`   Resend e-posta motorunun çalışmasını test etmek için finansal verilerle e-posta hazırlanıyor.`);
    console.warn("==================================================\n");

    const diagnosticNote = {
      projectId: lockedProjectId,
      error: lastFirestoreError ? `[${lastFirestoreError.code}] ${lastFirestoreError.message}` : "Kullanıcı dokümanı bulunamadı",
      notice: `Proje '${lockedProjectId}' (${effectiveDbId}) üzerinde '${USERS_COLLECTION}' koleksiyonu sorgulanmıştır.`
    };

    return [createFallbackTestUser(effectiveTargetUser, diagnosticNote)];
  }

  // 2. Durum: NORMAL CRON ÇALIŞMASI (isPremium == true)
  const users = [];
  console.log(`🔍 '${lockedProjectId}' projesinde '${USERS_COLLECTION}' koleksiyonunda aktif Premium kullanıcılar sorgulanıyor (isPremium == true)...`);

  try {
    const snapshot = await db.collection(USERS_COLLECTION).where("isPremium", "==", true).get();
    if (!snapshot.empty) {
      console.log(`📊 '${USERS_COLLECTION}' koleksiyonundan ${snapshot.size} aktif Premium kullanıcı bulundu. Alt koleksiyonlar derleniyor...`);
      for (const docSnap of snapshot.docs) {
        const fullUser = await fetchCompleteUserData(db, docSnap);
        users.push(fullUser);
      }
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
    console.error(`❌ [Firestore Sorgu Hatası] Proje: '${lockedProjectId}', Database: '${effectiveDbId}', Filtre: 'isPremium == true'`);
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
      notice: `Proje '${lockedProjectId}' (${effectiveDbId}) üzerinde '${USERS_COLLECTION}' koleksiyonu taranmıştır.`
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
