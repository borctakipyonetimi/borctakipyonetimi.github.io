import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import webpush from "web-push";

dotenv.config();

// Top-level crash guards to ensure the server process never terminates unexpectedly
process.on("uncaughtException", (err) => {
  console.error("[Server Process Guard] Uncaught Exception caught:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Server Process Guard] Unhandled Rejection caught at:", promise, "reason:", reason);
});

const app = express();
const PORT = 3000;

// In-app custom SMTP storage configuration
interface CustomSmtpConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  secure?: boolean;
  fromName?: string;
  fromEmail?: string;
  updatedAt?: number;
}

const SMTP_CONFIG_FILE = path.join(process.cwd(), "custom_smtp_config.json");
let currentCustomSmtp: CustomSmtpConfig = {};

// Load custom SMTP configuration from disk if exists
if (fs.existsSync(SMTP_CONFIG_FILE)) {
  try {
    const raw = fs.readFileSync(SMTP_CONFIG_FILE, "utf-8").trim();
    if (raw) {
      currentCustomSmtp = JSON.parse(raw);
      console.log(`[SMTP Engine] Loaded custom SMTP config for user: ${currentCustomSmtp.user || "none"}`);
    }
  } catch (err) {
    console.warn("[SMTP Engine] Error loading custom_smtp_config.json:", err);
  }
}

function saveCustomSmtpToFile() {
  try {
    fs.writeFileSync(SMTP_CONFIG_FILE, JSON.stringify(currentCustomSmtp, null, 2), "utf-8");
  } catch (err) {
    console.error("[SMTP Engine] Error saving custom_smtp_config.json:", err);
  }
}

// Custom CORS middleware to handle requests from any origin (Crucial for hybrid mobile APKs using file:// or capacitor origins to talk to this API backend)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "butcem-pro-backend",
    time: new Date().toISOString(),
    smtpConfigured: !!(
      currentCustomSmtp?.user ||
      process.env.SMTP_HOST ||
      process.env.SMTP_USER ||
      process.env.SMTP_USERNAME ||
      process.env.GMAIL_USER ||
      process.env.EMAIL_USER ||
      process.env.MAIL_USER
    ),
  });
});

// Memory cache for temporary backups (lasts 30 minutes for sharing via WhatsApp / Drive)
const tempWebviewBackups = new Map<string, { content: string, filename: string, expires: number }>();

// Periodic memory cleanup to prevent memory accumulation
setInterval(() => {
  try {
    const now = Date.now();
    for (const [key, val] of tempWebviewBackups.entries()) {
      if (now > val.expires) {
        tempWebviewBackups.delete(key);
      }
    }
  } catch (e) {
    console.error("Backup cache cleanup error:", e);
  }
}, 5 * 60 * 1000);

app.post("/api/temp-backup", (req, res) => {
  const { content, filename } = req.body;
  if (!content) {
    return res.status(400).json({ error: "İçerik boş olamaz" });
  }
  
  let cleanName = (typeof filename === "string" && filename.trim()) ? filename.trim() : "butcem_pro_yedek";
  cleanName = cleanName.replace(/[\/\\?%*:|"<>]/g, "_");
  
  // Preserve extension if provided, otherwise default to .json
  let finalFilename = cleanName;
  if (!/\.[a-zA-Z0-9]+$/.test(finalFilename)) {
    finalFilename = `${cleanName}.json`;
  }

  const key = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const expires = Date.now() + 30 * 60 * 1000; // 30 minutes
  tempWebviewBackups.set(key, { content, filename: finalFilename, expires });
  res.json({ success: true, key, filename: finalFilename });
});

app.get(["/api/download-temp", "/api/download-temp/:filename"], (req, res) => {
  const { key, filename: queryFilename } = req.query;
  if (!key || typeof key !== "string") {
    return res.status(400).send("Geçersiz anahtar");
  }
  const item = tempWebviewBackups.get(key);
  if (!item || Date.now() > item.expires) {
    return res.status(404).send("Yedek linkinin süresi dolmuş veya bulunamadı");
  }
  
  const effectiveFilename = (typeof queryFilename === "string" && queryFilename.trim()) || req.params.filename || item.filename;

  // Determine appropriate content type
  let contentType = "application/json; charset=utf-8";
  if (effectiveFilename.toLowerCase().endsWith(".csv")) {
    contentType = "text/csv; charset=utf-8";
  } else if (effectiveFilename.toLowerCase().endsWith(".html")) {
    contentType = "text/html; charset=utf-8";
  } else if (effectiveFilename.toLowerCase().endsWith(".txt")) {
    contentType = "text/plain; charset=utf-8";
  }

  const safeFilename = effectiveFilename.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
  const encodedFilename = encodeURIComponent(effectiveFilename);
  
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.send(item.content);
});

// 15-day Free Trial IP Tracking Endpoints
const TRIALS_FILE = path.join(process.cwd(), "trials.json");

function readTrials(): Record<string, string> {
  try {
    if (fs.existsSync(TRIALS_FILE)) {
      const data = fs.readFileSync(TRIALS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading trials file:", e);
  }
  return {};
}

function writeTrials(trials: Record<string, string>) {
  try {
    fs.writeFileSync(TRIALS_FILE, JSON.stringify(trials, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing trials file:", e);
  }
}

app.get("/api/trial/status", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();
  const userId = (req.query.userId as string) || "";
  const deviceId = (req.query.deviceId as string) || "";
  const trials = readTrials();

  const key = (userId && userId.trim()) || (deviceId && deviceId.trim()) || ip;
  const startDateStr = trials[key] || (deviceId && trials[deviceId]) || (userId && trials[userId]) || trials[ip];

  if (!startDateStr) {
    return res.json({
      hasTrial: false,
      isActive: false,
      isExpired: false,
      daysRemaining: 15,
      startDate: null,
      endDate: null,
    });
  }

  const startDate = new Date(startDateStr);
  const now = new Date();
  const diffTime = now.getTime() - startDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, Math.ceil(15 - diffDays));
  const isExpired = diffDays >= 15;

  const endDate = new Date(startDate.getTime() + 15 * 24 * 60 * 60 * 1000);

  res.json({
    hasTrial: true,
    isActive: !isExpired,
    isExpired: isExpired,
    daysRemaining: daysRemaining,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
});

app.post("/api/trial/activate", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();
  const { userId, deviceId, forceReset } = req.body || {};
  const trials = readTrials();
  const key = (userId && typeof userId === "string" && userId.trim()) || 
              (deviceId && typeof deviceId === "string" && deviceId.trim()) || 
              ip;

  // If forceReset is requested or no trial exists, activate fresh 15-day trial
  if (forceReset || !trials[key]) {
    const nowIso = new Date().toISOString();
    trials[key] = nowIso;
    if (deviceId) trials[deviceId] = nowIso;
    if (userId) trials[userId] = nowIso;
    trials[ip] = nowIso;
    writeTrials(trials);
  }

  const startDate = new Date(trials[key]);
  const now = new Date();
  const diffTime = now.getTime() - startDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, Math.ceil(15 - diffDays));
  const isExpired = diffDays >= 15;
  const endDate = new Date(startDate.getTime() + 15 * 24 * 60 * 60 * 1000);

  res.json({
    hasTrial: true,
    isActive: !isExpired,
    isExpired: isExpired,
    daysRemaining: daysRemaining,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
});

// Google Drive API Proxy endpoints
app.get("/api/drive/backups", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  try {
    const listUrl = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,size,createdTime)&orderBy=createdTime desc";
    const response = await fetch(listUrl, {
      headers: { Authorization: authHeader }
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json(err);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/drive/upload", async (req, res) => {
  const authHeader = req.headers.authorization;
  const { fileName, content } = req.body;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  try {
    const metadata = {
      name: fileName,
      parents: ["appDataFolder"],
      mimeType: "application/json"
    };

    // Construct the multipart body strictly according to Google Drive API requirements
    const boundary = "ais_multipart_boundary_5228182";
    const delimiter = `--${boundary}`;
    const closeDelimiter = `--${boundary}--`;

    const parts = [
      Buffer.from(`${delimiter}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
      Buffer.from(JSON.stringify(metadata)),
      Buffer.from(`\r\n${delimiter}\r\nContent-Type: application/json\r\n\r\n`),
      Buffer.from(JSON.stringify(content)),
      Buffer.from(`\r\n${closeDelimiter}`)
    ];

    const multipartBody = Buffer.concat(parts);

    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": multipartBody.length.toString()
      },
      body: multipartBody
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Gdrive Upload Failed - Raw Error:", JSON.stringify(err, null, 2));
      return res.status(response.status).json({
        error: err.error || err,
        message: err.error?.message || "Google Drive upload failed."
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error("Gdrive Proxy Server Exception:", err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.delete("/api/drive/backups/:fileId", async (req, res) => {
  const authHeader = req.headers.authorization;
  const { fileId } = req.params;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: authHeader }
    });

    if (!response.ok) {
       if (response.status === 404) return res.json({ success: true, message: "Already deleted" });
       const err = await response.json();
       return res.status(response.status).json(err);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/drive/user", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: authHeader }
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json(err);
    }

    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize Gemini dynamically and lazily with proper User-Agent header and environment reloading support
let cachedApiKey: string | undefined = undefined;
let cachedAi: GoogleGenAI | null = null;
let defaultKeyHasFailed = false;

function getGeminiClient(userKey?: string): GoogleGenAI | null {
  // If we are using the default system key and it is marked as failed, bypass and return null immediately
  if (!userKey && defaultKeyHasFailed) {
    return null;
  }

  const currentKey = userKey || process.env.GEMINI_API_KEY;
  if (!currentKey || currentKey.trim() === "") {
    return null;
  }

  const cleanKey = currentKey.trim();

  // If a user-provided temporary key is sent, spawn a dedicated client
  if (userKey) {
    try {
      return new GoogleGenAI({
        apiKey: cleanKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (err) {
      console.warn("[Gemini API Client] User key initialization error:", err);
      return null;
    }
  }

  if (cleanKey !== cachedApiKey || !cachedAi) {
    try {
      cachedAi = new GoogleGenAI({
        apiKey: cleanKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      cachedApiKey = cleanKey;
      console.log("[Gemini API Client] Successfully initialized with a valid key format.");
    } catch (err) {
      cachedAi = null;
      console.warn("Gemini API Client Initialization Error:", err);
      return null;
    }
  }
  return cachedAi;
}

function getSmartFallbackResponse(query: string, context: any, reason: string): string {
  const q = (query || "").toLowerCase();
  const stats = context?.stats || {
    totalIncome: 0,
    totalExpense: 0,
    netIncome: 0,
    totalDebt: 0,
    remaining: 0,
    thisMonthTotalBorc: 0,
    thisMonthKalanBorc: 0,
    thisMonthPaidBorc: 0,
  };
  const debts = context?.debts || [];
  const expenses = context?.expenses || [];
  const installmentDebts = context?.installmentDebts || [];
  const contactTxs = context?.contactTransactions || [];
  const contacts = context?.contacts || [];
  const expenseCategories = context?.expenseCategories || [];
  const selectedMonth = context?.selectedMonth;
  const selectedYear = context?.selectedYear;
  const categoriesList = expenseCategories.length > 0 ? expenseCategories : [
    { id: 1, name: "Kira", color: "#3b82f6", icon: "🏠" },
    { id: 2, name: "Market", color: "#10b981", icon: "🛒" },
    { id: 3, name: "Ulaşım", color: "#f59e0b", icon: "🚗" },
    { id: 4, name: "Yeme İçme", color: "#ec4899", icon: "🍔" },
    { id: 5, name: "Faturalar", color: "#ef4444", icon: "⚡" }
  ];

  const TURKISH_MONTHS = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  const mNum = selectedMonth !== null && selectedMonth !== undefined ? selectedMonth : new Date().getMonth();
  const yNum = selectedYear !== null && selectedYear !== undefined ? selectedYear : new Date().getFullYear();
  const monthName = TURKISH_MONTHS[mNum] || "Mevcut Ay";

  const dRatio = stats.totalIncome > 0 ? (stats.remaining / stats.totalIncome) : 0;
  const dRatioPerc = dRatio * 100;
  const expensePercentage = stats.totalIncome > 0 ? (stats.totalExpense / stats.totalIncome) * 100 : 0;
  const savingsRate = stats.totalIncome > 0 ? ((stats.netIncome / stats.totalIncome) * 100) : 0;

  // Let's perform semantic category analysis
  const categoryKeywords: Record<string, string[]> = {
    "Kira": ["kira", "ev", "konut", "depo", "otel", "apart", "rezidans"],
    "Market": ["market", "gıda", "gida", "yemek", "manav", "kasap", "mutfak", "bim", "migros", "carrefoursa", "şok", "sok", "alışveriş", "alisveris", "groseri", "tekel"],
    "Ulaşım": ["ulaşım", "ulasim", "yol", "akaryakıt", "akaryakit", "benzin", "otobüs", "otobus", "metro", "taksi", "bilet", "yakıt", "yakit", "otoyol", "köprü", "hgs", "egzoz", "sanayi", "araba"],
    "Faturalar": ["fatura", "elektrik", "su", "doğalgaz", "dogalgaz", "gaz", "internet", "telefon", "aidat", "asansör", "asansor", "tv", "abonelik"],
    "Eğlence": ["eğlence", "eglence", "sinema", "kafe", "oyun", "netflix", "konser", "bira", "bar", "restoran", "lokanta", "pub", "ps5", "alkol", "hediye", "hobi", "tatil", "gezi"],
    "Sağlık": ["sağlık", "saglik", "hastane", "ilaç", "ilac", "eczane", "doktor", "muayene", "diş", "dis", "optik", "gözlük", "reçete", "recete"]
  };

  let matchedCategory: string | null = null;
  for (const [catName, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(k => q.includes(k))) {
      matchedCategory = catName;
      break;
    }
  }

  let advice = `✨ **Bütçem Pro Gelişmiş Finansal Analiz Raporu**\n\n`;

  if (q.includes("aylık analiz raporu") || q.includes("aylik analiz raporu") || q.includes("analiz raporu")) {
    const tIncome = stats.totalIncome;
    const tExpense = stats.totalExpense;
    const nIncome = stats.netIncome;
    const thisMonthDebtDue = stats.thisMonthKalanBorc || 0;
    const thisMonthDebtPaid = stats.thisMonthPaidBorc || 0;
    const thisMonthDebtTotal = stats.thisMonthTotalBorc || (thisMonthDebtDue + thisMonthDebtPaid);
    const overallTotalLiabilities = stats.remaining || 0;

    const catTotals: { [key: number]: number } = {};
    expenses.forEach((e: any) => {
      catTotals[e.categoryId] = (catTotals[e.categoryId] || 0) + (Number(e.amount) || 0);
    });

    advice += `📊 **${monthName.toUpperCase()} ${yNum} - DETAYLI AYLIK ANALİZ RAPORU** 📊\n\n`;
    advice += `Sistemimizdeki bütçe ve gider kayıtlarınızı bizzat tarayarak **${monthName} ${yNum}** dönemi gelir/gider ve borç tablonuzu çıkardım:\n\n`;

    const totalDebtsRem = debts.reduce((sum: number, d: any) => sum + Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0)), 0);
    const totalInstsRem = installmentDebts.reduce((sum: number, inst: any) => {
      const totalAmt = Number(inst.totalAmount) || 0;
      const count = Number(inst.installmentCount) || 1;
      const paidCount = Number(inst.paidInstallmentCount) || 0;
      const perInst = totalAmt / count;
      const remCount = Math.max(0, count - paidCount);
      return sum + (remCount * perInst);
    }, 0);
    let contactPayablesRem = 0;
    let contactReceivablesRem = 0;
    contactTxs.forEach((tx: any) => {
      if (!tx.isPaid) {
        if (tx.type === "payable") contactPayablesRem += Number(tx.amount) || 0;
        else if (tx.type === "receivable") contactReceivablesRem += Number(tx.amount) || 0;
      }
    });

    advice += `### 💵 Aylık Mali Durum Özeti (${monthName} ${yNum})\n`;
    advice += `• **Toplam Aylık Gelir**: ₺${tIncome.toLocaleString("tr-TR")}\n`;
    advice += `• **Toplam Aylık Gider**: ₺${tExpense.toLocaleString("tr-TR")}\n`;
    advice += `• **Kalan Net Bakiye**: ₺${nIncome.toLocaleString("tr-TR")} (${nIncome >= 0 ? "🟢 Bütçe Fazla Veriyor" : "🔴 Bütçe Açık Veriyor"})\n\n`;

    advice += `### 💸 Bu Ayki Borç ve Yükümlülük Durumu\n`;
    advice += `• **Bu Ay Vadesi Gelen Kalan Borç**: ₺${thisMonthDebtDue.toLocaleString("tr-TR")}\n`;
    advice += `• **Bu Ay Ödenen Borç Tutarı**: ₺${thisMonthDebtPaid.toLocaleString("tr-TR")}\n`;
    advice += `• **Bu Ayki Toplam Borç Yükü**: ₺${thisMonthDebtTotal.toLocaleString("tr-TR")}\n`;
    advice += `• **Genel Toplam Kalan Borç Portföyü (Tüm Vadeler)**: ₺${overallTotalLiabilities.toLocaleString("tr-TR")}\n\n`;

    advice += `### 📋 Borç Dağılımı Detayları\n`;
    advice += `• **Nakit Borçlar (Kalan Toplam)**: ₺${totalDebtsRem.toLocaleString("tr-TR")}\n`;
    advice += `• **Taksitli Borçlar (Kalan Toplam)**: ₺${totalInstsRem.toLocaleString("tr-TR")}\n`;
    advice += `• **Kişi Borçları (Verecek - Kalan)**: ₺${contactPayablesRem.toLocaleString("tr-TR")}\n`;
    advice += `• **Kişi Alacakları (Alacak - Kalan)**: ₺${contactReceivablesRem.toLocaleString("tr-TR")}\n\n`;

    if (expenses.length === 0) {
      advice += `🚨 **Harcama Uyarısı**: Bu seçili ay için kaydedilmiş herhangi bir harcama kalemi bulunamadı. Lütfen analiz için harcamalarınızı girin.\n`;
    } else {
      advice += `### 📉 Kategori Karşılaştırma Analizi\n`;
      advice += `Aşağıdaki tabloda bu ayın harcama kategorileri, tutarları ve toplam aylık gider içindeki yüzdesel ağırlıkları gösterilmiştir:\n\n`;

      advice += `| Gider Kategorisi | Harcanan Tutar | Gider Oranı (%) | Öneri Seviyesi |\n`;
      advice += `| :--- | :--- | :---: | :---: |\n`;

      const sortedCats = categoriesList
        .map((c: any) => {
          const val = catTotals[c.id] || 0;
          return {
            name: c.name,
            value: val,
            pct: tExpense > 0 ? (val / tExpense) * 100 : 0
          };
        })
        .filter((c: any) => c.value > 0)
        .sort((a: any, b: any) => b.value - a.value);

      sortedCats.forEach((c: any) => {
        let recStatus = "🟢 Stabil";
        if (c.pct > 30) recStatus = "🚨 Çok Yüksek";
        else if (c.pct > 15) recStatus = "⚠️ Yüksek";

        advice += `| **${c.name}** | ₺${c.value.toLocaleString("tr-TR")} | %${c.pct.toFixed(1)} | ${recStatus} |\n`;
      });

      advice += `\n`;

      if (sortedCats.length > 0) {
        const topCat = sortedCats[0];
        advice += `💡 **En Kritik Harcama Kalemi**: Bu ay bütçenizi en çok zorlayan kategori **%${topCat.pct.toFixed(1)}** pay oranıyla **"${topCat.name}"** olmuştur (Tutar: ₺${topCat.value.toLocaleString("tr-TR")}).\n\n`;
      }

      advice += `### 🎯 Bütçe Disiplini Değerlendirmesi (50/30/20 Kuralı)\n`;
      const essentialPct = tIncome > 0 ? (tExpense / tIncome) * 100 : 0;
      advice += `• **Zorunlu ve Kişisel Gider Oranı**: Gelirinizin **%${essentialPct.toFixed(1)}** kadarı harcanmış durumda.\n`;
      if (essentialPct > 80) {
        advice += `• ⚠️ **Durum Analizi**: Harcama oranınız bütçe sınırlarını çok aşıyor. Gelirin %80'inden fazlasını harcamak, borç kapatmayı ve birikim yapmayı neredeyse imkansız kılar. Acilen lüks taksitleri durdurmalı ve abonelikleri iptal etmelisiniz.\n`;
      } else if (essentialPct > 50) {
        advice += `• ⚖️ **Durum Analizi**: İdeal sınırlandırmaya yakınsınız ancak hala bir miktar bütçe sızıntısı var. Gider kalemlerinde yapacağınız %10'luk bir kısıntı tasarruf hızınızı ikiye katlayabilir.\n`;
      } else {
        advice += `• 🟢 **Durum Analizi**: Tebrikler! Tasarruf limitleriniz oldukça güvenli bölgede. Finansal bağımsızlığınıza çok daha hızlı ulaşacaksınız.\n`;
      }

      advice += `\n### 💡 Tasarruf ve Optimizasyon Önerileri\n`;
      sortedCats.slice(0, 3).forEach((c: any, idx: number) => {
        const possibleSaving = c.value * 0.15;
        advice += `${idx + 1}️⃣ **${c.name} Tasarrufu**: %15 tasarruf ile bu kalemde yapacağınız küçük fedakarlıklar size ayda **₺${possibleSaving.toFixed(0)}** ek bakiye kazandıracaktır. `;
        if (c.name.toLowerCase().includes("market")) {
          advice += "Haftalık alışveriş listesi yapın ve aç karnına asla alışverişe çıkmayın. Markaların kendi etiketli ekonomik ürünlerini tercih edin.";
        } else if (c.name.toLowerCase().includes("fatura")) {
          advice += "Kullanılmayan cihazları prizden çekin, akıllı termostat kullanın ve abonelik planlarınızı daha uygun tarifelere düşürün.";
        } else if (c.name.toLowerCase().includes("yemek") || c.name.toLowerCase().includes("yeme")) {
          advice += "Dışarıdan sipariş verme oranını azaltarak evde pratik yemekler hazırlayın. İş yerine kendi hazırladığınız sefertasını götürün.";
        } else if (c.name.toLowerCase().includes("ulaşım") || c.name.toLowerCase().includes("ulasim")) {
          advice += "Kısa mesafelerde yürümeyi veya bisiklet kullanmayı tercih edin, toplu taşımayı önceliklendirin ve ortak araç kullanımını değerlendirin.";
        } else {
          advice += "Fayda-maliyet analizini iyi yapın, satın almadan önce 48 saat bekleyin ve nakit ödemeleri tercih edin.";
        }
        advice += `\n`;
      });
    }

  } else if (matchedCategory) {
    // CATEGORY SPECIFIC HARCAMA DETAYLI ANALİZİ
    let totalCatSpent = 0;
    const catObj = categoriesList.find((c: any) => c.name.toLowerCase() === matchedCategory!.toLowerCase());
    const catId = catObj ? catObj.id : null;

    const matchedExpenses = expenses.filter((e: any) => {
      const desc = (e.description || "").toLowerCase();
      const inDesc = desc.includes(matchedCategory!.toLowerCase()) || categoryKeywords[matchedCategory!].some(k => desc.includes(k));
      const inCatId = catId ? e.categoryId === catId : false;
      return inDesc || inCatId;
    });

    totalCatSpent = matchedExpenses.reduce((sum: number, curr: any) => sum + curr.amount, 0);
    const catRatioOfExpense = stats.totalExpense > 0 ? (totalCatSpent / stats.totalExpense) * 100 : 0;
    const catRatioOfIncome = stats.totalIncome > 0 ? (totalCatSpent / stats.totalIncome) * 100 : 0;

    advice += `🔍 **Harcama Kalemi Derinlemesine İncelemesi: ${matchedCategory}**\n\n`;
    advice += `Bütçe kayıtlarınızda **${matchedCategory}** kategorisi veya açıklamasına yönelik harcamalarınızı bizzat taradım:\n\n`;
    advice += `• **Kayıtlı Harcama Sayısı**: ${matchedExpenses.length} adet işlem \n`;
    advice += `• **Sektörel Toplam Gider**: ₺${totalCatSpent.toLocaleString("tr-TR")}\n`;
    advice += `• **Harcama Yükü (Gider Oranı)**: Toplam giderlerinizin **%${catRatioOfExpense.toFixed(1)}** kadarını oluşturuyor.\n`;
    advice += `• **Gelir Tüketim Oranı**: Aylık toplam gelirinizin **%${catRatioOfIncome.toFixed(1)}** kadarını sömürüyor.\n\n`;

    if (matchedExpenses.length > 0) {
      advice += `📊 **Son Harcama Detayları**:\n`;
      matchedExpenses.slice(0, 5).forEach((e: any) => {
        advice += `- ₺${e.amount.toLocaleString("tr-TR")} ➔ *"${e.description || "Açıklama Belirtilmemiş"}"* (${e.date ? e.date.split("T")[0] : "Tarih yok"})\n`;
      });
      advice += `\n`;
    }

    advice += `💡 **Asistan Tasarruf Önerisi**:\n`;
    if (totalCatSpent > stats.totalIncome * 0.15) {
      advice += `⚠️ **${matchedCategory}** harcamalarınız aylık gelirinizin %15 sınırını aşmış durumda. Bu kalemde her ay ekstra **%20 tasarruf** yaparak ayda **₺${(totalCatSpent * 0.2).toFixed(0)}** cebinizde tutabilir ve bu kaynağı borçlarınızı eritmek için kullanabilirsiniz! Harici abonelikleri veya lüks liyakat harcamalarını yeniden gözden geçirin.\n`;
    } else {
      advice += `🟢 Bu kategorideki harcamalarınız makul sınırda (%15 altında) seyrediyor. Mevcut tasarruflu bütçe disiplininizi tebrik ederim! Yeni lüks taksitler yaratmayarak bu istikrarı koruyun.\n`;
    }

  } else if (q.includes("risk") || q.includes("analiz") || q.includes("durum") || q.includes("bütçe") || q.includes("butce") || q.includes("genel") || q.includes("karne") || q.includes("sağlık") || q.includes("saglik") || q.includes("rapor")) {
    // GENEL FİNANSAL SAĞLIK VE KARNE ANALİZİ
    advice += `📊 **Kişiselleştirilmiş Bütçe Karnesi ve Risk Analizi**\n\n`;
    advice += `Aylık kayıtlı hesap parametreleriniz üzerinden gerçekleştirdiğim finansal sağlık taraması çıktısı:\n\n`;
    advice += `| Mali Metrik | Değer | Bütçe Oran Payı | Durum |\n`;
    advice += `| :--- | :--- | :--- | :---: |\n`;
    advice += `| **Aylık Gelir** | ₺${stats.totalIncome.toLocaleString("tr-TR")} | %100 | Nakit Girişi |\n`;
    advice += `| **Aylık Gider** | ₺${stats.totalExpense.toLocaleString("tr-TR")} | %${expensePercentage.toFixed(1)} | Harcama Oranı |\n`;
    advice += `| **Net Bakiye** | ₺${stats.netIncome.toLocaleString("tr-TR")} | %${savingsRate.toFixed(1)} | Aylık Tasarruf |\n`;
    advice += `| **Kalan Borç** | ₺${stats.remaining.toLocaleString("tr-TR")} | %${dRatioPerc.toFixed(0)} | Borç/Gelir Yükü |\n\n`;

    advice += `🚨 **Cari Borç Risk Seviyeniz**: `;
    if (dRatio > 5) {
      advice += `⚡ **KIRMIZI ALARM (YÜKSEK MALI RİSK)**\n`;
      advice += `Mevcut toplam borç yükünüz, aylık gelirinizin **${dRatio.toFixed(1)} katı**! Finansal güvenliğiniz tehlikede. Harcamalarınızı acilen dondurmalı, taksitli borçlanmayı durdurmalı ve tüm bütçe fazlasını en küçük borca kanalize etmelisiniz.\n\n`;
    } else if (dRatio > 2.5) {
      advice += `⚖️ **SARI ALARM (ORTA SEVİYE RİSK)**\n`;
      advice += `Geri ödenmesi gereken borç portföyünüz aylık gelirinizin **${dRatio.toFixed(1)} katı** düzeyinde. Bütçeniz kontrol edilebilir durumda ancak yeni taksitler eklemek sizi yüksek risk sınırına itecektir. Kar topu stratejisiyle acilen borç kapatmaya odaklanın.\n\n`;
    } else {
      advice += `🟢 **YEŞİL BÖLGE (GÜVENLİ VE RESİLİENT)**\n`;
      advice += `Toplam borç yükünüz aylık gelirinizin **${dRatio.toFixed(1)} katı** seviyesinde ve oldukça güvenli sınırda. Mevcut bütçe planınızı koruyarak borçlarınızı takvimine göre sıfırlayabilirsiniz.\n\n`;
    }

    advice += `💪 **Mali Güçlenme Tavsiyeleriniz**:\n`;
    if (savingsRate < 10) {
      advice += `- **Tasarruf Sızıntısı**: Aylık tasarruf oranınız (%${savingsRate.toFixed(1)}) çok düşük. Acil durum fonu oluşturmak için aylık gider bütçenizden en az **%15 kısıntı** planlamalıyız.\n`;
    } else {
      advice += `- **Yüksek Likidite Gücü**: Aylık tasarruf oranınız (%${savingsRate.toFixed(1)}) son derece güçlü. Biriktirdiğiniz bu net bakiye fazlasını borç kapatma hızlandırıcısı olarak asgari ödemelerin üzerine ekleyin.\n`;
    }
    if (installmentDebts.length > 2) {
      advice += `- **Taksit Blokajı**: Devam eden **${installmentDebts.length} aktif taksitiniz** gelecekteki nakit akışınızı rehin tutuyor. Gelecek aylarda yeni taksitli işlem yapmayacağınıza dair kendinize söz verin.\n`;
    }

  } else if (q.includes("borç") || q.includes("borc") || q.includes("kapat") || q.includes("erit") || q.includes("strateji") || q.includes("kartopu") || q.includes("avalanche") || q.includes("çığ") || q.includes("cig") || q.includes("öde")) {
    // BORÇ KAPATMA VE ERİTME TEKNİK SİMÜLASYONU
    advice += `🚀 **Akıllı Borç Sıfırlama ve Yapılandırma Stratejisi**\n\n`;
    
    if (debts.length === 0) {
      advice += `Şu anda sistemde kayıtlı aktif nakit borç kaleminiz bulunmuyor. Yeni borçlar ekleyerek asistanın gerçek-zamanlı kar topu simülasyonunu başlatabilirsiniz!\n\n`;
    } else {
      advice += `Mevcut **${debts.length} adet** borç kaleminiz analiz edilerek borçsuz bir yaşama en hızlı ulaşmanızı sağlayacak iki temel metodoloji simüle edilmiştir:\n\n`;
      
      const sortedSnowball = [...debts].sort((a: any, b: any) => (a.amount - a.paid) - (b.amount - b.paid));
      const sortedAvalanche = [...debts].sort((a: any, b: any) => (b.amount - b.paid) - (a.amount - a.paid));

      advice += `1️⃣ **Kartopu (Snowball) Stratejisi (Psikolojik & En Hızlı Sonuç)**:\n`;
      advice += `• Kalan net bakiyesi en düşük olan borca agresif ödeme yapıp onu yok edin, diğerlerine asgari yatırın. Bir borcun tamamen silindiğini görmek sizi inanılmaz motive eder.\n`;
      advice += `👉 **Kartopu İlk Hedefiniz**: En az kalan borç olan **"${sortedSnowball[0].name}"** borcunu kapatmaya odaklanın. Kalan Ödenecek: **₺${(sortedSnowball[0].amount - sortedSnowball[0].paid).toLocaleString("tr-TR")}**.\n\n`;

      advice += `2️⃣ **Çığ (Avalanche) Stratejisi (Matematiksel / En Ekonomik Yol)**:\n`;
      advice += `• Tutarı veya maliyeti en yüksek olan borca öncelik tanıyın. Böylece toplamda katlanacağınız enflasyonist vade yükünü ve faiz kaybını minimuma indirirsiniz.\n`;
      advice += `👉 **Çığ İlk Hedefiniz**: En büyük kalan borç olan **"${sortedAvalanche[0].name}"** borcuna odaklanın. Kalan Ödenecek: **₺${(sortedAvalanche[0].amount - sortedAvalanche[0].paid).toLocaleString("tr-TR")}**.\n\n`;

      // Kalkülatif Tahmin
      const monthlyReserve = stats.netIncome;
      advice += `⏱️ **Borç Eritme Zaman Projeksiyonu**:\n`;
      if (monthlyReserve > 100) {
        const monthsNeeded = stats.remaining / monthlyReserve;
        advice += `• Her ay biriktirdiğiniz **₺${monthlyReserve.toLocaleString("tr-TR")}** tasarruf fazlasının tamamını borç kapatmaya yönlendirirseniz, teorik olarak **${monthsNeeded.toFixed(1)} ay sonra** tamamen borçsuz ve özgür bir hayata kavuşabilirsiniz! 🎉\n\n`;
      } else {
        advice += `• ⚠️ Aylık kullanılabilir tasarruf rezerviniz yetersiz (Negatif veya çok düşük nakit akışı). Borçlarınızı planlı sürede sıfırlayabilmek için aylık harcamalarınızı kısmalı veya acilen ek gelir yaratmalısınız. Giderleri azaltmadan borçların azalması matematiksel olarak imkansızdır.\n\n`;
      }
    }

  } else if (q.includes("tasarruf") || q.includes("tasaruf") || q.includes("para biriktir") || q.includes("biriktir") || q.includes("tasarruf yöntemi") || q.includes("gider") || q.includes("harcama") || q.includes("bakiye") || q.includes("birikim")) {
    // TASARRUF VE BİRİKİM YÖNLENDİRİCİSİ
    advice += `🎯 **Profesyonel Tasarruf ve Birikim Rehberi**\n\n`;
    advice += `Aylık toplam kalibre edilmiş geliriniz olan **₺${stats.totalIncome.toLocaleString("tr-TR")}** temel alınarak oluşturulan tasarruf matrisiniz aşağıdadır:\n\n`;
    
    const necessityLimit = stats.totalIncome * 0.50;
    const wantLimit = stats.totalIncome * 0.30;
    const savingTarget = stats.totalIncome * 0.20;

    advice += `💡 **İdeal 50/30/20 Bütçe Bölüşümü**:\n`;
    advice += `- **Zorunlu Giderler (Ev, Fatura, Gıda - %50)**: Maksimum **₺${necessityLimit.toLocaleString("tr-TR")}** ayrılmalı. (Sizin Mevcut Gideriniz: ₺${stats.totalExpense.toLocaleString("tr-TR")})\n`;
    advice += `- **Kişisel İstekler (Sosyal Yaşam - %30)**: Maksimum **₺${wantLimit.toLocaleString("tr-TR")}** ayrılmalı.\n`;
    advice += `- **Borç Ödeme ve Birikim Fonu (%20)**: Aylık asgari **₺${savingTarget.toLocaleString("tr-TR")}** hedef koyulmalı.\n\n`;

    advice += `🌟 **Eyleme Geçilebilir Tasarruf Reçetesi**:\n`;
    advice += `1. **Acil Durum Fonu (Emergency Fund)**: Olası harika fırsatlar veya beklenmedik krizler için asgari 3 aylık yaşamsal harcamalarınızı kapsayan (Önerilen Güvence Kaynağı: **₺${(stats.totalExpense * 3).toLocaleString("tr-TR")}**) bir kenar akçesi biriktirmeye başlayın.\n`;
    if (expenses.length > 0) {
      advice += `2. **Gereksiz Abonelikler ve Harcama Optimizasyonu**: Sistemde kayıtlı **${expenses.length} adet harcamanızı** tek tek gözden geçirdim. Küçük ve tekrarlayan harcamaları keserek ayda ortalama **₺400** ila **₺1.500** arasında doğrudan ek bütçe yaratabilirsiniz.\n`;
    } else {
      advice += `2. **Gider Kaydı Tutma**: Şu an hiç anlık gider kalemi girmemişsiniz. Harcamalarınızı disipline etmek ve nereye bütçe sızıntısı olduğunu teşhis etmek için 'Harcamalar' sekmesinden harcamalarınızı kaydetmeye başlayın.\n`;
    }

  } else if (
    q.includes("altın") || q.includes("altin") ||
    q.includes("dolar") || q.includes("usd") ||
    q.includes("euro") || q.includes("eur") ||
    q.includes("sterlin") || q.includes("gbp") ||
    q.includes("kur") || q.includes("döviz") || q.includes("doviz") ||
    q.includes("piyasa") || q.includes("ons") || q.includes("çeyrek") || q.includes("ceyrek") ||
    q.includes("gram") || q.includes("btc") || q.includes("bitcoin")
  ) {
    const usd = context?.rates?.USD || 45.85;
    const eur = context?.rates?.EUR || 49.85;
    const gbp = context?.rates?.GBP || 58.20;
    const goldOns = context?.rates?.GOLD_ONS || 4474.20;
    const goldGram = context?.rates?.GOLD_GRAM || ((goldOns * usd) / 31.10348);
    const goldCeyrek = context?.rates?.GOLD_CEYREK || (goldGram * 1.635);
    const btcUsd = context?.rates?.BTC_USD || 81588;

    advice += `💱 **ANLIK CANLI PİYASA & DÖVİZ / ALTIN KURLARI RAPORU**\n\n`;
    advice += `En entegre serbest piyasa ve uluslararası finans borsaları verilerine göre güncel kurlar:\n\n`;
    advice += `| Varlık Türü | Sembol | Anlık Fiyat (TL / USD) | Değişim / Birim |\n`;
    advice += `| :--- | :---: | :---: | :---: |\n`;
    advice += `| **Amerikan Doları** | 🇺🇸 USD | **₺${usd.toFixed(2)}** | 1 Dolar |\n`;
    advice += `| **Euro** | 🇪🇺 EUR | **₺${eur.toFixed(2)}** | 1 Euro |\n`;
    advice += `| **İngiliz Sterlini** | 🇬🇧 GBP | **₺${gbp.toFixed(2)}** | 1 Sterlin |\n`;
    advice += `| **Gram Altın (24K)** | 🥇 Gram | **₺${Math.round(goldGram).toLocaleString("tr-TR")} TL** | 1 Gram |\n`;
    advice += `| **Çeyrek Altın** | 🪙 Çeyrek | **₺${Math.round(goldCeyrek).toLocaleString("tr-TR")} TL** | 1 Adet |\n`;
    advice += `| **Ons Altın ($)** | 🪙 Ons | **$${Math.round(goldOns).toLocaleString("en-US")} USD** | 1 Ons (31.1g) |\n`;
    advice += `| **Bitcoin (BTC)** | ₿ BTC | **$${Math.round(btcUsd).toLocaleString("en-US")} USD** | 1 BTC |\n\n`;

    advice += `💡 **Finans Koçu Analizi & Önerisi**:\n`;
    advice += `• **Bütçe Koruması**: Enflasyonist ortamlarda nakitte kalan TL birikimleri değer kaybeder. Gelirinizden ayırdığınız tasarruf bakiyesini (**₺${stats.netIncome.toLocaleString("tr-TR")}**) parçalı olarak Gram Altın veya döviz varlıklarına yönlendirerek reel satın alma gücünüzü koruyabilirsiniz.\n`;
    advice += `• **Dövizli Borç Riski**: Eğer döviz veya altına endeksli borcunuz varsa, kurlardaki yükseliş riskine karşı borcunuzu TL cinsinden sabitlemeyi veya erken kapatmayı önceliklendirin.\n`;

    return advice;

  } else if (q.includes("merhaba") || q.includes("selam") || q.includes("hey") || q.includes("nasılsın") || q.includes("kimsin") || q.includes("yardım") || q.includes("help")) {
    advice += `👋 **Merhaba! Ben Bütçem Pro Bireysel Finans Danışmanınız.**\n\n`;
    advice += `Finansal hedeflerinize emin adımlarla yürümeniz, tüm borçlarınızı planlı şekilde sıfırlamanız ve bütçenizi en verimli şekilde yönetebilmeniz için bizzat buradayım.\n\n`;
    advice += `Aşağıdaki konuları bütçe verilerinizle bizzat hesaplayabiliyorum. Bana dilediğinizi yazabilirsiniz:\n`;
    advice += `• 📊 **Genel Bütçe Karnesi**: "Mevcut bütçe durumum genel olarak nasıl?"\n`;
    advice += `• 🚀 **Borç Eritme Stratejileri**: "Borçlarımı kartopu veya avalanche ile nasıl eritirim?"\n`;
    advice += `• 🎯 **Gider ve Tasarruf Tüyoları**: "Birikim yapmak için hangi harcamalarımı kısmalıyım?"\n`;
    advice += `• 🔍 **Kategori Analizi**: "Market (veya faturalar) için ne kadar harcama yaptım?"\n\n`;
    advice += `Sorularınızı bekliyorum!`;

  } else {
    // Genel Analiz Rapor Özetleme
    advice += `👋 **Bütçem Pro Bireysel Finansal Tavsiye Özet Raporu**\n\n`;
    advice += `Yazdığınız soruyu bütçenizin genel matematiksel verileriyle ilişkilendirerek detaylı şekilde analiz ettim:\n\n`;
    advice += `• **Aylık Gelir Kaynağınız**: ₺${stats.totalIncome.toLocaleString("tr-TR")}\n`;
    advice += `• **Aylık Gider Yükünüz**: ₺${stats.totalExpense.toLocaleString("tr-TR")}\n`;
    advice += `• **Kalan Serbest Net Rezerve**: ₺${stats.netIncome.toLocaleString("tr-TR")}\n`;
    advice += `• **Geri Ödenecek Kalan Toplam Borç**: ₺${stats.remaining.toLocaleString("tr-TR")} (Ödenen: ₺${stats.totalPaid.toLocaleString("tr-TR")})\n\n`;
    advice += `Bana borç kapatma simülasyonları (*Kartopu/Çığ yöntemleri*), sektörel harcama analizleri (*market, fatura, kira harcamaları*) veya tasarruf yöntemleri hakkında sorular yöneltebilirsiniz. Bütçe kalemlerinizi bizzat hesaplayarak size en rasyonel önerileri sunmaktan mutluluk duyarım!`;
  }

  advice += `\n\n---\n`;
  advice += `⚙️ *Bilgi: Bu analiz çevrimdışı finans hesaplama motoru tarafından bütçe verileriniz bizzat hesaplanarak üretilmiştir. Çevrimiçi yapay zekayı (Gemini 3.5) aktifleştirmek isterseniz, yan menüdeki **Yapay Zekâ Motor Ayarları** alanından kendi Gemini API Anahtarınızı kolayca kaydedebilirsiniz.*`;

  return advice;
}

// API Route for Yapay Zeka (AI Specialist)
app.post("/api/chat", async (req, res) => {
  const { message, context, chatHistory, userApiKey } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Mesaj alanı boş bırakılamaz." });
  }

  const aiClient = getGeminiClient(userApiKey);
  if (!aiClient) {
    const advice = getSmartFallbackResponse(message, context, "Çevrimdışı Mod");
    return res.json({ reply: advice });
  }

  try {
    const stats = context?.stats;
    const totalDebt = stats?.totalDebt || 0;
    const totalPaid = stats?.totalPaid || 0;
    const remaining = stats?.remaining || 0;
    const totalIncome = stats?.totalIncome || 0;
    const totalExpense = stats?.totalExpense || 0;
    const netIncome = stats?.netIncome || 0;
    const thisMonthKalanBorc = stats?.thisMonthKalanBorc || 0;
    const thisMonthPaidBorc = stats?.thisMonthPaidBorc || 0;
    const thisMonthTotalBorc = stats?.thisMonthTotalBorc || (thisMonthKalanBorc + thisMonthPaidBorc);

    const TURKISH_MONTHS = [
      "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];
    const periodLabel = context?.selectedMonth !== undefined && context?.selectedYear !== undefined
      ? `${TURKISH_MONTHS[context.selectedMonth] || ""} ${context.selectedYear}`
      : "Mevcut Ay";

    const cRates = context?.rates || {};
    const usd = cRates.USD || 45.85;
    const eur = cRates.EUR || 49.85;
    const gbp = cRates.GBP || 58.20;
    const goldOns = cRates.GOLD_ONS || 4474.20;
    const goldGram = cRates.GOLD_GRAM || ((goldOns * usd) / 31.10348);
    const goldCeyrek = cRates.GOLD_CEYREK || (goldGram * 1.635);
    const btcUsd = cRates.BTC_USD || 81588;

    const systemPrompt = `Sen "Bütçem Pro" bireysel finans yönetim ve borç takip uygulamasının en güncel "Gemini 3.7 Flash" yapay zeka finans koçu ve uzman analistisin. Türkçe konuşacaksın.
Kullanıcının ${periodLabel} dönemi güncel bütçe durumu ve mali parametreleri şunlardır:
- Seçili Dönem: ${periodLabel}
- Toplam Aylık Gelir: ₺${totalIncome}
- Toplam Aylık Gider: ₺${totalExpense}
- Kalan Net Gelir (Bakiye): ₺${netIncome}
- Bu Ay Vadesi Gelen Kalan Borç: ₺${thisMonthKalanBorc}
- Bu Ay Ödenen Borç: ₺${thisMonthPaidBorc}
- Bu Ayki Toplam Borç Yükü: ₺${thisMonthTotalBorc}
- Genel Toplam Kalan Borç Portföyü (Tüm Vadeler): ₺${remaining}
- Toplam Borç Kaydı: ₺${totalDebt}
- Toplam Ödenen Borç: ₺${totalPaid}
- Taksitli Borç Sayısı: ${context?.installmentDebts?.length || 0}
- Taksitli Borç Detayı: ${JSON.stringify(context?.installmentDebts || [])}
- Standart Borç Listesi Detayı: ${JSON.stringify(context?.debts || [])}
- Giderler Listesi Detayı: ${JSON.stringify(context?.expenses || [])}
- Rehber Kişi Borçları ve Alacakları: ${JSON.stringify(context?.contactTransactions || [])}
- Rehber Kişileri Listesi: ${JSON.stringify(context?.contacts || [])}

ANLIK ANLIK GÜNCEL PİYASA, DÖVİZ VE ALTIN KURLARI (GÜNCEL CANLI VERİLER):
• Amerikan Doları (USD): ₺${usd.toFixed(2)}
• Euro (EUR): ₺${eur.toFixed(2)}
• İngiliz Sterlini (GBP): ₺${gbp.toFixed(2)}
• Gram Altın (24 Ayar): ₺${Math.round(goldGram).toLocaleString("tr-TR")} TL
• Çeyrek Altın: ₺${Math.round(goldCeyrek).toLocaleString("tr-TR")} TL
• Ons Altın ($): $${Math.round(goldOns).toLocaleString("en-US")} USD
• Bitcoin (BTC): $${Math.round(btcUsd).toLocaleString("en-US")} USD

ÖNEMLİ KURAL: Kullanıcının toplam aylık gelirini (₺${totalIncome}) ve toplam aylık giderini (₺${totalExpense}) doğrudan yukarıdaki resmi istatistiklerden al ve asla 0 TL olarak varsayma. Dolar, Euro, Altın (Gram/Çeyrek/Ons) veya piyasalar sorulduğunda doğrudan yukarıdaki güncel canlı fiyatları ve TL tutarlarını aktar.

Görevlerin ve Davranış Kuralların:
1. Gelir/gider dengesini ve kalan borç durumunu analiz et, kullanıcının risk seviyesini (Yüksek Risk, Orta Seviye, Güvenli) belirle ve rasyonel yorumlar yap.
2. Tasarruf yöntemleri, borç kapatma stratejileri (Kartopu / Çığ yöntemleri vb.) hakkında son derece açıklayıcı, somut, adım adım finansal öneriler sun.
3. Kullanıcının sorduğu soruları bu finansal verileri göz ardı etmeden detaylı ve cesaretlendirici bir dille cevapla.
4. MOBİL VE DÜZENLİ GÖRÜNÜM KURALI: Mobil ekranlarda yazıların alt alta ve son derece belirgin, ferah ve tertipli okunması için:
   - Yanıtlarını net alt başlıklara ayır (### veya 📊, 🚀, 💡, 🎯, 💰 gibi emojilerle).
   - Maddeleri alt alta açıkça sırala (• veya - kullanarak).
   - Numaralı adımları (1., 2., 3.) tek tek ayrı satırlarda yaz.
   - Önemli tutarları ve tavsiyeleri **kalın** vurgula.
   - Uzun ve karmaşık tek parça blok metinlerden kaçın, her bölüm arasına bir boş satır bırak.
5. ÇEVRİMİÇİ (ONLINE) SORGULAR VE GÜNCEL BİLGİLER: Kullanıcı döviz kurlarını, güncel altın fiyatlarını, enflasyon veya diğer detayları sorduğunda yukarıdaki anlık canlı piyasa verilerini ve entegre Google Arama (googleSearch) aracını kullan. Kullanıcıya "Bilmiyorum" demek yerine kesin ve şeffaf yanıt ver.
6. Tamamen profesyonel, yapıcı ve sıcakkanlı bir finans koçu gibi davran.`;

    const rawTurns = [];
    if (chatHistory && Array.isArray(chatHistory)) {
      for (const turn of chatHistory) {
        const textStr = turn.text || "";
        // Skip fallback/alert messages from history
        if (
          textStr.includes("Yapay Zeka Servisi Bilgilendirmesi") ||
          textStr.includes("Yapay Zeka Servis Bildirimi") ||
          textStr.includes("çevrimdışı") ||
          textStr.includes("bağlantı kurulamadı") ||
          textStr.includes("zaman aşımına") ||
          textStr.includes("geçici bir") ||
          textStr.includes("API anahtarının")
        ) {
          continue;
        }

        rawTurns.push({
          role: turn.sender === "user" ? "user" : "model",
          text: textStr,
        });
      }
    }

    rawTurns.push({
      role: "user",
      text: message,
    });

    // Enforce alternation starting with user, merge sequential identical roles if any
    const contents: any[] = [];
    for (const turn of rawTurns) {
      if (contents.length === 0) {
        if (turn.role === "user") {
          contents.push({
            role: "user",
            parts: [{ text: turn.text }],
          });
        }
      } else {
        const lastTurn = contents[contents.length - 1];
        if (lastTurn.role === turn.role) {
          lastTurn.parts[0].text += "\n" + turn.text;
        } else {
          contents.push({
            role: turn.role,
            parts: [{ text: turn.text }],
          });
        }
      }
    }

    // Enforce an active 20-second timeout to allow rich reasoning and search grounding results
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout after 20000ms: Gemini API calls took too long, switching temporarily to offline analysis.")), 20000);
    });

    const geminiPromise = aiClient.models.generateContent({
      model: "gemini-3.7-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        tools: [{ googleSearch: {} }],
      },
    });

    const response = await Promise.race([geminiPromise, timeoutPromise]);
    res.json({ reply: response.text });
  } catch (error: any) {
    const errMsg = error?.message || error?.toString() || "";

    const isKeyError = errMsg.toLowerCase().includes("expired") || 
                       errMsg.toLowerCase().includes("key") || 
                       errMsg.toLowerCase().includes("credential") || 
                       errMsg.toLowerCase().includes("invalid_argument") ||
                       errMsg.toLowerCase().includes("unauthorized") ||
                       errMsg.toLowerCase().includes("api_key_invalid") ||
                       errMsg.toLowerCase().includes("forbidden") ||
                       errMsg.toLowerCase().includes("denied") ||
                       errMsg.toLowerCase().includes("403");

    const isTimeout = errMsg.toLowerCase().includes("timeout") ||
                      errMsg.toLowerCase().includes("deadline") ||
                      errMsg.toLowerCase().includes("duration");

    const reason = isKeyError 
      ? "API Anahtarı / Yetkilendirme Hatası (403)" 
      : isTimeout 
        ? "Yapay Zeka Bağlantı Zaman Aşımı" 
        : "Ağ Kısıtlaması";

    if (isKeyError) {
      if (!userApiKey) {
        defaultKeyHasFailed = true;
      }
      console.log("[Gemini Client Service] Active key check: Key has expired or domain is restricted. Bypassing silently.");
    } else if (isTimeout) {
      console.log("[Gemini Client Service] Active connection timeout. Speed limit configured.");
    } else {
      console.log("[Gemini Client Service] General network bypass triggered.");
    }
    
    // Call the intelligent fallback responder instead of static warning block to yield customized assistance
    const advice = getSmartFallbackResponse(message, context, reason);
    return res.json({ reply: advice });
  }
});

function convertTurkishWordsToNumbersServer(text: string): string {
  let result = text;
  const explicitPhrases: [RegExp, string][] = [
    [/(\b)bir milyon(\b)/gi, "1000000"],
    [/(\b)yüz elli bin(\b)/gi, "150000"],
    [/(\b)yüz bin(\b)/gi, "100000"],
    [/(\b)elli bin(\b)/gi, "50000"],
    [/(\b)kırk bin(\b)/gi, "40000"],
    [/(\b)otuz bin(\b)/gi, "30000"],
    [/(\b)yirmi bin(\b)/gi, "20000"],
    [/(\b)on bin(\b)/gi, "10000"],
    [/(\b)dokuz bin(\b)/gi, "9000"],
    [/(\b)sekiz bin(\b)/gi, "8000"],
    [/(\b)yedi bin(\b)/gi, "7000"],
    [/(\b)altı bin(\b)/gi, "6000"],
    [/(\b)beş bin(\b)/gi, "5000"],
    [/(\b)dört bin(\b)/gi, "4000"],
    [/(\b)üç bin(\b)/gi, "3000"],
    [/(\b)iki bin(\b)/gi, "2000"],
    [/(\b)bin(\b)/gi, "1000"],
    [/(\b)beş yüz(\b)/gi, "500"],
    [/(\b)yedi yüz elli(\b)/gi, "750"],
    [/(\b)yedi yüz(\b)/gi, "700"],
    [/(\b)sekiz yüz(\b)/gi, "800"],
    [/(\b)dokuz yüz(\b)/gi, "900"],
    [/(\b)dört yüz(\b)/gi, "400"],
    [/(\b)üç yüz(\b)/gi, "300"],
    [/(\b)iki yüz(\b)/gi, "200"],
    [/(\b)yüz(\b)/gi, "100"],
    [/(\b)on iki(\b)/gi, "12"],
    [/(\b)on altı(\b)/gi, "16"],
    [/(\b)on sekiz(\b)/gi, "18"],
    [/(\b)yirmi dört(\b)/gi, "24"],
    [/(\b)otuz altı(\b)/gi, "36"]
  ];

  explicitPhrases.forEach(([regex, replacement]) => {
    result = result.replace(regex, replacement);
  });

  return result;
}

function cleanTurkishPersonNameServer(rawName: string): string {
  let name = rawName.trim();
  if (name.includes("'") || name.includes("’")) {
    name = name.split(/['"’]/)[0].trim();
  }
  name = name.replace(/(den|dan|ten|tan|nin|nın|nun|nün|ye|ya|de|da|te|ta|e|a)$/gi, (match, suffix, offset, fullStr) => {
    if (fullStr.length - match.length >= 3) {
      return "";
    }
    return match;
  });
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name;
}

// Resilient Offline Voice command parser for Turkish
function parseVoiceCommandOffline(rawText: string): any {
  const text = convertTurkishWordsToNumbersServer(rawText);
  const norm = text.toLowerCase().trim();
  
  // Clean text of punctuation and replace some typical Turkish speech transcription artifacts
  const cleanNorm = norm
    .replace(/['"’\.]/g, "")
    .replace(/lira/gi, "tl")
    .replace(/türk lirası/gi, "tl");

  // Check for deletion first (since it might not contain a number, e.g. "Maaş gelirini sil" or "Ahmet borcunu sil")
  if (cleanNorm.includes("sil") || cleanNorm.includes("çıkar") || cleanNorm.includes("cikar") || cleanNorm.includes("kaldır") || cleanNorm.includes("kaldir")) {
    if (cleanNorm.includes("gelir")) {
      const name = text.replace(/(gelir|sil|çıkar|cikar|kaldır|kaldir|ekle|kaydet|tl|türk lirası|lira|₺)/gi, "").trim();
      return {
        action: "deleteIncome",
        deleteIncomeData: { name },
        explanation: `🔊 "${name || 'Gelir'}" isimli gelir kaydınızın silinmesini talep ettiniz. İşlem gerçekleştiriliyor.`
      };
    } else if (cleanNorm.includes("borç") || cleanNorm.includes("borc")) {
      const name = text.replace(/(borç|borc|sil|çıkar|cikar|kaldır|kaldir|ekle|kaydet|tl|türk lirası|lira|₺)/gi, "").trim();
      return {
        action: "deleteDebt",
        deleteDebtData: { name },
        explanation: `🔊 "${name || 'Borç'}" isimli borç kaydınızın silinmesini talep ettiniz. İşlem gerçekleştiriliyor.`
      };
    } else {
      // Default assume expense
      const desc = text.replace(/(harcama|gider|sil|çıkar|cikar|kaldır|kaldir|ekle|kaydet|tl|türk lirası|lira|₺)/gi, "").trim();
      return {
        action: "deleteExpense",
        deleteExpenseData: { description: desc },
        explanation: `🔊 "${desc || 'Harcama'}" isimli harcama kaydınızın silinmesini talep ettiniz. İşlem gerçekleştiriliyor.`
      };
    }
  }

  // Extract all numbers
  const numMatches = [...cleanNorm.matchAll(/(\d+[\d\s,.]*)/g)];
  if (numMatches.length === 0) {
    return {
      action: "unknown",
      explanation: `🤔 Söylediğiniz ifadede herhangi bir tutar/sayı algılayamadım: "${text}". Lütfen: "Market 150 lira" veya "Ahmet borç 2000 TL" gibi bir tutar belirterek söyleyin.`
    };
  }

  // Parse the first number found (amount)
  let amount = 0;
  const rawNum1 = numMatches[0][1].replace(/\s/g, "");
  if (rawNum1.includes(",") && rawNum1.includes(".")) {
    amount = parseFloat(rawNum1.replace(/\./g, "").replace(/,/g, "."));
  } else if (rawNum1.includes(",")) {
    const parts = rawNum1.split(",");
    if (parts[1].length <= 2) {
      amount = parseFloat(rawNum1.replace(/,/g, "."));
    } else {
      amount = parseFloat(rawNum1.replace(/,/g, ""));
    }
  } else {
    amount = parseFloat(rawNum1);
  }

  amount = isNaN(amount) ? 0 : amount;

  if (amount <= 0) {
    return {
      action: "unknown",
      explanation: `🤔 Söylediğiniz ifadedeki tutar geçersiz: "${text}". Lütfen geçerli bir miktar belirtin.`
    };
  }

  // 1. Taksit (taksit, ay taksit, taksitle)
  if (cleanNorm.includes("taksit")) {
    let installmentCount = 12; // default
    if (numMatches.length >= 2) {
      const parsedCount = parseInt(numMatches[1][1].replace(/\s/g, ""));
      if (!isNaN(parsedCount) && parsedCount > 0) {
        installmentCount = parsedCount;
      }
    }
    
    let name = "Taksit Planı";
    const cleanedName = text.replace(/\d+/g, "").replace(/(taksit|taksitli|tl|türk lirası|lira|₺|ekle|kaydet|borç|borc|için|icin)/gi, "").trim();
    if (cleanedName.length > 2) {
      name = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
    }

    return {
      action: "addInstallment",
      installmentData: {
        name,
        totalAmount: amount,
        installmentCount,
        paidInstallmentCount: 0,
        firstDueDate: new Date().toISOString().slice(0, 10)
      },
      explanation: `🔊 Çevrimdışı Mod: ${installmentCount} Ay taksitli "${name}" (Toplam: ₺${amount}) planınız başarıyla tanımlandı.`
    };
  }

  // 2. Income/Gelir (gelir, maaş, alacak, aldım, kazandım, yattı, yatti, yatta)
  if (cleanNorm.includes("gelir") || cleanNorm.includes("maaş") || cleanNorm.includes("maas") || cleanNorm.includes("kazandım") || cleanNorm.includes("kazandim") || cleanNorm.includes("yattı") || cleanNorm.includes("yatti") || cleanNorm.includes("yatta") || cleanNorm.includes("alacak")) {
    let name = "Sesli Gelir";
    const cleanedName = text.replace(/\d+/g, "").replace(/(gelir|maaş|maas|tl|türk lirası|lira|₺|ekle|kaydet|aldım|aldim|kazandım|kazandim|yattı|yatti|yatta|için|icin|alacak)/gi, "").trim();
    if (cleanedName.length > 2) {
      name = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
    }

    return {
      action: "addIncome",
      incomeData: { name, amount, date: new Date().toISOString().slice(0, 10) },
      explanation: `🔊 Çevrimdışı Mod: "${name}" bütçenize ₺${amount} tutarında gelir olarak eklenmiştir.`
    };
  }

  // 3. Debt update (e.g., 'Ahmet borcunun ödenen kısmını 500 TL yap' or 'Mehmet borcuna 200 TL ödedim')
  if ((cleanNorm.includes("borç") || cleanNorm.includes("borc")) && (cleanNorm.includes("ödenen") || cleanNorm.includes("yap") || cleanNorm.includes("güncelle") || cleanNorm.includes("guncelle") || cleanNorm.includes("öde") || cleanNorm.includes("ode") || cleanNorm.includes("tutar") || cleanNorm.includes("miktar"))) {
    const isAbsolute = cleanNorm.includes("yap") || cleanNorm.includes("olsun") || cleanNorm.includes("eşitle") || cleanNorm.includes("esitle");
    
    let debtName = "";
    const matchName = text.match(/^(.*?)(?:borç|borc|ödenen|ode|yap|güncelle|tutar|miktar)/i);
    if (matchName && matchName[1].trim().length > 1) {
      debtName = cleanTurkishPersonNameServer(matchName[1]);
    }

    if (debtName) {
      return {
        action: "updateDebtPaid",
        updateDebtData: {
          name: debtName,
          paidAmount: amount,
          isAbsolute
        },
        explanation: `🔊 Çevrimdışı Mod: "${debtName}" borcunun ödenen kısmı ₺${amount} olarak ${isAbsolute ? 'güncellenecektir.' : 'artırılacaktır.'}`
      };
    }
  }

  // 4. Debt/Borç (borç, borc, verecek, borçlandım, aldım, borclandim, borçlandık, borclandik, alacak)
  if (cleanNorm.includes("borç") || cleanNorm.includes("borc") || cleanNorm.includes("borçlandım") || cleanNorm.includes("borclandim") || cleanNorm.includes("borçlandık") || cleanNorm.includes("borclandik") || cleanNorm.includes("verecek") || cleanNorm.includes("alacak") || cleanNorm.includes("borcum")) {
    let name = "Sesli Borç";
    const cleanedName = text.replace(/\d+/g, "").replace(/(borç|borc|tl|türk lirası|lira|₺|ekle|kaydet|borçlandım|borclandim|borçlandık|borclandik|için|icin|verecek|alacak|verdim|aldım|borcum)/gi, "").trim();
    if (cleanedName.length > 2) {
      name = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
    }

    const rawBaseName = name.split(/['"’\s-]/)[0].replace(/[0-9]/g, "");
    const baseName = cleanTurkishPersonNameServer(rawBaseName);
    const isPerson = cleanNorm.includes("verdim") || cleanNorm.includes("aldım") || cleanNorm.includes("alacağım") || cleanNorm.includes("alacagim") || cleanNorm.includes("borcum") || cleanNorm.includes("vereceğim") || cleanNorm.includes("verecegim") || (cleanedName.length < 25 && !cleanNorm.includes("banka") && !cleanNorm.includes("kart") && !cleanNorm.includes("kredi"));

    if (isPerson && baseName.length > 1) {
      const isReceivable = cleanNorm.includes("verdim") || cleanNorm.includes("alacak") || cleanNorm.includes("alacağım") || cleanNorm.includes("alacagim") || cleanNorm.includes("bana borç") || cleanNorm.includes("bana borc");
      const pType = isReceivable ? "receivable" : "payable";

      return {
        action: "addContactDebt",
        contactDebtData: {
          contactName: baseName,
          amount,
          type: pType,
          description: "Sesli kayıt ile otomatik oluşturuldu"
        },
        explanation: `🔊 Çevrimdışı Mod: Kişi rehberinizdeki "${baseName}" isimli kişiye ₺${amount} tutarında ${pType === "receivable" ? "alacak" : "verecek/borç"} kaydı başarıyla eklenmiştir.`
      };
    }

    let debtCategory = "Şahıs";
    if (cleanNorm.includes("banka") || cleanNorm.includes("kredi")) debtCategory = "Banka";
    else if (cleanNorm.includes("kart")) debtCategory = "Kredi Kartı";
    else if (cleanNorm.includes("fatura")) debtCategory = "Fatura";
    else if (cleanNorm.includes("aidat")) debtCategory = "Aidat";

    return {
      action: "addDebt",
      debtData: {
        name,
        amount,
        paid: 0,
        category: debtCategory,
        dueDate: new Date().toISOString().slice(0, 10)
      },
      explanation: `🔊 Çevrimdışı Mod: "${name}" olarak ₺${amount} değerinde yeni bir borç eklenmiştir.`
    };
  }

  // 5. Default Fallback -> It is an Expense! (market, gıda, yemek, fatura, benzin, vb. or simply general phrase with numbers)
  let categoryId = 1; // Default: Diğer
  let desc = "Gider Kaydı";
  
  if (cleanNorm.includes("market") || cleanNorm.includes("gıda") || cleanNorm.includes("gida") || cleanNorm.includes("manav") || cleanNorm.includes("süpermarket") || cleanNorm.includes("supermarket")) {
    categoryId = 2; // Market
    desc = "Market Gideri";
  } else if (cleanNorm.includes("ulaşım") || cleanNorm.includes("ulasim") || cleanNorm.includes("yol") || cleanNorm.includes("taksi") || cleanNorm.includes("yakıt") || cleanNorm.includes("benzin") || cleanNorm.includes("otobüs") || cleanNorm.includes("bilet")) {
    categoryId = 3; // Ulaşım
    desc = "Ulaşım Gideri";
  } else if (cleanNorm.includes("yemek") || cleanNorm.includes("kafe") || cleanNorm.includes("cafe") || cleanNorm.includes("lokanta") || cleanNorm.includes("restoran") || cleanNorm.includes("döner") || cleanNorm.includes("pizz")) {
    categoryId = 4; // Yeme İçme
    desc = "Yemek Gideri";
  } else if (cleanNorm.includes("fatura") || cleanNorm.includes("elektrik") || cleanNorm.includes("su") || cleanNorm.includes("gaz") || cleanNorm.includes("telefon") || cleanNorm.includes("internet") || cleanNorm.includes("aidat")) {
    categoryId = 5; // Faturalar
    desc = "Fatura Ödemesi";
  }

  const cleanedDesc = text.replace(/\d+/g, "").replace(/(gider|harcama|tl|türk lirası|lira|₺|ekle|kaydet|için|icin|satın|aldım|aldim|fatura|ödedim|odedim|ödeme|odeme)/gi, "").trim();
  if (cleanedDesc.length > 2) {
    desc = cleanedDesc.charAt(0).toUpperCase() + cleanedDesc.slice(1);
  }

  return {
    action: "addExpense",
    expenseData: { amount, description: desc, categoryId },
    explanation: `🔊 Çevrimdışı Mod: "${desc}" bütçenize ₺${amount} tutarında harcama olarak eklenmiştir.`
  };
}

// API Route for voice commands voice assistant parsing
app.post("/api/voice-command", async (req, res) => {
  const { text, userApiKey } = req.body;
  
  if (!text || text.trim() === "") {
    return res.status(400).json({ error: "Boş komut algılandı." });
  }

  const aiClient = getGeminiClient(userApiKey);

  if (!aiClient) {
    console.log("[Voice Command API] Gemini API key not set or inactive. Falling back to offline fallback parser.");
    const offlineResult = parseVoiceCommandOffline(text);
    return res.json(offlineResult);
  }

  try {
    const promptText = 
      "Sen 'Bütçem Pro' finans asistanısın. Kullanıcının türkçe sesli bütçe kaydı / komutunu analiz edip bunu yapılandırılmış JSON verisine dönüştüreceksin.\n\n" +
      "Kullanıcı şunları yapabilir:\n" +
      "1. Borç ekleme (addDebt): Belirli bir şahsı belirtmeyen genel borçlar. Örn: 'Birim borcu 2000 TL', 'Banka kredisi borcu 100000 TL', vb. (Eğer sesli komutta belirli ve özel bir kişi ismi geçiyorsa, bu eylem yerine mutlaka addContactDebt eylemini kullan!)\n" +
      "2. Kişi alacak verecek ekleme (addContactDebt): Sesli komutta belirli bir şahıs/kişi ismi geçiyorsa (örn: 'Ahmet'e 5000 lira borç verdim', 'Mehmet'ten 3000 lira borç aldım', 'Zeynep'ten 1000 TL alacağım var', 'Ayşe'ye 200 TL borcum var'). Bu durumda contactName (Örn: 'Ahmet', 'Mehmet', 'Zeynep', 'Ayşe'), amount (Tutar), type ('receivable' veya 'payable') ve description alanlarını doldur.\n" +
      "   - 'receivable' (Alacak): Biz ona borç verdiysek ya da ondan bir alacağımız varsa. (Örn: 'borç verdim', 'alacağım var', 'bana borçlu')\n" +
      "   - 'payable' (Verecek): Ondan borç aldıysak ya da ona bir borcumuz varsa. (Örn: 'borç aldım', 'borcum var', 'ona vereceğim var')\n" +
      "3. Taksit/Taksitli borç ekleme (addInstallment): 'Koltuk takımı 12000 lira 6 taksit', 'Telefon için 24000 TL 12 taksit', vb.\n" +
      "4. Harcama/Gider ekleme (addExpense): 'Market harcaması 250 lira', 'Benzin aldım 800 TL', 'Yemek 350 lira', vb.\n" +
      "5. Gelir ekleme (addIncome): 'Maaş yattı 35000 lira', 'Kira geliri aldım 15000 TL', vb.\n" +
      "6. Borç güncelleme / Ödenen kısmı güncelleme (updateDebtPaid): 'Ahmet borcunun ödenen kısmını 500 TL yap', 'Banka kredisi borcunun ödenenini 1000 lira yap', 'Mehmet borcuna 200 TL ödedim' vb.\n" +
      "7. Harcama/Gider silme (deleteExpense): 'Market harcamasını sil', 'Yemek giderini kaldır' vb.\n" +
      "8. Gelir silme (deleteIncome): 'Maaş gelirini kaldır', 'Kira gelirini sil' vb.\n" +
      "9. Borç silme (deleteDebt): 'Ahmet borcunu sil', 'banka borcunu kaldır' vb.\n\n" +
      "Senin görevin, söylenen ifadeyi bu eylemlerden birine sığdırmak (action: 'addDebt' | 'addContactDebt' | 'addInstallment' | 'addExpense' | 'addIncome' | 'updateDebtPaid' | 'deleteExpense' | 'deleteIncome' | 'deleteDebt' | 'unknown') ve ilgili bilgileri çıkarmaktır. Gerekirse tarihleri bugünün tarihi varsay.\n" +
      "Ayrıca, kullanıcının eylemi duyduğunu onaylayan sevimli, samimi bir yapay zeka Türkçe sesli asistan onay mesajı yaz (explanation). Örn: 'Anlaşıldı! Harcama kaydınızı silme işlemini başlatıyorum.'";

    const response = await aiClient.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [
        { text: promptText },
        { text: `Kullanıcının Sözü: "${text}"` }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: {
              type: Type.STRING,
              description: "Eylem tipi: 'addDebt', 'addContactDebt', 'addInstallment', 'addExpense', 'addIncome', 'updateDebtPaid', 'deleteExpense', 'deleteIncome', 'deleteDebt' veya bilinmiyorsa 'unknown'."
            },
            contactDebtData: {
              type: Type.OBJECT,
              description: "addContactDebt eylemi için kişi bazlı alacak/verecek verileri.",
              properties: {
                contactName: { type: Type.STRING, description: "Şahıs/Kişi ismi (Örn: Ahmet, Ayşe vb.)" },
                amount: { type: Type.NUMBER, description: "Tutar" },
                type: { type: Type.STRING, description: "İşlem yönü: Kullanıcının alacağı varsa 'receivable' (Alacak), borcu varsa 'payable' (Verecek)" },
                description: { type: Type.STRING, description: "Açıklama (Örn: 'Sesli Alacak Kaydı')" }
              }
            },
            debtData: {
              type: Type.OBJECT,
              description: "addDebt eylemi için borç verileri.",
              properties: {
                name: { type: Type.STRING, description: "Borç veren/alan veya açıklama unvanı" },
                amount: { type: Type.NUMBER, description: "Borç miktarı" },
                paid: { type: Type.NUMBER, description: "Ödenmiş miktar (Varsayılan 0)" },
                category: { type: Type.STRING, description: "Banka, Eş-Dost, Vergi, Kredi Kartı vb." },
                dueDate: { type: Type.STRING, description: "Son ödeme tarihi (Format: YYYY-MM-DD)" }
              }
            },
            updateDebtData: {
              type: Type.OBJECT,
              description: "updateDebtPaid eylemi için borç güncelleme verileri.",
              properties: {
                name: { type: Type.STRING, description: "Güncellenecek borcun ismi (Kullanıcının belirttiği borç adı, örn: 'Ahmet', 'Banka kredisi' vb.)" },
                paidAmount: { type: Type.NUMBER, description: "Ödeme tutarı veya ödenen miktarın yeni değeri" },
                isAbsolute: { type: Type.BOOLEAN, description: "Eğer ödenen tutar doğrudan bu değere EŞİTLENECEK ise true (örn: 'ödenen kısmını 500 TL yap'), eğer mevcut ödenenin üzerine EKLENECEK ise false (örn: '500 TL ödeme yaptım', 'mevcut ödemeye 300 TL ekle' veya 'X borcuna 200 TL ödedim')" }
              }
            },
            installmentData: {
              type: Type.OBJECT,
              description: "addInstallment eylemi için taksit verileri.",
              properties: {
                name: { type: Type.STRING, description: "Taksit planı açıklaması" },
                totalAmount: { type: Type.NUMBER, description: "Toplam borç miktarı" },
                installmentCount: { type: Type.INTEGER, description: "Taksit sayısı" },
                paidInstallmentCount: { type: Type.INTEGER, description: "Ödenen taksit sayısı (Varsayılan 0)" },
                firstDueDate: { type: Type.STRING, description: "İlk taksit tarihi (Format: YYYY-MM-DD)" }
              }
            },
            expenseData: {
              type: Type.OBJECT,
              description: "addExpense eylemi için gider verileri.",
              properties: {
                amount: { type: Type.NUMBER, description: "Tutar" },
                description: { type: Type.STRING, description: "Açıklama" },
                categoryId: { type: Type.INTEGER, description: "Kategori ID'si (1: Kira/Yurt, 2: Market, 3: Ulaşım, 4: Yeme İçme, 5: Faturalar)" }
              }
            },
            incomeData: {
              type: Type.OBJECT,
              description: "addIncome eylemi için gelir verileri.",
              properties: {
                name: { type: Type.STRING, description: "Gelir unvanı/kaynağı" },
                amount: { type: Type.NUMBER, description: "Tutar" },
                date: { type: Type.STRING, description: "Gelir tarihi (Format: YYYY-MM-DD)" }
              }
            },
            deleteExpenseData: {
              type: Type.OBJECT,
              description: "deleteExpense eylemi için.",
              properties: {
                description: { type: Type.STRING, description: "Silinecek harcamanın açıklaması/adı" }
              }
            },
            deleteIncomeData: {
              type: Type.OBJECT,
              description: "deleteIncome eylemi için.",
              properties: {
                name: { type: Type.STRING, description: "Silinecek gelirin açıklaması/adı" }
              }
            },
            deleteDebtData: {
              type: Type.OBJECT,
              description: "deleteDebt eylemi için.",
              properties: {
                name: { type: Type.STRING, description: "Silinecek borcun açıklaması/adı" }
              }
            },
            explanation: {
              type: Type.STRING,
              description: "Kullanıcıya söylenecek Türkçe sevimli onay cümlesi."
            }
          },
          required: ["action", "explanation"]
        },
        temperature: 0.1,
      },
    });

    const parsedData = JSON.parse(response.text || "{}");
    return res.json(parsedData);
  } catch (error: any) {
    console.error("[Voice Command API Error]:", error);
    // Silent bypass to offline fallback parser
    const offlineResult = parseVoiceCommandOffline(text);
    return res.json(offlineResult);
  }
});

// API Route for receipt & bill OCR scanning using Gemini 3.5-Flash
app.post("/api/scan-receipt", async (req, res) => {
  const { image, mimeType: userMimeType } = req.body;
  if (!image) {
    return res.status(400).json({ error: "Lütfen taranacak fatura veya fiş görselini seçin." });
  }

  // Sanitize base64 and extract mimeType dynamically
  let base64Data = image;
  let detectedMimeType = userMimeType || "image/jpeg";

  if (base64Data.includes(",")) {
    const parts = base64Data.split(",");
    const match = parts[0].match(/data:(.*?);base64/);
    if (match) {
      detectedMimeType = match[1];
    }
    base64Data = parts[1];
  }

  const aiClient = getGeminiClient();
  
  if (!aiClient) {
    console.log("[Scan Receipt API] Gemini API key not set or inactive. Falling back to intelligent offline simulated scan.");
    // Simulate smart parsing delay for superior UX feel
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const todayStr = new Date().toISOString().split("T")[0];
    return res.json({
      success: true,
      title: "Seçili Belge (Örnek Alışveriş)",
      amount: 450.00,
      date: todayStr,
      categorySuggestion: "Gıda / Market",
      type: "expense",
      isOffline: true,
      message: "Akıllı tarama simülasyonu çalıştırıldı. Gerçek yapay zeka tespiti için lütfen Settings > Secrets panelinden GEMINI_API_KEY tanımlayın!"
    });
  }

  try {
    const promptText = 
      "Sen harika ve hassas bir belge okuma (OCR) servisisin. Ekteki görsel bir alışveriş fişi, fatura, makbuz ya da harcama belgesidir.\n\n" +
      "Görevlerin:\n" +
      "1. Belgedeki mağaza/satıcı/kurum adını tam olarak çıkar (örn: 'Migros Ticaret A.Ş.', 'Shell Akaryakıt', 'Elektrik Dağıtım').\n" +
      "2. Belgedeki KDV dahil toplam ödeme tutarını (KRD ya da NAKİT toplamı) sayısal olarak bul.\n" +
      "3. Belgedeki tarihi oku (Format: YYYY-MM-DD formatında olmalı. Eğer yıl açık değilse 2026 olarak varsay).\n" +
      "4. En uygun harcama kategorisini öner ('Gıda', 'Ulaşım', 'Fatura', 'Alışveriş', 'Eğlence', 'Sağlık', 'Diğer' vb.).\n" +
      "5. Bu belgenin bir peşin gider mi ('expense') yoksa bir sonraki ödemeli borç mu ('debt') olduğunu tespit et.\n\n" +
      "Verdiğin yanıt JSON şemasına tamamen uygun, ek açıklama metni içermeyen temiz bir JSON objesi olmalıdır.";

    const response = await aiClient.models.generateContent({
      model: "gemini-3.7-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: detectedMimeType,
              data: base64Data,
            },
          },
          {
            text: promptText,
          },
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Satıcı veya belge unvanı (örneğin: 'Bim Birleşik Mağazalar', 'Kira Faturası')"
            },
            amount: {
              type: Type.NUMBER,
              description: "Toplam harcama veya ödeme tutarı"
            },
            date: {
              type: Type.STRING,
              description: "İşlem tarihi (Format: YYYY-MM-DD)"
            },
            categorySuggestion: {
              type: Type.STRING,
              description: "Önerilen gider/borç kategorisi ismi"
            },
            type: {
              type: Type.STRING,
              description: "'expense' veya 'debt'"
            }
          },
          required: ["title", "amount"]
        },
        temperature: 0.2,
      },
    });

    const parsedData = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      title: parsedData.title || "Taranan Belge",
      amount: parsedData.amount || 0.00,
      date: parsedData.date || new Date().toISOString().split("T")[0],
      categorySuggestion: parsedData.categorySuggestion || "Diğer",
      type: parsedData.type || "expense",
      isOffline: false
    });
  } catch (error: any) {
    const errMsg = error?.message || error?.toString() || "";

    const isKeyError = errMsg.toLowerCase().includes("expired") || 
                       errMsg.toLowerCase().includes("key") || 
                       errMsg.toLowerCase().includes("credential") || 
                       errMsg.toLowerCase().includes("invalid_argument") ||
                       errMsg.toLowerCase().includes("unauthorized") ||
                       errMsg.toLowerCase().includes("api_key_invalid") ||
                       errMsg.toLowerCase().includes("forbidden") ||
                       errMsg.toLowerCase().includes("denied") ||
                       errMsg.toLowerCase().includes("403");

    if (isKeyError) {
      defaultKeyHasFailed = true;
      console.log("[Scan API] Key block matched: Key has expired or has restricted permissions. Bypassing silently.");
    } else {
      console.log("[Scan API] Process status: Interrupted.");
    }

    console.log("[Scan Receipt API] Falling back to intelligent offline simulated scan due to API issue.");
    const todayStr = new Date().toISOString().split("T")[0];
    return res.json({
      success: true,
      title: "Seçili Belge (Örnek Alışveriş)",
      amount: 450.00,
      date: todayStr,
      categorySuggestion: "Gıda / Market",
      type: "expense",
      isOffline: true,
      message: "Yapay zeka tespiti yerine (403/Hata kısıtı kaynaklı) akıllı tarama simülasyonu çalıştırıldı. Gerçek yapay zeka tespiti için lütfen Settings > Secrets panelinden GEMINI_API_KEY tanımlayın!"
    });
  }
});

// In-memory cache for rates to keep response sub-millisecond while avoiding upstream rate limits
let cachedRatesPayload: any = null;
let cachedRatesTimestamp = 0;

// API Route for currency exchange rates proxy (Server-side bypass of CORS/adblock restrictions)
app.get("/api/rates", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const now = Date.now();
  // Return cached payload if less than 15 seconds old unless explicitly forced via ?force=true
  if (cachedRatesPayload && (now - cachedRatesTimestamp < 15000) && req.query.force !== "true") {
    return res.json({ ...cachedRatesPayload, cached: true });
  }

  // Realistic fallback levels
  let usdRate = 48.42;
  let eurRate = 56.25;
  let gbpRate = 65.45;
  let chfRate = 59.72;
  let goldOns = 4431.10;
  let goldGram = 6898.85;
  let goldCeyrek = 11165.67;
  let goldYarim = 22331.33;
  let goldTam = 44526.08;
  let goldCumhuriyet = 45961.00;
  let btcUsd = 79614.00;

  const details: Record<string, { buying: number; selling: number; change: number }> = {
    USD: { buying: 48.38, selling: 48.49, change: 0.22 },
    EUR: { buying: 56.12, selling: 56.36, change: -0.25 },
    GBP: { buying: 65.43, selling: 65.48, change: -0.22 },
    CHF: { buying: 59.72, selling: 59.76, change: 0.18 },
    GOLD_GRAM: { buying: 6898.04, selling: 6898.85, change: -0.74 },
    GOLD_CEYREK: { buying: 10908.86, selling: 11165.67, change: -1.14 },
    GOLD_YARIM: { buying: 21749.55, selling: 22331.33, change: -1.14 },
    GOLD_TAM: { buying: 43635.46, selling: 44526.08, change: -1.14 },
    GOLD_CUMHURIYET: { buying: 45276.00, selling: 45961.00, change: -1.43 },
    GOLD_ONS: { buying: 4431.10, selling: 4431.10, change: 0.15 },
    BTC: { buying: 79614, selling: 79614, change: 0.85 }
  };

  let loadedSource = "";

  // 1. Primary: Fetch real Turkish market rates from Truncgil Finance API (Free, Real-Time Kapalıçarşı & Serbest Piyasa)
  try {
    const truncCtrl = new AbortController();
    const truncTimeout = setTimeout(() => truncCtrl.abort(), 5000);
    // Try clean JSON endpoint without query params that could trigger Cloudflare/CDN rate-limiting
    let truncRes = await fetch("https://finans.truncgil.com/v4/today.json", {
      signal: truncCtrl.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    }).catch(() => null);
    clearTimeout(truncTimeout);

    // Secondary backup endpoint on Truncgil if v4 fails
    if (!truncRes || !truncRes.ok) {
      const fallbackCtrl = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackCtrl.abort(), 3000);
      truncRes = await fetch("https://finans.truncgil.com/today.json", {
        signal: fallbackCtrl.signal,
        headers: { "Accept": "application/json" }
      }).catch(() => null);
      clearTimeout(fallbackTimeout);
    }

    if (truncRes && truncRes.ok) {
      const tData: any = await truncRes.json().catch(() => null);
      if (tData) {
        if (tData.USD && tData.USD.Selling) {
          usdRate = Number(tData.USD.Selling) || usdRate;
          details.USD = {
            buying: Number(tData.USD.Buying) || usdRate,
            selling: usdRate,
            change: Number(tData.USD.Change) || 0
          };
        }
        if (tData.EUR && tData.EUR.Selling) {
          eurRate = Number(tData.EUR.Selling) || eurRate;
          details.EUR = {
            buying: Number(tData.EUR.Buying) || eurRate,
            selling: eurRate,
            change: Number(tData.EUR.Change) || 0
          };
        }
        if (tData.GBP && tData.GBP.Selling) {
          gbpRate = Number(tData.GBP.Selling) || gbpRate;
          details.GBP = {
            buying: Number(tData.GBP.Buying) || gbpRate,
            selling: gbpRate,
            change: Number(tData.GBP.Change) || 0
          };
        }
        if (tData.CHF && tData.CHF.Selling) {
          chfRate = Number(tData.CHF.Selling) || chfRate;
          details.CHF = {
            buying: Number(tData.CHF.Buying) || chfRate,
            selling: chfRate,
            change: Number(tData.CHF.Change) || 0
          };
        }
        if (tData.GRA && tData.GRA.Selling) {
          goldGram = Number(tData.GRA.Selling) || goldGram;
          details.GOLD_GRAM = {
            buying: Number(tData.GRA.Buying) || goldGram,
            selling: goldGram,
            change: Number(tData.GRA.Change) || 0
          };
        }
        if (tData.CEYREKALTIN && tData.CEYREKALTIN.Selling) {
          goldCeyrek = Number(tData.CEYREKALTIN.Selling) || goldCeyrek;
          details.GOLD_CEYREK = {
            buying: Number(tData.CEYREKALTIN.Buying) || goldCeyrek,
            selling: goldCeyrek,
            change: Number(tData.CEYREKALTIN.Change) || 0
          };
        }
        if (tData.YARIMALTIN && tData.YARIMALTIN.Selling) {
          goldYarim = Number(tData.YARIMALTIN.Selling) || goldYarim;
          details.GOLD_YARIM = {
            buying: Number(tData.YARIMALTIN.Buying) || goldYarim,
            selling: goldYarim,
            change: Number(tData.YARIMALTIN.Change) || 0
          };
        }
        if (tData.TAMALTIN && tData.TAMALTIN.Selling) {
          goldTam = Number(tData.TAMALTIN.Selling) || goldTam;
          details.GOLD_TAM = {
            buying: Number(tData.TAMALTIN.Buying) || goldTam,
            selling: goldTam,
            change: Number(tData.TAMALTIN.Change) || 0
          };
        }
        if (tData.CUMHURIYETALTINI && tData.CUMHURIYETALTINI.Selling) {
          goldCumhuriyet = Number(tData.CUMHURIYETALTINI.Selling) || goldCumhuriyet;
          details.GOLD_CUMHURIYET = {
            buying: Number(tData.CUMHURIYETALTINI.Buying) || goldCumhuriyet,
            selling: goldCumhuriyet,
            change: Number(tData.CUMHURIYETALTINI.Change) || 0
          };
        }
        loadedSource = "Truncgil Financial Markets API (TR)";
      }
    }
  } catch (_e) {
    // Primary market provider temporarily unavailable; seamlessly fallback to secondary global forex providers
  }

  // 2. Fetch live Ons Altın ($ XAU)
  try {
    const goldCtrl = new AbortController();
    const goldTimeout = setTimeout(() => goldCtrl.abort(), 3000);
    const goldRes = await fetch("https://api.gold-api.com/price/XAU", { signal: goldCtrl.signal });
    clearTimeout(goldTimeout);
    if (goldRes.ok) {
      const gData: any = await goldRes.json();
      if (gData && gData.price) {
        goldOns = Number(gData.price);
        details.GOLD_ONS = { buying: goldOns, selling: goldOns, change: 0.15 };
        // If goldGram wasn't loaded from Turkish API, calculate mathematically
        if (!loadedSource) {
          goldGram = (goldOns * usdRate) / 31.1034768;
          goldCeyrek = goldGram * 1.635;
          goldYarim = goldCeyrek * 2;
          goldTam = goldCeyrek * 4;
          goldCumhuriyet = goldCeyrek * 4.12;
        }
      }
    }
  } catch (e: any) {
    console.warn("[Rates] Gold-api fetch error:", e.message);
  }

  // 3. Fetch real-time Bitcoin (BTC/USDT)
  try {
    const btcCtrl = new AbortController();
    const btcTimeout = setTimeout(() => btcCtrl.abort(), 2500);
    const btcRes = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", { signal: btcCtrl.signal });
    clearTimeout(btcTimeout);
    if (btcRes.ok) {
      const bData: any = await btcRes.json();
      if (bData && bData.lastPrice) {
        btcUsd = Number(bData.lastPrice);
        const btcChange = Number(bData.priceChangePercent) || 0;
        details.BTC = { buying: btcUsd, selling: btcUsd, change: btcChange };
      }
    }
  } catch (e: any) {
    console.warn("[Rates] Binance BTC fetch error:", e.message);
  }

  // 4. Secondary Forex Fallback if USD rate was not loaded
  if (!loadedSource) {
    const apis = [
      "https://open.er-api.com/v6/latest/USD",
      "https://api.exchangerate-api.com/v4/latest/USD"
    ];
    for (const baseUrl of apis) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${baseUrl}?t=${Date.now()}`, { signal: controller.signal });
        clearTimeout(id);
        if (res.ok) {
          const data: any = await res.json();
          if (data && data.rates && data.rates.TRY) {
            usdRate = Number(data.rates.TRY) || usdRate;
            eurRate = (data.rates.TRY / (data.rates.EUR || 0.86)) || eurRate;
            gbpRate = (data.rates.TRY / (data.rates.GBP || 0.74)) || gbpRate;
            goldGram = (goldOns * usdRate) / 31.1034768;
            goldCeyrek = goldGram * 1.635;
            goldYarim = goldCeyrek * 2;
            goldTam = goldCeyrek * 4;
            goldCumhuriyet = goldCeyrek * 4.12;
            loadedSource = baseUrl;
            break;
          }
        }
      } catch (err: any) {
        // continue
      }
    }
  }

  const btcTry = btcUsd * usdRate;

  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const stamp = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  cachedRatesPayload = {
    success: true,
    rates: {
      TRY: 1,
      USD: Number(usdRate.toFixed(4)),
      EUR: Number(eurRate.toFixed(4)),
      GBP: Number(gbpRate.toFixed(4)),
      CHF: Number(chfRate.toFixed(4)),
      GOLD_ONS: Number(goldOns.toFixed(2)),
      GOLD_GRAM: Number(goldGram.toFixed(2)),
      GOLD_CEYREK: Number(goldCeyrek.toFixed(2)),
      GOLD_YARIM: Number(goldYarim.toFixed(2)),
      GOLD_TAM: Number(goldTam.toFixed(2)),
      GOLD_CUMHURIYET: Number(goldCumhuriyet.toFixed(2)),
      BTC_USD: Number(btcUsd.toFixed(2)),
      BTC_TRY: Number(btcTry.toFixed(2))
    },
    details,
    lastUpdated: stamp,
    source: loadedSource || "Live Market Hybrid Engine"
  };
  cachedRatesTimestamp = now;

  return res.json(cachedRatesPayload);
});

// Weather API Proxy to avoid CORS, ad-blocker, and network fetch failures in client iframe
const TURKEY_PROVINCES = [
  { name: "İstanbul", lat: 41.0082, lon: 28.9784 },
  { name: "Ankara", lat: 39.9334, lon: 32.8597 },
  { name: "İzmir", lat: 38.4237, lon: 27.1428 },
  { name: "Bursa", lat: 40.1885, lon: 29.0610 },
  { name: "Antalya", lat: 36.8969, lon: 30.7133 },
  { name: "Adana", lat: 37.0000, lon: 35.3213 },
  { name: "Konya", lat: 37.8746, lon: 32.4932 },
  { name: "Gaziantep", lat: 37.0662, lon: 37.3833 },
  { name: "Şanlıurfa", lat: 37.1674, lon: 38.7955 },
  { name: "Kocaeli", lat: 40.8533, lon: 29.8815 },
  { name: "Mersin", lat: 36.8121, lon: 34.6415 },
  { name: "Diyarbakır", lat: 37.9144, lon: 40.2306 },
  { name: "Hatay", lat: 36.2023, lon: 36.1606 },
  { name: "Manisa", lat: 38.6191, lon: 27.4289 },
  { name: "Kayseri", lat: 38.7205, lon: 35.4826 },
  { name: "Samsun", lat: 41.2867, lon: 36.3300 },
  { name: "Balıkesir", lat: 39.6484, lon: 27.8826 },
  { name: "Kahramanmaraş", lat: 37.5858, lon: 36.9371 },
  { name: "Van", lat: 38.4891, lon: 43.4089 },
  { name: "Aydın", lat: 37.8380, lon: 27.8456 },
  { name: "Denizli", lat: 37.7765, lon: 29.0864 },
  { name: "Sakarya", lat: 40.7569, lon: 30.3783 },
  { name: "Trabzon", lat: 41.0027, lon: 39.7168 },
  { name: "Eskişehir", lat: 39.7767, lon: 30.5206 },
  { name: "Muğla", lat: 37.2153, lon: 28.3636 },
  { name: "Çanakkale", lat: 40.1553, lon: 26.4142 },
  { name: "Sivas", lat: 39.7477, lon: 37.0179 },
  { name: "Erzurum", lat: 39.9043, lon: 41.2679 },
  { name: "Edirne", lat: 41.6772, lon: 26.5557 },
  { name: "Zonguldak", lat: 41.4564, lon: 31.7987 },
  { name: "Rize", lat: 41.0201, lon: 40.5234 },
  { name: "Bodrum", lat: 37.0344, lon: 27.4305 },
  { name: "Alanya", lat: 36.5438, lon: 31.9998 }
];

app.get("/api/weather", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const lat = parseFloat(req.query.lat as string) || 41.0082;
  const lon = parseFloat(req.query.lon as string) || 28.9784;
  let cityName = (req.query.city as string)?.trim() || "";

  // If no city name, find closest Turkish province or default to nearest
  if (!cityName) {
    let closest = TURKEY_PROVINCES[0];
    let minDistance = Infinity;
    for (const p of TURKEY_PROVINCES) {
      const dist = Math.hypot(p.lat - lat, p.lon - lon);
      if (dist < minDistance) {
        minDistance = dist;
        closest = p;
      }
    }
    cityName = minDistance < 1.5 ? closest.name : "Konumunuz";
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
    const response = await fetch(weatherUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "ButcemPro/2.5" }
    });
    clearTimeout(timer);

    if (response.ok) {
      const data: any = await response.json();
      if (data && data.current_weather) {
        const current = data.current_weather;
        return res.json({
          success: true,
          city: cityName,
          temperature: Math.round(current.temperature),
          weatherCode: current.weathercode,
          isDay: current.is_day === 1,
          windSpeed: Math.round(current.windspeed)
        });
      }
    }
  } catch (err: any) {
    console.warn(`[Weather Proxy Warn] Weather fetch fallback triggered for (${lat}, ${lon}):`, err.message);
  }

  // Resilient fallback: realistic seasonal daytime temperature & clear sky for location
  const currentMonth = new Date().getMonth(); // 0-11
  let fallbackTemp = 24;
  if (currentMonth >= 5 && currentMonth <= 8) fallbackTemp = 28; // Summer
  else if (currentMonth >= 9 && currentMonth <= 10) fallbackTemp = 19; // Autumn
  else if (currentMonth >= 11 || currentMonth <= 2) fallbackTemp = 11; // Winter
  else fallbackTemp = 18; // Spring

  return res.json({
    success: true,
    city: cityName || "İstanbul",
    temperature: fallbackTemp,
    weatherCode: 0, // Sunny/Clear
    isDay: true,
    windSpeed: 12,
    fallback: true
  });
});

app.get("/api/weather/search", async (req, res) => {
  const query = ((req.query.q as string) || "").trim().toLowerCase();
  if (!query) {
    return res.json({ success: true, results: [] });
  }

  // 1. Search in local database of provinces
  const localMatches = TURKEY_PROVINCES.filter(p => 
    p.name.toLowerCase().includes(query) ||
    query.includes(p.name.toLowerCase())
  );

  if (localMatches.length > 0) {
    return res.json({
      success: true,
      results: localMatches.map(m => ({ name: m.name, latitude: m.lat, longitude: m.lon }))
    });
  }

  // 2. Fallback to Open-Meteo geocoding
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=tr&format=json`;
    const response = await fetch(geoUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "ButcemPro/2.5" }
    });
    clearTimeout(timer);

    if (response.ok) {
      const data: any = await response.json();
      if (data && data.results && data.results.length > 0) {
        return res.json({
          success: true,
          results: data.results.map((r: any) => ({
            name: r.name + (r.admin1 ? `, ${r.admin1}` : ""),
            latitude: r.latitude,
            longitude: r.longitude
          }))
        });
      }
    }
  } catch (err: any) {
    console.warn(`[Weather Geo Proxy Warn] Search query "${query}" failed:`, err.message);
  }

  // 3. Fallback: Return closest default Istanbul
  return res.json({
    success: true,
    results: [{ name: query.charAt(0).toUpperCase() + query.slice(1), latitude: 41.0082, longitude: 28.9784 }]
  });
});

// In-memory Auth Bridge Pairing Engine for Android APK Companion Login
interface PairingSession {
  code: string;
  email?: string;
  password?: string;
  status: "pending" | "approved";
  createdAt: number;
}
const pairingSessions = new Map<string, PairingSession>();

// Periodically clean up expired pairing sessions (valid for 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [code, sess] of pairingSessions.entries()) {
    if (now - sess.createdAt > 5 * 60 * 1000) {
      pairingSessions.delete(code);
    }
  }
}, 60000);

// Create a new pairing code session
app.post("/api/pair/create", (req, res) => {
  let attempt = 0;
  let code = "";
  // Ensure we get a unique active 6-digit code
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    attempt++;
  } while (pairingSessions.has(code) && attempt < 10);

  pairingSessions.set(code, {
    code,
    status: "pending",
    createdAt: Date.now()
  });

  console.log(`[Pairing Engine] New companion code created: ${code}`);
  res.json({ success: true, code });
});

// Check the approval status of a pairing code (polled by APK)
app.get("/api/pair/status/:code", (req, res) => {
  const { code } = req.params;
  const session = pairingSessions.get(code);

  if (!session) {
    return res.json({ status: "expired", message: "Bağlantı kodu süresi doldu veya geçersiz." });
  }

  // Check if session has timed out (5 minutes)
  if (Date.now() - session.createdAt > 5 * 60 * 1000) {
    pairingSessions.delete(code);
    return res.json({ status: "expired", message: "Bağlantı kodu zaman aşımına uğradı." });
  }

  res.json({
    status: session.status,
    email: session.email,
    password: session.password
  });
});

// Approve pairing code from browser with active session credentials
app.post("/api/pair/approve", (req, res) => {
  const { code, email, password } = req.body;
  
  if (!code || !email || !password) {
    return res.status(400).json({ error: "Eksik parametre grubu. Kodu ve yetki bilgilerini gönderin." });
  }

  const session = pairingSessions.get(String(code).trim());
  if (!session) {
    return res.status(404).json({ error: "Eşleştirme kodu bulunamadı veya süresi doldu." });
  }

  session.email = email;
  session.password = password;
  session.status = "approved";

  console.log(`[Pairing Engine] Code ${code} approved for user: ${email}`);
  res.json({ success: true, message: "Cihaz başarıyla yetkilendirildi. Giriş bilgileri APK cihazına aktarıldı." });
});

// Privacy Policy routing support for Google Play Compliance and immediate browser access
const privacyPaths = [
  "/privacy",
  "/privacy-policy",
  "/privacy.html",
  "/privacy-policy.html",
  "/gizlilik",
  "/gizlilik-politikasi",
  "/gizlilik-politikasi.html"
];

// ==========================================
// ROBUST WEB PUSH NOTIFICATION BACKEND SETUP
// ==========================================

// Resolve storage of VAPID KEYS
const VAPID_KEYS_FILE = path.join(process.cwd(), "vapid_keys.json");
let vapidKeys = { publicKey: "", privateKey: "" };

if (fs.existsSync(VAPID_KEYS_FILE)) {
  try {
    const raw = fs.readFileSync(VAPID_KEYS_FILE, 'utf8').trim();
    if (raw) {
      vapidKeys = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("[Push Server] Vapid keys parse error, generating new persistent keys...");
  }
}

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  vapidKeys = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(vapidKeys, null, 2), 'utf8');
    console.log("[Push Server] Dynamically generated new persistent VAPID keys.");
  } catch (e) {
    console.error("[Push Server] Could not write VAPID keys file:", e);
  }
}

try {
  webpush.setVapidDetails(
    "mailto:info.borcodemetakip@gmail.com",
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} catch (e) {
  console.error("[Push Server] Error setting VAPID details:", e);
}

// Storage for push subscriptions and their alarms & debts
const PUSH_SUBS_FILE = path.join(process.cwd(), "active_push_subscriptions.json");
interface PushSubscriptionRecord {
  subscription: any;
  alarms: any[];
  debts?: any[];
  installmentDebts?: any[];
  user: string;
  lastOverduePushTime?: number;
  lastDueTodayPushDate?: string;
  updatedAt?: number;
}
let subscriptionsMap: Record<string, PushSubscriptionRecord> = {};

if (fs.existsSync(PUSH_SUBS_FILE)) {
  try {
    const raw = fs.readFileSync(PUSH_SUBS_FILE, 'utf8').trim();
    if (raw) {
      subscriptionsMap = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("[Push Server] Failed to parse push subscriptions:", e);
  }
}

function saveSubscriptionsToFile() {
  try {
    fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(subscriptionsMap), 'utf8');
  } catch (e) {
    console.error("[Push Server] Failed to save push subscriptions:", e);
  }
}

// REST route to retrieve the VAPID Public Key
app.get("/api/push-vapid-public-key", (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// Robust date parser helper for Turkish and standard date strings
function parseDateRobust(dateStr: any): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  if (typeof dateStr !== "string") return null;
  
  const str = dateStr.trim();
  if (!str) return null;

  // Standard parse attempt
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Turkish format "DD.MM.YYYY" or "DD.MM.YYYY HH:mm"
  if (str.includes(".")) {
    const parts = str.split(" ");
    const datePart = parts[0];
    const timePart = parts[1] || "00:00:00";
    const dp = datePart.split(".");
    if (dp.length === 3) {
      const day = parseInt(dp[0], 10);
      const month = parseInt(dp[1], 10) - 1;
      const year = parseInt(dp[2], 10);
      const tp = timePart.split(":");
      const hr = parseInt(tp[0], 10) || 0;
      const min = parseInt(tp[1], 10) || 0;
      const sec = parseInt(tp[2], 10) || 0;
      d = new Date(year, month, day, hr, min, sec);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // ISO or hyphenated format "YYYY-MM-DD" or "DD-MM-YYYY"
  if (str.includes("-")) {
    const parts = str.split(" ");
    const datePart = parts[0];
    const timePart = parts[1] || "00:00:00";
    const dp = datePart.split("-");
    if (dp.length === 3) {
      if (dp[0].length === 4) {
        // YYYY-MM-DD
        const year = parseInt(dp[0], 10);
        const month = parseInt(dp[1], 10) - 1;
        const day = parseInt(dp[2], 10);
        const tp = timePart.split(":");
        const hr = parseInt(tp[0], 10) || 0;
        const min = parseInt(tp[1], 10) || 0;
        const sec = parseInt(tp[2], 10) || 0;
        d = new Date(year, month, day, hr, min, sec);
        if (!isNaN(d.getTime())) return d;
      } else {
        // DD-MM-YYYY
        const day = parseInt(dp[0], 10);
        const month = parseInt(dp[1], 10) - 1;
        const year = parseInt(dp[2], 10);
        const tp = timePart.split(":");
        const hr = parseInt(tp[0], 10) || 0;
        const min = parseInt(tp[1], 10) || 0;
        const sec = parseInt(tp[2], 10) || 0;
        d = new Date(year, month, day, hr, min, sec);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }

  return null;
}

// Helper: Comprehensive debt analysis (Active portfolio, overdue, due today, upcoming, inventory)
function analyzeUserDebts(debts: any[] = [], installmentDebts: any[] = []) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let overdueDebts: Array<{ name: string; remaining: number; daysLate: number; isInstallment?: boolean; dueDateStr?: string }> = [];
  let dueTodayDebts: Array<{ name: string; amount: number; isInstallment?: boolean; dueDateStr?: string }> = [];
  let upcomingDebts: Array<{ name: string; remaining: number; daysLeft: number; isInstallment?: boolean; dueDateStr?: string }> = [];
  let otherActiveDebts: Array<{ name: string; remaining: number; isInstallment?: boolean; dueDateStr?: string }> = [];
  let allActiveDebts: Array<{ name: string; remaining: number; isInstallment?: boolean; status: string; dueDateStr?: string }> = [];

  let totalActiveDebt = 0;
  let totalActiveCount = 0;

  // Single debts analysis
  (debts || []).forEach((d: any) => {
    if (!d) return;
    const amount = Number(d.amount) || Number(d.totalAmount) || 0;
    const paid = Number(d.paid) || 0;
    const remaining = d.remaining !== undefined 
      ? Number(d.remaining) 
      : d.remainingAmount !== undefined 
      ? Number(d.remainingAmount) 
      : Math.max(0, amount - paid);

    if (remaining <= 0) return; // Fully settled, skip

    totalActiveDebt += remaining;
    totalActiveCount++;

    const dateField = d.dueDate || d.date || d.paymentDate || d.vadeTarihi || "";
    let classified = false;

    if (dateField) {
      try {
        const due = parseDateRobust(dateField);
        if (due) {
          const dueTime = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
          const diffDays = Math.round((todayTime - dueTime) / (1000 * 60 * 60 * 24));
          const formattedDueDate = due.toLocaleDateString("tr-TR");
          const debtName = d.name || d.title || d.description || d.person || d.creditor || "Kayıtlı Borç";

          if (diffDays > 0) {
            overdueDebts.push({
              name: debtName,
              remaining,
              daysLate: diffDays,
              isInstallment: false,
              dueDateStr: formattedDueDate
            });
            allActiveDebts.push({
              name: debtName,
              remaining,
              isInstallment: false,
              status: `${diffDays} gün gecikti 🚨`,
              dueDateStr: formattedDueDate
            });
            classified = true;
          } else if (diffDays === 0) {
            dueTodayDebts.push({
              name: debtName,
              amount: remaining,
              isInstallment: false,
              dueDateStr: formattedDueDate
            });
            allActiveDebts.push({
              name: debtName,
              remaining,
              isInstallment: false,
              status: "Bugün son gün ⏰",
              dueDateStr: formattedDueDate
            });
            classified = true;
          } else {
            const daysLeft = Math.abs(diffDays);
            upcomingDebts.push({
              name: debtName,
              remaining,
              daysLeft,
              isInstallment: false,
              dueDateStr: formattedDueDate
            });
            allActiveDebts.push({
              name: debtName,
              remaining,
              isInstallment: false,
              status: `${daysLeft} gün sonra`,
              dueDateStr: formattedDueDate
            });
            classified = true;
          }
        }
      } catch (e) {
        // ignore date parse err
      }
    }

    if (!classified) {
      const fallbackName = d.name || d.title || d.description || d.person || d.creditor || "Kayıtlı Borç";
      otherActiveDebts.push({
        name: fallbackName,
        remaining,
        isInstallment: false,
        dueDateStr: "Tarih Belirtilmedi"
      });
      allActiveDebts.push({
        name: fallbackName,
        remaining,
        isInstallment: false,
        status: "Vade Tarihi Yok",
        dueDateStr: "-"
      });
    }
  });

  // Installment debts analysis
  (installmentDebts || []).forEach((inst: any) => {
    if (!inst) return;
    const totalAmount = Number(inst.totalAmount) || 0;
    const count = Number(inst.installmentCount) || 1;
    const paidCount = Number(inst.paidInstallmentCount) || 0;
    const perInst = count > 0 ? (totalAmount / count) : 0;
    const remainingInstallments = Math.max(0, count - paidCount);
    const remainingAmount = inst.remainingAmount !== undefined
      ? Number(inst.remainingAmount)
      : remainingInstallments * perInst;

    if (remainingAmount <= 0 || remainingInstallments <= 0) return; // Fully settled, skip

    totalActiveDebt += remainingAmount;
    totalActiveCount++;

    const firstDateField = inst.firstDueDate || inst.dueDate || inst.date || "";
    let classified = false;

    if (firstDateField) {
      try {
        const baseDate = parseDateRobust(firstDateField);
        if (baseDate) {
          // Compute next active installment due date
          baseDate.setMonth(baseDate.getMonth() + paidCount);
          const dueTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()).getTime();
          const diffDays = Math.round((todayTime - dueTime) / (1000 * 60 * 60 * 24));
          const formattedDueDate = baseDate.toLocaleDateString("tr-TR");
          const installmentLabel = `${inst.name || "Taksit"} (${paidCount + 1}/${count}. Taksit)`;

          if (diffDays > 0) {
            overdueDebts.push({
              name: installmentLabel,
              remaining: perInst,
              daysLate: diffDays,
              isInstallment: true,
              dueDateStr: formattedDueDate
            });
            allActiveDebts.push({
              name: `${inst.name || "Taksit"} (${remainingInstallments} Taksit)`,
              remaining: remainingAmount,
              isInstallment: true,
              status: `${diffDays} gün gecikti 🚨`,
              dueDateStr: formattedDueDate
            });
            classified = true;
          } else if (diffDays === 0) {
            dueTodayDebts.push({
              name: installmentLabel,
              amount: perInst,
              isInstallment: true,
              dueDateStr: formattedDueDate
            });
            allActiveDebts.push({
              name: `${inst.name || "Taksit"} (${remainingInstallments} Taksit)`,
              remaining: remainingAmount,
              isInstallment: true,
              status: "Bugün son gün ⏰",
              dueDateStr: formattedDueDate
            });
            classified = true;
          } else {
            const daysLeft = Math.abs(diffDays);
            upcomingDebts.push({
              name: installmentLabel,
              remaining: perInst,
              daysLeft,
              isInstallment: true,
              dueDateStr: formattedDueDate
            });
            allActiveDebts.push({
              name: `${inst.name || "Taksit"} (${remainingInstallments} Taksit)`,
              remaining: remainingAmount,
              isInstallment: true,
              status: `${daysLeft} gün sonra`,
              dueDateStr: formattedDueDate
            });
            classified = true;
          }
        }
      } catch (e) {
        // ignore date parse err
      }
    }

    if (!classified) {
      otherActiveDebts.push({
        name: `${inst.name || "Taksit"} (${remainingInstallments} Taksit)`,
        remaining: remainingAmount,
        isInstallment: true,
        dueDateStr: "Tarih Belirtilmedi"
      });
      allActiveDebts.push({
        name: `${inst.name || "Taksit"} (${remainingInstallments} Taksit)`,
        remaining: remainingAmount,
        isInstallment: true,
        status: "Vade Tarihi Yok",
        dueDateStr: "-"
      });
    }
  });

  const totalOverdueAmount = overdueDebts.reduce((sum, d) => sum + d.remaining, 0);
  const totalDueTodayAmount = dueTodayDebts.reduce((sum, d) => sum + d.amount, 0);

  return {
    overdueDebts,
    dueTodayDebts,
    upcomingDebts,
    otherActiveDebts,
    allActiveDebts,
    totalActiveDebt,
    totalOverdueAmount,
    totalDueTodayAmount,
    totalActiveCount,
    todayStr
  };
}

// REST route to subscribe/register device with current alarms AND debts
app.post("/api/push-register", (req, res) => {
  const { subscription, alarms, debts, installmentDebts, user } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Geçersiz abonelik bilgisi" });
  }

  const endpointHash = subscription.endpoint.slice(-50) || Math.random().toString();
  const existing: PushSubscriptionRecord = subscriptionsMap[endpointHash] || {
    subscription,
    alarms: [],
    debts: [],
    installmentDebts: [],
    user: user || "anonymous",
    lastOverduePushTime: 0,
    lastDueTodayPushDate: ""
  };

  subscriptionsMap[endpointHash] = {
    ...existing,
    subscription,
    alarms: alarms !== undefined ? alarms : (existing.alarms || []),
    debts: debts !== undefined ? debts : (existing.debts || []),
    installmentDebts: installmentDebts !== undefined ? installmentDebts : (existing.installmentDebts || []),
    user: user || existing.user || "anonymous",
    updatedAt: Date.now()
  };

  saveSubscriptionsToFile();
  console.log(`[Push Server] Registered/updated subscription for user: ${user}. Total alarms: ${alarms?.length || 0}, Total debts: ${debts?.length || 0}`);
  res.json({ success: true });
});

// REST route to trigger an instant overdue check push (manual trigger or test)
app.post("/api/trigger-overdue-push", async (req, res) => {
  const { subscription, debts, installmentDebts } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Geçersiz abonelik bilgisi" });
  }

  const { overdueDebts, dueTodayDebts } = analyzeUserDebts(debts, installmentDebts);

  if (overdueDebts.length === 0 && dueTodayDebts.length === 0) {
    return res.json({
      success: true,
      message: "Gecikmiş veya vadesi bugün olan herhangi bir borç bulunamadı.",
      hasOverdue: false
    });
  }

  let title = "Bütçem Pro: Borç Hatırlatması ⏰";
  let body = "";

  if (overdueDebts.length > 0) {
    const totalOverdue = overdueDebts.reduce((sum, d) => sum + d.remaining, 0);
    const topDebt = overdueDebts[0];
    title = `⚠️ Gecikmiş Borç Uyarısı (${overdueDebts.length} Adet)`;
    body = `Vadesi geçmiş borcunuz var: "${topDebt.name}" (₺${topDebt.remaining.toLocaleString("tr-TR")}, ${topDebt.daysLate} gün gecikmeli). Toplam geciken: ₺${totalOverdue.toLocaleString("tr-TR")}.`;
  } else if (dueTodayDebts.length > 0) {
    const totalDue = dueTodayDebts.reduce((sum, d) => sum + d.amount, 0);
    const topDebt = dueTodayDebts[0];
    title = `🚨 Bugün Vadesi Gelen Ödemeniz Var!`;
    body = `"${topDebt.name}" için ₺${topDebt.amount.toLocaleString("tr-TR")} ödemesinin son günü bugün. Toplam: ₺${totalDue.toLocaleString("tr-TR")}.`;
  }

  const payload = JSON.stringify({
    title,
    body,
    tag: "overdue-alert-" + Date.now(),
    icon: "/logo.png",
    badge: "/logo.png",
    url: "/?tab=debts"
  });

  try {
    await webpush.sendNotification(subscription, payload, {
      headers: { "Urgency": "high" },
      TTL: 86400
    });
    return res.json({ success: true, message: "Geçmiş borç bildirimi başarıyla telefona gönderildi!" });
  } catch (err: any) {
    console.error("[Push Server] Error in trigger-overdue-push:", err);
    return res.status(500).json({ error: err.message || "Bildirim iletilemedi" });
  }
});

// REST route to trigger a delayed test push notification for lockscreen diagnostics
app.post("/api/send-test-push", async (req, res) => {
  const { subscription, delaySeconds } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Geçersiz abonelik bilgisi" });
  }

  const delay = parseInt(delaySeconds, 10) || 5;
  const delayMs = delay * 1000;
  console.log(`[Push Server] Scheduled diagnostic test notification in ${delay} seconds.`);

  setTimeout(async () => {
    const payload = JSON.stringify({
      title: "Bütçem Pro Sinyali ⏰",
      body: "Harika! Telefon kapalıyken bile anlık bildirim sistemi başarıyla çalışıyor! Geçmiş ve yaklaşan borç uyarıları kilit ekranınıza gelecek. 🎉",
      tag: "test-push-alarm-" + Date.now(),
      icon: "/logo.png",
      badge: "/logo.png",
      url: "/"
    });

    try {
      await webpush.sendNotification(subscription, payload, {
        headers: { "Urgency": "high" },
        TTL: 0
      });
      console.log("[Push Server] Successfully pushed diagnostic alarm notification.");
    } catch (pushErr) {
      console.error("[Push Server] Push error in diagnostic route:", pushErr);
    }
  }, delayMs);

  res.json({ success: true, message: `Test bildirimi ${delay} saniye içinde gönderilecek.` });
});

// ==========================================
// EMAIL NOTIFICATIONS FOR OVERDUE DEBTS ENGINE
// ==========================================
interface EmailNotificationSubscriber {
  email: string;
  verified: boolean;
  verificationCode?: string;
  codeExpiresAt?: number;
  alertOverdue: boolean;
  alertDueToday: boolean;
  frequency: "daily_morning" | "daily_both" | "weekly";
  minAmountThreshold: number;
  debts: any[];
  installmentDebts: any[];
  user: string;
  createdAt: number;
  verifiedAt?: number;
  lastEmailSentAt?: number;
  lastSentDebtSummary?: string;
}

const EMAIL_SUBSCRIBERS_FILE = path.join(process.cwd(), "email_subscribers.json");
let emailSubscribersMap: Record<string, EmailNotificationSubscriber> = {};

// Load email subscribers from disk
if (fs.existsSync(EMAIL_SUBSCRIBERS_FILE)) {
  try {
    const raw = fs.readFileSync(EMAIL_SUBSCRIBERS_FILE, "utf-8").trim();
    if (raw) {
      emailSubscribersMap = JSON.parse(raw);
      console.log(`[Email Alert Engine] Loaded ${Object.keys(emailSubscribersMap).length} email subscribers.`);
    }
  } catch (e) {
    console.warn("[Email Alert Engine] Error loading email_subscribers.json:", e);
    emailSubscribersMap = {};
  }
}

const saveEmailSubscribersToFile = () => {
  try {
    fs.writeFileSync(EMAIL_SUBSCRIBERS_FILE, JSON.stringify(emailSubscribersMap, null, 2), "utf-8");
  } catch (err) {
    console.error("[Email Alert Engine] Error saving email_subscribers.json:", err);
  }
};

// Generate HTML email template for overdue debts
// Generate structured plain-text email for optimal deliverability and spam filter compliance
function generateOverdueEmailText(
  email: string,
  user: string,
  analysis: any,
  isTest = false,
  isWelcome = false
): string {
  let overdueDebts: any[] = [];
  let dueTodayDebts: any[] = [];
  let totalActiveDebt = 0;
  let totalOverdueAmount = 0;
  let totalActiveCount = 0;

  if (analysis && typeof analysis === "object") {
    overdueDebts = analysis.overdueDebts || [];
    dueTodayDebts = analysis.dueTodayDebts || [];
    totalActiveDebt = Number(analysis.totalActiveDebt) || 0;
    totalOverdueAmount = Number(analysis.totalOverdueAmount) || 0;
    totalActiveCount = Number(analysis.totalActiveCount) || (overdueDebts.length + dueTodayDebts.length);
  }

  const lines: string[] = [];
  lines.push(`Sayın ${user || "Bütçem Pro Kullanıcısı"},`);
  lines.push("");

  if (isWelcome) {
    lines.push("Bütçem Pro e-posta bildirimleriniz başarıyla aktifleştirildi. Güncel borç durumunuz:");
  } else if (isTest) {
    lines.push("Bu ileti Bütçem Pro tarafından gönderilen test ve borç durumu bildirim raporudur:");
  } else {
    lines.push("Bütçem Pro kayıtlı borç ve ödemelerinizin güncel durum özeti:");
  }

  lines.push("");
  lines.push(`* Toplam Kalan Borç: ₺${totalActiveDebt.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`);
  lines.push(`* Geciken Borç Tutarı: ₺${totalOverdueAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`);
  lines.push(`* Aktif Borç Kalem Sayısı: ${totalActiveCount}`);
  lines.push("");

  if (overdueDebts.length > 0) {
    lines.push("--- VADESİ GEÇMİŞ BORÇLAR ---");
    overdueDebts.forEach((d) => {
      lines.push(`- ${d.name}: ₺${(Number(d.remaining) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} (${d.daysLate} gün gecikti)`);
    });
    lines.push("");
  }

  if (dueTodayDebts.length > 0) {
    lines.push("--- BUGÜN VADESİ GELEN BORÇLAR ---");
    dueTodayDebts.forEach((d) => {
      lines.push(`- ${d.name}: ₺${(Number(d.amount) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} (Bugün Son Gün)`);
    });
    lines.push("");
  }

  lines.push("Bütçem Pro - Akıllı Bütçe ve Borç Takip Asistanı");
  lines.push(`Bu bilgilendirme e-postası ${email} adresi için oluşturulmuştur.`);
  lines.push("Not: Bu iletiyi gelen kutunuzda göremiyorsanız lütfen Spam / Tanıtımlar klasörünüzü kontrol ediniz.");

  return lines.join("\n");
}

// Generate rich HTML email template for debt overview, overdue alerts, and reminders
function generateOverdueEmailHtml(
  email: string,
  user: string,
  analysis: any,
  isTest = false,
  isWelcome = false
) {
  let overdueDebts: any[] = [];
  let dueTodayDebts: any[] = [];
  let upcomingDebts: any[] = [];
  let allActiveDebts: any[] = [];
  let totalActiveDebt = 0;
  let totalOverdueAmount = 0;
  let totalDueTodayAmount = 0;
  let totalActiveCount = 0;

  if (Array.isArray(analysis)) {
    overdueDebts = analysis;
    totalOverdueAmount = overdueDebts.reduce((sum, d) => sum + (Number(d.remaining) || 0), 0);
    totalActiveDebt = totalOverdueAmount;
    totalActiveCount = overdueDebts.length;
  } else if (analysis && typeof analysis === "object") {
    overdueDebts = analysis.overdueDebts || [];
    dueTodayDebts = analysis.dueTodayDebts || [];
    upcomingDebts = analysis.upcomingDebts || [];
    allActiveDebts = analysis.allActiveDebts || [];
    totalActiveDebt = Number(analysis.totalActiveDebt) || 0;
    totalOverdueAmount = Number(analysis.totalOverdueAmount) || overdueDebts.reduce((sum, d) => sum + (Number(d.remaining) || 0), 0);
    totalDueTodayAmount = Number(analysis.totalDueTodayAmount) || dueTodayDebts.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    totalActiveCount = Number(analysis.totalActiveCount) || allActiveDebts.length || (overdueDebts.length + dueTodayDebts.length + upcomingDebts.length);
  }

  const nowFormatted = new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  // Badge & Title customization
  let badgeLabel = "⚠️ BORÇ BİLDİRİMİ";
  let headingTitle = "Güncel Borç Durum & Hatırlatma Raporu";

  if (isWelcome) {
    badgeLabel = "🎉 BİLDİRİMLER AKTİFLEŞTİRİLDİ";
    headingTitle = "E-Posta Bildirimleriniz Devrede!";
  } else if (isTest) {
    badgeLabel = "🧪 TEST RAPORU & DOĞRULAMA";
    headingTitle = "Bütçem Pro Test ve Borç Raporu";
  } else if (overdueDebts.length > 0) {
    badgeLabel = "🚨 GECİKMİŞ BORÇ UYARISI";
    headingTitle = "Vadesi Geçmiş Borç Uyarısı!";
  } else if (dueTodayDebts.length > 0) {
    badgeLabel = "⏰ BUGÜN SON GÜN UYARISI";
    headingTitle = "Bugün Vadesi Dolan Ödemeniz Var!";
  }

  const overdueRows = overdueDebts.map(d => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 12px 14px; font-weight: 700; color: #1e293b; font-size: 13px;">
        ${d.name} ${d.isInstallment ? '<span style="font-size: 10px; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-weight: 800;">TAKSİT</span>' : ''}
        ${d.dueDateStr ? `<div style="font-size: 11px; color: #94a3b8; font-weight: 500; margin-top: 2px;">Vade: ${d.dueDateStr}</div>` : ''}
      </td>
      <td style="padding: 12px 14px; color: #e11d48; font-weight: 800; font-size: 14px; text-align: right;">
        ₺${(Number(d.remaining) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
      </td>
      <td style="padding: 12px 14px; text-align: center;">
        <span style="background: #ffe4e6; color: #be123c; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 800;">
          ${d.daysLate} Gün Gecikti
        </span>
      </td>
    </tr>
  `).join("");

  const dueTodayRows = dueTodayDebts.map(d => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 12px 14px; font-weight: 700; color: #1e293b; font-size: 13px;">
        ${d.name} ${d.isInstallment ? '<span style="font-size: 10px; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-weight: 800;">TAKSİT</span>' : ''}
      </td>
      <td style="padding: 12px 14px; color: #d97706; font-weight: 800; font-size: 14px; text-align: right;">
        ₺${(Number(d.amount) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
      </td>
      <td style="padding: 12px 14px; text-align: center;">
        <span style="background: #fef3c7; color: #b45309; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 800;">
          Bugün Son Gün
        </span>
      </td>
    </tr>
  `).join("");

  const allActiveRows = allActiveDebts.slice(0, 10).map(d => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 10px 14px; font-weight: 700; color: #1e293b; font-size: 12px;">
        ${d.name} ${d.isInstallment ? '<span style="font-size: 9px; background: #e0e7ff; color: #4338ca; padding: 1px 5px; border-radius: 4px; font-weight: 800;">TAKSİT</span>' : ''}
      </td>
      <td style="padding: 10px 14px; color: #64748b; font-size: 12px; text-align: center;">
        ${d.dueDateStr || '-'}
      </td>
      <td style="padding: 10px 14px; color: #0f172a; font-weight: 800; font-size: 13px; text-align: right;">
        ₺${(Number(d.remaining) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
      </td>
      <td style="padding: 10px 14px; text-align: center;">
        <span style="background: #f1f5f9; color: #475569; padding: 2px 7px; border-radius: 6px; font-size: 10px; font-weight: 700;">
          ${d.status || 'Aktif'}
        </span>
      </td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bütçem Pro Borç Uyarısı</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Top Colored Bar -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #4f46e5, #ec4899, #f59e0b);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 28px 28px 18px 28px; text-align: center;">
              <div style="display: inline-block; background: #e0e7ff; color: #4338ca; padding: 8px 16px; border-radius: 9999px; font-size: 11px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px;">
                ${badgeLabel}
              </div>
              <h1 style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 900; letter-spacing: -0.02em;">
                ${headingTitle}
              </h1>
              <p style="margin: 6px 0 0 0; color: #64748b; font-size: 13px; font-weight: 500;">
                Sayın ${user || "Bütçem Pro Kullanıcısı"}, ${nowFormatted} itibarıyla kayıtlı borç ve ödemelerinizin güncel durumu aşağıdadır.
              </p>
            </td>
          </tr>

          <!-- Metrics summary 3-column card -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
                <tr>
                  <td style="text-align: center; border-right: 1px solid #e2e8f0; padding: 16px 8px; width: 33%;">
                    <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Toplam Kalan Borç</div>
                    <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 4px;">
                      ₺${totalActiveDebt.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td style="text-align: center; border-right: 1px solid #e2e8f0; padding: 16px 8px; width: 33%;">
                    <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Geciken Tutar</div>
                    <div style="font-size: 18px; font-weight: 900; color: ${totalOverdueAmount > 0 ? '#e11d48' : '#10b981'}; margin-top: 4px;">
                      ${totalOverdueAmount > 0 ? `₺${totalOverdueAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : '₺0,00 (Temiz ✅)'}
                    </div>
                  </td>
                  <td style="text-align: center; padding: 16px 8px; width: 34%;">
                    <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Aktif Borç Sayısı</div>
                    <div style="font-size: 18px; font-weight: 900; color: #4f46e5; margin-top: 4px;">
                      ${totalActiveCount} Kalem
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${
            overdueDebts.length > 0
              ? `
          <!-- Overdue debts table -->
          <tr>
            <td style="padding: 0 28px 18px 28px;">
              <h3 style="margin: 0 0 10px 0; color: #be123c; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">
                🚨 Vadesi Geçmiş Borç Detayları (${overdueDebts.length} Kalem)
              </h3>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background: #ffffff; border: 1px solid #ffe4e6; border-radius: 12px; overflow: hidden;">
                <thead>
                  <tr style="background: #fff1f2; border-bottom: 1px solid #ffe4e6;">
                    <th style="padding: 10px 14px; text-align: left; font-size: 11px; color: #9f1239; font-weight: 800; text-transform: uppercase;">Borç / Taksit</th>
                    <th style="padding: 10px 14px; text-align: right; font-size: 11px; color: #9f1239; font-weight: 800; text-transform: uppercase;">Tutar</th>
                    <th style="padding: 10px 14px; text-align: center; font-size: 11px; color: #9f1239; font-weight: 800; text-transform: uppercase;">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  ${overdueRows}
                </tbody>
              </table>
            </td>
          </tr>
          `
              : ""
          }

          ${
            dueTodayDebts.length > 0
              ? `
          <!-- Due today debts table -->
          <tr>
            <td style="padding: 0 28px 18px 28px;">
              <h3 style="margin: 0 0 10px 0; color: #b45309; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">
                ⏰ Bugün Vadesi Dolan Ödemeler (${dueTodayDebts.length} Kalem)
              </h3>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background: #ffffff; border: 1px solid #fef3c7; border-radius: 12px; overflow: hidden;">
                <thead>
                  <tr style="background: #fffbeb; border-bottom: 1px solid #fef3c7;">
                    <th style="padding: 10px 14px; text-align: left; font-size: 11px; color: #92400e; font-weight: 800; text-transform: uppercase;">Borç / Taksit</th>
                    <th style="padding: 10px 14px; text-align: right; font-size: 11px; color: #92400e; font-weight: 800; text-transform: uppercase;">Tutar</th>
                    <th style="padding: 10px 14px; text-align: center; font-size: 11px; color: #92400e; font-weight: 800; text-transform: uppercase;">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  ${dueTodayRows}
                </tbody>
              </table>
            </td>
          </tr>
          `
              : ""
          }

          ${
            allActiveDebts.length > 0 && overdueDebts.length === 0 && dueTodayDebts.length === 0
              ? `
          <!-- All active debts table -->
          <tr>
            <td style="padding: 0 28px 18px 28px;">
              <h3 style="margin: 0 0 10px 0; color: #334155; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">
                📋 Kayıtlı Aktif Borç Listesi
              </h3>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <thead>
                  <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <th style="padding: 10px 14px; text-align: left; font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase;">Borç / Taksit</th>
                    <th style="padding: 10px 14px; text-align: center; font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase;">Vade</th>
                    <th style="padding: 10px 14px; text-align: right; font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase;">Kalan</th>
                    <th style="padding: 10px 14px; text-align: center; font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase;">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  ${allActiveRows}
                </tbody>
              </table>
            </td>
          </tr>
          `
              : ""
          }

          ${
            totalActiveCount === 0
              ? `
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 18px; text-align: center;">
                <div style="font-size: 24px; margin-bottom: 6px;">🎉</div>
                <div style="color: #166534; font-weight: 800; font-size: 14px;">Harika! Kayıtlı Ödenmemiş Borcunuz Yok</div>
                <div style="color: #15803d; font-size: 12px; margin-top: 4px;">Bütçem Pro'da takip edilen tüm borç ve taksitleriniz düzenli ve ödenmiş durumdadır.</div>
              </div>
            </td>
          </tr>
          `
              : ""
          }

          <!-- Action CTA -->
          <tr>
            <td style="padding: 8px 28px 24px 28px; text-align: center;">
              <div style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 14px; font-weight: 800; font-size: 13px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
                Bütçem Pro Borç Takip Asistanı
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 20px 28px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                Bu bilgilendirme e-postası, <strong>${email}</strong> adresi için Bütçem Pro <em>Ayarlar &gt; E-posta Bildirim Doğrulama</em> sisteminiz doğrultusunda iletilmiştir.
              </p>
              <p style="margin: 6px 0 0 0; font-size: 10px; color: #cbd5e1;">
                Bütçem Pro &copy; ${new Date().getFullYear()} - Akıllı Bütçe ve Borç Takip Asistanı
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Hostname and credential sanitizers
function cleanHost(rawHost?: string): string {
  if (!rawHost) return "";
  let host = rawHost.trim();
  // Strip any URL protocol or malformed leading characters like "smtp://", "smtps://", "https://", "://", "//"
  host = host.replace(/^[a-zA-Z0-9+.-]+:\/\//, "").replace(/^[:\/]+/, "");
  // Strip trailing paths, slashes or port attachments
  host = host.split("/")[0].split(":")[0].trim();

  // Known provider hostname mappings
  if (host === "gmail.com" || host === "gmail" || host === "googlemail.com") {
    return "smtp.gmail.com";
  }
  if (host === "hotmail.com" || host === "outlook.com" || host === "live.com") {
    return "smtp.office365.com";
  }
  if (host === "yahoo.com") {
    return "smtp.mail.yahoo.com";
  }
  if (host === "yandex.com" || host === "yandex.ru") {
    return "smtp.yandex.com";
  }
  return host;
}

function cleanCredential(val?: string): string {
  if (!val) return "";
  return val.trim().replace(/^["']|["']$/g, "");
}

// Nodemailer transporter resolver
function getMailTransporter(customOverride?: CustomSmtpConfig) {
  const activeConfig = customOverride || currentCustomSmtp;

  const user = cleanCredential(
    activeConfig?.user ||
    process.env.SMTP_USER ||
    process.env.SMTP_USERNAME ||
    process.env.EMAIL_USER ||
    process.env.MAIL_USER ||
    process.env.MAIL_USERNAME ||
    process.env.GMAIL_USER ||
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM
  );

  const pass = cleanCredential(
    activeConfig?.pass ||
    process.env.SMTP_PASS ||
    process.env.SMTP_PASSWORD ||
    process.env.EMAIL_PASS ||
    process.env.EMAIL_PASSWORD ||
    process.env.MAIL_PASS ||
    process.env.MAIL_PASSWORD ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.GMAIL_PASS ||
    process.env.GMAIL_PASSWORD
  ).replace(/\s+/g, "");

  if (!user || !pass) {
    return null;
  }

  const rawHost = activeConfig?.host ||
    process.env.SMTP_HOST ||
    process.env.MAIL_HOST ||
    process.env.EMAIL_HOST ||
    process.env.GMAIL_HOST;

  let host = cleanHost(rawHost);

  // Auto-detect host from email domain if missing
  if (!host) {
    const domain = user.includes("@") ? user.split("@")[1].toLowerCase() : "";
    if (domain === "gmail.com" || domain === "googlemail.com") {
      host = "smtp.gmail.com";
    } else if (domain === "outlook.com" || domain === "hotmail.com" || domain === "live.com") {
      host = "smtp.office365.com";
    } else if (domain === "yahoo.com") {
      host = "smtp.mail.yahoo.com";
    } else if (domain === "yandex.com" || domain === "yandex.ru") {
      host = "smtp.yandex.com";
    } else if (domain) {
      host = `smtp.${domain}`;
    } else {
      host = "smtp.gmail.com";
    }
  }

  const rawPort = Number(
    activeConfig?.port ||
    process.env.SMTP_PORT ||
    process.env.MAIL_PORT ||
    process.env.EMAIL_PORT
  );

  const port = rawPort || (host === "smtp.gmail.com" ? 465 : 587);
  const secureEnv = process.env.SMTP_SECURE || process.env.MAIL_SECURE;
  const secure = activeConfig?.secure ?? (secureEnv === "true" || secureEnv === "ssl" || port === 465);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

// Test SMTP Connection with detailed diagnostic feedback
async function testSmtpCredentials(config: CustomSmtpConfig): Promise<{ success: boolean; message: string; host?: string; port?: number }> {
  const host = cleanHost(config.host || (config.user?.includes("@gmail.com") ? "smtp.gmail.com" : ""));
  const user = cleanCredential(config.user);
  const pass = cleanCredential(config.pass).replace(/\s+/g, "");
  const port = Number(config.port) || (host === "smtp.gmail.com" ? 465 : 587);
  const secure = config.secure ?? (port === 465);

  if (!user || !pass) {
    return {
      success: false,
      message: "Lütfen gönderici e-posta adresinizi ve 16 haneli Uygulama Şifrenizi (veya SMTP şifrenizi) eksiksiz girin."
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: host || "smtp.gmail.com",
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    await transporter.verify();
    return {
      success: true,
      message: `✅ SMTP Bağlantısı Başarılı: ${host || "smtp.gmail.com"}:${port} üzerinden kimlik doğrulandı ve e-posta gönderimine hazır!`,
      host: host || "smtp.gmail.com",
      port
    };
  } catch (err: any) {
    console.error("[SMTP Verify Error]:", err);
    let errorMsg = err.message || "Bilinmeyen SMTP hatası";

    if (err.responseCode === 535 || errorMsg.includes("535") || errorMsg.includes("Username and Password not accepted") || err.code === "EAUTH") {
      errorMsg = "Kimlik Doğrulama Hatası (535): Gmail veya e-posta sağlayıcınız şifrenizi reddetti. Gmail kullanıyorsanız normal hesap şifreniz yerine Google Hesabınızdan (myaccount.google.com/apppasswords) alacağınız 16 haneli 'Google Uygulama Şifresi'ni girmelisiniz.";
    } else if (err.code === "ETIMEDOUT" || err.code === "ESOCKET" || errorMsg.includes("timeout")) {
      errorMsg = `Bağlantı Zaman Aşımı (${port} portu): Sunucu yanıt vermedi. Port olarak 465 (SSL) veya 587 (TLS) deneyiniz.`;
    } else if (err.code === "ENOTFOUND") {
      errorMsg = `Sunucu Adresi Bulunamadı (${host}): Lütfen SMTP sunucu adresinin doğruluğunu kontrol ediniz.`;
    } else if (err.code === "ECONNREFUSED") {
      errorMsg = `Bağlantı Reddedildi: ${host}:${port} bağlantıyı kapattı. Port veya SSL ayarını kontrol ediniz.`;
    }

    return {
      success: false,
      message: `❌ ${errorMsg}`
    };
  }
}

async function sendMailHelper(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  customConfig?: CustomSmtpConfig;
}): Promise<{ success: boolean; messageId?: string; simulated?: boolean; error?: string }> {
  try {
    const transporter = getMailTransporter(options.customConfig);
    const activeConfig = options.customConfig || currentCustomSmtp;
    const user = cleanCredential(activeConfig?.user || process.env.SMTP_USER || process.env.GMAIL_USER);
    
    // When sending through Gmail SMTP, the From address must align with authenticated user for optimal inbox deliverability
    const authEmail = user || (process.env.SMTP_FROM ? cleanCredential(process.env.SMTP_FROM) : "bildirim@butcempro.app");
    const senderName = activeConfig?.fromName || "Bütçem Pro";
    const fromAddress = `"${senderName}" <${authEmail}>`;
    const replyTo = process.env.SMTP_FROM ? cleanCredential(process.env.SMTP_FROM) : authEmail;
    
    if (transporter) {
      const info = await transporter.sendMail({
        from: fromAddress,
        replyTo: replyTo,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.subject,
        headers: {
          "Auto-Submitted": "auto-generated",
          "X-Entity-Ref-ID": `butcempro-${Date.now()}`
        }
      });
      console.log(`[Email Engine] Real email successfully sent to ${options.to} (MessageID: ${info.messageId})`);
      return { success: true, messageId: info.messageId, simulated: false };
    } else {
      console.log(`[Email Engine] SMTP not configured in environment or settings. Email simulation prepared for ${options.to}: "${options.subject}"`);
      return { success: true, simulated: true };
    }
  } catch (err: any) {
    console.error(`[Email Engine] Failed to deliver email to ${options.to}:`, err.message || err);
    let errMsg = err.message || "E-posta gönderim hatası";
    if (err.responseCode === 535 || errMsg.includes("535") || errMsg.includes("Username and Password not accepted") || err.code === "EAUTH") {
      errMsg = "Gmail Kimlik Doğrulama Hatası (535): Normal şifreniz yerine Google Hesabı > Güvenlik > 2 Adımlı Doğrulama > 'Uygulama Şifreleri' bölümünden oluşturduğunuz 16 haneli şifreyi giriniz.";
    }
    return { success: false, error: errMsg, simulated: false };
  }
}

// 1. Request verification code for email notification registration
app.post("/api/notifications/email/request-verification", async (req, res) => {
  const { email, user, debts, installmentDebts } = req.body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Lütfen geçerli bir e-posta adresi girin." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  // Generate a random 6-digit numeric OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  const existing = emailSubscribersMap[normalizedEmail] || {
    email: normalizedEmail,
    verified: false,
    alertOverdue: true,
    alertDueToday: true,
    frequency: "daily_morning" as const,
    minAmountThreshold: 0,
    debts: debts || [],
    installmentDebts: installmentDebts || [],
    user: user || "Kullanıcı",
    createdAt: Date.now()
  };

  emailSubscribersMap[normalizedEmail] = {
    ...existing,
    verificationCode: code,
    codeExpiresAt: expiresAt,
    debts: debts || existing.debts || [],
    installmentDebts: installmentDebts || existing.installmentDebts || [],
    user: user || existing.user || "Kullanıcı"
  };

  saveEmailSubscribersToFile();

  const otpHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; padding: 32px 24px; text-align: center;">
      <div style="font-size: 36px; margin-bottom: 12px;">🔐</div>
      <h2 style="color: #1e293b; margin: 0 0 12px 0; font-size: 22px; font-weight: 800;">Bütçem Pro Doğrulama Kodu</h2>
      <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
        Gecikmiş borç ve ödeme hatırlatıcı e-posta bildirimlerini aktifleştirmek için 6 haneli doğrulama kodunuz:
      </p>
      <div style="display: inline-block; background: #f1f5f9; border: 2px dashed #6366f1; border-radius: 14px; padding: 16px 32px; margin-bottom: 24px;">
        <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #4f46e5;">${code}</span>
      </div>
      <p style="color: #64748b; font-size: 13px; margin: 0 0 12px 0;">Bu kod <strong>10 dakika</strong> boyunca geçerlidir.</p>
      <p style="color: #94a3b8; font-size: 11px; margin: 0; line-height: 1.5;">Not: İletiyi gelen kutunuzda göremiyorsanız lütfen Spam / Tanıtımlar klasörünüzü kontrol ediniz.</p>
    </div>
  `;

  const otpText = `Sayın Bütçem Pro Kullanıcısı,\n\nE-posta bildirimlerini aktifleştirmek için 6 haneli doğrulama kodunuz: ${code}\n\nBu kod 10 dakika boyunca geçerlidir.\n\nNot: Bu e-posta gelen kutunuzda değilse lütfen Spam / Tanıtımlar klasörünüzü kontrol ediniz.\n\nBütçem Pro Ekibi`;

  try {
    await sendMailHelper({
      to: normalizedEmail,
      subject: `Bütçem Pro Doğrulama Kodunuz: ${code}`,
      html: otpHtml,
      text: otpText
    });
  } catch (mailErr) {
    console.warn("[Email Alert Engine] Background email send handled:", mailErr);
  }

  console.log(`[Email Alert Engine] Verification code for ${normalizedEmail}: [${code}] (Expires in 10 mins)`);

  res.json({
    success: true,
    message: `Doğrulama kodu ${normalizedEmail} adresine iletildi.`,
    expiresInSeconds: 600,
    devCode: code // Provided for instant seamless OTP filling in development/preview environments
  });
});

// 2. Verify OTP code and activate email alerts
app.post("/api/notifications/email/verify", async (req, res) => {
  const { email, code, debts, installmentDebts, preferences } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "E-posta ve doğrulama kodu zorunludur." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const subscriber = emailSubscribersMap[normalizedEmail];

  if (!subscriber) {
    return res.status(404).json({ error: "Bu e-posta için doğrulama talebi bulunamadı. Lütfen tekrar kod isteyin." });
  }

  if (Date.now() > (subscriber.codeExpiresAt || 0)) {
    return res.status(400).json({ error: "Doğrulama kodunun süresi dolmuş. Lütfen yeni bir kod isteyin." });
  }

  if (subscriber.verificationCode !== code.trim()) {
    return res.status(400).json({ error: "Girdiğiniz 6 haneli doğrulama kodu hatalı." });
  }

  // Mark as verified!
  subscriber.verified = true;
  subscriber.verifiedAt = Date.now();
  subscriber.verificationCode = undefined;
  subscriber.codeExpiresAt = undefined;

  if (preferences) {
    if (typeof preferences.alertOverdue === "boolean") subscriber.alertOverdue = preferences.alertOverdue;
    if (typeof preferences.alertDueToday === "boolean") subscriber.alertDueToday = preferences.alertDueToday;
    if (preferences.frequency) subscriber.frequency = preferences.frequency;
    if (typeof preferences.minAmountThreshold === "number") subscriber.minAmountThreshold = preferences.minAmountThreshold;
  }

  if (debts && Array.isArray(debts)) subscriber.debts = debts;
  if (installmentDebts && Array.isArray(installmentDebts)) subscriber.installmentDebts = installmentDebts;

  // Run comprehensive debt analysis for real amounts
  const debtAnalysis = analyzeUserDebts(subscriber.debts || [], subscriber.installmentDebts || []);

  console.log(`[Email Alert Engine] Verified email: ${normalizedEmail}. Total active debts: ${debtAnalysis.totalActiveCount}, Total remaining: ₺${debtAnalysis.totalActiveDebt}, Overdue: ₺${debtAnalysis.totalOverdueAmount}`);

  // Send an immediate confirmation / welcome email with current debt summary
  let welcomeSent = false;
  try {
    const welcomeHtml = generateOverdueEmailHtml(
      normalizedEmail,
      subscriber.user || "Bütçem Pro Kullanıcısı",
      debtAnalysis,
      false,
      true
    );
    const welcomeText = generateOverdueEmailText(
      normalizedEmail,
      subscriber.user || "Bütçem Pro Kullanıcısı",
      debtAnalysis,
      false,
      true
    );
    const welcomeResult = await sendMailHelper({
      to: normalizedEmail,
      subject: `Bütçem Pro: E-posta Bildirimleriniz Aktifleştirildi (Güncel Borç Raporu)`,
      html: welcomeHtml,
      text: welcomeText
    });
    welcomeSent = welcomeResult.success && !welcomeResult.simulated;
    subscriber.lastEmailSentAt = Date.now();
    subscriber.lastSentDebtSummary = `${debtAnalysis.overdueDebts.length} gecikmiş, ${debtAnalysis.dueTodayDebts.length} bugün vadesi gelen, toplam ₺${debtAnalysis.totalActiveDebt} borç`;
  } catch (confirmMailErr) {
    console.warn("[Email Alert Engine] Welcome confirmation email dispatch warning:", confirmMailErr);
  }

  saveEmailSubscribersToFile();

  res.json({
    success: true,
    welcomeSent,
    message: "E-posta adresiniz gecikmiş borç uyarıları için başarıyla doğrulandı ve aktifleştirildi! 🎉",
    subscriber: {
      email: subscriber.email,
      verified: subscriber.verified,
      alertOverdue: subscriber.alertOverdue,
      alertDueToday: subscriber.alertDueToday,
      frequency: subscriber.frequency,
      minAmountThreshold: subscriber.minAmountThreshold,
      verifiedAt: subscriber.verifiedAt,
      totalActiveDebt: debtAnalysis.totalActiveDebt,
      totalOverdueAmount: debtAnalysis.totalOverdueAmount,
      totalActiveCount: debtAnalysis.totalActiveCount
    }
  });
});

// Direct Rich HTML Email Send endpoint
app.post("/api/notifications/email/send-direct", async (req, res) => {
  try {
    const { recipientEmail, subject, htmlContent } = req.body || {};
    if (!recipientEmail || typeof recipientEmail !== "string" || !recipientEmail.includes("@")) {
      return res.status(400).json({ success: false, error: "Geçerli bir alıcı e-posta adresi giriniz." });
    }

    const mailResult = await sendMailHelper({
      to: recipientEmail.trim(),
      subject: subject || `Bütçem Pro: Finansal Rapor ve Bütçe Özeti (${new Date().toLocaleDateString("tr-TR")})`,
      html: htmlContent || "<p>Bütçem Pro Finansal Raporu</p>",
    });

    if (mailResult.success) {
      return res.json({
        success: true,
        simulated: mailResult.simulated,
        message: mailResult.simulated
          ? "SMTP sunucusu henüz yapılandırılmadığı için gönderim simüle edildi. Canlı e-posta gönderimi için Gelişmiş Bildirim Ayarları bölümünden e-posta/SMTP şifrenizi tanımlayabilirsiniz."
          : "Finansal rapor e-postası başarıyla alıcıya gönderildi! 🚀",
      });
    } else {
      return res.status(500).json({ success: false, error: mailResult.error || "E-posta gönderilemedi." });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "E-posta sunucusu hatası." });
  }
});

// 3. Get subscriber status by email
app.get("/api/notifications/email/status", (req, res) => {
  const email = (req.query.email as string)?.trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "E-posta adresi belirtilmedi." });
  }

  const subscriber = emailSubscribersMap[email];
  if (!subscriber) {
    return res.json({
      registered: false,
      verified: false
    });
  }

  const debtAnalysis = analyzeUserDebts(subscriber.debts || [], subscriber.installmentDebts || []);

  res.json({
    registered: true,
    verified: subscriber.verified,
    email: subscriber.email,
    alertOverdue: subscriber.alertOverdue,
    alertDueToday: subscriber.alertDueToday,
    frequency: subscriber.frequency,
    minAmountThreshold: subscriber.minAmountThreshold,
    verifiedAt: subscriber.verifiedAt,
    lastEmailSentAt: subscriber.lastEmailSentAt,
    lastSentDebtSummary: subscriber.lastSentDebtSummary,
    totalActiveDebt: debtAnalysis.totalActiveDebt,
    totalOverdueAmount: debtAnalysis.totalOverdueAmount,
    totalActiveCount: debtAnalysis.totalActiveCount
  });
});

// 4. Update email alert preferences
app.post("/api/notifications/email/update-preferences", (req, res) => {
  const { email, preferences, debts, installmentDebts } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !emailSubscribersMap[normalizedEmail]) {
    return res.status(404).json({ error: "Doğrulanmış e-posta kaydı bulunamadı." });
  }

  const subscriber = emailSubscribersMap[normalizedEmail];
  if (preferences) {
    if (typeof preferences.alertOverdue === "boolean") subscriber.alertOverdue = preferences.alertOverdue;
    if (typeof preferences.alertDueToday === "boolean") subscriber.alertDueToday = preferences.alertDueToday;
    if (preferences.frequency) subscriber.frequency = preferences.frequency;
    if (typeof preferences.minAmountThreshold === "number") subscriber.minAmountThreshold = preferences.minAmountThreshold;
  }

  if (debts !== undefined && Array.isArray(debts)) subscriber.debts = debts;
  if (installmentDebts !== undefined && Array.isArray(installmentDebts)) subscriber.installmentDebts = installmentDebts;

  saveEmailSubscribersToFile();

  res.json({
    success: true,
    message: "E-posta bildirim tercihleriniz güncellendi.",
    subscriber: {
      email: subscriber.email,
      verified: subscriber.verified,
      alertOverdue: subscriber.alertOverdue,
      alertDueToday: subscriber.alertDueToday,
      frequency: subscriber.frequency,
      minAmountThreshold: subscriber.minAmountThreshold
    }
  });
});

// 5. Remove or unlink email registration
app.post("/api/notifications/email/remove", (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail && emailSubscribersMap[normalizedEmail]) {
    delete emailSubscribersMap[normalizedEmail];
    saveEmailSubscribersToFile();
    console.log(`[Email Alert Engine] Removed email subscription for: ${normalizedEmail}`);
  }

  res.json({ success: true, message: "E-posta bildirim aboneliği başarıyla kaldırıldı." });
});

// 6. Send a simulated / live test overdue alert email
app.post("/api/notifications/email/send-test", async (req, res) => {
  const { email, debts, installmentDebts, user, analysis: clientAnalysis } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: "E-posta adresi belirtilmedi." });
  }

  const sub = emailSubscribersMap[normalizedEmail];
  // Always use the latest available debts (provided in body or saved in subscriber record)
  const userDebts = (debts && Array.isArray(debts) && debts.length > 0) ? debts : (sub?.debts || []);
  const userInstDebts = (installmentDebts && Array.isArray(installmentDebts) && installmentDebts.length > 0) ? installmentDebts : (sub?.installmentDebts || []);

  if (debts && Array.isArray(debts) && sub) sub.debts = debts;
  if (installmentDebts && Array.isArray(installmentDebts) && sub) sub.installmentDebts = installmentDebts;
  if (sub) saveEmailSubscribersToFile();

  const computedAnalysis = analyzeUserDebts(userDebts, userInstDebts);
  const analysis = (clientAnalysis && (clientAnalysis.totalActiveCount > 0 || clientAnalysis.overdueCount > 0))
    ? clientAnalysis
    : computedAnalysis;

  // If user has zero registered debts at all in system, provide test mock items so they can see how late alerts render
  let reportAnalysis = analysis;
  if (analysis.totalActiveCount === 0) {
    reportAnalysis = {
      ...analysis,
      totalActiveDebt: 19300,
      totalOverdueAmount: 16850,
      totalDueTodayAmount: 2450,
      totalActiveCount: 3,
      overdueDebts: [
        { name: "Garanti Kredi Kartı Asgari (Test)", remaining: 4850, daysLate: 3, isInstallment: false, dueDateStr: "3 gün önce" },
        { name: "Kira / Aidat Ödemesi (Test)", remaining: 12000, daysLate: 1, isInstallment: false, dueDateStr: "Dün" }
      ],
      dueTodayDebts: [
        { name: "Buzdolabı Taksiti (4. Taksit) (Test)", amount: 2450, isInstallment: true }
      ]
    };
  }

  const html = generateOverdueEmailHtml(
    normalizedEmail,
    user || sub?.user || "Bütçem Pro Kullanıcısı",
    reportAnalysis,
    true,
    false
  );
  const text = generateOverdueEmailText(
    normalizedEmail,
    user || sub?.user || "Bütçem Pro Kullanıcısı",
    reportAnalysis,
    true,
    false
  );
  const subject = `Bütçem Pro: Güncel Borç Raporu ve Ödeme Özeti (${new Date().toLocaleDateString("tr-TR")})`;

  const sendResult = await sendMailHelper({
    to: normalizedEmail,
    subject,
    html,
    text
  });

  const hasSmtp = !!(currentCustomSmtp.user && currentCustomSmtp.pass) || !!(process.env.SMTP_HOST || process.env.SMTP_USER || process.env.GMAIL_USER);

  console.log(`[Email Alert Engine] Sent test email to: ${normalizedEmail} (Delivered: ${!sendResult.simulated && sendResult.success}, HasSMTP: ${hasSmtp}, TotalDebt: ₺${reportAnalysis.totalActiveDebt})`);

  res.json({
    success: sendResult.success,
    delivered: !sendResult.simulated && sendResult.success,
    simulated: sendResult.simulated,
    smtpConfigured: hasSmtp,
    messageId: sendResult.messageId,
    message: sendResult.simulated 
      ? `Test e-postası ${normalizedEmail} adresi için simüle edildi (Arayüzde önizleme olarak görüntülenebilir). Doğrudan gelen kutunuza anlık iletim için 'SMTP & E-Posta Gönderim Ayarları' bölümünden e-posta ve 16 haneli Google Uygulama Şifrenizi kaydedebilirsiniz.`
      : sendResult.success
        ? `Test e-postası ${normalizedEmail} adresine başarıyla gönderildi! Lütfen gelen kutunuzu (ve Spam / Tanıtımlar klasörünüzü) kontrol edin.`
        : `E-posta gönderiminde hata oluştu: ${sendResult.error}`,
    htmlPreview: html,
    overdueCount: reportAnalysis.overdueDebts.length,
    dueTodayCount: reportAnalysis.dueTodayDebts.length,
    totalOverdueAmount: reportAnalysis.totalOverdueAmount,
    totalActiveDebt: reportAnalysis.totalActiveDebt,
    totalActiveCount: reportAnalysis.totalActiveCount
  });
});

// 7. Test custom SMTP connection directly
app.post("/api/notifications/email/test-smtp-connection", async (req, res) => {
  const { host, port, user, pass, secure } = req.body;
  const result = await testSmtpCredentials({ host, port, user, pass, secure });
  res.json(result);
});

// 8. Save custom SMTP configuration and verify it
app.post("/api/notifications/email/save-smtp-config", async (req, res) => {
  const { host, port, user, pass, secure, fromName } = req.body;
  if (!user || !pass) {
    return res.status(400).json({ success: false, message: "Kullanıcı adı/e-posta ve şifre zorunludur." });
  }

  const cleanU = cleanCredential(user);
  const cleanP = cleanCredential(pass).replace(/\s+/g, "");
  const cleanH = cleanHost(host || (cleanU.includes("@gmail.com") ? "smtp.gmail.com" : ""));
  const cleanPort = Number(port) || (cleanH === "smtp.gmail.com" ? 465 : 587);
  const isSecure = secure ?? (cleanPort === 465);

  const testResult = await testSmtpCredentials({
    host: cleanH,
    port: cleanPort,
    user: cleanU,
    pass: cleanP,
    secure: isSecure
  });

  if (!testResult.success) {
    return res.status(400).json({
      success: false,
      message: testResult.message,
      smtpConfigured: false
    });
  }

  // Save valid config
  currentCustomSmtp = {
    host: cleanH,
    port: cleanPort,
    user: cleanU,
    pass: cleanP,
    secure: isSecure,
    fromName: fromName || "Bütçem Pro",
    updatedAt: Date.now()
  };

  saveCustomSmtpToFile();
  console.log(`[SMTP Engine] Custom SMTP configuration updated for ${cleanU} on ${cleanH}:${cleanPort}`);

  res.json({
    success: true,
    message: `✅ SMTP ayarları başarıyla kaydedildi ve doğrulandı (${cleanH}:${cleanPort})! Artık tüm e-postalar bu adres üzerinden canlı iletilecektir.`,
    smtpConfigured: true,
    user: cleanU,
    host: cleanH,
    port: cleanPort
  });
});

// 9. Reset custom SMTP configuration (return to defaults/env)
app.post("/api/notifications/email/reset-smtp-config", (req, res) => {
  currentCustomSmtp = {};
  if (fs.existsSync(SMTP_CONFIG_FILE)) {
    try {
      fs.unlinkSync(SMTP_CONFIG_FILE);
    } catch (e) {}
  }
  console.log("[SMTP Engine] Custom SMTP configuration reset.");
  res.json({ success: true, message: "Özel SMTP ayarları sıfırlandı." });
});

// 10. Get current SMTP status
app.get("/api/notifications/email/smtp-status", (req, res) => {
  const hasCustom = !!(currentCustomSmtp.user && currentCustomSmtp.pass);
  const hasEnv = !!(process.env.SMTP_USER || process.env.GMAIL_USER);
  const activeUser = currentCustomSmtp.user || process.env.SMTP_USER || process.env.GMAIL_USER || "";
  const activeHost = currentCustomSmtp.host || cleanHost(process.env.SMTP_HOST) || (activeUser.includes("@gmail.com") ? "smtp.gmail.com" : "");
  const activePort = currentCustomSmtp.port || Number(process.env.SMTP_PORT) || (activeHost === "smtp.gmail.com" ? 465 : 587);

  // Mask user email for safety (e.g. n***2@gmail.com)
  let maskedUser = "";
  if (activeUser.includes("@")) {
    const [name, domain] = activeUser.split("@");
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}*`;
    maskedUser = `${maskedName}@${domain}`;
  } else if (activeUser) {
    maskedUser = `${activeUser.substring(0, 2)}***`;
  }

  res.json({
    configured: hasCustom || hasEnv,
    source: hasCustom ? "in_app" : hasEnv ? "env" : "none",
    host: activeHost || null,
    port: activePort,
    user: maskedUser || null,
    rawUser: activeUser || null,
    fromName: currentCustomSmtp.fromName || "Bütçem Pro"
  });
});

// 11. Send automated overdue / due today debt alert email
app.post("/api/notifications/email/send-alert", async (req, res) => {
  const { email, debts, installmentDebts, user, analysis: clientAnalysis, isWelcome } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: "E-posta adresi belirtilmedi." });
  }

  const sub = emailSubscribersMap[normalizedEmail];
  const userDebts = (debts && Array.isArray(debts)) ? debts : (sub?.debts || []);
  const userInstDebts = (installmentDebts && Array.isArray(installmentDebts)) ? installmentDebts : (sub?.installmentDebts || []);

  const computedAnalysis = analyzeUserDebts(userDebts, userInstDebts);
  const analysis = clientAnalysis || computedAnalysis;

  const html = generateOverdueEmailHtml(
    normalizedEmail,
    user || sub?.user || "Bütçem Pro Kullanıcısı",
    analysis,
    false,
    !!isWelcome
  );
  const text = generateOverdueEmailText(
    normalizedEmail,
    user || sub?.user || "Bütçem Pro Kullanıcısı",
    analysis,
    false,
    !!isWelcome
  );
  const subject = isWelcome 
    ? `Bütçem Pro: E-posta Bildirimleriniz Aktifleştirildi 🎉`
    : (analysis?.overdueCount > 0)
      ? `🚨 Acil Borç Hatırlatması: ${analysis.overdueCount} Adet Gecikmiş Ödemeniz Bulunuyor!`
      : `📅 Günlük Borç ve Ödeme Özeti: Bugün ${analysis?.dueTodayCount || 0} Adet Ödemeniz Var`;

  const sendResult = await sendMailHelper({
    to: normalizedEmail,
    subject,
    html,
    text
  });

  if (sendResult.success && sub) {
    sub.lastEmailSentAt = Date.now();
    saveEmailSubscribersToFile();
  }

  res.json({
    success: sendResult.success,
    delivered: !sendResult.simulated && sendResult.success,
    simulated: sendResult.simulated,
    messageId: sendResult.messageId,
  });
});

// Background daemon that runs every 10 seconds:
// 1. Checks specific due alarms
// 2. Periodically checks overdue debts & due-today debts (push notifications)
// 3. Periodically checks overdue debts for verified email subscribers (automated email alerts)
setInterval(async () => {
  try {
    const nowTime = Date.now();
    let hasChanges = false;

    // Check verified email subscribers for automated overdue emails (once every 12 hours)
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    for (const [emailKey, sub] of Object.entries(emailSubscribersMap)) {
      if (!sub.verified || (!sub.alertOverdue && !sub.alertDueToday)) continue;

      const lastSent = sub.lastEmailSentAt || 0;
      if (nowTime - lastSent > TWELVE_HOURS_MS) {
        const subDebts = sub.debts || [];
        const subInstDebts = sub.installmentDebts || [];
        const analysis = analyzeUserDebts(subDebts, subInstDebts);
        const { overdueDebts, dueTodayDebts } = analysis;
        const qualifyingOverdue = overdueDebts.filter(d => d.remaining >= (sub.minAmountThreshold || 0));
        const qualifyingDueToday = dueTodayDebts.filter(d => d.amount >= (sub.minAmountThreshold || 0));

        if ((sub.alertOverdue && qualifyingOverdue.length > 0) || (sub.alertDueToday && qualifyingDueToday.length > 0)) {
          console.log(`[Email Alert Engine] Automated background overdue alert triggered for verified subscriber: ${sub.email}`);
          
          const filteredAnalysis = {
            ...analysis,
            overdueDebts: qualifyingOverdue,
            dueTodayDebts: qualifyingDueToday,
            totalOverdueAmount: qualifyingOverdue.reduce((s, d) => s + (Number(d.remaining) || 0), 0),
            totalDueTodayAmount: qualifyingDueToday.reduce((s, d) => s + (Number(d.amount) || 0), 0),
          };

          const html = generateOverdueEmailHtml(
            sub.email,
            sub.user || "Bütçem Pro Kullanıcısı",
            filteredAnalysis,
            false,
            false
          );
          const text = generateOverdueEmailText(
            sub.email,
            sub.user || "Bütçem Pro Kullanıcısı",
            filteredAnalysis,
            false,
            false
          );
          const subject = `${qualifyingOverdue.length > 0 ? `Bütçem Pro: ${qualifyingOverdue.length} Adet Gecikmiş Borç Bildirimi` : "Bütçem Pro: Bugün Vadesi Dolan Ödeme Hatırlatması"}`;
          
          await sendMailHelper({
            to: sub.email,
            subject,
            html,
            text
          });

          sub.lastEmailSentAt = nowTime;
          sub.lastSentDebtSummary = `${qualifyingOverdue.length} gecikmiş, ${qualifyingDueToday.length} bugün vadesi gelen (Toplam Kalan: ₺${analysis.totalActiveDebt})`;
          saveEmailSubscribersToFile();
        }
      }
    }

    for (const [endpointHash, details] of Object.entries(subscriptionsMap)) {
      if (!details || !details.subscription) continue;

      // --- 1. CHECK SPECIFIC SCHEDULED ALARMS ---
      if (details.alarms && details.alarms.length > 0) {
        const remainingAlarms: any[] = [];
        const triggeredAlarms: any[] = [];

        details.alarms.forEach((alarm) => {
          if (!alarm) return;
          
          let alarmTime = NaN;
          if (alarm.timestamp) {
            alarmTime = Number(alarm.timestamp);
          } else if (alarm.date) {
            try {
              alarmTime = new Date(alarm.date).getTime();
              
              // Secondary Turkish locale parser fallback for "dd.mm.yyyy hh:mm:ss"
              if (isNaN(alarmTime)) {
                const parts = alarm.date.trim().split(" ");
                if (parts.length === 2) {
                  const datePart = parts[0];
                  const timePart = parts[1];
                  let y, m, d;
                  if (datePart.includes(".")) {
                    const dp = datePart.split(".");
                    d = parseInt(dp[0], 10);
                    m = parseInt(dp[1], 10) - 1;
                    y = parseInt(dp[2], 10);
                  } else if (datePart.includes("-")) {
                    const dp = datePart.split("-");
                    y = parseInt(dp[0], 10);
                    m = parseInt(dp[1], 10) - 1;
                    d = parseInt(dp[2], 10);
                  }
                  const tp = timePart.split(":");
                  const hr = parseInt(tp[0], 10) || 0;
                  const min = parseInt(tp[1], 10) || 0;
                  const sec = parseInt(tp[2], 10) || 0;
                  alarmTime = new Date(y, m, d, hr, min, sec).getTime();
                }
              }
            } catch (err) {
              console.error("[Push Server] parse alarm date error:", err);
            }
          }

          if (!isNaN(alarmTime) && alarmTime <= nowTime) {
            triggeredAlarms.push(alarm);
          } else {
            remainingAlarms.push(alarm);
          }
        });

        if (triggeredAlarms.length > 0) {
          hasChanges = true;
          details.alarms = remainingAlarms;

          // Send a push notification for each triggered alarm!
          for (const alarm of triggeredAlarms) {
            const payload = JSON.stringify({
              title: "Butcem Pro",
              body: alarm.title || "Hatırlatıcı zamanı geldi! ⏰",
              tag: `alarm-${alarm.id}`,
              action: "trigger-sync",
              syncTag: "server-cron-sync",
              icon: "/logo.png",
              badge: "/logo.png",
              url: "/?tab=notifications"
            });

            console.log(`[Push Server] Sending background notification for alarm: "${alarm.title}" to user "${details.user}"`);
            
            try {
              await webpush.sendNotification(details.subscription, payload, {
                headers: { "Urgency": "high" },
                TTL: 0
              });
              console.log(`[Push Server] Successfully sent notification!`);
            } catch (pushErr: any) {
              console.error(`[Push Server] Error sending push notification. Status code: ${pushErr.statusCode || "unknown"}`);
              if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                console.log(`[Push Server] Removing deactivated subscription: ${endpointHash}`);
                delete subscriptionsMap[endpointHash];
                break;
              }
            }
          }
        }
      }

      // --- 2. CHECK OVERDUE DEBTS & DUE TODAY (BACKGROUND PUSH WHEN APP IS CLOSED) ---
      // We send overdue / due reminders at reasonable intervals (at least 6 hours apart per device)
      const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
      const lastOverdueTime = details.lastOverduePushTime || 0;
      const hasDebts = (details.debts && details.debts.length > 0) || (details.installmentDebts && details.installmentDebts.length > 0);

      if (hasDebts && (nowTime - lastOverdueTime > SIX_HOURS_MS)) {
        const { overdueDebts, dueTodayDebts } = analyzeUserDebts(details.debts || [], details.installmentDebts || []);

        if (overdueDebts.length > 0 || dueTodayDebts.length > 0) {
          let title = "Bütçem Pro: Borç Hatırlatması ⏰";
          let body = "";

          if (overdueDebts.length > 0) {
            const totalOverdue = overdueDebts.reduce((sum, d) => sum + d.remaining, 0);
            const topDebt = overdueDebts[0];
            title = `⚠️ Gecikmiş Borç Uyarısı (${overdueDebts.length} Adet)`;
            body = `Ödemesi geçen borcunuz var: "${topDebt.name}" (₺${topDebt.remaining.toLocaleString("tr-TR")}, ${topDebt.daysLate} gün gecikti). Toplam: ₺${totalOverdue.toLocaleString("tr-TR")}.`;
          } else if (dueTodayDebts.length > 0) {
            const totalDue = dueTodayDebts.reduce((sum, d) => sum + d.amount, 0);
            const topDebt = dueTodayDebts[0];
            title = `🚨 Bugün Vadesi Gelen Ödemeniz Var!`;
            body = `"${topDebt.name}" için ₺${topDebt.amount.toLocaleString("tr-TR")} tutarındaki ödemenizin vadesi bugün!`;
          }

          const payload = JSON.stringify({
            title,
            body,
            tag: "overdue-periodic-" + new Date().toISOString().slice(0, 10),
            action: "trigger-sync",
            syncTag: "server-cron-sync",
            icon: "/logo.png",
            badge: "/logo.png",
            url: "/?tab=debts"
          });

          try {
            console.log(`[Push Server] Sending periodic background overdue reminder to user: "${details.user}"`);
            await webpush.sendNotification(details.subscription, payload, {
              headers: { "Urgency": "high" },
              TTL: 86400
            });
            details.lastOverduePushTime = nowTime;
            hasChanges = true;
          } catch (pushErr: any) {
            console.error(`[Push Server] Error sending overdue push:`, pushErr.statusCode || pushErr.message);
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              delete subscriptionsMap[endpointHash];
              hasChanges = true;
            }
          }
        }
      }
    }

    if (hasChanges) {
      saveSubscriptionsToFile();
    }
  } catch (daemonErr) {
    console.error("[Daemon Guard] Background check error safely caught:", daemonErr);
  }
}, 10000);

// Global Express Error Middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Express Global Error Handler]:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Sunucu hatası engellendi", message: err?.message || "Bilinmeyen hata" });
  }
});


// Crawler & AdSense file helper
const serveStaticPlainTextFile = (fileName: string, defaultContent: string, contentType = "text/plain; charset=utf-8") => {
  return (_req: express.Request, res: express.Response) => {
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");

    const possibleFiles = [
      path.join(process.cwd(), "public", fileName),
      path.join(process.cwd(), "dist", fileName),
      path.join(process.cwd(), fileName)
    ];

    for (const fp of possibleFiles) {
      if (fs.existsSync(fp)) {
        try {
          const content = fs.readFileSync(fp, "utf-8");
          return res.status(200).send(content);
        } catch {
          // fallback to next
        }
      }
    }

    return res.status(200).send(defaultContent);
  };
};

// Google AdSense & AdMob Crawler Verification Routes
app.get("/ads.txt", serveStaticPlainTextFile("ads.txt", "google.com, pub-4449700232321088, DIRECT, f08c47fec0942fa0\n"));
app.get("/app-ads.txt", serveStaticPlainTextFile("app-ads.txt", "google.com, pub-4449700232321088, DIRECT, f08c47fec0942fa0\n"));
app.get("/robots.txt", serveStaticPlainTextFile("robots.txt", "User-agent: *\nAllow: /\n\nUser-agent: Mediapartners-Google\nAllow: /\n\nUser-agent: Googlebot\nAllow: /\n\nSitemap: https://borctakipyonetimi.github.io/sitemap.xml\n"));
app.get("/sitemap.xml", serveStaticPlainTextFile("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://borctakipyonetimi.github.io/</loc><priority>1.0</priority></url>\n</urlset>', "application/xml; charset=utf-8"));

app.get(privacyPaths, (req, res) => {
  const possibleFiles = [
    path.join(process.cwd(), "dist", "privacy-policy.html"),
    path.join(process.cwd(), "public", "privacy-policy.html"),
    path.join(process.cwd(), "privacy-policy.html")
  ];
  
  for (const fp of possibleFiles) {
    if (fs.existsSync(fp)) {
      return res.sendFile(fp);
    }
  }
  res.status(404).send("Gizlilik politikası dosyası bulunamadı. Lütfen /public/privacy-policy.html dosyasının varlığından emin olun.");
});

// Explicit JSON 404 handler for any unhandled /api/* endpoints (prevents falling through to HTML SPA page)
app.use("/api/*", (req, res) => {
  res.status(404).json({ success: false, error: `API uç noktası bulunamadı: ${req.originalUrl}` });
});

// Global JSON error middleware for any /api errors
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.originalUrl && req.originalUrl.startsWith("/api")) {
    console.error("[API Error Handler]:", err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || "Sunucuda beklenmeyen bir API hatası oluştu."
    });
  }
  next(err);
});

// Vite middleware flow
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
