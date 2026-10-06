/**
 * Bütçem Pro - Aylık Finansal Rapor E-posta Gönderim Betiği (Cron)
 * 
 * GitHub Actions ve cron tetiklemeleri için tasarlanmıştır.
 * Her ayın 1'inde çalışarak aktif Premium kullanıcıların (isPremium == true)
 * bir önceki aya ait Gerçek Gelir, Gider ve Ödenen Borç verilerini derler,
 * dinamik HTML şablonunu oluşturur ve Resend (veya Nodemailer) ile iletir.
 * 
 * NOT: Bu betik sunucu ortamında (GitHub Actions) çalıştığı için sadece
 * ve doğrudan Firebase Admin SDK (firebase-admin) kullanır.
 * Client SDK (firebase/firestore) tamamen kaldırılmıştır.
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

// Hedef kullanıcı (--user=... veya TARGET_USER env)
let rawTargetUser = (
  args.find(a => a.startsWith("--user="))?.replace("--user=", "") ||
  process.env.TARGET_USER ||
  ""
).trim();
// Tırnak işaretlerini temizle
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

console.log("==================================================");
console.log("🚀 BÜTÇEM PRO - AYLIK FİNANSAL RAPOR GÖNDERİM MOTORU");
console.log(`📅 Rapor Dönemi: ${reportMonthTitle} (Ay: ${targetMonth + 1}, Yıl: ${targetYear})`);
console.log(`⚙️ Mod: ${isDryRun ? "DRY RUN (Test Modu - E-posta gönderilmeyecek)" : "CANLI (E-postalar gönderilecek)"}`);
if (targetEmailArg) console.log(`🎯 Hedef Test Kullanıcısı Önceliği: ${targetEmailArg}`);
console.log("==================================================");

/**
 * Güvenli Servis Hesabı Ayrıştırıcı
 * String, Base64 veya escape edilmiş JSON biçimlerini sorunsuz parse eder.
 */
function parseServiceAccount(rawCred) {
  if (!rawCred) return null;
  let str = String(rawCred).trim();

  // Tırnak işaretiyle sarılmışsa kaldır
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.substring(1, str.length - 1).trim();
  }

  // Base64 kodlanmışsa çöz
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
    // Private key içindeki kaçış karakterlerini (\n) gerçek alt satırlara dönüştür
    if (parsed.private_key && typeof parsed.private_key === "string" && parsed.private_key.includes("\\n")) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (err) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT JSON parse hatası: ${err.message}`);
  }
}

/**
 * Firebase Admin SDK Başlatıcı (Firestore Bağlantısı)
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

  const credential = cert(serviceAccount);

  const existingApps = getApps();
  const app = existingApps.length > 0 
    ? existingApps[0] 
    : initializeApp({
        credential,
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || "borc-takip-pro-f6936"
      });

  const db = getFirestore(app);

  // admin nesnesi geriye dönük uyumluluk köprüsü
  if (!admin.credential) {
    admin.credential = { cert };
  }
  if (!admin.firestore) {
    admin.firestore = () => db;
  }

  console.log(`🔥 Firebase Admin SDK ve Firestore başarıyla başlatıldı (Proje: ${serviceAccount.project_id}).`);
  return db;
}

/**
 * E-posta Gönderici Servisi
 * Resend API Key varsa Resend üzerinden, yoksa Nodemailer SMTP üzerinden gönderir.
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

  // Nodemailer Fallback (SMTP)
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
      // Düzenli gelirler: Başlangıç ayı veya öncesindeyse her aya yansır
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
      // Tek seferlik gelirler: Tam o aya ait olmalı
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
      // Düzenli giderler
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
      // Normal giderler
      if (p && p.year === year && p.month === month) {
        totalExpense += amt;
      }
    }
  });

  // 3. Ödenen Borçlar ve Taksitler
  let paidDebts = 0;

  // Payments kayıtlarından hedef ayda yapılmış ödemeleri topla
  const hasPaymentLogs = payments.length > 0;
  payments.forEach((pay) => {
    const amt = Number(pay.amount) || 0;
    if (amt <= 0) return;
    const p = parseDateParts(pay.date);
    if (p && p.year === year && p.month === month) {
      paidDebts += amt;
    }
  });

  // Detaylı payments logu tutulmamışsa basit borç ve taksitlerden dönemsel ödenenleri ekle
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
 * Firestore'dan kullanıcıları yükler (Admin SDK)
 */
async function loadUsersFromFirestore(db) {
  if (isMockMode || !db) {
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

  // 1. ÖNCELİK: Test kullanıcısı argümanı verilmişse (--user=...)
  if (targetEmailArg) {
    console.log(`🎯 Test Kullanıcısı Sorgusu: '${targetEmailArg}' Firestore'dan aranıyor...`);
    const targetClean = targetEmailArg.trim();
    const targetLower = targetClean.toLowerCase();

    const matchedUsers = [];

    // A) email alanına göre doğrudan eşleşme
    try {
      const q1 = await db.collection("users").where("email", "==", targetClean).get();
      q1.forEach(doc => matchedUsers.push({ id: doc.id, ...doc.data() }));
    } catch (e1) {
      console.warn("⚠️ email sorgusu:", e1.message);
    }

    // B) emailLower alanına göre eşleşme
    if (matchedUsers.length === 0) {
      try {
        const q2 = await db.collection("users").where("emailLower", "==", targetLower).get();
        q2.forEach(doc => matchedUsers.push({ id: doc.id, ...doc.data() }));
      } catch (e2) {
        console.warn("⚠️ emailLower sorgusu:", e2.message);
      }
    }

    // C) Küçük harf ile email sorgusu
    if (matchedUsers.length === 0 && targetClean !== targetLower) {
      try {
        const q3 = await db.collection("users").where("email", "==", targetLower).get();
        q3.forEach(doc => matchedUsers.push({ id: doc.id, ...doc.data() }));
      } catch (e3) {
        console.warn("⚠️ lowercase email sorgusu:", e3.message);
      }
    }

    // D) Doküman ID veya tüm kullanıcılar içinde arama (Geniş fallback)
    if (matchedUsers.length === 0) {
      console.log(`ℹ️ Doğrudan index eşleşmedi, doküman ID veya koleksiyon içi arama yapılıyor...`);
      try {
        // Doküman doğrudan ID olabilir
        const docById = await db.collection("users").doc(targetClean).get();
        if (docById.exists) {
          matchedUsers.push({ id: docById.id, ...docById.data() });
        }
      } catch {}

      if (matchedUsers.length === 0) {
        const allSnap = await db.collection("users").get();
        allSnap.forEach(doc => {
          const d = doc.data() || {};
          const docEmail = String(d.email || d.emailLower || "").trim().toLowerCase();
          if (docEmail === targetLower || doc.id.toLowerCase() === targetLower) {
            matchedUsers.push({ id: doc.id, ...d });
          }
        });
      }
    }

    if (matchedUsers.length > 0) {
      const user = matchedUsers[0];
      console.log(`✅ Test kullanıcısı Firestore'da bulundu: ${user.userName || user.email || user.id}`);
      console.log(`   Veritabanı Kayıtları: ${user.incomes?.length || 0} gelir, ${user.expenses?.length || 0} gider, ${user.debts?.length || 0} borç, ${user.installmentDebts?.length || 0} taksit, ${user.payments?.length || 0} ödeme.`);
      // Test kullanıcısına garanti e-posta adresi ata
      if (!user.email) user.email = targetClean;
      return [user];
    } else {
      console.warn(`⚠️ Veritabanında '${targetEmailArg}' adresine ait kullanıcı dokümanı bulunamadı.`);
      console.log(`💡 Hedef adrese sıfır bakiyeli test şablonu iletilecektir.`);
      return [{
        id: "test_" + targetLower,
        email: targetClean,
        userName: targetClean.split("@")[0],
        isPremium: true,
        incomes: [],
        expenses: [],
        debts: [],
        installmentDebts: [],
        payments: []
      }];
    }
  }

  // 2. NORMAL CRON ÇALIŞMASI: Aktif Premium kullanıcılar (isPremium == true)
  console.log("🔍 Aktif Premium kullanıcılar sorgulanıyor (isPremium == true)...");
  const snapshot = await db.collection("users").where("isPremium", "==", true).get();
  const users = [];
  snapshot.forEach((doc) => {
    users.push({ id: doc.id, ...doc.data() });
  });

  console.log(`📊 Toplam ${users.length} aktif Premium kullanıcı çekildi.`);
  return users;
}

/**
 * Ana Gönderim Döngüsü
 */
async function run() {
  const startTime = Date.now();

  // Firebase Admin Firestore bağlantısını kur
  const db = initFirebaseAdmin();

  // Kullanıcıları yükle
  const users = await loadUsersFromFirestore(db);

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

        // Resend rate limit sınırlarına takılmamak için kısa bekleme (150ms)
        await new Promise((res) => setTimeout(res, 150));
      }
    } catch (userErr) {
      // HATA TOLERANSI: Tek kullanıcının hatası diğer gönderimleri aksatmaz!
      console.error(`❌ [Hata] '${email}' kullanıcısına rapor gönderilemedi:`, userErr.message);
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
  process.exit(1);
});
