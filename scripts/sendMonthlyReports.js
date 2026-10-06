/**
 * Bütçem Pro - Aylık Finansal Rapor E-posta Gönderim Betiği (Cron)
 * 
 * GitHub Actions ve cron tetiklemeleri için tasarlanmıştır.
 * Her ayın 1'inde çalışarak aktif Premium kullanıcıların (isPremium == true)
 * bir önceki aya ait Gerçek Gelir, Gider ve Ödenen Borç verilerini derler,
 * dinamik HTML şablonunu oluşturur ve Resend (veya Nodemailer) ile iletir.
 */

import { generateMonthlyReportEmail } from "./templates/monthlyReportTemplate.js";
import { Resend } from "resend";
import nodemailer from "nodemailer";

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

// CLI argümanlarını ayrıştır
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run") || process.env.DRY_RUN === "true";
const targetEmailArg = (args.find(a => a.startsWith("--user=")) || "").replace("--user=", "").trim();
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
if (targetEmailArg) console.log(`🎯 Hedef Test Kullanıcısı: ${targetEmailArg}`);
console.log("==================================================");

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

  // Eğer detaylı payments logu tutulmamışsa basit borç ve taksitlerden dönemsel ödenenleri ekle
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
 * Firestore'dan kullanıcıları yükler
 */
async function loadPremiumUsers() {
  if (args.includes("--mock")) {
    console.log("🧪 [--mock bayrağı aktif] Test amaçlı örnek kullanıcı verileri yükleniyor...");
    return [
      {
        id: "mock_user_1",
        email: targetEmailArg || "test.kullanici@example.com",
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

  // 1. Firebase Admin SDK Kontrolü (Servis Hesabı Varsa)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const admin = await import("firebase-admin");
      let credential;
      let rawCred = process.env.FIREBASE_SERVICE_ACCOUNT.trim();

      // Base64 kodlanmışsa çöz
      if (!rawCred.startsWith("{") && !rawCred.includes("\n")) {
        try {
          rawCred = Buffer.from(rawCred, "base64").toString("utf-8");
        } catch {}
      }

      if (rawCred.startsWith("{")) {
        credential = admin.default.credential.cert(JSON.parse(rawCred));
      } else {
        credential = admin.default.credential.cert(rawCred);
      }

      if (!admin.default.apps.length) {
        admin.default.initializeApp({ credential });
      }

      const db = admin.default.firestore();
      
      // 10 saniye zaman aşımı koruması
      const snapshotPromise = db.collection("users").where("isPremium", "==", true).get();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Firestore bağlantı zaman aşımı (10s)")), 10000)
      );

      const snapshot = await Promise.race([snapshotPromise, timeoutPromise]);
      const users = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
      console.log(`[Firebase Admin] ${users.length} aktif Premium kullanıcı çekildi.`);
      return users;
    } catch (adminErr) {
      console.warn("[Firebase Admin] Başlatma/okuma uyarısı:", adminErr.message);
    }
  }

  // 2. Firebase Client SDK Kontrolü (Zaman aşımı korumalı)
  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getFirestore, collection, query, where, getDocs } = await import("firebase/firestore");

    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDnMbBVsN37dGjNEYSL4XJnWVBIeiF1F4c",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || "borc-takip-pro-f6936.firebaseapp.com",
      projectId: process.env.FIREBASE_PROJECT_ID || "borc-takip-pro-f6936"
    };

    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const q = query(collection(db, "users"), where("isPremium", "==", true));
    const queryPromise = getDocs(q);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Firestore Client zaman aşımı (8s)")), 8000)
    );

    const querySnapshot = await Promise.race([queryPromise, timeoutPromise]);
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });

    console.log(`[Firebase Client] ${users.length} aktif Premium kullanıcı çekildi.`);
    return users;
  } catch (clientErr) {
    console.warn("[Firebase Client] Veri çekme uyarısı:", clientErr.message);
  }

  return [];
}

/**
 * Ana Gönderim Döngüsü
 */
async function run() {
  const startTime = Date.now();
  const users = await loadPremiumUsers();

  if (!users || users.length === 0) {
    console.log("ℹ️ Gönderilecek aktif Premium kullanıcı bulunamadı.");
    return;
  }

  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    const email = (user.email || "").trim();
    const userName = user.userName || user.name || user.displayName || user.user || email.split("@")[0] || "Değerli Kullanıcımız";

    if (!email || !email.includes("@")) {
      console.log(`⚠️ Kullanıcı '${userName}' (${user.id}) geçerli bir e-posta adresine sahip değil, atlandı.`);
      skippedCount++;
      continue;
    }

    if (targetEmailArg && email.toLowerCase() !== targetEmailArg.toLowerCase()) {
      skippedCount++;
      continue;
    }

    try {
      // Kullanıcının ilgili aya ait hesaplamasını yap
      const { totalIncome, totalExpense, paidDebts, netBalance } = calculateUserMonthlyFinances(user, targetMonth, targetYear);

      // Dinamik HTML şablonunu oluştur
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
        console.log(`✅ Başarıyla iletildi (${result.provider}): ${email} (ID: ${result.id || "N/A"})`);
        successCount++;

        // Hız sınırlamasını (rate limit) önlemek için kısa bekleme (150ms)
        await new Promise((res) => setTimeout(res, 150));
      }
    } catch (userErr) {
      // HATA TOLERANSI: Tek kullanıcının hatası tüm süreci durdurmaz!
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
  console.error("💥 Kritik betik hatası:", err);
  process.exit(1);
});
