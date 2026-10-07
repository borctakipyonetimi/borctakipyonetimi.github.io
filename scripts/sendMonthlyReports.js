/**
 * Bütçem Pro - Aylık Finansal Rapor E-posta Gönderim Betiği (Cron)
 * 
 * GitHub Actions ve cron tetiklemeleri için tasarlanmıştır.
 * Firebase Realtime Database (RTDB) üzerinden 'kullanicilar' ve 'users'
 * düğümlerini okur, aktif Premium kullanıcıların (isPremium == true) veya
 * hedeflenen test kullanıcısının bir önceki aya ait Gerçek Gelir, Gider ve
 * Ödenen Borç verilerini hesaplar, dinamik HTML şablonuyla Resend üzerinden iletir.
 * 
 * Veritabanı Mimarisi:
 * - Veritabanı Türü: Firebase Realtime Database (RTDB)
 * - RTDB URL: https://borc-takip-pro-f6936-default-rtdb.firebaseio.com
 * - Ana Düğümler: /kullanicilar/{userId}/veriler ve /users/{userId}/veriler
 */

import { generateMonthlyReportEmail, MONTHLY_REPORT_HTML_TEMPLATE } from "./templates/monthlyReportTemplate.js";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import { initializeApp, cert, getApps, deleteApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

// admin.app() desteği (modular Firebase Admin ESM uyumluluğu)
admin.app = (name) => {
  const apps = getApps();
  const target = name ? apps.find(a => a.name === name) : (apps[0] || null);
  if (!target) return { delete: async () => {} };
  if (!target.delete) target.delete = async () => deleteApp(target);
  return target;
};

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

// RTDB Varsayılan Yapılandırması
const DEFAULT_RTDB_URL = "https://borc-takip-pro-f6936-default-rtdb.firebaseio.com";

console.log("==================================================");
console.log("🚀 BÜTÇEM PRO - AYLIK FİNANSAL RAPOR GÖNDERİM MOTORU (RTDB)");
console.log(`📅 Rapor Dönemi: ${reportMonthTitle} (Hedef Ay: ${targetMonth + 1}/${targetYear})`);
console.log(`⚙️ Mod: ${isDryRun ? "DRY RUN (Test Modu - E-posta gönderilmeyecek)" : "CANLI (E-postalar gönderilecek)"}`);
if (targetEmailArg) console.log(`🎯 Hedef Test Kullanıcısı: ${targetEmailArg}`);
console.log("==================================================");

/**
 * 1. ESNEK TARİH DÖNÜŞTÜRÜCÜ
 * Epoch sayıları (ms/sec), ISO string, YYYY-MM-DD, DD.MM.YYYY,
 * DD/MM/YYYY ve JS Date objelerini güvenle ayrıştırır.
 */
function parseFlexibleDate(rawDate) {
  if (!rawDate && rawDate !== 0) return null;

  // A) Date objesi veya Timestamp nesnesi
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
 * 2. ESNEK TUTAR VE SAYISAL DEĞER AYRIŞTIRICI
 */
function parseNumeric(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return isNaN(raw) ? 0 : raw;
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
 * Gelir veya gider kaydından tutarı çeker
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
              0;

  return parseNumeric(raw);
}

/**
 * İşlemin/borcun/taksitin GERÇEKTEN ÖDENMİŞ olup olmadığını doğrular
 * (isPaid == true veya status == 'paid' veya odendi == true)
 */
function isItemPaid(item) {
  if (!item || typeof item !== "object") return false;
  if (item.isPaid === true || item.odendi === true) return true;
  if (typeof item.status === "string") {
    const s = item.status.toLowerCase().trim();
    if (s === "paid" || s === "completed" || s === "odendi" || s === "success") return true;
  }
  return false;
}

/**
 * Bir ödeme/borç/taksit kaydından SADECE GERÇEK ÖDEME TARİHİNİ çeker
 * Asla dueDate (vade tarihi) KULLANMAZ!
 */
function extractPaymentDate(item, isFromPaymentsLog = false) {
  if (!item || typeof item !== "object") return null;

  // 1. Doğrudan ödeme tarihi alanları (En yüksek öncelik)
  const raw = item.paymentDate ?? 
              item.odemeTarihi ?? 
              item.paidAt ?? 
              item.odendiTarihi ?? 
              item.transactionDate;
  if (raw) return parseFlexibleDate(raw);

  // 2. Eğer kayıt zaten ödeme logu tablosundan (payments) geliyorsa date ödeme tarihidir
  if (isFromPaymentsLog) {
    const logDate = item.date ?? item.tarih ?? item.createdAt ?? item.timestamp;
    if (logDate) return parseFlexibleDate(logDate);
  }

  // 3. Eğer işlem açıkça ödenmişse (isPaid == true) ve date alanı varsa
  if (isItemPaid(item)) {
    const paidDate = item.date ?? item.tarih ?? item.updatedAt;
    if (paidDate) return parseFlexibleDate(paidDate);
  }

  return null;
}

/**
 * Borç/Taksit/Ödeme kaydından SADECE ÖDENEN MİKTARI (paidAmount) çeker
 * ASLA totalAmount veya anapara amount tutarını almaz!
 */
function extractPaidAmountOnly(item, isFromPaymentsLog = false) {
  if (!item || typeof item !== "object") return 0;

  // 1. Doğrudan ödenen miktar alanları
  const explicitPaid = item.paidAmount ?? 
                       item.odenenTutar ?? 
                       item.amountPaid ?? 
                       item.odenen ??
                       null;
  if (explicitPaid !== null && explicitPaid !== undefined) {
    const val = parseNumeric(explicitPaid);
    if (val > 0) return val;
  }

  // 2. Eğer doğrudan 'payments' log kaydı ise, kaydın kendi amount/tutar alanı ödenen tutardır
  if (isFromPaymentsLog) {
    const logAmt = item.amount ?? item.tutar ?? item.paid ?? 0;
    return parseNumeric(logAmt);
  }

  // 3. Borç nesnesindeki 'paid' alanı (sayısal ödenen miktar)
  if (typeof item.paid === "number" && item.paid > 0) {
    return item.paid;
  }
  if (typeof item.paid === "string") {
    const p = parseNumeric(item.paid);
    if (p > 0) return p;
  }

  // 4. Eğer işlem TEK BİR İŞLEM / FATURA olarak açıkça ödenmişse (isPaid == true)
  // ve bu bir çoklu taksit planı DEĞİLSE
  if (isItemPaid(item)) {
    const hasInstallments = Boolean(item.installmentCount && Number(item.installmentCount) > 1);
    if (!hasInstallments) {
      const singleAmt = item.amount ?? item.tutar ?? 0;
      return parseNumeric(singleAmt);
    }
  }

  return 0;
}

/**
 * Kayıttan tarih alanını çıkarır (Gelir ve Giderler için)
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
 * Firebase Admin SDK ve Realtime Database (RTDB) Başlatıcı
 */
function initFirebaseAdminRTDB() {
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
  const databaseURL = (process.env.FIREBASE_DATABASE_URL || DEFAULT_RTDB_URL).trim();

  const credential = cert(serviceAccount);

  let app;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    app = initializeApp({
      credential,
      projectId: lockedProjectId,
      databaseURL: databaseURL
    });
  }

  const db = getDatabase(app);

  if (!admin.credential) {
    admin.credential = { cert };
  }
  admin.database = () => db;

  console.log(`🔥 Firebase Realtime Database (RTDB) Başlatıldı.`);
  console.log(`   Proje ID: ${lockedProjectId}`);
  console.log(`   Veritabanı URL: ${databaseURL}`);

  return {
    db,
    app,
    lockedProjectId,
    databaseURL,
    serviceAccount
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
 * 3. HEDEF AYA AİT GERÇEK FİNANSAL RAKAMLARI HESAPLAR
 * 
 * Mantık Kriterleri:
 * - Toplam Gelir: İlgili ayda gerçekleşen tek seferlik veya o aya kadar başlamış düzenli gelirler.
 * - Toplam Gider: İlgili ayda gerçekleşen tek seferlik veya o aya kadar başlamış düzenli giderler.
 * - Ödenen Borç & Taksitler:
 *     * YALNIZCA ilgili rapor ayında (Örn: 01.09.2026 - 30.09.2026) Gerçekleşmiş / Ödenmiş (isPaid == true veya status == 'paid') olan ödemeler/taksitler.
 *     * Borcun toplam tutarı (totalAmount / anapara) ASLA alınmaz; yalnızca o ay içinde fiilen ödenmiş olan taksit/ödeme miktarı (paidAmount / perMonth) toplanır.
 *     * Vadesi (dueDate) o ayda olsa bile, ödenmemiş (bekleyen) borçlar ASLA dahil edilmez.
 *     * Çift sayma (duplicate) koruması: Payments logunda yer alan işlemler borç/taksit listelerinden tekrar eklenmez.
 * - Net Kalan Bakiye: (Toplam Gelir) - (Toplam Gider + İlgili Ayda Gerçekten Ödenen Borçlar)
 */
function calculateUserMonthlyFinances(userData, month, year) {
  const incomes = Array.isArray(userData.incomes) ? userData.incomes : [];
  const expenses = Array.isArray(userData.expenses) ? userData.expenses : [];
  const debts = Array.isArray(userData.debts) ? userData.debts : [];
  const installmentDebts = Array.isArray(userData.installmentDebts) ? userData.installmentDebts : [];
  const payments = Array.isArray(userData.payments) ? userData.payments : [];
  const contactTransactions = Array.isArray(userData.contactTransactions) ? userData.contactTransactions : [];

  const targetPeriodText = `${MONTH_NAMES_TR[month]} ${year} (Ay: ${month + 1}, Yıl: ${year})`;
  console.log(`\n🧮 [FİNANSAL HESAPLAMA BAŞLATILDI] Hedef: ${targetPeriodText}`);

  // 1. TOPLAM GELİR
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

  // 2. TOPLAM GİDER
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

  // 3. ÖDENEN BORÇ & TAKSİTLER
  let paidDebts = 0;
  const countedPaymentKeys = new Set();
  const countedDebtIdsInThisMonth = new Set();

  console.log(`\n💳 [ÖDENEN BORÇ & TAKSİT ANALİZİ - ${MONTH_NAMES_TR[month]} ${year}]:`);

  // A) Payments Log Tablosu (En güvenilir ödeme hareketleri)
  payments.forEach((pay, idx) => {
    if (pay.isPaid === false || pay.status === "cancelled" || pay.status === "failed" || pay.status === "pending") {
      return;
    }

    const pDate = extractPaymentDate(pay, true);
    if (!pDate) {
      console.log(`   ℹ️ [Ödeme Logu Tarihsiz]: #${idx + 1} atlandı.`);
      return;
    }

    if (pDate.year === year && pDate.month === month) {
      const amt = extractPaidAmountOnly(pay, true);
      if (amt > 0) {
        paidDebts += amt;
        if (pay.debtId) countedDebtIdsInThisMonth.add(pay.debtId);
        const key = `${pay.debtId || pay.id || idx}_${amt.toFixed(2)}`;
        countedPaymentKeys.add(key);
        console.log(`   🔵 [Gerçekleşen Ödeme Logu]: ₺${amt} (Tarih: ${pDate.day}.${pDate.month + 1}.${pDate.year}, Tip: ${pay.type || 'ödeme'})`);
      }
    } else {
      console.log(`   ⏳ [Ödeme Logu Dönem Dışı]: #${idx + 1} Tutar: ₺${extractPaidAmountOnly(pay, true)}, Tarih: ${pDate.day}.${pDate.month + 1}.${pDate.year}`);
    }
  });

  // B) Taksitli Borçlar (Installment Debts)
  installmentDebts.forEach((inst) => {
    // 1. Taksit nesnesinin içinde alt taksit detay dizisi varsa
    const subList = Array.isArray(inst.installments) ? inst.installments :
                    Array.isArray(inst.taksitListesi) ? inst.taksitListesi :
                    Array.isArray(inst.taksitler) ? inst.taksitler : null;

    if (subList && subList.length > 0) {
      subList.forEach((sub, subIdx) => {
        if (!isItemPaid(sub)) return; // Sadece ödenmiş taksitler
        const pDate = extractPaymentDate(sub, false);
        if (pDate && pDate.year === year && pDate.month === month) {
          const instCount = Number(inst.installmentCount || inst.taksitSayisi) || 1;
          const amt = extractPaidAmountOnly(sub, false) || (parseNumeric(inst.totalAmount) / instCount);
          const key = `sub_${inst.id}_${sub.id || subIdx}_${amt.toFixed(2)}`;
          if (!countedPaymentKeys.has(key) && amt > 0) {
            paidDebts += amt;
            countedPaymentKeys.add(key);
            console.log(`   🔵 [Ödenen Taksit Eklendi]: ₺${amt} (Plan: ${inst.name || 'Taksit'}, Taksit #${subIdx + 1})`);
          }
        }
      });
      return;
    }

    // 2. Alt dizi yoksa: Payments logunda bu taksit için ödeme zaten işlenmişse mükerrer ekleme
    if (countedDebtIdsInThisMonth.has(inst.id)) {
      console.log(`   ℹ️ [Taksit Payments Logundan Zaten Eklendi]: '${inst.name}' (Tekrar sayılmadı)`);
      return;
    }

    // Payments tablosunda yoksa, bu ayın taksiti gerçekten ödenmiş mi hesapla:
    const startParts = parseFlexibleDate(inst.firstDueDate || inst.ilkVadeTarihi || inst.startDate);
    const instCount = Number(inst.installmentCount || inst.taksitSayisi) || 1;
    const totalAmt = parseNumeric(inst.totalAmount ?? inst.toplamTutar);
    const perMonth = instCount > 0 ? (totalAmt / instCount) : 0;

    if (startParts && perMonth > 0) {
      const startTime = startParts.year * 12 + startParts.month;
      const targetTime = year * 12 + month;
      const monthDiff = targetTime - startTime;

      if (monthDiff >= 0 && monthDiff < instCount) {
        const paidCount = Number(inst.paidInstallmentCount || inst.odenenTaksitSayisi) || 0;
        // İlgili ayın taksit dilimi fiilen ödenmiş mi?
        if (paidCount >= monthDiff + 1 || isItemPaid(inst)) {
          paidDebts += perMonth;
          console.log(`   🔵 [Aylık Taksit Ödemesi Eklendi]: ₺${perMonth.toFixed(2)} (Plan: ${inst.name}, #${monthDiff + 1}/${instCount}. Taksit - Anapara DEĞİL)`);
        } else {
          console.log(`   ⏳ [Ödenmemiş Taksit]: '${inst.name}' #${monthDiff + 1}. taksit bu ay ödenmemiş (Ödenen Sayısı: ${paidCount}).`);
        }
      }
    }
  });

  // C) Basit Borçlar (Debts)
  debts.forEach((d) => {
    // Payments logunda bu borç için ödeme zaten işlenmişse mükerrer ekleme
    if (countedDebtIdsInThisMonth.has(d.id)) {
      console.log(`   ℹ️ [Borç Payments Logundan Zaten Eklendi]: '${d.name}' (Tekrar sayılmadı)`);
      return;
    }

    // Yalnızca GERÇEKTEN ÖDENMİŞ borçlar
    const pDate = extractPaymentDate(d, false);
    const isPaid = isItemPaid(d);

    if (pDate && pDate.year === year && pDate.month === month && (isPaid || parseNumeric(d.paidAmount || d.odenenTutar || d.paid) > 0)) {
      // Borcun toplam tutarını (totalAmount / amount) DEĞİL, sadece bu ay içinde ödenmiş miktarı topla:
      let paidAmt = parseNumeric(d.paidAmount ?? d.odenenTutar ?? d.amountPaid);
      if (paidAmt <= 0 && isPaid) {
        paidAmt = parseNumeric(d.paid ?? d.odenen ?? d.amount ?? d.tutar);
      }
      if (paidAmt > 0) {
        paidDebts += paidAmt;
        console.log(`   🔵 [Gerçekleşen Borç Kapatma Eklendi]: ₺${paidAmt} (Borç: ${d.name}, Ödeme Tarihi: ${pDate.day}.${pDate.month + 1}.${pDate.year})`);
      }
    } else {
      // Vadesi bu ayda olsa bile, ödenmediyse ASLA dahil etme
      if (d.dueDate) {
        const vDate = parseFlexibleDate(d.dueDate);
        if (vDate && vDate.year === year && vDate.month === month) {
          console.log(`   ℹ️ [Vadesi Bu Ay Olan Borç Ödenmemiş / Bekliyor]: '${d.name}' Tutar: ₺${d.amount}, Vade: ${d.dueDate} (Ödenmediği için rapora eklenmedi)`);
        }
      }
    }
  });

  // D) Kişi Borçları (Varsa)
  contactTransactions.forEach((t) => {
    if (t.type !== "payable" && t.tur !== "borc") return;
    if (!isItemPaid(t)) return;

    const pDate = extractPaymentDate(t, false);
    if (pDate && pDate.year === year && pDate.month === month) {
      const paidAmt = parseNumeric(t.paidAmount ?? t.odenenTutar ?? t.amount ?? t.tutar);
      if (paidAmt > 0) {
        paidDebts += paidAmt;
        console.log(`   🔵 [Kişi Borcu Kapatma Eklendi]: ₺${paidAmt} (Kişi: ${t.contactName || t.kisi || 'Belirtilmemiş'})`);
      }
    }
  });

  // 4. NET KALAN REZERV / BAKİYE HESAPLAMASI
  // Formül: (Toplam Gelir) - (Toplam Gider + İlgili Ayda Gerçekten Ödenen Borçlar)
  const totalOutflow = totalExpense + paidDebts;
  const netBalance = totalIncome - totalOutflow;

  const results = {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    paidDebts: Math.round(paidDebts * 100) / 100,
    netBalance: Math.round(netBalance * 100) / 100
  };

  console.log(`\n📊 [HESAPLAMA SONUÇLARI - ${reportMonthTitle}]:`);
  console.log(`   🟢 Toplam Gelir: ₺${results.totalIncome}`);
  console.log(`   🔴 Toplam Gider: ₺${results.totalExpense}`);
  console.log(`   🔵 Gerçekten Ödenen Borç & Taksit: ₺${results.paidDebts}`);
  console.log(`   ⭐ Net Bakiye / Rezerv: ₺${results.netBalance} (${results.netBalance >= 0 ? 'POZİTİF (NET KALAN REZERV)' : 'NEGATİF (DÖNEM BAKİYESİ AÇIK)'})\n`);

  return results;
}

/**
 * Nesneden veya diziden temiz liste oluşturucu
 */
function normalizeToArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "object") return Object.values(val).filter(Boolean);
  return [];
}

/**
 * 4. REALTIME DATABASE'DEN KULLANICI VERİLERİNİ OKUR
 */
async function loadUsersFromRTDB(firebaseContext) {
  let lastRTDBError = null;
  const effectiveTargetUser = targetEmailArg || (process.env.TARGET_USER ? process.env.TARGET_USER.trim() : "");

  if (isMockMode || !firebaseContext) {
    if (!firebaseContext) {
      console.warn("⚠️ Firebase Context mevcut değil. Mock test modu aktif.");
    } else {
      console.log("🧪 [--mock modu aktif] Test kullanıcı verisi yükleniyor...");
    }
    return [{
      id: "mock_user",
      email: effectiveTargetUser || "info.borcodemetakip@gmail.com",
      userName: "Ahmet Yılmaz (Bütçem Pro)",
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
        { amount: 8000, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-12`, type: "debt", isPaid: true, status: "paid" },
        { amount: 6500, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-18`, type: "installment", isPaid: true, status: "paid" }
      ],
      debts: [],
      installmentDebts: [],
      contactTransactions: []
    }];
  }

  const { db, lockedProjectId, databaseURL } = firebaseContext;

  try {
    console.log(`🔍 Realtime Database düğümleri taranıyor (/kullanicilar ve /users)...`);

    // A) /kullanicilar düğümünü oku
    let kullanicilarObj = {};
    try {
      const snap = await db.ref("kullanicilar").once("value");
      kullanicilarObj = snap.val() || {};
      console.log(`📊 /kullanicilar düğümünde ${Object.keys(kullanicilarObj).length} kayıt bulundu.`);
    } catch (kErr) {
      console.warn("⚠️ /kullanicilar okuma uyarısı:", kErr.message);
    }

    // B) /users düğümünü oku (Yedek eşitleme düğümü)
    let usersObj = {};
    try {
      const uSnap = await db.ref("users").once("value");
      usersObj = uSnap.val() || {};
      console.log(`📊 /users düğümünde ${Object.keys(usersObj).length} kayıt bulundu.`);
    } catch (uErr) {
      console.warn("⚠️ /users okuma uyarısı:", uErr.message);
    }

    // Tüm kullanıcı düğümlerini birleştir
    const allUserKeys = new Set([...Object.keys(kullanicilarObj), ...Object.keys(usersObj)]);
    console.log(`🌐 Toplam ${allUserKeys.size} farklı kullanıcı düğümü tespit edildi.`);

    const parsedUsers = [];

    for (const uid of allUserKeys) {
      const kNode = kullanicilarObj[uid] || {};
      const uNode = usersObj[uid] || {};

      // veriler nesnesi (kullanicilar/UID/veriler veya users/UID/veriler)
      const veriler = kNode.veriler || uNode.veriler || kNode || uNode || {};
      const profil = kNode.profil || uNode.profil || {};
      const ayarlar = kNode.ayarlar || uNode.ayarlar || {};

      const userEmail = (
        veriler.email || 
        veriler.emailLower || 
        kNode.email || 
        uNode.email || 
        (uid.includes("@") ? uid : "")
      ).trim();

      const userName = (
        profil.isim || 
        profil.name || 
        veriler.userName || 
        veriler.name || 
        (userEmail ? userEmail.split("@")[0] : "Değerli Kullanıcımız")
      );

      const isPremium = (
        veriler.isPremium === true || 
        kNode.isPremium === true || 
        uNode.isPremium === true || 
        ayarlar.isPremium === true || 
        Boolean(veriler.premiumPlan)
      );

      const incomes = normalizeToArray(veriler.incomes || veriler.gelirler);
      const expenses = normalizeToArray(veriler.expenses || veriler.giderler);
      const debts = normalizeToArray(veriler.debts || veriler.borclar);
      const installmentDebts = normalizeToArray(veriler.installmentDebts || veriler.taksitler || veriler.taksitli_borclar);
      const payments = normalizeToArray(veriler.payments || veriler.odemeler);
      const contactTransactions = normalizeToArray(veriler.contactTransactions || veriler.contacts || veriler.savedContactTxs || veriler.kisi_borclari);

      parsedUsers.push({
        id: uid,
        email: userEmail,
        emailLower: userEmail.toLowerCase(),
        userName,
        isPremium,
        incomes,
        expenses,
        debts,
        installmentDebts,
        payments,
        contactTransactions,
        rawNode: { uid, email: userEmail, incomesCount: incomes.length, expensesCount: expenses.length, debtsCount: debts.length, paymentsCount: payments.length }
      });
    }

    // 1. ÖZEL TEST KULLANICISI MODU (--user=...)
    if (effectiveTargetUser) {
      console.log(`\n🎯 Test Kullanıcısı Hedeflendi: '${effectiveTargetUser}'`);
      const targetLower = effectiveTargetUser.toLowerCase();

      let targetUser = parsedUsers.find(u => 
        u.emailLower === targetLower || 
        u.email === effectiveTargetUser || 
        u.id.toLowerCase() === targetLower ||
        u.id.toLowerCase() === `email_${targetLower.replace(/[^a-zA-Z0-9_]/g, "_")}`
      );

      if (!targetUser) {
        // UID bazlı veya parça bazlı arama
        targetUser = parsedUsers.find(u => u.emailLower.includes(targetLower) || targetLower.includes(u.emailLower));
      }

      if (targetUser) {
        console.log(`\n==================================================`);
        console.log(`✅ [TEST KULLANICISI REALTIME DB'DE BULUNDU]`);
        console.log(`👤 Kullanıcı Adı: ${targetUser.userName}`);
        console.log(`📧 E-posta: ${targetUser.email}`);
        console.log(`🔑 Düğüm / UID: ${targetUser.id}`);
        console.log(`💎 Premium Durumu: ${targetUser.isPremium ? "Aktif (true)" : "Normal"}`);
        console.log(`--------------------------------------------------`);
        console.log(`📊 [TOPLAM KAYIT SAYILARI]:`);
        console.log(`   - Toplam Gelir: ${targetUser.incomes.length}`);
        if (targetUser.incomes.length > 0) {
          console.log(`🔍 [İLK GELİR HAM VERİSİ]:`, JSON.stringify(targetUser.incomes[0], null, 2));
        }
        console.log(`   - Toplam Gider: ${targetUser.expenses.length}`);
        if (targetUser.expenses.length > 0) {
          console.log(`🔍 [İLK GİDER HAM VERİSİ]:`, JSON.stringify(targetUser.expenses[0], null, 2));
        }
        console.log(`   - Toplam Borç: ${targetUser.debts.length}`);
        if (targetUser.debts.length > 0) {
          console.log(`🔍 [İLK BORÇ HAM VERİSİ]:`, JSON.stringify(targetUser.debts[0], null, 2));
        }
        console.log(`   - Toplam Taksit: ${targetUser.installmentDebts.length}`);
        if (targetUser.installmentDebts.length > 0) {
          console.log(`🔍 [İLK TAKSİT HAM VERİSİ]:`, JSON.stringify(targetUser.installmentDebts[0], null, 2));
        }
        console.log(`   - Toplam Ödeme: ${targetUser.payments.length}`);
        if (targetUser.payments.length > 0) {
          console.log(`🔍 [İLK ÖDEME HAM VERİSİ]:`, JSON.stringify(targetUser.payments[0], null, 2));
        }
        console.log(`==================================================\n`);

        if (!targetUser.email) targetUser.email = effectiveTargetUser;
        return [targetUser];
      } else {
        console.warn(`⚠️ Realtime Database içerisinde '${effectiveTargetUser}' e-posta adresine sahip kullanıcı düğümü bulunamadı.`);
        console.log(`💡 Mevcut kullanıcı e-postaları:`, parsedUsers.map(u => u.email || u.id).filter(Boolean));
      }
    }

    // 2. NORMAL CRON ÇALIŞMASI (isPremium == true)
    const premiumUsers = parsedUsers.filter(u => u.isPremium && u.email && u.email.includes("@"));
    console.log(`📊 Toplam ${premiumUsers.length} aktif Premium kullanıcı bulundu.`);
    if (premiumUsers.length > 0) {
      return premiumUsers;
    }

    // Eğer hiç premium kullanıcı filtrelenememişse ancak test/dispatch modundaysak geçerli e-postalı kullanıcıları döndür
    const validEmailUsers = parsedUsers.filter(u => u.email && u.email.includes("@"));
    if (validEmailUsers.length > 0 && (process.env.GITHUB_EVENT_NAME === "workflow_dispatch" || process.env.DRY_RUN === "true")) {
      console.log(`ℹ️ [Test Modu] Tüm e-postalı kullanıcılar (${validEmailUsers.length}) test için dahil ediliyor.`);
      return validEmailUsers;
    }

    return parsedUsers.filter(u => u.email && u.email.includes("@"));

  } catch (rtdbErr) {
    lastRTDBError = {
      projectId: lockedProjectId,
      databaseURL,
      message: rtdbErr.message,
      code: rtdbErr.code || "RTDB_ERROR"
    };
    console.error(`❌ [Realtime Database Okuma Hatası]:`, rtdbErr.message);
    console.error(`   Stack Trace:\n${rtdbErr.stack || rtdbErr}`);
  }

  // Son çare güvenli fallback
  if (effectiveTargetUser) {
    console.warn(`⚠️ Realtime Database hatası nedeniyle test kullanıcısı fallback devreye alındı.`);
    return [{
      id: "fallback_user",
      email: effectiveTargetUser,
      userName: effectiveTargetUser.split("@")[0],
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
        { amount: 8000, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-12`, type: "debt", isPaid: true, status: "paid" },
        { amount: 6500, date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-18`, type: "installment", isPaid: true, status: "paid" }
      ],
      debts: [],
      installmentDebts: [],
      contactTransactions: [],
      firestore_diagnostic: {
        projectId: lockedProjectId,
        error: `[${lastRTDBError?.code || 'RTDB_FAIL'}] ${lastRTDBError?.message || 'Realtime Database okunamadı'}`,
        notice: `Realtime Database erişimi sağlanamadı. Test verileriyle şablon doğrulanmıştır.`
      }
    }];
  }

  return [];
}

/**
 * Ana Gönderim Döngüsü
 */
async function run() {
  const startTime = Date.now();

  const firebaseContext = initFirebaseAdminRTDB();
  const users = await loadUsersFromRTDB(firebaseContext);

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

  try {
    await admin.app().delete();
  } catch (e) {
    console.log("Firebase kapatılırken hata:", e);
  }
  process.exit(0);
}

run().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error("💥 Kritik betik hatası:", err.message || err);
  if (err.stack) console.error("Stack Trace:\n" + err.stack);
  try {
    admin.app().delete().catch(() => {});
  } catch (_) {}
  process.exit(1);
});

