var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_nodemailer = __toESM(require("nodemailer"), 1);
var import_web_push = __toESM(require("web-push"), 1);
var import_crypto = __toESM(require("crypto"), 1);
import_dotenv.default.config();
process.on("uncaughtException", (err) => {
  console.error("[Server Process Guard] Uncaught Exception caught:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Server Process Guard] Unhandled Rejection caught at:", promise, "reason:", reason);
});
var app = (0, import_express.default)();
var PORT = 3e3;
var SMTP_CONFIG_FILE = import_path.default.join(process.cwd(), "custom_smtp_config.json");
var currentCustomSmtp = {};
if (import_fs.default.existsSync(SMTP_CONFIG_FILE)) {
  try {
    const raw = import_fs.default.readFileSync(SMTP_CONFIG_FILE, "utf-8").trim();
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
    import_fs.default.writeFileSync(SMTP_CONFIG_FILE, JSON.stringify(currentCustomSmtp, null, 2), "utf-8");
  } catch (err) {
    console.error("[SMTP Engine] Error saving custom_smtp_config.json:", err);
  }
}
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
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "butcem-pro-backend",
    time: (/* @__PURE__ */ new Date()).toISOString(),
    smtpConfigured: !!(currentCustomSmtp?.user && currentCustomSmtp?.pass)
  });
});
var tempWebviewBackups = /* @__PURE__ */ new Map();
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
}, 5 * 60 * 1e3);
app.post("/api/temp-backup", (req, res) => {
  const { content, filename } = req.body;
  if (!content) {
    return res.status(400).json({ error: "\u0130\xE7erik bo\u015F olamaz" });
  }
  let cleanName = typeof filename === "string" && filename.trim() ? filename.trim() : "butcem_pro_yedek";
  cleanName = cleanName.replace(/[\/\\?%*:|"<>]/g, "_");
  let finalFilename = cleanName;
  if (!/\.[a-zA-Z0-9]+$/.test(finalFilename)) {
    finalFilename = `${cleanName}.json`;
  }
  const key = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const expires = Date.now() + 30 * 60 * 1e3;
  tempWebviewBackups.set(key, { content, filename: finalFilename, expires });
  res.json({ success: true, key, filename: finalFilename });
});
app.get(["/api/download-temp", "/api/download-temp/:filename"], (req, res) => {
  const { key, filename: queryFilename } = req.query;
  if (!key || typeof key !== "string") {
    return res.status(400).send("Ge\xE7ersiz anahtar");
  }
  const item = tempWebviewBackups.get(key);
  if (!item || Date.now() > item.expires) {
    return res.status(404).send("Yedek linkinin s\xFCresi dolmu\u015F veya bulunamad\u0131");
  }
  const effectiveFilename = typeof queryFilename === "string" && queryFilename.trim() || req.params.filename || item.filename;
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
var TRIALS_FILE = import_path.default.join(process.cwd(), "trials.json");
function readTrials() {
  try {
    if (import_fs.default.existsSync(TRIALS_FILE)) {
      const data = import_fs.default.readFileSync(TRIALS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading trials file:", e);
  }
  return {};
}
function writeTrials(trials) {
  try {
    import_fs.default.writeFileSync(TRIALS_FILE, JSON.stringify(trials, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing trials file:", e);
  }
}
app.get("/api/trial/status", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();
  const userId = req.query.userId || "";
  const deviceId = req.query.deviceId || "";
  const trials = readTrials();
  const key = userId && userId.trim() || deviceId && deviceId.trim() || ip;
  const startDateStr = trials[key] || deviceId && trials[deviceId] || userId && trials[userId] || trials[ip];
  if (!startDateStr) {
    return res.json({
      hasTrial: false,
      isActive: false,
      isExpired: false,
      daysRemaining: 7,
      startDate: null,
      endDate: null
    });
  }
  const startDate = new Date(startDateStr);
  const now = /* @__PURE__ */ new Date();
  const diffTime = now.getTime() - startDate.getTime();
  const diffDays = diffTime / (1e3 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, Math.ceil(7 - diffDays));
  const isExpired = diffDays >= 7;
  const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1e3);
  res.json({
    hasTrial: true,
    isActive: !isExpired,
    isExpired,
    daysRemaining,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });
});
app.post("/api/trial/activate", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();
  const { userId, deviceId } = req.body || {};
  const trials = readTrials();
  const key = userId && typeof userId === "string" && userId.trim() || deviceId && typeof deviceId === "string" && deviceId.trim() || ip;
  if (!trials[key]) {
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    trials[key] = nowIso;
    if (deviceId) trials[deviceId] = nowIso;
    if (userId) trials[userId] = nowIso;
    trials[ip] = nowIso;
    writeTrials(trials);
  }
  const startDate = new Date(trials[key]);
  const now = /* @__PURE__ */ new Date();
  const diffTime = now.getTime() - startDate.getTime();
  const diffDays = diffTime / (1e3 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, Math.ceil(7 - diffDays));
  const isExpired = diffDays >= 7;
  const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1e3);
  res.json({
    hasTrial: true,
    isActive: !isExpired,
    isExpired,
    daysRemaining,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });
});
app.post("/api/trial/cancel", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();
  const { userId, deviceId } = req.body || {};
  const trials = readTrials();
  const key = userId && typeof userId === "string" && userId.trim() || deviceId && typeof deviceId === "string" && deviceId.trim() || ip;
  const expiredDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString();
  trials[key] = expiredDate;
  if (deviceId) trials[deviceId] = expiredDate;
  if (userId) trials[userId] = expiredDate;
  trials[ip] = expiredDate;
  writeTrials(trials);
  res.json({
    hasTrial: true,
    isActive: false,
    isExpired: true,
    isCanceled: true,
    daysRemaining: 0,
    startDate: null,
    endDate: null
  });
});
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
  } catch (err) {
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
    const boundary = "ais_multipart_boundary_5228182";
    const delimiter = `--${boundary}`;
    const closeDelimiter = `--${boundary}--`;
    const parts = [
      Buffer.from(`${delimiter}\r
Content-Type: application/json; charset=UTF-8\r
\r
`),
      Buffer.from(JSON.stringify(metadata)),
      Buffer.from(`\r
${delimiter}\r
Content-Type: application/json\r
\r
`),
      Buffer.from(JSON.stringify(content)),
      Buffer.from(`\r
${closeDelimiter}`)
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
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var cachedApiKey = void 0;
var cachedAi = null;
var defaultKeyHasFailed = false;
function getGeminiClient(userKey) {
  if (!userKey && defaultKeyHasFailed) {
    return null;
  }
  const currentKey = userKey || process.env.GEMINI_API_KEY;
  if (!currentKey || currentKey.trim() === "") {
    return null;
  }
  const cleanKey = currentKey.trim();
  if (userKey) {
    try {
      return new import_genai.GoogleGenAI({
        apiKey: cleanKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
    } catch (err) {
      console.warn("[Gemini API Client] User key initialization error:", err);
      return null;
    }
  }
  if (cleanKey !== cachedApiKey || !cachedAi) {
    try {
      cachedAi = new import_genai.GoogleGenAI({
        apiKey: cleanKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
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
function getSmartFallbackResponse(query, context, reason) {
  const q = (query || "").toLowerCase();
  const stats = context?.stats || {
    totalIncome: 0,
    totalExpense: 0,
    netIncome: 0,
    totalDebt: 0,
    remaining: 0,
    thisMonthTotalBorc: 0,
    thisMonthKalanBorc: 0,
    thisMonthPaidBorc: 0
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
    { id: 1, name: "Kira", color: "#3b82f6", icon: "\u{1F3E0}" },
    { id: 2, name: "Market", color: "#10b981", icon: "\u{1F6D2}" },
    { id: 3, name: "Ula\u015F\u0131m", color: "#f59e0b", icon: "\u{1F697}" },
    { id: 4, name: "Yeme \u0130\xE7me", color: "#ec4899", icon: "\u{1F354}" },
    { id: 5, name: "Faturalar", color: "#ef4444", icon: "\u26A1" }
  ];
  const TURKISH_MONTHS = [
    "Ocak",
    "\u015Eubat",
    "Mart",
    "Nisan",
    "May\u0131s",
    "Haziran",
    "Temmuz",
    "A\u011Fustos",
    "Eyl\xFCl",
    "Ekim",
    "Kas\u0131m",
    "Aral\u0131k"
  ];
  const mNum = selectedMonth !== null && selectedMonth !== void 0 ? selectedMonth : (/* @__PURE__ */ new Date()).getMonth();
  const yNum = selectedYear !== null && selectedYear !== void 0 ? selectedYear : (/* @__PURE__ */ new Date()).getFullYear();
  const monthName = TURKISH_MONTHS[mNum] || "Mevcut Ay";
  const dRatio = stats.totalIncome > 0 ? stats.remaining / stats.totalIncome : 0;
  const dRatioPerc = dRatio * 100;
  const expensePercentage = stats.totalIncome > 0 ? stats.totalExpense / stats.totalIncome * 100 : 0;
  const savingsRate = stats.totalIncome > 0 ? stats.netIncome / stats.totalIncome * 100 : 0;
  const categoryKeywords = {
    "Kira": ["kira", "ev", "konut", "depo", "otel", "apart", "rezidans"],
    "Market": ["market", "g\u0131da", "gida", "yemek", "manav", "kasap", "mutfak", "bim", "migros", "carrefoursa", "\u015Fok", "sok", "al\u0131\u015Fveri\u015F", "alisveris", "groseri", "tekel"],
    "Ula\u015F\u0131m": ["ula\u015F\u0131m", "ulasim", "yol", "akaryak\u0131t", "akaryakit", "benzin", "otob\xFCs", "otobus", "metro", "taksi", "bilet", "yak\u0131t", "yakit", "otoyol", "k\xF6pr\xFC", "hgs", "egzoz", "sanayi", "araba"],
    "Faturalar": ["fatura", "elektrik", "su", "do\u011Falgaz", "dogalgaz", "gaz", "internet", "telefon", "aidat", "asans\xF6r", "asansor", "tv", "abonelik"],
    "E\u011Flence": ["e\u011Flence", "eglence", "sinema", "kafe", "oyun", "netflix", "konser", "bira", "bar", "restoran", "lokanta", "pub", "ps5", "alkol", "hediye", "hobi", "tatil", "gezi"],
    "Sa\u011Fl\u0131k": ["sa\u011Fl\u0131k", "saglik", "hastane", "ila\xE7", "ilac", "eczane", "doktor", "muayene", "di\u015F", "dis", "optik", "g\xF6zl\xFCk", "re\xE7ete", "recete"]
  };
  let matchedCategory = null;
  for (const [catName, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((k) => q.includes(k))) {
      matchedCategory = catName;
      break;
    }
  }
  let advice = `\u2728 **B\xFCt\xE7em Pro Geli\u015Fmi\u015F Finansal Analiz Raporu**

`;
  if (q.includes("ayl\u0131k analiz raporu") || q.includes("aylik analiz raporu") || q.includes("analiz raporu")) {
    const tIncome = stats.totalIncome;
    const tExpense = stats.totalExpense;
    const nIncome = stats.netIncome;
    const thisMonthDebtDue = stats.thisMonthKalanBorc || 0;
    const thisMonthDebtPaid = stats.thisMonthPaidBorc || 0;
    const thisMonthDebtTotal = stats.thisMonthTotalBorc || thisMonthDebtDue + thisMonthDebtPaid;
    const overallTotalLiabilities = stats.remaining || 0;
    const catTotals = {};
    expenses.forEach((e) => {
      catTotals[e.categoryId] = (catTotals[e.categoryId] || 0) + (Number(e.amount) || 0);
    });
    advice += `\u{1F4CA} **${monthName.toUpperCase()} ${yNum} - DETAYLI AYLIK ANAL\u0130Z RAPORU** \u{1F4CA}

`;
    advice += `Sistemimizdeki b\xFCt\xE7e ve gider kay\u0131tlar\u0131n\u0131z\u0131 bizzat tarayarak **${monthName} ${yNum}** d\xF6nemi gelir/gider ve bor\xE7 tablonuzu \xE7\u0131kard\u0131m:

`;
    const totalDebtsRem = debts.reduce((sum, d) => sum + Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0)), 0);
    const totalInstsRem = installmentDebts.reduce((sum, inst) => {
      const totalAmt = Number(inst.totalAmount) || 0;
      const count = Number(inst.installmentCount) || 1;
      const paidCount = Number(inst.paidInstallmentCount) || 0;
      const perInst = totalAmt / count;
      const remCount = Math.max(0, count - paidCount);
      return sum + remCount * perInst;
    }, 0);
    let contactPayablesRem = 0;
    let contactReceivablesRem = 0;
    contactTxs.forEach((tx) => {
      if (!tx.isPaid) {
        if (tx.type === "payable") contactPayablesRem += Number(tx.amount) || 0;
        else if (tx.type === "receivable") contactReceivablesRem += Number(tx.amount) || 0;
      }
    });
    advice += `### \u{1F4B5} Ayl\u0131k Mali Durum \xD6zeti (${monthName} ${yNum})
`;
    advice += `\u2022 **Toplam Ayl\u0131k Gelir**: \u20BA${tIncome.toLocaleString("tr-TR")}
`;
    advice += `\u2022 **Toplam Ayl\u0131k Gider**: \u20BA${tExpense.toLocaleString("tr-TR")}
`;
    advice += `\u2022 **Kalan Net Bakiye**: \u20BA${nIncome.toLocaleString("tr-TR")} (${nIncome >= 0 ? "\u{1F7E2} B\xFCt\xE7e Fazla Veriyor" : "\u{1F534} B\xFCt\xE7e A\xE7\u0131k Veriyor"})

`;
    advice += `### \u{1F4B8} Bu Ayki Bor\xE7 ve Y\xFCk\xFCml\xFCl\xFCk Durumu
`;
    advice += `\u2022 **Bu Ay Vadesi Gelen Kalan Bor\xE7**: \u20BA${Math.round(thisMonthDebtDue).toLocaleString("tr-TR")}
`;
    advice += `\u2022 **Bu Ay \xD6denen Bor\xE7 Tutar\u0131**: \u20BA${Math.round(thisMonthDebtPaid).toLocaleString("tr-TR")}
`;
    advice += `\u2022 **Bu Ayki Toplam Bor\xE7 Y\xFCk\xFC**: \u20BA${Math.round(thisMonthDebtTotal).toLocaleString("tr-TR")}
`;
    advice += `\u2022 **Genel Toplam Kalan Bor\xE7 Portf\xF6y\xFC (T\xFCm Vadeler)**: \u20BA${Math.round(overallTotalLiabilities).toLocaleString("tr-TR")}

`;
    advice += `### \u{1F4CB} Bor\xE7 Da\u011F\u0131l\u0131m\u0131 Detaylar\u0131
`;
    advice += `\u2022 **Nakit Bor\xE7lar (Kalan Toplam)**: \u20BA${Math.round(totalDebtsRem).toLocaleString("tr-TR")}
`;
    advice += `\u2022 **Taksitli Bor\xE7lar (Kalan Toplam)**: \u20BA${Math.round(totalInstsRem).toLocaleString("tr-TR")}
`;
    advice += `\u2022 **Ki\u015Fi Bor\xE7lar\u0131 (Verecek - Kalan)**: \u20BA${Math.round(contactPayablesRem).toLocaleString("tr-TR")}
`;
    advice += `\u2022 **Ki\u015Fi Alacaklar\u0131 (Alacak - Kalan)**: \u20BA${Math.round(contactReceivablesRem).toLocaleString("tr-TR")}

`;
    const activeDebtsMap = /* @__PURE__ */ new Map();
    let paidDebtsCount = 0;
    debts.forEach((d) => {
      const rem = Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0));
      if (rem <= 0) {
        paidDebtsCount++;
        return;
      }
      const key = (d.name || "").trim().toLowerCase();
      if (!activeDebtsMap.has(key)) {
        activeDebtsMap.set(key, { name: (d.name || "").trim(), category: d.category || "Genel", remaining: rem });
      } else {
        activeDebtsMap.get(key).remaining += rem;
      }
    });
    const sortedActiveDebts = Array.from(activeDebtsMap.values()).sort((a, b) => b.remaining - a.remaining);
    advice += `### \u{1F4B3} Aktif Kalan Standart Bor\xE7lar (T\xFCm Liste)
`;
    if (sortedActiveDebts.length > 0) {
      sortedActiveDebts.forEach((d, idx) => {
        advice += `\u2022 **${idx + 1}. ${d.name}** (${d.category}): Kalan \u20BA${Math.round(d.remaining).toLocaleString("tr-TR")}
`;
      });
    } else {
      advice += `\u2022 Tebrikler! Kay\u0131tl\u0131 a\xE7\u0131k standart borcunuz bulunmamaktad\u0131r.
`;
    }
    if (paidDebtsCount > 0) {
      advice += `\u2022 \u{1F7E2} **Kapat\u0131lan Bor\xE7lar**: ${paidDebtsCount} adet bor\xE7 tamamen \xF6dendi.
`;
    }
    advice += `
`;
    advice += `### \u{1F5D3}\uFE0F Aktif Taksitli Bor\xE7lar ve Ayl\u0131k \xD6deme Plan\u0131
`;
    const instList = [];
    let completedInstCount = 0;
    installmentDebts.forEach((inst) => {
      const totalAmt = Number(inst.totalAmount) || 0;
      const count = Number(inst.installmentCount) || 1;
      const paidCount = Number(inst.paidInstallmentCount) || 0;
      const perInst = totalAmt / count;
      const remCount = Math.max(0, count - paidCount);
      const remAmt = Math.max(0, totalAmt - paidCount * perInst);
      if (remCount <= 0 || remAmt <= 0) {
        completedInstCount++;
      } else {
        instList.push({
          name: inst.name || "Taksitli Bor\xE7",
          perInst,
          remCount,
          totalCount: count,
          remAmt
        });
      }
    });
    instList.sort((a, b) => b.remAmt - a.remAmt);
    if (instList.length > 0) {
      instList.forEach((inst, idx) => {
        advice += `\u2022 **${idx + 1}. ${inst.name}**: Ayl\u0131k \u20BA${Math.round(inst.perInst).toLocaleString("tr-TR")} | Kalan: ${inst.remCount}/${inst.totalCount} Taksit | Kalan Bor\xE7: \u20BA${Math.round(inst.remAmt).toLocaleString("tr-TR")}
`;
      });
    } else {
      advice += `\u2022 Kay\u0131tl\u0131 aktif taksitli borcunuz bulunmamaktad\u0131r.
`;
    }
    if (completedInstCount > 0) {
      advice += `\u2022 \u{1F7E2} **Tamamlanan Taksitler**: ${completedInstCount} adet taksitli bor\xE7 tamamen \xF6dendi.
`;
    }
    advice += `
`;
    if (expenses.length === 0) {
      advice += `\u2139\uFE0F **Harcama Bilgisi**: Bu ay i\xE7in hen\xFCz harcama kayd\u0131 girilmemi\u015F. Giderlerinizi girdik\xE7e kategori bazl\u0131 optimizasyon \xF6nerileriniz detaylanacakt\u0131r.

`;
    } else {
      advice += `### \u{1F4C9} Kategori Kar\u015F\u0131la\u015Ft\u0131rma Analizi
`;
      advice += `A\u015Fa\u011F\u0131daki tabloda bu ay\u0131n harcama kategorileri, tutarlar\u0131 ve toplam ayl\u0131k gider i\xE7indeki y\xFCzdesel a\u011F\u0131rl\u0131klar\u0131 g\xF6sterilmi\u015Ftir:

`;
      advice += `| Gider Kategorisi | Harcanan Tutar | Gider Oran\u0131 (%) | \xD6neri Seviyesi |
`;
      advice += `| :--- | :--- | :---: | :---: |
`;
      const sortedCats = categoriesList.map((c) => {
        const val = catTotals[c.id] || 0;
        return {
          name: c.name,
          value: val,
          pct: tExpense > 0 ? val / tExpense * 100 : 0
        };
      }).filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
      sortedCats.forEach((c) => {
        let recStatus = "\u{1F7E2} Stabil";
        if (c.pct > 30) recStatus = "\u{1F6A8} \xC7ok Y\xFCksek";
        else if (c.pct > 15) recStatus = "\u26A0\uFE0F Y\xFCksek";
        advice += `| **${c.name}** | \u20BA${c.value.toLocaleString("tr-TR")} | %${c.pct.toFixed(1)} | ${recStatus} |
`;
      });
      advice += `
`;
      if (sortedCats.length > 0) {
        const topCat = sortedCats[0];
        advice += `\u{1F4A1} **En Kritik Harcama Kalemi**: Bu ay b\xFCt\xE7enizi en \xE7ok zorlayan kategori **%${topCat.pct.toFixed(1)}** pay oran\u0131yla **"${topCat.name}"** olmu\u015Ftur (Tutar: \u20BA${topCat.value.toLocaleString("tr-TR")}).

`;
      }
      advice += `### \u{1F3AF} B\xFCt\xE7e Disiplini De\u011Ferlendirmesi (50/30/20 Kural\u0131)
`;
      const essentialPct = tIncome > 0 ? tExpense / tIncome * 100 : 0;
      advice += `\u2022 **Zorunlu ve Ki\u015Fisel Gider Oran\u0131**: Gelirinizin **%${essentialPct.toFixed(1)}** kadar\u0131 harcanm\u0131\u015F durumda.
`;
      if (essentialPct > 80) {
        advice += `\u2022 \u26A0\uFE0F **Durum Analizi**: Harcama oran\u0131n\u0131z b\xFCt\xE7e s\u0131n\u0131rlar\u0131n\u0131 \xE7ok a\u015F\u0131yor. Gelirin %80'inden fazlas\u0131n\u0131 harcamak, bor\xE7 kapatmay\u0131 ve birikim yapmay\u0131 neredeyse imkans\u0131z k\u0131lar. Acilen l\xFCks taksitleri durdurmal\u0131 ve abonelikleri iptal etmelisiniz.
`;
      } else if (essentialPct > 50) {
        advice += `\u2022 \u2696\uFE0F **Durum Analizi**: \u0130deal s\u0131n\u0131rland\u0131rmaya yak\u0131ns\u0131n\u0131z ancak hala bir miktar b\xFCt\xE7e s\u0131z\u0131nt\u0131s\u0131 var. Gider kalemlerinde yapaca\u011F\u0131n\u0131z %10'luk bir k\u0131s\u0131nt\u0131 tasarruf h\u0131z\u0131n\u0131z\u0131 ikiye katlayabilir.
`;
      } else {
        advice += `\u2022 \u{1F7E2} **Durum Analizi**: Tebrikler! Tasarruf limitleriniz olduk\xE7a g\xFCvenli b\xF6lgede. Finansal ba\u011F\u0131ms\u0131zl\u0131\u011F\u0131n\u0131za \xE7ok daha h\u0131zl\u0131 ula\u015Facaks\u0131n\u0131z.
`;
      }
      advice += `
### \u{1F4A1} Tasarruf ve Optimizasyon \xD6nerileri
`;
      sortedCats.slice(0, 3).forEach((c, idx) => {
        const possibleSaving = c.value * 0.15;
        advice += `${idx + 1}\uFE0F\u20E3 **${c.name} Tasarrufu**: %15 tasarruf ile bu kalemde yapaca\u011F\u0131n\u0131z k\xFC\xE7\xFCk fedakarl\u0131klar size ayda **\u20BA${possibleSaving.toFixed(0)}** ek bakiye kazand\u0131racakt\u0131r. `;
        if (c.name.toLowerCase().includes("market")) {
          advice += "Haftal\u0131k al\u0131\u015Fveri\u015F listesi yap\u0131n ve a\xE7 karn\u0131na asla al\u0131\u015Fveri\u015Fe \xE7\u0131kmay\u0131n. Markalar\u0131n kendi etiketli ekonomik \xFCr\xFCnlerini tercih edin.";
        } else if (c.name.toLowerCase().includes("fatura")) {
          advice += "Kullan\u0131lmayan cihazlar\u0131 prizden \xE7ekin, ak\u0131ll\u0131 termostat kullan\u0131n ve abonelik planlar\u0131n\u0131z\u0131 daha uygun tarifelere d\xFC\u015F\xFCr\xFCn.";
        } else if (c.name.toLowerCase().includes("yemek") || c.name.toLowerCase().includes("yeme")) {
          advice += "D\u0131\u015Far\u0131dan sipari\u015F verme oran\u0131n\u0131 azaltarak evde pratik yemekler haz\u0131rlay\u0131n. \u0130\u015F yerine kendi haz\u0131rlad\u0131\u011F\u0131n\u0131z sefertas\u0131n\u0131 g\xF6t\xFCr\xFCn.";
        } else if (c.name.toLowerCase().includes("ula\u015F\u0131m") || c.name.toLowerCase().includes("ulasim")) {
          advice += "K\u0131sa mesafelerde y\xFCr\xFCmeyi veya bisiklet kullanmay\u0131 tercih edin, toplu ta\u015F\u0131may\u0131 \xF6nceliklendirin ve ortak ara\xE7 kullan\u0131m\u0131n\u0131 de\u011Ferlendirin.";
        } else {
          advice += "Fayda-maliyet analizini iyi yap\u0131n, sat\u0131n almadan \xF6nce 48 saat bekleyin ve nakit \xF6demeleri tercih edin.";
        }
        advice += `
`;
      });
    }
  } else if (matchedCategory) {
    let totalCatSpent = 0;
    const catObj = categoriesList.find((c) => c.name.toLowerCase() === matchedCategory.toLowerCase());
    const catId = catObj ? catObj.id : null;
    const matchedExpenses = expenses.filter((e) => {
      const desc = (e.description || "").toLowerCase();
      const inDesc = desc.includes(matchedCategory.toLowerCase()) || categoryKeywords[matchedCategory].some((k) => desc.includes(k));
      const inCatId = catId ? e.categoryId === catId : false;
      return inDesc || inCatId;
    });
    totalCatSpent = matchedExpenses.reduce((sum, curr) => sum + curr.amount, 0);
    const catRatioOfExpense = stats.totalExpense > 0 ? totalCatSpent / stats.totalExpense * 100 : 0;
    const catRatioOfIncome = stats.totalIncome > 0 ? totalCatSpent / stats.totalIncome * 100 : 0;
    advice += `\u{1F50D} **Harcama Kalemi Derinlemesine \u0130ncelemesi: ${matchedCategory}**

`;
    advice += `B\xFCt\xE7e kay\u0131tlar\u0131n\u0131zda **${matchedCategory}** kategorisi veya a\xE7\u0131klamas\u0131na y\xF6nelik harcamalar\u0131n\u0131z\u0131 bizzat tarad\u0131m:

`;
    advice += `\u2022 **Kay\u0131tl\u0131 Harcama Say\u0131s\u0131**: ${matchedExpenses.length} adet i\u015Flem 
`;
    advice += `\u2022 **Sekt\xF6rel Toplam Gider**: \u20BA${totalCatSpent.toLocaleString("tr-TR")}
`;
    advice += `\u2022 **Harcama Y\xFCk\xFC (Gider Oran\u0131)**: Toplam giderlerinizin **%${catRatioOfExpense.toFixed(1)}** kadar\u0131n\u0131 olu\u015Fturuyor.
`;
    advice += `\u2022 **Gelir T\xFCketim Oran\u0131**: Ayl\u0131k toplam gelirinizin **%${catRatioOfIncome.toFixed(1)}** kadar\u0131n\u0131 s\xF6m\xFCr\xFCyor.

`;
    if (matchedExpenses.length > 0) {
      advice += `\u{1F4CA} **Son Harcama Detaylar\u0131**:
`;
      matchedExpenses.slice(0, 5).forEach((e) => {
        advice += `- \u20BA${e.amount.toLocaleString("tr-TR")} \u2794 *"${e.description || "A\xE7\u0131klama Belirtilmemi\u015F"}"* (${e.date ? e.date.split("T")[0] : "Tarih yok"})
`;
      });
      advice += `
`;
    }
    advice += `\u{1F4A1} **Asistan Tasarruf \xD6nerisi**:
`;
    if (totalCatSpent > stats.totalIncome * 0.15) {
      advice += `\u26A0\uFE0F **${matchedCategory}** harcamalar\u0131n\u0131z ayl\u0131k gelirinizin %15 s\u0131n\u0131r\u0131n\u0131 a\u015Fm\u0131\u015F durumda. Bu kalemde her ay ekstra **%20 tasarruf** yaparak ayda **\u20BA${(totalCatSpent * 0.2).toFixed(0)}** cebinizde tutabilir ve bu kayna\u011F\u0131 bor\xE7lar\u0131n\u0131z\u0131 eritmek i\xE7in kullanabilirsiniz! Harici abonelikleri veya l\xFCks liyakat harcamalar\u0131n\u0131 yeniden g\xF6zden ge\xE7irin.
`;
    } else {
      advice += `\u{1F7E2} Bu kategorideki harcamalar\u0131n\u0131z makul s\u0131n\u0131rda (%15 alt\u0131nda) seyrediyor. Mevcut tasarruflu b\xFCt\xE7e disiplininizi tebrik ederim! Yeni l\xFCks taksitler yaratmayarak bu istikrar\u0131 koruyun.
`;
    }
  } else if (q.includes("risk") || q.includes("analiz") || q.includes("durum") || q.includes("b\xFCt\xE7e") || q.includes("butce") || q.includes("genel") || q.includes("karne") || q.includes("sa\u011Fl\u0131k") || q.includes("saglik") || q.includes("rapor")) {
    advice += `\u{1F4CA} **Ki\u015Fiselle\u015Ftirilmi\u015F B\xFCt\xE7e Karnesi ve Risk Analizi**

`;
    advice += `Ayl\u0131k kay\u0131tl\u0131 hesap parametreleriniz \xFCzerinden ger\xE7ekle\u015Ftirdi\u011Fim finansal sa\u011Fl\u0131k taramas\u0131 \xE7\u0131kt\u0131s\u0131:

`;
    advice += `| Mali Metrik | De\u011Fer | B\xFCt\xE7e Oran Pay\u0131 | Durum |
`;
    advice += `| :--- | :--- | :--- | :---: |
`;
    advice += `| **Ayl\u0131k Gelir** | \u20BA${stats.totalIncome.toLocaleString("tr-TR")} | %100 | Nakit Giri\u015Fi |
`;
    advice += `| **Ayl\u0131k Gider** | \u20BA${stats.totalExpense.toLocaleString("tr-TR")} | %${expensePercentage.toFixed(1)} | Harcama Oran\u0131 |
`;
    advice += `| **Net Bakiye** | \u20BA${stats.netIncome.toLocaleString("tr-TR")} | %${savingsRate.toFixed(1)} | Ayl\u0131k Tasarruf |
`;
    advice += `| **Kalan Bor\xE7** | \u20BA${stats.remaining.toLocaleString("tr-TR")} | %${dRatioPerc.toFixed(0)} | Bor\xE7/Gelir Y\xFCk\xFC |

`;
    advice += `\u{1F6A8} **Cari Bor\xE7 Risk Seviyeniz**: `;
    if (dRatio > 5) {
      advice += `\u26A1 **KIRMIZI ALARM (Y\xDCKSEK MALI R\u0130SK)**
`;
      advice += `Mevcut toplam bor\xE7 y\xFCk\xFCn\xFCz, ayl\u0131k gelirinizin **${dRatio.toFixed(1)} kat\u0131**! Finansal g\xFCvenli\u011Finiz tehlikede. Harcamalar\u0131n\u0131z\u0131 acilen dondurmal\u0131, taksitli bor\xE7lanmay\u0131 durdurmal\u0131 ve t\xFCm b\xFCt\xE7e fazlas\u0131n\u0131 en k\xFC\xE7\xFCk borca kanalize etmelisiniz.

`;
    } else if (dRatio > 2.5) {
      advice += `\u2696\uFE0F **SARI ALARM (ORTA SEV\u0130YE R\u0130SK)**
`;
      advice += `Geri \xF6denmesi gereken bor\xE7 portf\xF6y\xFCn\xFCz ayl\u0131k gelirinizin **${dRatio.toFixed(1)} kat\u0131** d\xFCzeyinde. B\xFCt\xE7eniz kontrol edilebilir durumda ancak yeni taksitler eklemek sizi y\xFCksek risk s\u0131n\u0131r\u0131na itecektir. Kar topu stratejisiyle acilen bor\xE7 kapatmaya odaklan\u0131n.

`;
    } else {
      advice += `\u{1F7E2} **YE\u015E\u0130L B\xD6LGE (G\xDCVENL\u0130 VE RES\u0130L\u0130ENT)**
`;
      advice += `Toplam bor\xE7 y\xFCk\xFCn\xFCz ayl\u0131k gelirinizin **${dRatio.toFixed(1)} kat\u0131** seviyesinde ve olduk\xE7a g\xFCvenli s\u0131n\u0131rda. Mevcut b\xFCt\xE7e plan\u0131n\u0131z\u0131 koruyarak bor\xE7lar\u0131n\u0131z\u0131 takvimine g\xF6re s\u0131f\u0131rlayabilirsiniz.

`;
    }
    advice += `\u{1F4AA} **Mali G\xFC\xE7lenme Tavsiyeleriniz**:
`;
    if (savingsRate < 10) {
      advice += `- **Tasarruf S\u0131z\u0131nt\u0131s\u0131**: Ayl\u0131k tasarruf oran\u0131n\u0131z (%${savingsRate.toFixed(1)}) \xE7ok d\xFC\u015F\xFCk. Acil durum fonu olu\u015Fturmak i\xE7in ayl\u0131k gider b\xFCt\xE7enizden en az **%15 k\u0131s\u0131nt\u0131** planlamal\u0131y\u0131z.
`;
    } else {
      advice += `- **Y\xFCksek Likidite G\xFCc\xFC**: Ayl\u0131k tasarruf oran\u0131n\u0131z (%${savingsRate.toFixed(1)}) son derece g\xFC\xE7l\xFC. Biriktirdi\u011Finiz bu net bakiye fazlas\u0131n\u0131 bor\xE7 kapatma h\u0131zland\u0131r\u0131c\u0131s\u0131 olarak asgari \xF6demelerin \xFCzerine ekleyin.
`;
    }
    if (installmentDebts.length > 2) {
      advice += `- **Taksit Blokaj\u0131**: Devam eden **${installmentDebts.length} aktif taksitiniz** gelecekteki nakit ak\u0131\u015F\u0131n\u0131z\u0131 rehin tutuyor. Gelecek aylarda yeni taksitli i\u015Flem yapmayaca\u011F\u0131n\u0131za dair kendinize s\xF6z verin.
`;
    }
  } else if (q.includes("bor\xE7") || q.includes("borc") || q.includes("kapat") || q.includes("erit") || q.includes("strateji") || q.includes("kartopu") || q.includes("avalanche") || q.includes("\xE7\u0131\u011F") || q.includes("cig") || q.includes("\xF6de")) {
    advice += `\u{1F680} **Ak\u0131ll\u0131 Bor\xE7 S\u0131f\u0131rlama ve Yap\u0131land\u0131rma Stratejisi**

`;
    if (debts.length === 0) {
      advice += `\u015Eu anda sistemde kay\u0131tl\u0131 aktif nakit bor\xE7 kaleminiz bulunmuyor. Yeni bor\xE7lar ekleyerek asistan\u0131n ger\xE7ek-zamanl\u0131 kar topu sim\xFClasyonunu ba\u015Flatabilirsiniz!

`;
    } else {
      advice += `Mevcut **${debts.length} adet** bor\xE7 kaleminiz analiz edilerek bor\xE7suz bir ya\u015Fama en h\u0131zl\u0131 ula\u015Fman\u0131z\u0131 sa\u011Flayacak iki temel metodoloji sim\xFCle edilmi\u015Ftir:

`;
      const sortedSnowball = [...debts].sort((a, b) => a.amount - a.paid - (b.amount - b.paid));
      const sortedAvalanche = [...debts].sort((a, b) => b.amount - b.paid - (a.amount - a.paid));
      advice += `1\uFE0F\u20E3 **Kartopu (Snowball) Stratejisi (Psikolojik & En H\u0131zl\u0131 Sonu\xE7)**:
`;
      advice += `\u2022 Kalan net bakiyesi en d\xFC\u015F\xFCk olan borca agresif \xF6deme yap\u0131p onu yok edin, di\u011Ferlerine asgari yat\u0131r\u0131n. Bir borcun tamamen silindi\u011Fini g\xF6rmek sizi inan\u0131lmaz motive eder.
`;
      advice += `\u{1F449} **Kartopu \u0130lk Hedefiniz**: En az kalan bor\xE7 olan **"${sortedSnowball[0].name}"** borcunu kapatmaya odaklan\u0131n. Kalan \xD6denecek: **\u20BA${(sortedSnowball[0].amount - sortedSnowball[0].paid).toLocaleString("tr-TR")}**.

`;
      advice += `2\uFE0F\u20E3 **\xC7\u0131\u011F (Avalanche) Stratejisi (Matematiksel / En Ekonomik Yol)**:
`;
      advice += `\u2022 Tutar\u0131 veya maliyeti en y\xFCksek olan borca \xF6ncelik tan\u0131y\u0131n. B\xF6ylece toplamda katlanaca\u011F\u0131n\u0131z enflasyonist vade y\xFCk\xFCn\xFC ve faiz kayb\u0131n\u0131 minimuma indirirsiniz.
`;
      advice += `\u{1F449} **\xC7\u0131\u011F \u0130lk Hedefiniz**: En b\xFCy\xFCk kalan bor\xE7 olan **"${sortedAvalanche[0].name}"** borcuna odaklan\u0131n. Kalan \xD6denecek: **\u20BA${(sortedAvalanche[0].amount - sortedAvalanche[0].paid).toLocaleString("tr-TR")}**.

`;
      const monthlyReserve = stats.netIncome;
      advice += `\u23F1\uFE0F **Bor\xE7 Eritme Zaman Projeksiyonu**:
`;
      if (monthlyReserve > 100) {
        const monthsNeeded = stats.remaining / monthlyReserve;
        advice += `\u2022 Her ay biriktirdi\u011Finiz **\u20BA${monthlyReserve.toLocaleString("tr-TR")}** tasarruf fazlas\u0131n\u0131n tamam\u0131n\u0131 bor\xE7 kapatmaya y\xF6nlendirirseniz, teorik olarak **${monthsNeeded.toFixed(1)} ay sonra** tamamen bor\xE7suz ve \xF6zg\xFCr bir hayata kavu\u015Fabilirsiniz! \u{1F389}

`;
      } else {
        advice += `\u2022 \u26A0\uFE0F Ayl\u0131k kullan\u0131labilir tasarruf rezerviniz yetersiz (Negatif veya \xE7ok d\xFC\u015F\xFCk nakit ak\u0131\u015F\u0131). Bor\xE7lar\u0131n\u0131z\u0131 planl\u0131 s\xFCrede s\u0131f\u0131rlayabilmek i\xE7in ayl\u0131k harcamalar\u0131n\u0131z\u0131 k\u0131smal\u0131 veya acilen ek gelir yaratmal\u0131s\u0131n\u0131z. Giderleri azaltmadan bor\xE7lar\u0131n azalmas\u0131 matematiksel olarak imkans\u0131zd\u0131r.

`;
      }
    }
  } else if (q.includes("tasarruf") || q.includes("tasaruf") || q.includes("para biriktir") || q.includes("biriktir") || q.includes("tasarruf y\xF6ntemi") || q.includes("gider") || q.includes("harcama") || q.includes("bakiye") || q.includes("birikim")) {
    advice += `\u{1F3AF} **Profesyonel Tasarruf ve Birikim Rehberi**

`;
    advice += `Ayl\u0131k toplam kalibre edilmi\u015F geliriniz olan **\u20BA${stats.totalIncome.toLocaleString("tr-TR")}** temel al\u0131narak olu\u015Fturulan tasarruf matrisiniz a\u015Fa\u011F\u0131dad\u0131r:

`;
    const necessityLimit = stats.totalIncome * 0.5;
    const wantLimit = stats.totalIncome * 0.3;
    const savingTarget = stats.totalIncome * 0.2;
    advice += `\u{1F4A1} **\u0130deal 50/30/20 B\xFCt\xE7e B\xF6l\xFC\u015F\xFCm\xFC**:
`;
    advice += `- **Zorunlu Giderler (Ev, Fatura, G\u0131da - %50)**: Maksimum **\u20BA${necessityLimit.toLocaleString("tr-TR")}** ayr\u0131lmal\u0131. (Sizin Mevcut Gideriniz: \u20BA${stats.totalExpense.toLocaleString("tr-TR")})
`;
    advice += `- **Ki\u015Fisel \u0130stekler (Sosyal Ya\u015Fam - %30)**: Maksimum **\u20BA${wantLimit.toLocaleString("tr-TR")}** ayr\u0131lmal\u0131.
`;
    advice += `- **Bor\xE7 \xD6deme ve Birikim Fonu (%20)**: Ayl\u0131k asgari **\u20BA${savingTarget.toLocaleString("tr-TR")}** hedef koyulmal\u0131.

`;
    advice += `\u{1F31F} **Eyleme Ge\xE7ilebilir Tasarruf Re\xE7etesi**:
`;
    advice += `1. **Acil Durum Fonu (Emergency Fund)**: Olas\u0131 harika f\u0131rsatlar veya beklenmedik krizler i\xE7in asgari 3 ayl\u0131k ya\u015Famsal harcamalar\u0131n\u0131z\u0131 kapsayan (\xD6nerilen G\xFCvence Kayna\u011F\u0131: **\u20BA${(stats.totalExpense * 3).toLocaleString("tr-TR")}**) bir kenar ak\xE7esi biriktirmeye ba\u015Flay\u0131n.
`;
    if (expenses.length > 0) {
      advice += `2. **Gereksiz Abonelikler ve Harcama Optimizasyonu**: Sistemde kay\u0131tl\u0131 **${expenses.length} adet harcaman\u0131z\u0131** tek tek g\xF6zden ge\xE7irdim. K\xFC\xE7\xFCk ve tekrarlayan harcamalar\u0131 keserek ayda ortalama **\u20BA400** ila **\u20BA1.500** aras\u0131nda do\u011Frudan ek b\xFCt\xE7e yaratabilirsiniz.
`;
    } else {
      advice += `2. **Gider Kayd\u0131 Tutma**: \u015Eu an hi\xE7 anl\u0131k gider kalemi girmemi\u015Fsiniz. Harcamalar\u0131n\u0131z\u0131 disipline etmek ve nereye b\xFCt\xE7e s\u0131z\u0131nt\u0131s\u0131 oldu\u011Funu te\u015Fhis etmek i\xE7in 'Harcamalar' sekmesinden harcamalar\u0131n\u0131z\u0131 kaydetmeye ba\u015Flay\u0131n.
`;
    }
  } else if (q.includes("alt\u0131n") || q.includes("altin") || q.includes("dolar") || q.includes("usd") || q.includes("euro") || q.includes("eur") || q.includes("sterlin") || q.includes("gbp") || q.includes("kur") || q.includes("d\xF6viz") || q.includes("doviz") || q.includes("piyasa") || q.includes("ons") || q.includes("\xE7eyrek") || q.includes("ceyrek") || q.includes("gram") || q.includes("btc") || q.includes("bitcoin")) {
    const usd = context?.rates?.USD || 45.85;
    const eur = context?.rates?.EUR || 49.85;
    const gbp = context?.rates?.GBP || 58.2;
    const goldOns = context?.rates?.GOLD_ONS || 4474.2;
    const goldGram = context?.rates?.GOLD_GRAM || goldOns * usd / 31.10348;
    const goldCeyrek = context?.rates?.GOLD_CEYREK || goldGram * 1.635;
    const btcUsd = context?.rates?.BTC_USD || 81588;
    advice += `\u{1F4B1} **ANLIK CANLI P\u0130YASA & D\xD6V\u0130Z / ALTIN KURLARI RAPORU**

`;
    advice += `En entegre serbest piyasa ve uluslararas\u0131 finans borsalar\u0131 verilerine g\xF6re g\xFCncel kurlar:

`;
    advice += `| Varl\u0131k T\xFCr\xFC | Sembol | Anl\u0131k Fiyat (TL / USD) | De\u011Fi\u015Fim / Birim |
`;
    advice += `| :--- | :---: | :---: | :---: |
`;
    advice += `| **Amerikan Dolar\u0131** | \u{1F1FA}\u{1F1F8} USD | **\u20BA${usd.toFixed(2)}** | 1 Dolar |
`;
    advice += `| **Euro** | \u{1F1EA}\u{1F1FA} EUR | **\u20BA${eur.toFixed(2)}** | 1 Euro |
`;
    advice += `| **\u0130ngiliz Sterlini** | \u{1F1EC}\u{1F1E7} GBP | **\u20BA${gbp.toFixed(2)}** | 1 Sterlin |
`;
    advice += `| **Gram Alt\u0131n (24K)** | \u{1F947} Gram | **\u20BA${Math.round(goldGram).toLocaleString("tr-TR")} TL** | 1 Gram |
`;
    advice += `| **\xC7eyrek Alt\u0131n** | \u{1FA99} \xC7eyrek | **\u20BA${Math.round(goldCeyrek).toLocaleString("tr-TR")} TL** | 1 Adet |
`;
    advice += `| **Ons Alt\u0131n ($)** | \u{1FA99} Ons | **$${Math.round(goldOns).toLocaleString("en-US")} USD** | 1 Ons (31.1g) |
`;
    advice += `| **Bitcoin (BTC)** | \u20BF BTC | **$${Math.round(btcUsd).toLocaleString("en-US")} USD** | 1 BTC |

`;
    advice += `\u{1F4A1} **Finans Ko\xE7u Analizi & \xD6nerisi**:
`;
    advice += `\u2022 **B\xFCt\xE7e Korumas\u0131**: Enflasyonist ortamlarda nakitte kalan TL birikimleri de\u011Fer kaybeder. Gelirinizden ay\u0131rd\u0131\u011F\u0131n\u0131z tasarruf bakiyesini (**\u20BA${stats.netIncome.toLocaleString("tr-TR")}**) par\xE7al\u0131 olarak Gram Alt\u0131n veya d\xF6viz varl\u0131klar\u0131na y\xF6nlendirerek reel sat\u0131n alma g\xFCc\xFCn\xFCz\xFC koruyabilirsiniz.
`;
    advice += `\u2022 **D\xF6vizli Bor\xE7 Riski**: E\u011Fer d\xF6viz veya alt\u0131na endeksli borcunuz varsa, kurlardaki y\xFCkseli\u015F riskine kar\u015F\u0131 borcunuzu TL cinsinden sabitlemeyi veya erken kapatmay\u0131 \xF6nceliklendirin.
`;
    return advice;
  } else if (q.includes("merhaba") || q.includes("selam") || q.includes("hey") || q.includes("nas\u0131ls\u0131n") || q.includes("kimsin") || q.includes("yard\u0131m") || q.includes("help")) {
    advice += `\u{1F44B} **Merhaba! Ben B\xFCt\xE7em Pro Bireysel Finans Dan\u0131\u015Fman\u0131n\u0131z.**

`;
    advice += `Finansal hedeflerinize emin ad\u0131mlarla y\xFCr\xFCmeniz, t\xFCm bor\xE7lar\u0131n\u0131z\u0131 planl\u0131 \u015Fekilde s\u0131f\u0131rlaman\u0131z ve b\xFCt\xE7enizi en verimli \u015Fekilde y\xF6netebilmeniz i\xE7in bizzat buraday\u0131m.

`;
    advice += `A\u015Fa\u011F\u0131daki konular\u0131 b\xFCt\xE7e verilerinizle bizzat hesaplayabiliyorum. Bana diledi\u011Finizi yazabilirsiniz:
`;
    advice += `\u2022 \u{1F4CA} **Genel B\xFCt\xE7e Karnesi**: "Mevcut b\xFCt\xE7e durumum genel olarak nas\u0131l?"
`;
    advice += `\u2022 \u{1F680} **Bor\xE7 Eritme Stratejileri**: "Bor\xE7lar\u0131m\u0131 kartopu veya avalanche ile nas\u0131l eritirim?"
`;
    advice += `\u2022 \u{1F3AF} **Gider ve Tasarruf T\xFCyolar\u0131**: "Birikim yapmak i\xE7in hangi harcamalar\u0131m\u0131 k\u0131smal\u0131y\u0131m?"
`;
    advice += `\u2022 \u{1F50D} **Kategori Analizi**: "Market (veya faturalar) i\xE7in ne kadar harcama yapt\u0131m?"

`;
    advice += `Sorular\u0131n\u0131z\u0131 bekliyorum!`;
  } else {
    advice += `\u{1F44B} **B\xFCt\xE7em Pro Bireysel Finansal Tavsiye \xD6zet Raporu**

`;
    advice += `Yazd\u0131\u011F\u0131n\u0131z soruyu b\xFCt\xE7enizin genel matematiksel verileriyle ili\u015Fkilendirerek detayl\u0131 \u015Fekilde analiz ettim:

`;
    advice += `\u2022 **Ayl\u0131k Gelir Kayna\u011F\u0131n\u0131z**: \u20BA${stats.totalIncome.toLocaleString("tr-TR")}
`;
    advice += `\u2022 **Ayl\u0131k Gider Y\xFCk\xFCn\xFCz**: \u20BA${stats.totalExpense.toLocaleString("tr-TR")}
`;
    advice += `\u2022 **Kalan Serbest Net Rezerve**: \u20BA${stats.netIncome.toLocaleString("tr-TR")}
`;
    advice += `\u2022 **Geri \xD6denecek Kalan Toplam Bor\xE7**: \u20BA${stats.remaining.toLocaleString("tr-TR")} (\xD6denen: \u20BA${stats.totalPaid.toLocaleString("tr-TR")})

`;
    advice += `Bana bor\xE7 kapatma sim\xFClasyonlar\u0131 (*Kartopu/\xC7\u0131\u011F y\xF6ntemleri*), sekt\xF6rel harcama analizleri (*market, fatura, kira harcamalar\u0131*) veya tasarruf y\xF6ntemleri hakk\u0131nda sorular y\xF6neltebilirsiniz. B\xFCt\xE7e kalemlerinizi bizzat hesaplayarak size en rasyonel \xF6nerileri sunmaktan mutluluk duyar\u0131m!`;
  }
  advice += `

---
`;
  advice += `\u2699\uFE0F *Bilgi: Bu analiz \xE7evrimd\u0131\u015F\u0131 finans hesaplama motoru taraf\u0131ndan b\xFCt\xE7e verileriniz bizzat hesaplanarak \xFCretilmi\u015Ftir. \xC7evrimi\xE7i yapay zekay\u0131 (Gemini 3.5) aktifle\u015Ftirmek isterseniz, yan men\xFCdeki **Yapay Zek\xE2 Motor Ayarlar\u0131** alan\u0131ndan kendi Gemini API Anahtar\u0131n\u0131z\u0131 kolayca kaydedebilirsiniz.*`;
  return advice;
}
app.post("/api/chat", async (req, res) => {
  const { message, context, chatHistory, userApiKey } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Mesaj alan\u0131 bo\u015F b\u0131rak\u0131lamaz." });
  }
  const aiClient = getGeminiClient(userApiKey);
  if (!aiClient) {
    const advice = getSmartFallbackResponse(message, context, "\xC7evrimd\u0131\u015F\u0131 Mod");
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
    const thisMonthTotalBorc = stats?.thisMonthTotalBorc || thisMonthKalanBorc + thisMonthPaidBorc;
    const TURKISH_MONTHS = [
      "Ocak",
      "\u015Eubat",
      "Mart",
      "Nisan",
      "May\u0131s",
      "Haziran",
      "Temmuz",
      "A\u011Fustos",
      "Eyl\xFCl",
      "Ekim",
      "Kas\u0131m",
      "Aral\u0131k"
    ];
    const periodLabel = context?.selectedMonth !== void 0 && context?.selectedYear !== void 0 ? `${TURKISH_MONTHS[context.selectedMonth] || ""} ${context.selectedYear}` : "Mevcut Ay";
    const cRates = context?.rates || {};
    const usd = cRates.USD || 45.85;
    const eur = cRates.EUR || 49.85;
    const gbp = cRates.GBP || 58.2;
    const goldOns = cRates.GOLD_ONS || 4474.2;
    const goldGram = cRates.GOLD_GRAM || goldOns * usd / 31.10348;
    const goldCeyrek = cRates.GOLD_CEYREK || goldGram * 1.635;
    const btcUsd = cRates.BTC_USD || 81588;
    const debtsArr = Array.isArray(context?.debts) ? context.debts : [];
    const activeDebtsMap = /* @__PURE__ */ new Map();
    let totalPaidDebtsCount = 0;
    let totalPaidDebtsSum = 0;
    debtsArr.forEach((d) => {
      const rem = Math.max(0, (Number(d.amount) || 0) - (Number(d.paid) || 0));
      if (rem <= 0) {
        totalPaidDebtsCount++;
        totalPaidDebtsSum += Number(d.paid) || Number(d.amount) || 0;
        return;
      }
      const key = (d.name || "").trim().toLowerCase();
      if (!activeDebtsMap.has(key)) {
        activeDebtsMap.set(key, {
          name: (d.name || "").trim(),
          category: d.category || "Genel",
          remaining: Math.round(rem),
          totalAmount: Math.round(Number(d.amount) || 0),
          paid: Math.round(Number(d.paid) || 0)
        });
      } else {
        const item = activeDebtsMap.get(key);
        item.remaining += Math.round(rem);
        item.totalAmount += Math.round(Number(d.amount) || 0);
        item.paid += Math.round(Number(d.paid) || 0);
      }
    });
    const sanitizedActiveDebts = Array.from(activeDebtsMap.values()).sort((a, b) => b.remaining - a.remaining);
    const instsArr = Array.isArray(context?.installmentDebts) ? context.installmentDebts : [];
    const activeInstMap = /* @__PURE__ */ new Map();
    let totalPaidInstCount = 0;
    instsArr.forEach((inst) => {
      const total = Number(inst.totalAmount) || 0;
      const count = Number(inst.installmentCount) || 1;
      const paidCount = Number(inst.paidInstallmentCount) || 0;
      const remCount = Math.max(0, count - paidCount);
      const remAmount = Math.max(0, total - paidCount * (total / count));
      if (remCount <= 0 || remAmount <= 0) {
        totalPaidInstCount++;
        return;
      }
      const key = (inst.name || "").trim().toLowerCase();
      if (!activeInstMap.has(key)) {
        activeInstMap.set(key, {
          name: (inst.name || "").trim(),
          remainingAmount: Math.round(remAmount),
          remainingMonths: remCount,
          monthlyInstallment: Math.round(total / count)
        });
      } else {
        const item = activeInstMap.get(key);
        item.remainingAmount += Math.round(remAmount);
        item.remainingMonths = Math.max(item.remainingMonths, remCount);
      }
    });
    const sanitizedActiveInsts = Array.from(activeInstMap.values()).sort((a, b) => b.remainingAmount - a.remainingAmount);
    const systemPrompt = `Sen "B\xFCt\xE7em Pro" bireysel finans y\xF6netim ve bor\xE7 takip uygulamas\u0131n\u0131n en g\xFCncel "Gemini 3.7 Flash" yapay zeka finans ko\xE7u ve uzman analistisin. T\xFCrk\xE7e konu\u015Facaks\u0131n.
Kullan\u0131c\u0131n\u0131n ${periodLabel} d\xF6nemi g\xFCncel b\xFCt\xE7e durumu ve mali parametreleri \u015Funlard\u0131r:
- Se\xE7ili D\xF6nem: ${periodLabel}
- Toplam Ayl\u0131k Gelir: \u20BA${totalIncome}
- Toplam Ayl\u0131k Gider: \u20BA${totalExpense}
- Kalan Net Gelir (Bakiye): \u20BA${netIncome}
- Bu Ay Vadesi Gelen Kalan Bor\xE7: \u20BA${thisMonthKalanBorc}
- Bu Ay \xD6denen Bor\xE7: \u20BA${thisMonthPaidBorc}
- Bu Ayki Toplam Bor\xE7 Y\xFCk\xFC: \u20BA${thisMonthTotalBorc}
- Genel Toplam Kalan Bor\xE7 Portf\xF6y\xFC (T\xFCm Vadeler): \u20BA${remaining}
- Toplam Bor\xE7 Kayd\u0131: \u20BA${totalDebt}
- Toplam \xD6denen Bor\xE7: \u20BA${totalPaid}
- Tekille\u015Ftirilmi\u015F Aktif Standart Bor\xE7lar (Yaln\u0131zca \xD6denmesi Gerekenler): ${JSON.stringify(sanitizedActiveDebts)}
- Tamamen \xD6denmi\u015F/S\u0131f\u0131rlanm\u0131\u015F Standart Bor\xE7: ${totalPaidDebtsCount} adet (Toplam Kapat\u0131lan: \u20BA${Math.round(totalPaidDebtsSum)})
- Tekille\u015Ftirilmi\u015F Aktif Taksitli Bor\xE7lar: ${JSON.stringify(sanitizedActiveInsts)}
- Giderler Listesi Detay\u0131: ${JSON.stringify(context?.expenses || [])}
- Rehber Ki\u015Fi Bor\xE7lar\u0131 ve Alacaklar\u0131: ${JSON.stringify(context?.contactTransactions || [])}
- Rehber Ki\u015Fileri Listesi: ${JSON.stringify(context?.contacts || [])}

ANLIK ANLIK G\xDCNCEL P\u0130YASA, D\xD6V\u0130Z VE ALTIN KURLARI (G\xDCNCEL CANLI VER\u0130LER):
\u2022 Amerikan Dolar\u0131 (USD): \u20BA${usd.toFixed(2)}
\u2022 Euro (EUR): \u20BA${eur.toFixed(2)}
\u2022 \u0130ngiliz Sterlini (GBP): \u20BA${gbp.toFixed(2)}
\u2022 Gram Alt\u0131n (24 Ayar): \u20BA${Math.round(goldGram).toLocaleString("tr-TR")} TL
\u2022 \xC7eyrek Alt\u0131n: \u20BA${Math.round(goldCeyrek).toLocaleString("tr-TR")} TL
\u2022 Ons Alt\u0131n ($): $${Math.round(goldOns).toLocaleString("en-US")} USD
\u2022 Bitcoin (BTC): $${Math.round(btcUsd).toLocaleString("en-US")} USD

\xD6NEML\u0130 KURAL: Kullan\u0131c\u0131n\u0131n toplam ayl\u0131k gelirini (\u20BA${totalIncome}) ve toplam ayl\u0131k giderini (\u20BA${totalExpense}) do\u011Frudan yukar\u0131daki resmi istatistiklerden al ve asla 0 TL olarak varsayma. Dolar, Euro, Alt\u0131n (Gram/\xC7eyrek/Ons) veya piyasalar soruldu\u011Funda do\u011Frudan yukar\u0131daki g\xFCncel canl\u0131 fiyatlar\u0131 ve TL tutarlar\u0131n\u0131 aktar.

G\xF6revlerin ve Davran\u0131\u015F Kurallar\u0131n:
1. Gelir/gider dengesini ve kalan bor\xE7 durumunu analiz et, kullan\u0131c\u0131n\u0131n risk seviyesini (Y\xFCksek Risk, Orta Seviye, G\xFCvenli) belirle ve rasyonel yorumlar yap.
2. Tasarruf y\xF6ntemleri, bor\xE7 kapatma stratejileri (Kartopu / \xC7\u0131\u011F y\xF6ntemleri vb.) hakk\u0131nda son derece a\xE7\u0131klay\u0131c\u0131, somut, ad\u0131m ad\u0131m finansal \xF6neriler sun.
3. Kullan\u0131c\u0131n\u0131n sordu\u011Fu sorular\u0131 bu finansal verileri g\xF6z ard\u0131 etmeden detayl\u0131 ve cesaretlendirici bir dille cevapla.
4. MOB\u0130L VE D\xDCZENL\u0130 G\xD6R\xDCN\xDCM KURALI: Mobil ekranlarda yaz\u0131lar\u0131n alt alta ve son derece belirgin, ferah ve tertipli okunmas\u0131 i\xE7in:
   - Yan\u0131tlar\u0131n\u0131 net alt ba\u015Fl\u0131klara ay\u0131r (### veya \u{1F4CA}, \u{1F680}, \u{1F4A1}, \u{1F3AF}, \u{1F4B0} gibi emojilerle).
   - Maddeleri alt alta a\xE7\u0131k\xE7a s\u0131rala (\u2022 veya - kullanarak).
   - Numaral\u0131 ad\u0131mlar\u0131 (1., 2., 3.) tek tek ayr\u0131 sat\u0131rlarda yaz.
   - \xD6nemli tutarlar\u0131 ve tavsiyeleri **kal\u0131n** vurgula.
   - Uzun ve karma\u015F\u0131k tek par\xE7a blok metinlerden ka\xE7\u0131n, her b\xF6l\xFCm aras\u0131na bir bo\u015F sat\u0131r b\u0131rak.
5. \xC7EVR\u0130M\u0130\xC7\u0130 (ONLINE) SORGULAR VE G\xDCNCEL B\u0130LG\u0130LER: Kullan\u0131c\u0131 d\xF6viz kurlar\u0131n\u0131, g\xFCncel alt\u0131n fiyatlar\u0131n\u0131, enflasyon veya di\u011Fer detaylar\u0131 sordu\u011Funda yukar\u0131daki anl\u0131k canl\u0131 piyasa verilerini ve entegre Google Arama (googleSearch) arac\u0131n\u0131 kullan. Kullan\u0131c\u0131ya "Bilmiyorum" demek yerine kesin ve \u015Feffaf yan\u0131t ver.
6. Tamamen profesyonel, yap\u0131c\u0131 ve s\u0131cakkanl\u0131 bir finans ko\xE7u gibi davran.
7. BOR\xC7 VE TAKS\u0130T L\u0130STELEME KURALLARI:
   - Kullan\u0131c\u0131 ayl\u0131k finans/analiz raporu istedi\u011Finde veya bor\xE7lar\u0131n\u0131 sordu\u011Funda; hem aktif standart bor\xE7lar\u0131 hem de aktif taksitli bor\xE7lar\u0131 (kalan taksit adedi, ayl\u0131k taksit tutar\u0131 ve toplam kalan borcuyla) EKS\u0130KS\u0130Z \u015Fekilde TEK TEK s\u0131rala.
   - ASLA bor\xE7lar\u0131 'Di\u011Fer bor\xE7lar' veya 've benzeri' ad\u0131 alt\u0131nda gizleme veya topluca \xF6zetleme! Her bir bor\xE7 ve taksit kalemini tek tek a\xE7\u0131k d\xF6k\xFCm olarak listele.
   - Raporda mutlaka '### \u{1F4B3} Aktif Standart Bor\xE7lar' ve '### \u{1F5D3}\uFE0F Aktif Taksitli Bor\xE7lar ve Ayl\u0131k \xD6deme Plan\u0131' alt ba\u015Fl\u0131klar\u0131n\u0131 kullan.
   - Ayn\u0131 bor\xE7 ad\u0131n\u0131 ASLA 2 veya 3 defa tekrar yazma (tekille\u015Ftirilmi\u015F listeyi baz al).
   - Tamamen \xF6denmi\u015F (0 TL kalan) bor\xE7lar\u0131 tek bir sat\u0131rda '\u{1F7E2} Tamamen Kapat\u0131lan: X adet bor\xE7' \u015Feklinde \xF6zetle. Bor\xE7lar\u0131 kalan tutarlar\u0131na g\xF6re b\xFCy\xFCkten k\xFC\xE7\xFC\u011Fe s\u0131ral\u0131 ve temiz maddeler halinde listele.`;
    const rawTurns = [];
    if (chatHistory && Array.isArray(chatHistory)) {
      for (const turn of chatHistory) {
        const textStr = turn.text || "";
        if (textStr.includes("Yapay Zeka Servisi Bilgilendirmesi") || textStr.includes("Yapay Zeka Servis Bildirimi") || textStr.includes("\xE7evrimd\u0131\u015F\u0131") || textStr.includes("ba\u011Flant\u0131 kurulamad\u0131") || textStr.includes("zaman a\u015F\u0131m\u0131na") || textStr.includes("ge\xE7ici bir") || textStr.includes("API anahtar\u0131n\u0131n")) {
          continue;
        }
        rawTurns.push({
          role: turn.sender === "user" ? "user" : "model",
          text: textStr
        });
      }
    }
    rawTurns.push({
      role: "user",
      text: message
    });
    const contents = [];
    for (const turn of rawTurns) {
      if (contents.length === 0) {
        if (turn.role === "user") {
          contents.push({
            role: "user",
            parts: [{ text: turn.text }]
          });
        }
      } else {
        const lastTurn = contents[contents.length - 1];
        if (lastTurn.role === turn.role) {
          lastTurn.parts[0].text += "\n" + turn.text;
        } else {
          contents.push({
            role: turn.role,
            parts: [{ text: turn.text }]
          });
        }
      }
    }
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout after 20000ms: Gemini API calls took too long, switching temporarily to offline analysis.")), 2e4);
    });
    const geminiPromise = aiClient.models.generateContent({
      model: "gemini-3.7-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        tools: [{ googleSearch: {} }]
      }
    });
    const response = await Promise.race([geminiPromise, timeoutPromise]);
    res.json({ reply: response.text });
  } catch (error) {
    const errMsg = error?.message || error?.toString() || "";
    const isKeyError = errMsg.toLowerCase().includes("expired") || errMsg.toLowerCase().includes("key") || errMsg.toLowerCase().includes("credential") || errMsg.toLowerCase().includes("invalid_argument") || errMsg.toLowerCase().includes("unauthorized") || errMsg.toLowerCase().includes("api_key_invalid") || errMsg.toLowerCase().includes("forbidden") || errMsg.toLowerCase().includes("denied") || errMsg.toLowerCase().includes("403");
    const isTimeout = errMsg.toLowerCase().includes("timeout") || errMsg.toLowerCase().includes("deadline") || errMsg.toLowerCase().includes("duration");
    const reason = isKeyError ? "API Anahtar\u0131 / Yetkilendirme Hatas\u0131 (403)" : isTimeout ? "Yapay Zeka Ba\u011Flant\u0131 Zaman A\u015F\u0131m\u0131" : "A\u011F K\u0131s\u0131tlamas\u0131";
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
    const advice = getSmartFallbackResponse(message, context, reason);
    return res.json({ reply: advice });
  }
});
function convertTurkishWordsToNumbersServer(text) {
  let result = text;
  const explicitPhrases = [
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
function cleanTurkishPersonNameServer(rawName) {
  let name = rawName.trim();
  if (name.includes("'") || name.includes("\u2019")) {
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
function parseVoiceCommandOffline(rawText) {
  const text = convertTurkishWordsToNumbersServer(rawText);
  const norm = text.toLowerCase().trim();
  const cleanNorm = norm.replace(/['"’\.]/g, "").replace(/lira/gi, "tl").replace(/türk lirası/gi, "tl");
  if (cleanNorm.includes("sil") || cleanNorm.includes("\xE7\u0131kar") || cleanNorm.includes("cikar") || cleanNorm.includes("kald\u0131r") || cleanNorm.includes("kaldir")) {
    if (cleanNorm.includes("gelir")) {
      const name = text.replace(/(gelir|sil|çıkar|cikar|kaldır|kaldir|ekle|kaydet|tl|türk lirası|lira|₺)/gi, "").trim();
      return {
        action: "deleteIncome",
        deleteIncomeData: { name },
        explanation: `\u{1F50A} "${name || "Gelir"}" isimli gelir kayd\u0131n\u0131z\u0131n silinmesini talep ettiniz. \u0130\u015Flem ger\xE7ekle\u015Ftiriliyor.`
      };
    } else if (cleanNorm.includes("bor\xE7") || cleanNorm.includes("borc")) {
      const name = text.replace(/(borç|borc|sil|çıkar|cikar|kaldır|kaldir|ekle|kaydet|tl|türk lirası|lira|₺)/gi, "").trim();
      return {
        action: "deleteDebt",
        deleteDebtData: { name },
        explanation: `\u{1F50A} "${name || "Bor\xE7"}" isimli bor\xE7 kayd\u0131n\u0131z\u0131n silinmesini talep ettiniz. \u0130\u015Flem ger\xE7ekle\u015Ftiriliyor.`
      };
    } else {
      const desc2 = text.replace(/(harcama|gider|sil|çıkar|cikar|kaldır|kaldir|ekle|kaydet|tl|türk lirası|lira|₺)/gi, "").trim();
      return {
        action: "deleteExpense",
        deleteExpenseData: { description: desc2 },
        explanation: `\u{1F50A} "${desc2 || "Harcama"}" isimli harcama kayd\u0131n\u0131z\u0131n silinmesini talep ettiniz. \u0130\u015Flem ger\xE7ekle\u015Ftiriliyor.`
      };
    }
  }
  const numMatches = [...cleanNorm.matchAll(/(\d+[\d\s,.]*)/g)];
  if (numMatches.length === 0) {
    return {
      action: "unknown",
      explanation: `\u{1F914} S\xF6yledi\u011Finiz ifadede herhangi bir tutar/say\u0131 alg\u0131layamad\u0131m: "${text}". L\xFCtfen: "Market 150 lira" veya "Ahmet bor\xE7 2000 TL" gibi bir tutar belirterek s\xF6yleyin.`
    };
  }
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
      explanation: `\u{1F914} S\xF6yledi\u011Finiz ifadedeki tutar ge\xE7ersiz: "${text}". L\xFCtfen ge\xE7erli bir miktar belirtin.`
    };
  }
  if (cleanNorm.includes("taksit")) {
    let installmentCount = 12;
    if (numMatches.length >= 2) {
      const parsedCount = parseInt(numMatches[1][1].replace(/\s/g, ""));
      if (!isNaN(parsedCount) && parsedCount > 0) {
        installmentCount = parsedCount;
      }
    }
    let name = "Taksit Plan\u0131";
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
        firstDueDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
      },
      explanation: `\u{1F50A} \xC7evrimd\u0131\u015F\u0131 Mod: ${installmentCount} Ay taksitli "${name}" (Toplam: \u20BA${amount}) plan\u0131n\u0131z ba\u015Far\u0131yla tan\u0131mland\u0131.`
    };
  }
  if (cleanNorm.includes("gelir") || cleanNorm.includes("maa\u015F") || cleanNorm.includes("maas") || cleanNorm.includes("kazand\u0131m") || cleanNorm.includes("kazandim") || cleanNorm.includes("yatt\u0131") || cleanNorm.includes("yatti") || cleanNorm.includes("yatta") || cleanNorm.includes("alacak")) {
    let name = "Sesli Gelir";
    const cleanedName = text.replace(/\d+/g, "").replace(/(gelir|maaş|maas|tl|türk lirası|lira|₺|ekle|kaydet|aldım|aldim|kazandım|kazandim|yattı|yatti|yatta|için|icin|alacak)/gi, "").trim();
    if (cleanedName.length > 2) {
      name = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
    }
    return {
      action: "addIncome",
      incomeData: { name, amount, date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) },
      explanation: `\u{1F50A} \xC7evrimd\u0131\u015F\u0131 Mod: "${name}" b\xFCt\xE7enize \u20BA${amount} tutar\u0131nda gelir olarak eklenmi\u015Ftir.`
    };
  }
  if ((cleanNorm.includes("bor\xE7") || cleanNorm.includes("borc")) && (cleanNorm.includes("\xF6denen") || cleanNorm.includes("yap") || cleanNorm.includes("g\xFCncelle") || cleanNorm.includes("guncelle") || cleanNorm.includes("\xF6de") || cleanNorm.includes("ode") || cleanNorm.includes("tutar") || cleanNorm.includes("miktar"))) {
    const isAbsolute = cleanNorm.includes("yap") || cleanNorm.includes("olsun") || cleanNorm.includes("e\u015Fitle") || cleanNorm.includes("esitle");
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
        explanation: `\u{1F50A} \xC7evrimd\u0131\u015F\u0131 Mod: "${debtName}" borcunun \xF6denen k\u0131sm\u0131 \u20BA${amount} olarak ${isAbsolute ? "g\xFCncellenecektir." : "art\u0131r\u0131lacakt\u0131r."}`
      };
    }
  }
  if (cleanNorm.includes("bor\xE7") || cleanNorm.includes("borc") || cleanNorm.includes("bor\xE7land\u0131m") || cleanNorm.includes("borclandim") || cleanNorm.includes("bor\xE7land\u0131k") || cleanNorm.includes("borclandik") || cleanNorm.includes("verecek") || cleanNorm.includes("alacak") || cleanNorm.includes("borcum")) {
    let name = "Sesli Bor\xE7";
    const cleanedName = text.replace(/\d+/g, "").replace(/(borç|borc|tl|türk lirası|lira|₺|ekle|kaydet|borçlandım|borclandim|borçlandık|borclandik|için|icin|verecek|alacak|verdim|aldım|borcum)/gi, "").trim();
    if (cleanedName.length > 2) {
      name = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
    }
    const rawBaseName = name.split(/['"’\s-]/)[0].replace(/[0-9]/g, "");
    const baseName = cleanTurkishPersonNameServer(rawBaseName);
    const isPerson = cleanNorm.includes("verdim") || cleanNorm.includes("ald\u0131m") || cleanNorm.includes("alaca\u011F\u0131m") || cleanNorm.includes("alacagim") || cleanNorm.includes("borcum") || cleanNorm.includes("verece\u011Fim") || cleanNorm.includes("verecegim") || cleanedName.length < 25 && !cleanNorm.includes("banka") && !cleanNorm.includes("kart") && !cleanNorm.includes("kredi");
    if (isPerson && baseName.length > 1) {
      const isReceivable = cleanNorm.includes("verdim") || cleanNorm.includes("alacak") || cleanNorm.includes("alaca\u011F\u0131m") || cleanNorm.includes("alacagim") || cleanNorm.includes("bana bor\xE7") || cleanNorm.includes("bana borc");
      const pType = isReceivable ? "receivable" : "payable";
      return {
        action: "addContactDebt",
        contactDebtData: {
          contactName: baseName,
          amount,
          type: pType,
          description: "Sesli kay\u0131t ile otomatik olu\u015Fturuldu"
        },
        explanation: `\u{1F50A} \xC7evrimd\u0131\u015F\u0131 Mod: Ki\u015Fi rehberinizdeki "${baseName}" isimli ki\u015Fiye \u20BA${amount} tutar\u0131nda ${pType === "receivable" ? "alacak" : "verecek/bor\xE7"} kayd\u0131 ba\u015Far\u0131yla eklenmi\u015Ftir.`
      };
    }
    let debtCategory = "\u015Eah\u0131s";
    if (cleanNorm.includes("banka") || cleanNorm.includes("kredi")) debtCategory = "Banka";
    else if (cleanNorm.includes("kart")) debtCategory = "Kredi Kart\u0131";
    else if (cleanNorm.includes("fatura")) debtCategory = "Fatura";
    else if (cleanNorm.includes("aidat")) debtCategory = "Aidat";
    return {
      action: "addDebt",
      debtData: {
        name,
        amount,
        paid: 0,
        category: debtCategory,
        dueDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
      },
      explanation: `\u{1F50A} \xC7evrimd\u0131\u015F\u0131 Mod: "${name}" olarak \u20BA${amount} de\u011Ferinde yeni bir bor\xE7 eklenmi\u015Ftir.`
    };
  }
  let categoryId = 1;
  let desc = "Gider Kayd\u0131";
  if (cleanNorm.includes("market") || cleanNorm.includes("g\u0131da") || cleanNorm.includes("gida") || cleanNorm.includes("manav") || cleanNorm.includes("s\xFCpermarket") || cleanNorm.includes("supermarket")) {
    categoryId = 2;
    desc = "Market Gideri";
  } else if (cleanNorm.includes("ula\u015F\u0131m") || cleanNorm.includes("ulasim") || cleanNorm.includes("yol") || cleanNorm.includes("taksi") || cleanNorm.includes("yak\u0131t") || cleanNorm.includes("benzin") || cleanNorm.includes("otob\xFCs") || cleanNorm.includes("bilet")) {
    categoryId = 3;
    desc = "Ula\u015F\u0131m Gideri";
  } else if (cleanNorm.includes("yemek") || cleanNorm.includes("kafe") || cleanNorm.includes("cafe") || cleanNorm.includes("lokanta") || cleanNorm.includes("restoran") || cleanNorm.includes("d\xF6ner") || cleanNorm.includes("pizz")) {
    categoryId = 4;
    desc = "Yemek Gideri";
  } else if (cleanNorm.includes("fatura") || cleanNorm.includes("elektrik") || cleanNorm.includes("su") || cleanNorm.includes("gaz") || cleanNorm.includes("telefon") || cleanNorm.includes("internet") || cleanNorm.includes("aidat")) {
    categoryId = 5;
    desc = "Fatura \xD6demesi";
  }
  const cleanedDesc = text.replace(/\d+/g, "").replace(/(gider|harcama|tl|türk lirası|lira|₺|ekle|kaydet|için|icin|satın|aldım|aldim|fatura|ödedim|odedim|ödeme|odeme)/gi, "").trim();
  if (cleanedDesc.length > 2) {
    desc = cleanedDesc.charAt(0).toUpperCase() + cleanedDesc.slice(1);
  }
  return {
    action: "addExpense",
    expenseData: { amount, description: desc, categoryId },
    explanation: `\u{1F50A} \xC7evrimd\u0131\u015F\u0131 Mod: "${desc}" b\xFCt\xE7enize \u20BA${amount} tutar\u0131nda harcama olarak eklenmi\u015Ftir.`
  };
}
app.post("/api/voice-command", async (req, res) => {
  const { text, userApiKey } = req.body;
  if (!text || text.trim() === "") {
    return res.status(400).json({ error: "Bo\u015F komut alg\u0131land\u0131." });
  }
  const aiClient = getGeminiClient(userApiKey);
  if (!aiClient) {
    console.log("[Voice Command API] Gemini API key not set or inactive. Falling back to offline fallback parser.");
    const offlineResult = parseVoiceCommandOffline(text);
    return res.json(offlineResult);
  }
  try {
    const promptText = "Sen 'B\xFCt\xE7em Pro' finans asistan\u0131s\u0131n. Kullan\u0131c\u0131n\u0131n t\xFCrk\xE7e sesli b\xFCt\xE7e kayd\u0131 / komutunu analiz edip bunu yap\u0131land\u0131r\u0131lm\u0131\u015F JSON verisine d\xF6n\xFC\u015Ft\xFCreceksin.\n\nKullan\u0131c\u0131 \u015Funlar\u0131 yapabilir:\n1. Bor\xE7 ekleme (addDebt): Belirli bir \u015Fahs\u0131 belirtmeyen genel bor\xE7lar. \xD6rn: 'Birim borcu 2000 TL', 'Banka kredisi borcu 100000 TL', vb. (E\u011Fer sesli komutta belirli ve \xF6zel bir ki\u015Fi ismi ge\xE7iyorsa, bu eylem yerine mutlaka addContactDebt eylemini kullan!)\n2. Ki\u015Fi alacak verecek ekleme (addContactDebt): Sesli komutta belirli bir \u015Fah\u0131s/ki\u015Fi ismi ge\xE7iyorsa (\xF6rn: 'Ahmet'e 5000 lira bor\xE7 verdim', 'Mehmet'ten 3000 lira bor\xE7 ald\u0131m', 'Zeynep'ten 1000 TL alaca\u011F\u0131m var', 'Ay\u015Fe'ye 200 TL borcum var'). Bu durumda contactName (\xD6rn: 'Ahmet', 'Mehmet', 'Zeynep', 'Ay\u015Fe'), amount (Tutar), type ('receivable' veya 'payable') ve description alanlar\u0131n\u0131 doldur.\n   - 'receivable' (Alacak): Biz ona bor\xE7 verdiysek ya da ondan bir alaca\u011F\u0131m\u0131z varsa. (\xD6rn: 'bor\xE7 verdim', 'alaca\u011F\u0131m var', 'bana bor\xE7lu')\n   - 'payable' (Verecek): Ondan bor\xE7 ald\u0131ysak ya da ona bir borcumuz varsa. (\xD6rn: 'bor\xE7 ald\u0131m', 'borcum var', 'ona verece\u011Fim var')\n3. Taksit/Taksitli bor\xE7 ekleme (addInstallment): 'Koltuk tak\u0131m\u0131 12000 lira 6 taksit', 'Telefon i\xE7in 24000 TL 12 taksit', vb.\n4. Harcama/Gider ekleme (addExpense): 'Market harcamas\u0131 250 lira', 'Benzin ald\u0131m 800 TL', 'Yemek 350 lira', vb.\n5. Gelir ekleme (addIncome): 'Maa\u015F yatt\u0131 35000 lira', 'Kira geliri ald\u0131m 15000 TL', vb.\n6. Bor\xE7 g\xFCncelleme / \xD6denen k\u0131sm\u0131 g\xFCncelleme (updateDebtPaid): 'Ahmet borcunun \xF6denen k\u0131sm\u0131n\u0131 500 TL yap', 'Banka kredisi borcunun \xF6denenini 1000 lira yap', 'Mehmet borcuna 200 TL \xF6dedim' vb.\n7. Harcama/Gider silme (deleteExpense): 'Market harcamas\u0131n\u0131 sil', 'Yemek giderini kald\u0131r' vb.\n8. Gelir silme (deleteIncome): 'Maa\u015F gelirini kald\u0131r', 'Kira gelirini sil' vb.\n9. Bor\xE7 silme (deleteDebt): 'Ahmet borcunu sil', 'banka borcunu kald\u0131r' vb.\n\nSenin g\xF6revin, s\xF6ylenen ifadeyi bu eylemlerden birine s\u0131\u011Fd\u0131rmak (action: 'addDebt' | 'addContactDebt' | 'addInstallment' | 'addExpense' | 'addIncome' | 'updateDebtPaid' | 'deleteExpense' | 'deleteIncome' | 'deleteDebt' | 'unknown') ve ilgili bilgileri \xE7\u0131karmakt\u0131r. Gerekirse tarihleri bug\xFCn\xFCn tarihi varsay.\nAyr\u0131ca, kullan\u0131c\u0131n\u0131n eylemi duydu\u011Funu onaylayan sevimli, samimi bir yapay zeka T\xFCrk\xE7e sesli asistan onay mesaj\u0131 yaz (explanation). \xD6rn: 'Anla\u015F\u0131ld\u0131! Harcama kayd\u0131n\u0131z\u0131 silme i\u015Flemini ba\u015Flat\u0131yorum.'";
    const response = await aiClient.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [
        { text: promptText },
        { text: `Kullan\u0131c\u0131n\u0131n S\xF6z\xFC: "${text}"` }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            action: {
              type: import_genai.Type.STRING,
              description: "Eylem tipi: 'addDebt', 'addContactDebt', 'addInstallment', 'addExpense', 'addIncome', 'updateDebtPaid', 'deleteExpense', 'deleteIncome', 'deleteDebt' veya bilinmiyorsa 'unknown'."
            },
            contactDebtData: {
              type: import_genai.Type.OBJECT,
              description: "addContactDebt eylemi i\xE7in ki\u015Fi bazl\u0131 alacak/verecek verileri.",
              properties: {
                contactName: { type: import_genai.Type.STRING, description: "\u015Eah\u0131s/Ki\u015Fi ismi (\xD6rn: Ahmet, Ay\u015Fe vb.)" },
                amount: { type: import_genai.Type.NUMBER, description: "Tutar" },
                type: { type: import_genai.Type.STRING, description: "\u0130\u015Flem y\xF6n\xFC: Kullan\u0131c\u0131n\u0131n alaca\u011F\u0131 varsa 'receivable' (Alacak), borcu varsa 'payable' (Verecek)" },
                description: { type: import_genai.Type.STRING, description: "A\xE7\u0131klama (\xD6rn: 'Sesli Alacak Kayd\u0131')" }
              }
            },
            debtData: {
              type: import_genai.Type.OBJECT,
              description: "addDebt eylemi i\xE7in bor\xE7 verileri.",
              properties: {
                name: { type: import_genai.Type.STRING, description: "Bor\xE7 veren/alan veya a\xE7\u0131klama unvan\u0131" },
                amount: { type: import_genai.Type.NUMBER, description: "Bor\xE7 miktar\u0131" },
                paid: { type: import_genai.Type.NUMBER, description: "\xD6denmi\u015F miktar (Varsay\u0131lan 0)" },
                category: { type: import_genai.Type.STRING, description: "Banka, E\u015F-Dost, Vergi, Kredi Kart\u0131 vb." },
                dueDate: { type: import_genai.Type.STRING, description: "Son \xF6deme tarihi (Format: YYYY-MM-DD)" }
              }
            },
            updateDebtData: {
              type: import_genai.Type.OBJECT,
              description: "updateDebtPaid eylemi i\xE7in bor\xE7 g\xFCncelleme verileri.",
              properties: {
                name: { type: import_genai.Type.STRING, description: "G\xFCncellenecek borcun ismi (Kullan\u0131c\u0131n\u0131n belirtti\u011Fi bor\xE7 ad\u0131, \xF6rn: 'Ahmet', 'Banka kredisi' vb.)" },
                paidAmount: { type: import_genai.Type.NUMBER, description: "\xD6deme tutar\u0131 veya \xF6denen miktar\u0131n yeni de\u011Feri" },
                isAbsolute: { type: import_genai.Type.BOOLEAN, description: "E\u011Fer \xF6denen tutar do\u011Frudan bu de\u011Fere E\u015E\u0130TLENECEK ise true (\xF6rn: '\xF6denen k\u0131sm\u0131n\u0131 500 TL yap'), e\u011Fer mevcut \xF6denenin \xFCzerine EKLENECEK ise false (\xF6rn: '500 TL \xF6deme yapt\u0131m', 'mevcut \xF6demeye 300 TL ekle' veya 'X borcuna 200 TL \xF6dedim')" }
              }
            },
            installmentData: {
              type: import_genai.Type.OBJECT,
              description: "addInstallment eylemi i\xE7in taksit verileri.",
              properties: {
                name: { type: import_genai.Type.STRING, description: "Taksit plan\u0131 a\xE7\u0131klamas\u0131" },
                totalAmount: { type: import_genai.Type.NUMBER, description: "Toplam bor\xE7 miktar\u0131" },
                installmentCount: { type: import_genai.Type.INTEGER, description: "Taksit say\u0131s\u0131" },
                paidInstallmentCount: { type: import_genai.Type.INTEGER, description: "\xD6denen taksit say\u0131s\u0131 (Varsay\u0131lan 0)" },
                firstDueDate: { type: import_genai.Type.STRING, description: "\u0130lk taksit tarihi (Format: YYYY-MM-DD)" }
              }
            },
            expenseData: {
              type: import_genai.Type.OBJECT,
              description: "addExpense eylemi i\xE7in gider verileri.",
              properties: {
                amount: { type: import_genai.Type.NUMBER, description: "Tutar" },
                description: { type: import_genai.Type.STRING, description: "A\xE7\u0131klama" },
                categoryId: { type: import_genai.Type.INTEGER, description: "Kategori ID'si (1: Kira/Yurt, 2: Market, 3: Ula\u015F\u0131m, 4: Yeme \u0130\xE7me, 5: Faturalar)" }
              }
            },
            incomeData: {
              type: import_genai.Type.OBJECT,
              description: "addIncome eylemi i\xE7in gelir verileri.",
              properties: {
                name: { type: import_genai.Type.STRING, description: "Gelir unvan\u0131/kayna\u011F\u0131" },
                amount: { type: import_genai.Type.NUMBER, description: "Tutar" },
                date: { type: import_genai.Type.STRING, description: "Gelir tarihi (Format: YYYY-MM-DD)" }
              }
            },
            deleteExpenseData: {
              type: import_genai.Type.OBJECT,
              description: "deleteExpense eylemi i\xE7in.",
              properties: {
                description: { type: import_genai.Type.STRING, description: "Silinecek harcaman\u0131n a\xE7\u0131klamas\u0131/ad\u0131" }
              }
            },
            deleteIncomeData: {
              type: import_genai.Type.OBJECT,
              description: "deleteIncome eylemi i\xE7in.",
              properties: {
                name: { type: import_genai.Type.STRING, description: "Silinecek gelirin a\xE7\u0131klamas\u0131/ad\u0131" }
              }
            },
            deleteDebtData: {
              type: import_genai.Type.OBJECT,
              description: "deleteDebt eylemi i\xE7in.",
              properties: {
                name: { type: import_genai.Type.STRING, description: "Silinecek borcun a\xE7\u0131klamas\u0131/ad\u0131" }
              }
            },
            explanation: {
              type: import_genai.Type.STRING,
              description: "Kullan\u0131c\u0131ya s\xF6ylenecek T\xFCrk\xE7e sevimli onay c\xFCmlesi."
            }
          },
          required: ["action", "explanation"]
        },
        temperature: 0.1
      }
    });
    const parsedData = JSON.parse(response.text || "{}");
    return res.json(parsedData);
  } catch (error) {
    console.error("[Voice Command API Error]:", error);
    const offlineResult = parseVoiceCommandOffline(text);
    return res.json(offlineResult);
  }
});
app.post("/api/scan-receipt", async (req, res) => {
  const { image, mimeType: userMimeType } = req.body;
  if (!image) {
    return res.status(400).json({ error: "L\xFCtfen taranacak fatura veya fi\u015F g\xF6rselini se\xE7in." });
  }
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
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    return res.json({
      success: true,
      title: "Se\xE7ili Belge (\xD6rnek Al\u0131\u015Fveri\u015F)",
      amount: 450,
      date: todayStr,
      categorySuggestion: "G\u0131da / Market",
      type: "expense",
      isOffline: true,
      message: "Ak\u0131ll\u0131 tarama sim\xFClasyonu \xE7al\u0131\u015Ft\u0131r\u0131ld\u0131. Ger\xE7ek yapay zeka tespiti i\xE7in l\xFCtfen Settings > Secrets panelinden GEMINI_API_KEY tan\u0131mlay\u0131n!"
    });
  }
  try {
    const promptText = "Sen harika ve hassas bir belge okuma (OCR) servisisin. Ekteki g\xF6rsel bir al\u0131\u015Fveri\u015F fi\u015Fi, fatura, makbuz ya da harcama belgesidir.\n\nG\xF6revlerin:\n1. Belgedeki ma\u011Faza/sat\u0131c\u0131/kurum ad\u0131n\u0131 tam olarak \xE7\u0131kar (\xF6rn: 'Migros Ticaret A.\u015E.', 'Shell Akaryak\u0131t', 'Elektrik Da\u011F\u0131t\u0131m').\n2. Belgedeki KDV dahil toplam \xF6deme tutar\u0131n\u0131 (KRD ya da NAK\u0130T toplam\u0131) say\u0131sal olarak bul.\n3. Belgedeki tarihi oku (Format: YYYY-MM-DD format\u0131nda olmal\u0131. E\u011Fer y\u0131l a\xE7\u0131k de\u011Filse 2026 olarak varsay).\n4. En uygun harcama kategorisini \xF6ner ('G\u0131da', 'Ula\u015F\u0131m', 'Fatura', 'Al\u0131\u015Fveri\u015F', 'E\u011Flence', 'Sa\u011Fl\u0131k', 'Di\u011Fer' vb.).\n5. Bu belgenin bir pe\u015Fin gider mi ('expense') yoksa bir sonraki \xF6demeli bor\xE7 mu ('debt') oldu\u011Funu tespit et.\n\nVerdi\u011Fin yan\u0131t JSON \u015Femas\u0131na tamamen uygun, ek a\xE7\u0131klama metni i\xE7ermeyen temiz bir JSON objesi olmal\u0131d\u0131r.";
    const response = await aiClient.models.generateContent({
      model: "gemini-3.7-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: detectedMimeType,
              data: base64Data
            }
          },
          {
            text: promptText
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            title: {
              type: import_genai.Type.STRING,
              description: "Sat\u0131c\u0131 veya belge unvan\u0131 (\xF6rne\u011Fin: 'Bim Birle\u015Fik Ma\u011Fazalar', 'Kira Faturas\u0131')"
            },
            amount: {
              type: import_genai.Type.NUMBER,
              description: "Toplam harcama veya \xF6deme tutar\u0131"
            },
            date: {
              type: import_genai.Type.STRING,
              description: "\u0130\u015Flem tarihi (Format: YYYY-MM-DD)"
            },
            categorySuggestion: {
              type: import_genai.Type.STRING,
              description: "\xD6nerilen gider/bor\xE7 kategorisi ismi"
            },
            type: {
              type: import_genai.Type.STRING,
              description: "'expense' veya 'debt'"
            }
          },
          required: ["title", "amount"]
        },
        temperature: 0.2
      }
    });
    const parsedData = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      title: parsedData.title || "Taranan Belge",
      amount: parsedData.amount || 0,
      date: parsedData.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      categorySuggestion: parsedData.categorySuggestion || "Di\u011Fer",
      type: parsedData.type || "expense",
      isOffline: false
    });
  } catch (error) {
    const errMsg = error?.message || error?.toString() || "";
    const isKeyError = errMsg.toLowerCase().includes("expired") || errMsg.toLowerCase().includes("key") || errMsg.toLowerCase().includes("credential") || errMsg.toLowerCase().includes("invalid_argument") || errMsg.toLowerCase().includes("unauthorized") || errMsg.toLowerCase().includes("api_key_invalid") || errMsg.toLowerCase().includes("forbidden") || errMsg.toLowerCase().includes("denied") || errMsg.toLowerCase().includes("403");
    if (isKeyError) {
      defaultKeyHasFailed = true;
      console.log("[Scan API] Key block matched: Key has expired or has restricted permissions. Bypassing silently.");
    } else {
      console.log("[Scan API] Process status: Interrupted.");
    }
    console.log("[Scan Receipt API] Falling back to intelligent offline simulated scan due to API issue.");
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    return res.json({
      success: true,
      title: "Se\xE7ili Belge (\xD6rnek Al\u0131\u015Fveri\u015F)",
      amount: 450,
      date: todayStr,
      categorySuggestion: "G\u0131da / Market",
      type: "expense",
      isOffline: true,
      message: "Yapay zeka tespiti yerine (403/Hata k\u0131s\u0131t\u0131 kaynakl\u0131) ak\u0131ll\u0131 tarama sim\xFClasyonu \xE7al\u0131\u015Ft\u0131r\u0131ld\u0131. Ger\xE7ek yapay zeka tespiti i\xE7in l\xFCtfen Settings > Secrets panelinden GEMINI_API_KEY tan\u0131mlay\u0131n!"
    });
  }
});
var cachedRatesPayload = null;
var cachedRatesTimestamp = 0;
app.get("/api/rates", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  const now = Date.now();
  if (cachedRatesPayload && now - cachedRatesTimestamp < 15e3 && req.query.force !== "true") {
    return res.json({ ...cachedRatesPayload, cached: true });
  }
  let usdRate = 48.42;
  let eurRate = 56.25;
  let gbpRate = 65.45;
  let chfRate = 59.72;
  let goldOns = 4431.1;
  let goldGram = 6898.85;
  let goldCeyrek = 11165.67;
  let goldYarim = 22331.33;
  let goldTam = 44526.08;
  let goldCumhuriyet = 45961;
  let btcUsd = 79614;
  const details = {
    USD: { buying: 48.38, selling: 48.49, change: 0.22 },
    EUR: { buying: 56.12, selling: 56.36, change: -0.25 },
    GBP: { buying: 65.43, selling: 65.48, change: -0.22 },
    CHF: { buying: 59.72, selling: 59.76, change: 0.18 },
    GOLD_GRAM: { buying: 6898.04, selling: 6898.85, change: -0.74 },
    GOLD_CEYREK: { buying: 10908.86, selling: 11165.67, change: -1.14 },
    GOLD_YARIM: { buying: 21749.55, selling: 22331.33, change: -1.14 },
    GOLD_TAM: { buying: 43635.46, selling: 44526.08, change: -1.14 },
    GOLD_CUMHURIYET: { buying: 45276, selling: 45961, change: -1.43 },
    GOLD_ONS: { buying: 4431.1, selling: 4431.1, change: 0.15 },
    BTC: { buying: 79614, selling: 79614, change: 0.85 }
  };
  let loadedSource = "";
  try {
    const truncCtrl = new AbortController();
    const truncTimeout = setTimeout(() => truncCtrl.abort(), 5e3);
    let truncRes = await fetch("https://finans.truncgil.com/v4/today.json", {
      signal: truncCtrl.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    }).catch(() => null);
    clearTimeout(truncTimeout);
    if (!truncRes || !truncRes.ok) {
      const fallbackCtrl = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackCtrl.abort(), 3e3);
      truncRes = await fetch("https://finans.truncgil.com/today.json", {
        signal: fallbackCtrl.signal,
        headers: { "Accept": "application/json" }
      }).catch(() => null);
      clearTimeout(fallbackTimeout);
    }
    if (truncRes && truncRes.ok) {
      const tData = await truncRes.json().catch(() => null);
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
  }
  try {
    const goldCtrl = new AbortController();
    const goldTimeout = setTimeout(() => goldCtrl.abort(), 3e3);
    const goldRes = await fetch("https://api.gold-api.com/price/XAU", { signal: goldCtrl.signal });
    clearTimeout(goldTimeout);
    if (goldRes.ok) {
      const gData = await goldRes.json();
      if (gData && gData.price) {
        goldOns = Number(gData.price);
        details.GOLD_ONS = { buying: goldOns, selling: goldOns, change: 0.15 };
        if (!loadedSource) {
          goldGram = goldOns * usdRate / 31.1034768;
          goldCeyrek = goldGram * 1.635;
          goldYarim = goldCeyrek * 2;
          goldTam = goldCeyrek * 4;
          goldCumhuriyet = goldCeyrek * 4.12;
        }
      }
    }
  } catch (e) {
    console.warn("[Rates] Gold-api fetch error:", e.message);
  }
  let cryptos = {
    BTC: { usd: 79614, change: 0.85 },
    ETH: { usd: 2680, change: 1.42 },
    SOL: { usd: 185.5, change: 2.8 },
    BNB: { usd: 645, change: 0.95 },
    XRP: { usd: 2.15, change: -1.1 },
    AVAX: { usd: 28.5, change: 3.25 },
    DOGE: { usd: 0.22, change: -0.65 },
    ADA: { usd: 0.78, change: 1.15 },
    TON: { usd: 5.4, change: 0.5 },
    USDT: { usd: 1, change: 0.02 }
  };
  try {
    const cryptoCtrl = new AbortController();
    const cryptoTimeout = setTimeout(() => cryptoCtrl.abort(), 3500);
    const symbolsParam = JSON.stringify([
      "BTCUSDT",
      "ETHUSDT",
      "SOLUSDT",
      "BNBUSDT",
      "XRPUSDT",
      "AVAXUSDT",
      "DOGEUSDT",
      "ADAUSDT"
    ]);
    const cryptoRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`, {
      signal: cryptoCtrl.signal
    });
    clearTimeout(cryptoTimeout);
    if (cryptoRes.ok) {
      const cryptoData = await cryptoRes.json();
      if (Array.isArray(cryptoData)) {
        for (const item of cryptoData) {
          const sym = item.symbol.replace("USDT", "");
          const price = Number(item.lastPrice);
          const chg = Number(item.priceChangePercent) || 0;
          if (price > 0 && cryptos[sym]) {
            cryptos[sym] = { usd: price, change: chg };
          }
        }
      }
    }
  } catch (e) {
    console.warn("[Rates] Binance multi-crypto fetch error:", e.message);
  }
  btcUsd = cryptos.BTC.usd;
  for (const [sym, data] of Object.entries(cryptos)) {
    details[sym] = {
      buying: data.usd,
      selling: data.usd,
      change: data.change
    };
  }
  if (!loadedSource) {
    const apis = [
      "https://open.er-api.com/v6/latest/USD",
      "https://api.exchangerate-api.com/v4/latest/USD"
    ];
    for (const baseUrl of apis) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 3e3);
        const res2 = await fetch(`${baseUrl}?t=${Date.now()}`, { signal: controller.signal });
        clearTimeout(id);
        if (res2.ok) {
          const data = await res2.json();
          if (data && data.rates && data.rates.TRY) {
            usdRate = Number(data.rates.TRY) || usdRate;
            eurRate = data.rates.TRY / (data.rates.EUR || 0.86) || eurRate;
            gbpRate = data.rates.TRY / (data.rates.GBP || 0.74) || gbpRate;
            goldGram = goldOns * usdRate / 31.1034768;
            goldCeyrek = goldGram * 1.635;
            goldYarim = goldCeyrek * 2;
            goldTam = goldCeyrek * 4;
            goldCumhuriyet = goldCeyrek * 4.12;
            loadedSource = baseUrl;
            break;
          }
        }
      } catch (err) {
      }
    }
  }
  const btcTry = btcUsd * usdRate;
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => n.toString().padStart(2, "0");
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
      BTC_USD: Number(cryptos.BTC.usd.toFixed(2)),
      BTC_TRY: Number((cryptos.BTC.usd * usdRate).toFixed(2)),
      ETH_USD: Number(cryptos.ETH.usd.toFixed(2)),
      ETH_TRY: Number((cryptos.ETH.usd * usdRate).toFixed(2)),
      SOL_USD: Number(cryptos.SOL.usd.toFixed(2)),
      SOL_TRY: Number((cryptos.SOL.usd * usdRate).toFixed(2)),
      BNB_USD: Number(cryptos.BNB.usd.toFixed(2)),
      BNB_TRY: Number((cryptos.BNB.usd * usdRate).toFixed(2)),
      XRP_USD: Number(cryptos.XRP.usd.toFixed(4)),
      XRP_TRY: Number((cryptos.XRP.usd * usdRate).toFixed(2)),
      AVAX_USD: Number(cryptos.AVAX.usd.toFixed(2)),
      AVAX_TRY: Number((cryptos.AVAX.usd * usdRate).toFixed(2)),
      DOGE_USD: Number(cryptos.DOGE.usd.toFixed(4)),
      DOGE_TRY: Number((cryptos.DOGE.usd * usdRate).toFixed(2)),
      ADA_USD: Number(cryptos.ADA.usd.toFixed(4)),
      ADA_TRY: Number((cryptos.ADA.usd * usdRate).toFixed(2)),
      TON_USD: Number(cryptos.TON.usd.toFixed(2)),
      TON_TRY: Number((cryptos.TON.usd * usdRate).toFixed(2)),
      USDT_USD: Number(cryptos.USDT.usd.toFixed(4)),
      USDT_TRY: Number((cryptos.USDT.usd * usdRate).toFixed(2))
    },
    details,
    lastUpdated: stamp,
    source: loadedSource || "Live Market Hybrid Engine"
  };
  cachedRatesTimestamp = now;
  return res.json(cachedRatesPayload);
});
var TURKEY_PROVINCES = [
  { name: "\u0130stanbul", lat: 41.0082, lon: 28.9784 },
  { name: "Ankara", lat: 39.9334, lon: 32.8597 },
  { name: "\u0130zmir", lat: 38.4237, lon: 27.1428 },
  { name: "Bursa", lat: 40.1885, lon: 29.061 },
  { name: "Antalya", lat: 36.8969, lon: 30.7133 },
  { name: "Adana", lat: 37, lon: 35.3213 },
  { name: "Konya", lat: 37.8746, lon: 32.4932 },
  { name: "Gaziantep", lat: 37.0662, lon: 37.3833 },
  { name: "\u015Eanl\u0131urfa", lat: 37.1674, lon: 38.7955 },
  { name: "Kocaeli", lat: 40.8533, lon: 29.8815 },
  { name: "Mersin", lat: 36.8121, lon: 34.6415 },
  { name: "Diyarbak\u0131r", lat: 37.9144, lon: 40.2306 },
  { name: "Hatay", lat: 36.2023, lon: 36.1606 },
  { name: "Manisa", lat: 38.6191, lon: 27.4289 },
  { name: "Kayseri", lat: 38.7205, lon: 35.4826 },
  { name: "Samsun", lat: 41.2867, lon: 36.33 },
  { name: "Bal\u0131kesir", lat: 39.6484, lon: 27.8826 },
  { name: "Kahramanmara\u015F", lat: 37.5858, lon: 36.9371 },
  { name: "Van", lat: 38.4891, lon: 43.4089 },
  { name: "Ayd\u0131n", lat: 37.838, lon: 27.8456 },
  { name: "Denizli", lat: 37.7765, lon: 29.0864 },
  { name: "Sakarya", lat: 40.7569, lon: 30.3783 },
  { name: "Trabzon", lat: 41.0027, lon: 39.7168 },
  { name: "Eski\u015Fehir", lat: 39.7767, lon: 30.5206 },
  { name: "Mu\u011Fla", lat: 37.2153, lon: 28.3636 },
  { name: "\xC7anakkale", lat: 40.1553, lon: 26.4142 },
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
  const lat = parseFloat(req.query.lat) || 41.0082;
  const lon = parseFloat(req.query.lon) || 28.9784;
  let cityName = req.query.city?.trim() || "";
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
    const timer = setTimeout(() => controller.abort(), 4e3);
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
    const response = await fetch(weatherUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "ButcemPro/2.5" }
    });
    clearTimeout(timer);
    if (response.ok) {
      const data = await response.json();
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
  } catch (err) {
    console.warn(`[Weather Proxy Warn] Weather fetch fallback triggered for (${lat}, ${lon}):`, err.message);
  }
  const currentMonth = (/* @__PURE__ */ new Date()).getMonth();
  let fallbackTemp = 24;
  if (currentMonth >= 5 && currentMonth <= 8) fallbackTemp = 28;
  else if (currentMonth >= 9 && currentMonth <= 10) fallbackTemp = 19;
  else if (currentMonth >= 11 || currentMonth <= 2) fallbackTemp = 11;
  else fallbackTemp = 18;
  return res.json({
    success: true,
    city: cityName || "\u0130stanbul",
    temperature: fallbackTemp,
    weatherCode: 0,
    // Sunny/Clear
    isDay: true,
    windSpeed: 12,
    fallback: true
  });
});
app.get("/api/weather/search", async (req, res) => {
  const query = (req.query.q || "").trim().toLowerCase();
  if (!query) {
    return res.json({ success: true, results: [] });
  }
  const localMatches = TURKEY_PROVINCES.filter(
    (p) => p.name.toLowerCase().includes(query) || query.includes(p.name.toLowerCase())
  );
  if (localMatches.length > 0) {
    return res.json({
      success: true,
      results: localMatches.map((m) => ({ name: m.name, latitude: m.lat, longitude: m.lon }))
    });
  }
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
      const data = await response.json();
      if (data && data.results && data.results.length > 0) {
        return res.json({
          success: true,
          results: data.results.map((r) => ({
            name: r.name + (r.admin1 ? `, ${r.admin1}` : ""),
            latitude: r.latitude,
            longitude: r.longitude
          }))
        });
      }
    }
  } catch (err) {
    console.warn(`[Weather Geo Proxy Warn] Search query "${query}" failed:`, err.message);
  }
  return res.json({
    success: true,
    results: [{ name: query.charAt(0).toUpperCase() + query.slice(1), latitude: 41.0082, longitude: 28.9784 }]
  });
});
var pairingSessions = /* @__PURE__ */ new Map();
setInterval(() => {
  const now = Date.now();
  for (const [code, sess] of pairingSessions.entries()) {
    if (now - sess.createdAt > 5 * 60 * 1e3) {
      pairingSessions.delete(code);
    }
  }
}, 6e4);
app.post("/api/pair/create", (req, res) => {
  let attempt = 0;
  let code = "";
  do {
    code = Math.floor(1e5 + Math.random() * 9e5).toString();
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
app.get("/api/pair/status/:code", (req, res) => {
  const { code } = req.params;
  const session = pairingSessions.get(code);
  if (!session) {
    return res.json({ status: "expired", message: "Ba\u011Flant\u0131 kodu s\xFCresi doldu veya ge\xE7ersiz." });
  }
  if (Date.now() - session.createdAt > 5 * 60 * 1e3) {
    pairingSessions.delete(code);
    return res.json({ status: "expired", message: "Ba\u011Flant\u0131 kodu zaman a\u015F\u0131m\u0131na u\u011Frad\u0131." });
  }
  res.json({
    status: session.status,
    email: session.email,
    password: session.password
  });
});
app.post("/api/pair/approve", (req, res) => {
  const { code, email, password } = req.body;
  if (!code || !email || !password) {
    return res.status(400).json({ error: "Eksik parametre grubu. Kodu ve yetki bilgilerini g\xF6nderin." });
  }
  const session = pairingSessions.get(String(code).trim());
  if (!session) {
    return res.status(404).json({ error: "E\u015Fle\u015Ftirme kodu bulunamad\u0131 veya s\xFCresi doldu." });
  }
  session.email = email;
  session.password = password;
  session.status = "approved";
  console.log(`[Pairing Engine] Code ${code} approved for user: ${email}`);
  res.json({ success: true, message: "Cihaz ba\u015Far\u0131yla yetkilendirildi. Giri\u015F bilgileri APK cihaz\u0131na aktar\u0131ld\u0131." });
});
var privacyPaths = [
  "/privacy",
  "/privacy-policy",
  "/privacy.html",
  "/privacy-policy.html",
  "/gizlilik",
  "/gizlilik-politikasi",
  "/gizlilik-politikasi.html"
];
var VAPID_KEYS_FILE = import_path.default.join(process.cwd(), "vapid_keys.json");
var vapidKeys = { publicKey: "", privateKey: "" };
if (import_fs.default.existsSync(VAPID_KEYS_FILE)) {
  try {
    const raw = import_fs.default.readFileSync(VAPID_KEYS_FILE, "utf8").trim();
    if (raw) {
      vapidKeys = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("[Push Server] Vapid keys parse error, generating new persistent keys...");
  }
}
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  vapidKeys = import_web_push.default.generateVAPIDKeys();
  try {
    import_fs.default.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(vapidKeys, null, 2), "utf8");
    console.log("[Push Server] Dynamically generated new persistent VAPID keys.");
  } catch (e) {
    console.error("[Push Server] Could not write VAPID keys file:", e);
  }
}
try {
  import_web_push.default.setVapidDetails(
    "mailto:info.borcodemetakip@gmail.com",
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} catch (e) {
  console.error("[Push Server] Error setting VAPID details:", e);
}
var PUSH_SUBS_FILE = import_path.default.join(process.cwd(), "active_push_subscriptions.json");
var subscriptionsMap = {};
if (import_fs.default.existsSync(PUSH_SUBS_FILE)) {
  try {
    const raw = import_fs.default.readFileSync(PUSH_SUBS_FILE, "utf8").trim();
    if (raw) {
      subscriptionsMap = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("[Push Server] Failed to parse push subscriptions:", e);
  }
}
function saveSubscriptionsToFile() {
  try {
    import_fs.default.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(subscriptionsMap), "utf8");
  } catch (e) {
    console.error("[Push Server] Failed to save push subscriptions:", e);
  }
}
app.get("/api/push-vapid-public-key", (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});
function parseDateRobust(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  if (typeof dateStr !== "string") return null;
  const str = dateStr.trim();
  if (!str) return null;
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d;
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
  if (str.includes("-")) {
    const parts = str.split(" ");
    const datePart = parts[0];
    const timePart = parts[1] || "00:00:00";
    const dp = datePart.split("-");
    if (dp.length === 3) {
      if (dp[0].length === 4) {
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
function analyzeUserDebts(debts = [], installmentDebts = []) {
  const now = /* @__PURE__ */ new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let overdueDebts = [];
  let dueTodayDebts = [];
  let upcomingDebts = [];
  let otherActiveDebts = [];
  let allActiveDebts = [];
  let totalActiveDebt = 0;
  let totalActiveCount = 0;
  (debts || []).forEach((d) => {
    if (!d) return;
    const amount = Number(d.amount) || Number(d.totalAmount) || 0;
    const paid = Number(d.paid) || 0;
    const remaining = d.remaining !== void 0 ? Number(d.remaining) : d.remainingAmount !== void 0 ? Number(d.remainingAmount) : Math.max(0, amount - paid);
    if (remaining <= 0) return;
    totalActiveDebt += remaining;
    totalActiveCount++;
    const dateField = d.dueDate || d.date || d.paymentDate || d.vadeTarihi || "";
    let classified = false;
    if (dateField) {
      try {
        const due = parseDateRobust(dateField);
        if (due) {
          const dueTime = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
          const diffDays = Math.round((todayTime - dueTime) / (1e3 * 60 * 60 * 24));
          const formattedDueDate = due.toLocaleDateString("tr-TR");
          const debtName = d.name || d.title || d.description || d.person || d.creditor || "Kay\u0131tl\u0131 Bor\xE7";
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
              status: `${diffDays} g\xFCn gecikti \u{1F6A8}`,
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
              status: "Bug\xFCn son g\xFCn \u23F0",
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
              status: `${daysLeft} g\xFCn sonra`,
              dueDateStr: formattedDueDate
            });
            classified = true;
          }
        }
      } catch (e) {
      }
    }
    if (!classified) {
      const fallbackName = d.name || d.title || d.description || d.person || d.creditor || "Kay\u0131tl\u0131 Bor\xE7";
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
  (installmentDebts || []).forEach((inst) => {
    if (!inst) return;
    const totalAmount = Number(inst.totalAmount) || 0;
    const count = Number(inst.installmentCount) || 1;
    const paidCount = Number(inst.paidInstallmentCount) || 0;
    const perInst = count > 0 ? totalAmount / count : 0;
    const remainingInstallments = Math.max(0, count - paidCount);
    const remainingAmount = inst.remainingAmount !== void 0 ? Number(inst.remainingAmount) : remainingInstallments * perInst;
    if (remainingAmount <= 0 || remainingInstallments <= 0) return;
    totalActiveDebt += remainingAmount;
    totalActiveCount++;
    const firstDateField = inst.firstDueDate || inst.dueDate || inst.date || "";
    let classified = false;
    if (firstDateField) {
      try {
        const baseDate = parseDateRobust(firstDateField);
        if (baseDate) {
          baseDate.setMonth(baseDate.getMonth() + paidCount);
          const dueTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()).getTime();
          const diffDays = Math.round((todayTime - dueTime) / (1e3 * 60 * 60 * 24));
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
              status: `${diffDays} g\xFCn gecikti \u{1F6A8}`,
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
              status: "Bug\xFCn son g\xFCn \u23F0",
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
              status: `${daysLeft} g\xFCn sonra`,
              dueDateStr: formattedDueDate
            });
            classified = true;
          }
        }
      } catch (e) {
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
app.post("/api/push-register", (req, res) => {
  const { subscription, alarms, debts, installmentDebts, user } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Ge\xE7ersiz abonelik bilgisi" });
  }
  const endpointHash = import_crypto.default.createHash("md5").update(subscription.endpoint).digest("hex");
  const existing = subscriptionsMap[endpointHash] || {
    subscription,
    alarms: [],
    debts: [],
    installmentDebts: [],
    user: user || "anonymous",
    lastOverduePushTime: 0,
    lastDueTodayPushDate: ""
  };
  const cleanAlarms = Array.isArray(alarms) ? alarms : existing.alarms || [];
  const cleanDebts = Array.isArray(debts) ? debts : existing.debts || [];
  const cleanInstallmentDebts = Array.isArray(installmentDebts) ? installmentDebts : existing.installmentDebts || [];
  subscriptionsMap[endpointHash] = {
    ...existing,
    subscription,
    alarms: cleanAlarms,
    debts: cleanDebts,
    installmentDebts: cleanInstallmentDebts,
    user: user || existing.user || "anonymous",
    updatedAt: Date.now()
  };
  saveSubscriptionsToFile();
  console.log(`[Push Server] Registered/updated subscription for user: ${user}. Total alarms: ${cleanAlarms.length}, Total debts: ${cleanDebts.length}`);
  res.json({
    success: true,
    message: "Abonelik ve alarmlar ba\u015Far\u0131yla sunucuya kaydedildi.",
    registeredAlarmsCount: cleanAlarms.length,
    registeredDebtsCount: cleanDebts.length
  });
});
app.get("/api/push-status", (req, res) => {
  const count = Object.keys(subscriptionsMap).length;
  let totalAlarms = 0;
  for (const s of Object.values(subscriptionsMap)) {
    totalAlarms += s.alarms?.length || 0;
  }
  res.json({
    success: true,
    activeSubscriptions: count,
    scheduledAlarms: totalAlarms,
    serverTime: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/trigger-overdue-push", async (req, res) => {
  const { subscription, debts, installmentDebts } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Ge\xE7ersiz abonelik bilgisi" });
  }
  const { overdueDebts, dueTodayDebts } = analyzeUserDebts(debts, installmentDebts);
  if (overdueDebts.length === 0 && dueTodayDebts.length === 0) {
    return res.json({
      success: true,
      message: "Gecikmi\u015F veya vadesi bug\xFCn olan herhangi bir bor\xE7 bulunamad\u0131.",
      hasOverdue: false
    });
  }
  let title = "B\xFCt\xE7em Pro: Bor\xE7 Hat\u0131rlatmas\u0131 \u23F0";
  let body = "";
  if (overdueDebts.length > 0) {
    const totalOverdue = overdueDebts.reduce((sum, d) => sum + d.remaining, 0);
    const topDebt = overdueDebts[0];
    title = `\u26A0\uFE0F Gecikmi\u015F Bor\xE7 Uyar\u0131s\u0131 (${overdueDebts.length} Adet)`;
    body = `Vadesi ge\xE7mi\u015F borcunuz var: "${topDebt.name}" (\u20BA${topDebt.remaining.toLocaleString("tr-TR")}, ${topDebt.daysLate} g\xFCn gecikmeli). Toplam geciken: \u20BA${totalOverdue.toLocaleString("tr-TR")}.`;
  } else if (dueTodayDebts.length > 0) {
    const totalDue = dueTodayDebts.reduce((sum, d) => sum + d.amount, 0);
    const topDebt = dueTodayDebts[0];
    title = `\u{1F6A8} Bug\xFCn Vadesi Gelen \xD6demeniz Var!`;
    body = `"${topDebt.name}" i\xE7in \u20BA${topDebt.amount.toLocaleString("tr-TR")} \xF6demesinin son g\xFCn\xFC bug\xFCn. Toplam: \u20BA${totalDue.toLocaleString("tr-TR")}.`;
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
    await import_web_push.default.sendNotification(subscription, payload, {
      headers: { "Urgency": "high" },
      TTL: 86400
    });
    return res.json({ success: true, message: "Ge\xE7mi\u015F bor\xE7 bildirimi ba\u015Far\u0131yla telefona g\xF6nderildi!" });
  } catch (err) {
    console.error("[Push Server] Error in trigger-overdue-push:", err);
    return res.status(500).json({ error: err.message || "Bildirim iletilemedi" });
  }
});
app.post("/api/send-test-push", async (req, res) => {
  const { subscription, delaySeconds } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Ge\xE7ersiz abonelik bilgisi" });
  }
  const delay = Math.max(1, parseInt(delaySeconds, 10) || 5);
  const delayMs = delay * 1e3;
  console.log(`[Push Server] Scheduled diagnostic test notification in ${delay} seconds.`);
  setTimeout(async () => {
    const payload = JSON.stringify({
      title: "B\xFCt\xE7em Pro Alarm Sinyali \u23F0",
      body: "Harika! Telefon kapal\u0131yken bile Web Push ve Service Worker bildirim sistemi kusursuz \xE7al\u0131\u015F\u0131yor! \u{1F514}",
      tag: "test-push-alarm-" + Date.now(),
      icon: "/logo.png",
      badge: "/logo.png",
      url: "/?tab=notifications"
    });
    try {
      await import_web_push.default.sendNotification(subscription, payload, {
        headers: { "Urgency": "high" },
        TTL: 86400
      });
      console.log("[Push Server] Successfully pushed diagnostic alarm notification with TTL 86400.");
    } catch (pushErr) {
      console.error("[Push Server] Push error in diagnostic route:", pushErr);
    }
  }, delayMs);
  res.json({ success: true, message: `Test bildirimi ${delay} saniye i\xE7inde g\xF6nderilecek. Telefonunuzu kilitleyebilirsiniz!` });
});
var EMAIL_SUBSCRIBERS_FILE = import_path.default.join(process.cwd(), "email_subscribers.json");
var emailSubscribersMap = {};
if (import_fs.default.existsSync(EMAIL_SUBSCRIBERS_FILE)) {
  try {
    const raw = import_fs.default.readFileSync(EMAIL_SUBSCRIBERS_FILE, "utf-8").trim();
    if (raw) {
      emailSubscribersMap = JSON.parse(raw);
      console.log(`[Email Alert Engine] Loaded ${Object.keys(emailSubscribersMap).length} email subscribers.`);
    }
  } catch (e) {
    console.warn("[Email Alert Engine] Error loading email_subscribers.json:", e);
    emailSubscribersMap = {};
  }
}
var saveEmailSubscribersToFile = () => {
  try {
    import_fs.default.writeFileSync(EMAIL_SUBSCRIBERS_FILE, JSON.stringify(emailSubscribersMap, null, 2), "utf-8");
  } catch (err) {
    console.error("[Email Alert Engine] Error saving email_subscribers.json:", err);
  }
};
function generateOverdueEmailText(email, user, analysis, isTest = false, isWelcome = false) {
  let overdueDebts = [];
  let dueTodayDebts = [];
  let totalActiveDebt = 0;
  let totalOverdueAmount = 0;
  let totalActiveCount = 0;
  if (analysis && typeof analysis === "object") {
    overdueDebts = analysis.overdueDebts || [];
    dueTodayDebts = analysis.dueTodayDebts || [];
    totalActiveDebt = Number(analysis.totalActiveDebt) || 0;
    totalOverdueAmount = Number(analysis.totalOverdueAmount) || 0;
    totalActiveCount = Number(analysis.totalActiveCount) || overdueDebts.length + dueTodayDebts.length;
  }
  const lines = [];
  lines.push(`Say\u0131n ${user || "B\xFCt\xE7em Pro Kullan\u0131c\u0131s\u0131"},`);
  lines.push("");
  if (isWelcome) {
    lines.push("B\xFCt\xE7em Pro e-posta bildirimleriniz ba\u015Far\u0131yla aktifle\u015Ftirildi. G\xFCncel bor\xE7 durumunuz:");
  } else if (isTest) {
    lines.push("Bu ileti B\xFCt\xE7em Pro taraf\u0131ndan g\xF6nderilen test ve bor\xE7 durumu bildirim raporudur:");
  } else {
    lines.push("B\xFCt\xE7em Pro kay\u0131tl\u0131 bor\xE7 ve \xF6demelerinizin g\xFCncel durum \xF6zeti:");
  }
  lines.push("");
  lines.push(`* Toplam Kalan Bor\xE7: \u20BA${totalActiveDebt.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`);
  lines.push(`* Geciken Bor\xE7 Tutar\u0131: \u20BA${totalOverdueAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`);
  lines.push(`* Aktif Bor\xE7 Kalem Say\u0131s\u0131: ${totalActiveCount}`);
  lines.push("");
  if (overdueDebts.length > 0) {
    lines.push("--- VADES\u0130 GE\xC7M\u0130\u015E BOR\xC7LAR ---");
    overdueDebts.forEach((d) => {
      lines.push(`- ${d.name}: \u20BA${(Number(d.remaining) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} (${d.daysLate} g\xFCn gecikti)`);
    });
    lines.push("");
  }
  if (dueTodayDebts.length > 0) {
    lines.push("--- BUG\xDCN VADES\u0130 GELEN BOR\xC7LAR ---");
    dueTodayDebts.forEach((d) => {
      lines.push(`- ${d.name}: \u20BA${(Number(d.amount) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} (Bug\xFCn Son G\xFCn)`);
    });
    lines.push("");
  }
  lines.push("B\xFCt\xE7em Pro - Ak\u0131ll\u0131 B\xFCt\xE7e ve Bor\xE7 Takip Asistan\u0131");
  lines.push(`Bu bilgilendirme e-postas\u0131 ${email} adresi i\xE7in olu\u015Fturulmu\u015Ftur.`);
  lines.push("Not: Bu iletiyi gelen kutunuzda g\xF6remiyorsan\u0131z l\xFCtfen Spam / Tan\u0131t\u0131mlar klas\xF6r\xFCn\xFCz\xFC kontrol ediniz.");
  return lines.join("\n");
}
function generateOverdueEmailHtml(email, user, analysis, isTest = false, isWelcome = false) {
  let overdueDebts = [];
  let dueTodayDebts = [];
  let upcomingDebts = [];
  let allActiveDebts = [];
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
    totalActiveCount = Number(analysis.totalActiveCount) || allActiveDebts.length || overdueDebts.length + dueTodayDebts.length + upcomingDebts.length;
  }
  const nowFormatted = (/* @__PURE__ */ new Date()).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  let badgeLabel = "\u26A0\uFE0F BOR\xC7 B\u0130LD\u0130R\u0130M\u0130";
  let headingTitle = "G\xFCncel Bor\xE7 Durum & Hat\u0131rlatma Raporu";
  if (isWelcome) {
    badgeLabel = "\u{1F389} B\u0130LD\u0130R\u0130MLER AKT\u0130FLE\u015ET\u0130R\u0130LD\u0130";
    headingTitle = "E-Posta Bildirimleriniz Devrede!";
  } else if (isTest) {
    badgeLabel = "\u{1F9EA} TEST RAPORU & DO\u011ERULAMA";
    headingTitle = "B\xFCt\xE7em Pro Test ve Bor\xE7 Raporu";
  } else if (overdueDebts.length > 0) {
    badgeLabel = "\u{1F6A8} GEC\u0130KM\u0130\u015E BOR\xC7 UYARISI";
    headingTitle = "Vadesi Ge\xE7mi\u015F Bor\xE7 Uyar\u0131s\u0131!";
  } else if (dueTodayDebts.length > 0) {
    badgeLabel = "\u23F0 BUG\xDCN SON G\xDCN UYARISI";
    headingTitle = "Bug\xFCn Vadesi Dolan \xD6demeniz Var!";
  }
  const overdueRows = overdueDebts.map((d) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 12px 14px; font-weight: 700; color: #1e293b; font-size: 13px;">
        ${d.name} ${d.isInstallment ? '<span style="font-size: 10px; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-weight: 800;">TAKS\u0130T</span>' : ""}
        ${d.dueDateStr ? `<div style="font-size: 11px; color: #94a3b8; font-weight: 500; margin-top: 2px;">Vade: ${d.dueDateStr}</div>` : ""}
      </td>
      <td style="padding: 12px 14px; color: #e11d48; font-weight: 800; font-size: 14px; text-align: right;">
        \u20BA${(Number(d.remaining) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
      </td>
      <td style="padding: 12px 14px; text-align: center;">
        <span style="background: #ffe4e6; color: #be123c; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 800;">
          ${d.daysLate} G\xFCn Gecikti
        </span>
      </td>
    </tr>
  `).join("");
  const dueTodayRows = dueTodayDebts.map((d) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 12px 14px; font-weight: 700; color: #1e293b; font-size: 13px;">
        ${d.name} ${d.isInstallment ? '<span style="font-size: 10px; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-weight: 800;">TAKS\u0130T</span>' : ""}
      </td>
      <td style="padding: 12px 14px; color: #d97706; font-weight: 800; font-size: 14px; text-align: right;">
        \u20BA${(Number(d.amount) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
      </td>
      <td style="padding: 12px 14px; text-align: center;">
        <span style="background: #fef3c7; color: #b45309; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 800;">
          Bug\xFCn Son G\xFCn
        </span>
      </td>
    </tr>
  `).join("");
  const allActiveRows = allActiveDebts.slice(0, 10).map((d) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 10px 14px; font-weight: 700; color: #1e293b; font-size: 12px;">
        ${d.name} ${d.isInstallment ? '<span style="font-size: 9px; background: #e0e7ff; color: #4338ca; padding: 1px 5px; border-radius: 4px; font-weight: 800;">TAKS\u0130T</span>' : ""}
      </td>
      <td style="padding: 10px 14px; color: #64748b; font-size: 12px; text-align: center;">
        ${d.dueDateStr || "-"}
      </td>
      <td style="padding: 10px 14px; color: #0f172a; font-weight: 800; font-size: 13px; text-align: right;">
        \u20BA${(Number(d.remaining) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
      </td>
      <td style="padding: 10px 14px; text-align: center;">
        <span style="background: #f1f5f9; color: #475569; padding: 2px 7px; border-radius: 6px; font-size: 10px; font-weight: 700;">
          ${d.status || "Aktif"}
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
  <title>B\xFCt\xE7em Pro Bor\xE7 Uyar\u0131s\u0131</title>
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
                Say\u0131n ${user || "B\xFCt\xE7em Pro Kullan\u0131c\u0131s\u0131"}, ${nowFormatted} itibar\u0131yla kay\u0131tl\u0131 bor\xE7 ve \xF6demelerinizin g\xFCncel durumu a\u015Fa\u011F\u0131dad\u0131r.
              </p>
            </td>
          </tr>

          <!-- Metrics summary 3-column card -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
                <tr>
                  <td style="text-align: center; border-right: 1px solid #e2e8f0; padding: 16px 8px; width: 33%;">
                    <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Toplam Kalan Bor\xE7</div>
                    <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 4px;">
                      \u20BA${totalActiveDebt.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td style="text-align: center; border-right: 1px solid #e2e8f0; padding: 16px 8px; width: 33%;">
                    <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Geciken Tutar</div>
                    <div style="font-size: 18px; font-weight: 900; color: ${totalOverdueAmount > 0 ? "#e11d48" : "#10b981"}; margin-top: 4px;">
                      ${totalOverdueAmount > 0 ? `\u20BA${totalOverdueAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "\u20BA0,00 (Temiz \u2705)"}
                    </div>
                  </td>
                  <td style="text-align: center; padding: 16px 8px; width: 34%;">
                    <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Aktif Bor\xE7 Say\u0131s\u0131</div>
                    <div style="font-size: 18px; font-weight: 900; color: #4f46e5; margin-top: 4px;">
                      ${totalActiveCount} Kalem
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${overdueDebts.length > 0 ? `
          <!-- Overdue debts table -->
          <tr>
            <td style="padding: 0 28px 18px 28px;">
              <h3 style="margin: 0 0 10px 0; color: #be123c; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">
                \u{1F6A8} Vadesi Ge\xE7mi\u015F Bor\xE7 Detaylar\u0131 (${overdueDebts.length} Kalem)
              </h3>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background: #ffffff; border: 1px solid #ffe4e6; border-radius: 12px; overflow: hidden;">
                <thead>
                  <tr style="background: #fff1f2; border-bottom: 1px solid #ffe4e6;">
                    <th style="padding: 10px 14px; text-align: left; font-size: 11px; color: #9f1239; font-weight: 800; text-transform: uppercase;">Bor\xE7 / Taksit</th>
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
          ` : ""}

          ${dueTodayDebts.length > 0 ? `
          <!-- Due today debts table -->
          <tr>
            <td style="padding: 0 28px 18px 28px;">
              <h3 style="margin: 0 0 10px 0; color: #b45309; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">
                \u23F0 Bug\xFCn Vadesi Dolan \xD6demeler (${dueTodayDebts.length} Kalem)
              </h3>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background: #ffffff; border: 1px solid #fef3c7; border-radius: 12px; overflow: hidden;">
                <thead>
                  <tr style="background: #fffbeb; border-bottom: 1px solid #fef3c7;">
                    <th style="padding: 10px 14px; text-align: left; font-size: 11px; color: #92400e; font-weight: 800; text-transform: uppercase;">Bor\xE7 / Taksit</th>
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
          ` : ""}

          ${allActiveDebts.length > 0 && overdueDebts.length === 0 && dueTodayDebts.length === 0 ? `
          <!-- All active debts table -->
          <tr>
            <td style="padding: 0 28px 18px 28px;">
              <h3 style="margin: 0 0 10px 0; color: #334155; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">
                \u{1F4CB} Kay\u0131tl\u0131 Aktif Bor\xE7 Listesi
              </h3>
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <thead>
                  <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <th style="padding: 10px 14px; text-align: left; font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase;">Bor\xE7 / Taksit</th>
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
          ` : ""}

          ${totalActiveCount === 0 ? `
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 18px; text-align: center;">
                <div style="font-size: 24px; margin-bottom: 6px;">\u{1F389}</div>
                <div style="color: #166534; font-weight: 800; font-size: 14px;">Harika! Kay\u0131tl\u0131 \xD6denmemi\u015F Borcunuz Yok</div>
                <div style="color: #15803d; font-size: 12px; margin-top: 4px;">B\xFCt\xE7em Pro'da takip edilen t\xFCm bor\xE7 ve taksitleriniz d\xFCzenli ve \xF6denmi\u015F durumdad\u0131r.</div>
              </div>
            </td>
          </tr>
          ` : ""}

          <!-- Action CTA -->
          <tr>
            <td style="padding: 8px 28px 24px 28px; text-align: center;">
              <div style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 14px; font-weight: 800; font-size: 13px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
                B\xFCt\xE7em Pro Bor\xE7 Takip Asistan\u0131
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 20px 28px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                Bu bilgilendirme e-postas\u0131, <strong>${email}</strong> adresi i\xE7in B\xFCt\xE7em Pro <em>Ayarlar &gt; E-posta Bildirim Do\u011Frulama</em> sisteminiz do\u011Frultusunda iletilmi\u015Ftir.
              </p>
              <p style="margin: 6px 0 0 0; font-size: 10px; color: #cbd5e1;">
                B\xFCt\xE7em Pro &copy; ${(/* @__PURE__ */ new Date()).getFullYear()} - Ak\u0131ll\u0131 B\xFCt\xE7e ve Bor\xE7 Takip Asistan\u0131
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
function cleanHost(rawHost) {
  if (!rawHost) return "";
  let host = rawHost.trim();
  host = host.replace(/^[a-zA-Z0-9+.-]+:\/\//, "").replace(/^[:\/]+/, "");
  host = host.split("/")[0].split(":")[0].trim();
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
function cleanCredential(val) {
  if (!val) return "";
  return val.trim().replace(/^["']|["']$/g, "");
}
function getMailTransporter(customOverride) {
  const activeConfig = customOverride || currentCustomSmtp;
  const user = cleanCredential(activeConfig?.user);
  const pass = cleanCredential(activeConfig?.pass).replace(/\s+/g, "");
  if (!user || !pass) {
    return null;
  }
  const rawHost = activeConfig?.host;
  let host = cleanHost(rawHost);
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
  const rawPort = Number(activeConfig?.port);
  const port = rawPort || (host === "smtp.gmail.com" ? 465 : 587);
  const secure = activeConfig?.secure ?? port === 465;
  return import_nodemailer.default.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 1e4,
    greetingTimeout: 1e4,
    socketTimeout: 15e3
  });
}
async function testSmtpCredentials(config) {
  const host = cleanHost(config.host || (config.user?.includes("@gmail.com") ? "smtp.gmail.com" : ""));
  const user = cleanCredential(config.user);
  const pass = cleanCredential(config.pass).replace(/\s+/g, "");
  const port = Number(config.port) || (host === "smtp.gmail.com" ? 465 : 587);
  const secure = config.secure ?? port === 465;
  if (!user || !pass) {
    return {
      success: false,
      message: "L\xFCtfen g\xF6nderici e-posta adresinizi ve 16 haneli Uygulama \u015Eifrenizi (veya SMTP \u015Fifrenizi) eksiksiz girin."
    };
  }
  try {
    const transporter = import_nodemailer.default.createTransport({
      host: host || "smtp.gmail.com",
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 1e4,
      greetingTimeout: 1e4,
      socketTimeout: 15e3
    });
    await transporter.verify();
    return {
      success: true,
      message: `\u2705 SMTP Ba\u011Flant\u0131s\u0131 Ba\u015Far\u0131l\u0131: ${host || "smtp.gmail.com"}:${port} \xFCzerinden kimlik do\u011Fruland\u0131 ve e-posta g\xF6nderimine haz\u0131r!`,
      host: host || "smtp.gmail.com",
      port
    };
  } catch (err) {
    console.error("[SMTP Verify Error]:", err);
    let errorMsg = err.message || "Bilinmeyen SMTP hatas\u0131";
    if (err.responseCode === 535 || errorMsg.includes("535") || errorMsg.includes("Username and Password not accepted") || err.code === "EAUTH") {
      errorMsg = "Kimlik Do\u011Frulama Hatas\u0131 (535): Gmail veya e-posta sa\u011Flay\u0131c\u0131n\u0131z \u015Fifrenizi reddetti. Gmail kullan\u0131yorsan\u0131z normal hesap \u015Fifreniz yerine Google Hesab\u0131n\u0131zdan (myaccount.google.com/apppasswords) alaca\u011F\u0131n\u0131z 16 haneli 'Google Uygulama \u015Eifresi'ni girmelisiniz.";
    } else if (err.code === "ETIMEDOUT" || err.code === "ESOCKET" || errorMsg.includes("timeout")) {
      errorMsg = `Ba\u011Flant\u0131 Zaman A\u015F\u0131m\u0131 (${port} portu): Sunucu yan\u0131t vermedi. Port olarak 465 (SSL) veya 587 (TLS) deneyiniz.`;
    } else if (err.code === "ENOTFOUND") {
      errorMsg = `Sunucu Adresi Bulunamad\u0131 (${host}): L\xFCtfen SMTP sunucu adresinin do\u011Frulu\u011Funu kontrol ediniz.`;
    } else if (err.code === "ECONNREFUSED") {
      errorMsg = `Ba\u011Flant\u0131 Reddedildi: ${host}:${port} ba\u011Flant\u0131y\u0131 kapatt\u0131. Port veya SSL ayar\u0131n\u0131 kontrol ediniz.`;
    }
    return {
      success: false,
      message: `\u274C ${errorMsg}`
    };
  }
}
async function sendMailHelper(options) {
  try {
    const transporter = getMailTransporter(options.customConfig);
    const activeConfig = options.customConfig || currentCustomSmtp;
    const user = cleanCredential(activeConfig?.user);
    const authEmail = user || "bildirim@butcempro.app";
    const senderName = activeConfig?.fromName || "B\xFCt\xE7em Pro";
    const fromAddress = `"${senderName}" <${authEmail}>`;
    const replyTo = authEmail;
    if (transporter) {
      const info = await transporter.sendMail({
        from: fromAddress,
        replyTo,
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
  } catch (err) {
    console.error(`[Email Engine] Failed to deliver email to ${options.to}:`, err.message || err);
    let errMsg = err.message || "E-posta g\xF6nderim hatas\u0131";
    if (err.responseCode === 535 || errMsg.includes("535") || errMsg.includes("Username and Password not accepted") || err.code === "EAUTH") {
      errMsg = "Gmail Kimlik Do\u011Frulama Hatas\u0131 (535): Normal \u015Fifreniz yerine Google Hesab\u0131 > G\xFCvenlik > 2 Ad\u0131ml\u0131 Do\u011Frulama > 'Uygulama \u015Eifreleri' b\xF6l\xFCm\xFCnden olu\u015Fturdu\u011Funuz 16 haneli \u015Fifreyi giriniz.";
    }
    return { success: false, error: errMsg, simulated: false };
  }
}
app.post("/api/notifications/email/request-verification", async (req, res) => {
  const { email, user, debts, installmentDebts } = req.body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "L\xFCtfen ge\xE7erli bir e-posta adresi girin." });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const code = Math.floor(1e5 + Math.random() * 9e5).toString();
  const expiresAt = Date.now() + 10 * 60 * 1e3;
  const existing = emailSubscribersMap[normalizedEmail] || {
    email: normalizedEmail,
    verified: false,
    alertOverdue: true,
    alertDueToday: true,
    frequency: "daily_morning",
    minAmountThreshold: 0,
    debts: debts || [],
    installmentDebts: installmentDebts || [],
    user: user || "Kullan\u0131c\u0131",
    createdAt: Date.now()
  };
  emailSubscribersMap[normalizedEmail] = {
    ...existing,
    verificationCode: code,
    codeExpiresAt: expiresAt,
    debts: debts || existing.debts || [],
    installmentDebts: installmentDebts || existing.installmentDebts || [],
    user: user || existing.user || "Kullan\u0131c\u0131"
  };
  saveEmailSubscribersToFile();
  const otpHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; padding: 32px 24px; text-align: center;">
      <div style="font-size: 36px; margin-bottom: 12px;">\u{1F510}</div>
      <h2 style="color: #1e293b; margin: 0 0 12px 0; font-size: 22px; font-weight: 800;">B\xFCt\xE7em Pro Do\u011Frulama Kodu</h2>
      <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
        Gecikmi\u015F bor\xE7 ve \xF6deme hat\u0131rlat\u0131c\u0131 e-posta bildirimlerini aktifle\u015Ftirmek i\xE7in 6 haneli do\u011Frulama kodunuz:
      </p>
      <div style="display: inline-block; background: #f1f5f9; border: 2px dashed #6366f1; border-radius: 14px; padding: 16px 32px; margin-bottom: 24px;">
        <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #4f46e5;">${code}</span>
      </div>
      <p style="color: #64748b; font-size: 13px; margin: 0 0 12px 0;">Bu kod <strong>10 dakika</strong> boyunca ge\xE7erlidir.</p>
      <p style="color: #94a3b8; font-size: 11px; margin: 0; line-height: 1.5;">Not: \u0130letiyi gelen kutunuzda g\xF6remiyorsan\u0131z l\xFCtfen Spam / Tan\u0131t\u0131mlar klas\xF6r\xFCn\xFCz\xFC kontrol ediniz.</p>
    </div>
  `;
  const otpText = `Say\u0131n B\xFCt\xE7em Pro Kullan\u0131c\u0131s\u0131,

E-posta bildirimlerini aktifle\u015Ftirmek i\xE7in 6 haneli do\u011Frulama kodunuz: ${code}

Bu kod 10 dakika boyunca ge\xE7erlidir.

Not: Bu e-posta gelen kutunuzda de\u011Filse l\xFCtfen Spam / Tan\u0131t\u0131mlar klas\xF6r\xFCn\xFCz\xFC kontrol ediniz.

B\xFCt\xE7em Pro Ekibi`;
  try {
    await sendMailHelper({
      to: normalizedEmail,
      subject: `B\xFCt\xE7em Pro Do\u011Frulama Kodunuz: ${code}`,
      html: otpHtml,
      text: otpText
    });
  } catch (mailErr) {
    console.warn("[Email Alert Engine] Background email send handled:", mailErr);
  }
  console.log(`[Email Alert Engine] Verification code for ${normalizedEmail}: [${code}] (Expires in 10 mins)`);
  res.json({
    success: true,
    message: `Do\u011Frulama kodu ${normalizedEmail} adresine iletildi.`,
    expiresInSeconds: 600,
    devCode: code
    // Provided for instant seamless OTP filling in development/preview environments
  });
});
app.post("/api/notifications/email/verify", async (req, res) => {
  const { email, code, debts, installmentDebts, preferences } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "E-posta ve do\u011Frulama kodu zorunludur." });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const subscriber = emailSubscribersMap[normalizedEmail];
  if (!subscriber) {
    return res.status(404).json({ error: "Bu e-posta i\xE7in do\u011Frulama talebi bulunamad\u0131. L\xFCtfen tekrar kod isteyin." });
  }
  if (Date.now() > (subscriber.codeExpiresAt || 0)) {
    return res.status(400).json({ error: "Do\u011Frulama kodunun s\xFCresi dolmu\u015F. L\xFCtfen yeni bir kod isteyin." });
  }
  if (subscriber.verificationCode !== code.trim()) {
    return res.status(400).json({ error: "Girdi\u011Finiz 6 haneli do\u011Frulama kodu hatal\u0131." });
  }
  subscriber.verified = true;
  subscriber.verifiedAt = Date.now();
  subscriber.verificationCode = void 0;
  subscriber.codeExpiresAt = void 0;
  if (preferences) {
    if (typeof preferences.alertOverdue === "boolean") subscriber.alertOverdue = preferences.alertOverdue;
    if (typeof preferences.alertDueToday === "boolean") subscriber.alertDueToday = preferences.alertDueToday;
    if (preferences.frequency) subscriber.frequency = preferences.frequency;
    if (typeof preferences.minAmountThreshold === "number") subscriber.minAmountThreshold = preferences.minAmountThreshold;
  }
  if (debts && Array.isArray(debts)) subscriber.debts = debts;
  if (installmentDebts && Array.isArray(installmentDebts)) subscriber.installmentDebts = installmentDebts;
  const debtAnalysis = analyzeUserDebts(subscriber.debts || [], subscriber.installmentDebts || []);
  console.log(`[Email Alert Engine] Verified email: ${normalizedEmail}. Total active debts: ${debtAnalysis.totalActiveCount}, Total remaining: \u20BA${debtAnalysis.totalActiveDebt}, Overdue: \u20BA${debtAnalysis.totalOverdueAmount}`);
  let welcomeSent = false;
  try {
    const welcomeHtml = generateOverdueEmailHtml(
      normalizedEmail,
      subscriber.user || "B\xFCt\xE7em Pro Kullan\u0131c\u0131s\u0131",
      debtAnalysis,
      false,
      true
    );
    const welcomeText = generateOverdueEmailText(
      normalizedEmail,
      subscriber.user || "B\xFCt\xE7em Pro Kullan\u0131c\u0131s\u0131",
      debtAnalysis,
      false,
      true
    );
    const welcomeResult = await sendMailHelper({
      to: normalizedEmail,
      subject: `B\xFCt\xE7em Pro: E-posta Bildirimleriniz Aktifle\u015Ftirildi (G\xFCncel Bor\xE7 Raporu)`,
      html: welcomeHtml,
      text: welcomeText
    });
    welcomeSent = welcomeResult.success && !welcomeResult.simulated;
    subscriber.lastEmailSentAt = Date.now();
    subscriber.lastSentDebtSummary = `${debtAnalysis.overdueDebts.length} gecikmi\u015F, ${debtAnalysis.dueTodayDebts.length} bug\xFCn vadesi gelen, toplam \u20BA${debtAnalysis.totalActiveDebt} bor\xE7`;
  } catch (confirmMailErr) {
    console.warn("[Email Alert Engine] Welcome confirmation email dispatch warning:", confirmMailErr);
  }
  saveEmailSubscribersToFile();
  res.json({
    success: true,
    welcomeSent,
    message: "E-posta adresiniz gecikmi\u015F bor\xE7 uyar\u0131lar\u0131 i\xE7in ba\u015Far\u0131yla do\u011Fruland\u0131 ve aktifle\u015Ftirildi! \u{1F389}",
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
app.get("/api/auth/verify-premium-email", (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Ge\xE7erli bir e-posta adresi gereklidir.", exists: false, isPremium: false });
  }
  if (email === "info.borcodemetakip@gmail.com") {
    return res.json({
      exists: true,
      isPremium: true
    });
  }
  const subscriber = emailSubscribersMap[email];
  const isSubscriberPremium = subscriber && (subscriber.isPremium === true || subscriber.verified === true);
  return res.json({
    exists: !!subscriber,
    isPremium: !!isSubscriberPremium
  });
});
app.post("/api/notifications/email/send-direct", async (req, res) => {
  try {
    const { recipientEmail, subject, htmlContent } = req.body || {};
    if (!recipientEmail || typeof recipientEmail !== "string" || !recipientEmail.includes("@")) {
      return res.status(400).json({ success: false, error: "Ge\xE7erli bir al\u0131c\u0131 e-posta adresi giriniz." });
    }
    const mailResult = await sendMailHelper({
      to: recipientEmail.trim(),
      subject: subject || `B\xFCt\xE7em Pro: Finansal Rapor ve B\xFCt\xE7e \xD6zeti (${(/* @__PURE__ */ new Date()).toLocaleDateString("tr-TR")})`,
      html: htmlContent || "<p>B\xFCt\xE7em Pro Finansal Raporu</p>"
    });
    if (mailResult.success) {
      return res.json({
        success: true,
        simulated: mailResult.simulated,
        message: mailResult.simulated ? "SMTP sunucusu hen\xFCz yap\u0131land\u0131r\u0131lmad\u0131\u011F\u0131 i\xE7in g\xF6nderim sim\xFCle edildi. Canl\u0131 e-posta g\xF6nderimi i\xE7in Geli\u015Fmi\u015F Bildirim Ayarlar\u0131 b\xF6l\xFCm\xFCnden e-posta/SMTP \u015Fifrenizi tan\u0131mlayabilirsiniz." : "Finansal rapor e-postas\u0131 ba\u015Far\u0131yla al\u0131c\u0131ya g\xF6nderildi! \u{1F680}"
      });
    } else {
      return res.status(500).json({ success: false, error: mailResult.error || "E-posta g\xF6nderilemedi." });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || "E-posta sunucusu hatas\u0131." });
  }
});
app.post("/api/newsletter/subscribe", async (req, res) => {
  try {
    const { email, subject, message } = req.body || {};
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Ge\xE7erli bir e-posta adresi belirtiniz." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const finalSubject = subject || "B\xFCt\xE7em Pro - B\xFClten \xDCyeli\u011Finiz Onayland\u0131! \u{1F389}";
    const finalMessage = message || "Merhaba, B\xFCt\xE7em Pro b\xFCltenine ba\u015Far\u0131yla kay\u0131t oldunuz. Art\u0131k en g\xFCncel finansal ipu\xE7lar\u0131, b\xFCt\xE7e y\xF6netim taktikleri ve yeni uygulama g\xFCncellemeleri an\u0131nda e-posta kutunuza gelecek. Aram\u0131za ho\u015F geldiniz! \u0130yi g\xFCnler dileriz.";
    const htmlCard = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">B\xFCt\xE7em Pro</h1>
          <p style="color: #e0e7ff; margin: 8px 0 0 0; font-size: 13px; font-weight: 500;">Ki\u015Fisel B\xFCt\xE7e ve Bor\xE7 Takip Asistan\u0131n\u0131z</p>
        </div>
        <div style="padding: 32px 28px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 26px;">\u{1F389}</div>
            <h2 style="color: #1e293b; margin: 16px 0 8px 0; font-size: 18px; font-weight: 700;">B\xFClten \xDCyeli\u011Finiz Onayland\u0131!</h2>
            <p style="color: #64748b; font-size: 14px; margin: 0;">${cleanEmail}</p>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; font-size: 14px; line-height: 1.65; color: #334155;">
            ${finalMessage}
          </div>
          <div style="text-align: center; margin-top: 28px;">
            <a href="https://borctakipyonetimi.github.io" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 9999px; font-size: 13px; font-weight: 600; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);">Uygulamaya Git \u2192</a>
          </div>
        </div>
        <div style="background: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Bu e-posta, B\xFCt\xE7em Pro b\xFCltenine kaydoldu\u011Funuz i\xE7in g\xF6nderilmi\u015Ftir. &copy; ${(/* @__PURE__ */ new Date()).getFullYear()} B\xFCt\xE7em Pro. T\xFCm haklar\u0131 sakl\u0131d\u0131r.
        </div>
      </div>
    `;
    const EMAILJS_SERVICE_ID = "service_osnjc54";
    const EMAILJS_TEMPLATE_ID = "template_ydyje4e";
    const EMAILJS_PUBLIC_KEY = "KNh4u8my4-19aJZMn";
    try {
      await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: {
            to_email: cleanEmail,
            subject: finalSubject,
            message: finalMessage
          }
        })
      });
      console.log(`[Newsletter] EmailJS server dispatch succeeded for ${cleanEmail}`);
    } catch (eJsErr) {
      console.warn(`[Newsletter] EmailJS server dispatch error:`, eJsErr?.message || eJsErr);
    }
    const mailResult = await sendMailHelper({
      to: cleanEmail,
      subject: finalSubject,
      text: finalMessage,
      html: htmlCard
    });
    return res.json({
      success: true,
      simulated: mailResult.simulated,
      message: "B\xFClten \xFCyeli\u011Finiz onayland\u0131! Onay e-postas\u0131 ba\u015Far\u0131yla iletildi."
    });
  } catch (err) {
    console.error("[Newsletter Subscribe Error]:", err);
    return res.status(500).json({ success: false, error: err.message || "Sunucu hatas\u0131 olu\u015Ftu." });
  }
});
app.get("/api/notifications/email/status", (req, res) => {
  const email = req.query.email?.trim().toLowerCase();
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
app.post("/api/notifications/email/update-preferences", (req, res) => {
  const { email, preferences, debts, installmentDebts } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !emailSubscribersMap[normalizedEmail]) {
    return res.status(404).json({ error: "Do\u011Frulanm\u0131\u015F e-posta kayd\u0131 bulunamad\u0131." });
  }
  const subscriber = emailSubscribersMap[normalizedEmail];
  if (preferences) {
    if (typeof preferences.alertOverdue === "boolean") subscriber.alertOverdue = preferences.alertOverdue;
    if (typeof preferences.alertDueToday === "boolean") subscriber.alertDueToday = preferences.alertDueToday;
    if (preferences.frequency) subscriber.frequency = preferences.frequency;
    if (typeof preferences.minAmountThreshold === "number") subscriber.minAmountThreshold = preferences.minAmountThreshold;
  }
  if (debts !== void 0 && Array.isArray(debts)) subscriber.debts = debts;
  if (installmentDebts !== void 0 && Array.isArray(installmentDebts)) subscriber.installmentDebts = installmentDebts;
  saveEmailSubscribersToFile();
  res.json({
    success: true,
    message: "E-posta bildirim tercihleriniz g\xFCncellendi.",
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
app.post("/api/notifications/email/remove", (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail && emailSubscribersMap[normalizedEmail]) {
    delete emailSubscribersMap[normalizedEmail];
    saveEmailSubscribersToFile();
    console.log(`[Email Alert Engine] Removed email subscription for: ${normalizedEmail}`);
  }
  res.json({ success: true, message: "E-posta bildirim aboneli\u011Fi ba\u015Far\u0131yla kald\u0131r\u0131ld\u0131." });
});
app.post("/api/notifications/email/send-test", async (req, res) => {
  const { email, debts, installmentDebts, user, analysis: clientAnalysis } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: "E-posta adresi belirtilmedi." });
  }
  const sub = emailSubscribersMap[normalizedEmail];
  const userDebts = debts && Array.isArray(debts) && debts.length > 0 ? debts : sub?.debts || [];
  const userInstDebts = installmentDebts && Array.isArray(installmentDebts) && installmentDebts.length > 0 ? installmentDebts : sub?.installmentDebts || [];
  if (debts && Array.isArray(debts) && sub) sub.debts = debts;
  if (installmentDebts && Array.isArray(installmentDebts) && sub) sub.installmentDebts = installmentDebts;
  if (sub) saveEmailSubscribersToFile();
  const computedAnalysis = analyzeUserDebts(userDebts, userInstDebts);
  const analysis = clientAnalysis && (clientAnalysis.totalActiveCount > 0 || clientAnalysis.overdueCount > 0) ? clientAnalysis : computedAnalysis;
  let reportAnalysis = analysis;
  if (analysis.totalActiveCount === 0) {
    reportAnalysis = {
      ...analysis,
      totalActiveDebt: 19300,
      totalOverdueAmount: 16850,
      totalDueTodayAmount: 2450,
      totalActiveCount: 3,
      overdueDebts: [
        { name: "Garanti Kredi Kart\u0131 Asgari (Test)", remaining: 4850, daysLate: 3, isInstallment: false, dueDateStr: "3 g\xFCn \xF6nce" },
        { name: "Kira / Aidat \xD6demesi (Test)", remaining: 12e3, daysLate: 1, isInstallment: false, dueDateStr: "D\xFCn" }
      ],
      dueTodayDebts: [
        { name: "Buzdolab\u0131 Taksiti (4. Taksit) (Test)", amount: 2450, isInstallment: true }
      ]
    };
  }
  const html = generateOverdueEmailHtml(
    normalizedEmail,
    user || sub?.user || "B\xFCt\xE7em Pro Kullan\u0131c\u0131s\u0131",
    reportAnalysis,
    true,
    false
  );
  const text = generateOverdueEmailText(
    normalizedEmail,
    user || sub?.user || "B\xFCt\xE7em Pro Kullan\u0131c\u0131s\u0131",
    reportAnalysis,
    true,
    false
  );
  const subject = `B\xFCt\xE7em Pro: G\xFCncel Bor\xE7 Raporu ve \xD6deme \xD6zeti (${(/* @__PURE__ */ new Date()).toLocaleDateString("tr-TR")})`;
  const sendResult = await sendMailHelper({
    to: normalizedEmail,
    subject,
    html,
    text
  });
  const hasSmtp = !!(currentCustomSmtp.user && currentCustomSmtp.pass);
  console.log(`[Email Alert Engine] Sent test email to: ${normalizedEmail} (Delivered: ${!sendResult.simulated && sendResult.success}, HasSMTP: ${hasSmtp}, TotalDebt: \u20BA${reportAnalysis.totalActiveDebt})`);
  res.json({
    success: sendResult.success,
    delivered: !sendResult.simulated && sendResult.success,
    simulated: sendResult.simulated,
    smtpConfigured: hasSmtp,
    messageId: sendResult.messageId,
    message: sendResult.simulated ? `Test e-postas\u0131 ${normalizedEmail} adresi i\xE7in sim\xFCle edildi (Aray\xFCzde \xF6nizleme olarak g\xF6r\xFCnt\xFClenebilir). Do\u011Frudan gelen kutunuza anl\u0131k iletim i\xE7in 'SMTP & E-Posta G\xF6nderim Ayarlar\u0131' b\xF6l\xFCm\xFCnden e-posta ve 16 haneli Google Uygulama \u015Eifrenizi kaydedebilirsiniz.` : sendResult.success ? `Test e-postas\u0131 ${normalizedEmail} adresine ba\u015Far\u0131yla g\xF6nderildi! L\xFCtfen gelen kutunuzu (ve Spam / Tan\u0131t\u0131mlar klas\xF6r\xFCn\xFCz\xFC) kontrol edin.` : `E-posta g\xF6nderiminde hata olu\u015Ftu: ${sendResult.error}`,
    htmlPreview: html,
    overdueCount: reportAnalysis.overdueDebts.length,
    dueTodayCount: reportAnalysis.dueTodayDebts.length,
    totalOverdueAmount: reportAnalysis.totalOverdueAmount,
    totalActiveDebt: reportAnalysis.totalActiveDebt,
    totalActiveCount: reportAnalysis.totalActiveCount
  });
});
app.post("/api/notifications/email/test-smtp-connection", async (req, res) => {
  const { host, port, user, pass, secure } = req.body;
  const result = await testSmtpCredentials({ host, port, user, pass, secure });
  res.json(result);
});
app.post("/api/notifications/email/save-smtp-config", async (req, res) => {
  const { host, port, user, pass, secure, fromName } = req.body;
  if (!user || !pass) {
    return res.status(400).json({ success: false, message: "Kullan\u0131c\u0131 ad\u0131/e-posta ve \u015Fifre zorunludur." });
  }
  const cleanU = cleanCredential(user);
  const cleanP = cleanCredential(pass).replace(/\s+/g, "");
  const cleanH = cleanHost(host || (cleanU.includes("@gmail.com") ? "smtp.gmail.com" : ""));
  const cleanPort = Number(port) || (cleanH === "smtp.gmail.com" ? 465 : 587);
  const isSecure = secure ?? cleanPort === 465;
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
  currentCustomSmtp = {
    host: cleanH,
    port: cleanPort,
    user: cleanU,
    pass: cleanP,
    secure: isSecure,
    fromName: fromName || "B\xFCt\xE7em Pro",
    updatedAt: Date.now()
  };
  saveCustomSmtpToFile();
  console.log(`[SMTP Engine] Custom SMTP configuration updated for ${cleanU} on ${cleanH}:${cleanPort}`);
  res.json({
    success: true,
    message: `\u2705 SMTP ayarlar\u0131 ba\u015Far\u0131yla kaydedildi ve do\u011Fruland\u0131 (${cleanH}:${cleanPort})! Art\u0131k t\xFCm e-postalar bu adres \xFCzerinden canl\u0131 iletilecektir.`,
    smtpConfigured: true,
    user: cleanU,
    host: cleanH,
    port: cleanPort
  });
});
app.post("/api/notifications/email/reset-smtp-config", (req, res) => {
  currentCustomSmtp = {};
  if (import_fs.default.existsSync(SMTP_CONFIG_FILE)) {
    try {
      import_fs.default.unlinkSync(SMTP_CONFIG_FILE);
    } catch (e) {
    }
  }
  console.log("[SMTP Engine] Custom SMTP configuration reset.");
  res.json({ success: true, message: "\xD6zel SMTP ayarlar\u0131 s\u0131f\u0131rland\u0131." });
});
app.get("/api/notifications/email/smtp-status", (req, res) => {
  const hasCustom = !!(currentCustomSmtp.user && currentCustomSmtp.pass);
  const activeUser = currentCustomSmtp.user || "";
  const activeHost = currentCustomSmtp.host || (activeUser.includes("@gmail.com") ? "smtp.gmail.com" : "");
  const activePort = currentCustomSmtp.port || (activeHost === "smtp.gmail.com" ? 465 : 587);
  let maskedUser = "";
  if (activeUser.includes("@")) {
    const [name, domain] = activeUser.split("@");
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}*`;
    maskedUser = `${maskedName}@${domain}`;
  } else if (activeUser) {
    maskedUser = `${activeUser.substring(0, 2)}***`;
  }
  res.json({
    configured: hasCustom,
    source: hasCustom ? "in_app" : "none",
    host: activeHost || null,
    port: activePort,
    user: maskedUser || null,
    rawUser: activeUser || null,
    fromName: currentCustomSmtp.fromName || "B\xFCt\xE7em Pro"
  });
});
app.post("/api/notifications/email/send-alert", async (req, res) => {
  const { email, debts, installmentDebts, user, analysis: clientAnalysis, isWelcome } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: "E-posta adresi belirtilmedi." });
  }
  const sub = emailSubscribersMap[normalizedEmail];
  const userDebts = debts && Array.isArray(debts) ? debts : sub?.debts || [];
  const userInstDebts = installmentDebts && Array.isArray(installmentDebts) ? installmentDebts : sub?.installmentDebts || [];
  const computedAnalysis = analyzeUserDebts(userDebts, userInstDebts);
  const analysis = clientAnalysis || computedAnalysis;
  const html = generateOverdueEmailHtml(
    normalizedEmail,
    user || sub?.user || "B\xFCt\xE7em Pro Kullan\u0131c\u0131s\u0131",
    analysis,
    false,
    !!isWelcome
  );
  const text = generateOverdueEmailText(
    normalizedEmail,
    user || sub?.user || "B\xFCt\xE7em Pro Kullan\u0131c\u0131s\u0131",
    analysis,
    false,
    !!isWelcome
  );
  const subject = isWelcome ? `B\xFCt\xE7em Pro: E-posta Bildirimleriniz Aktifle\u015Ftirildi \u{1F389}` : analysis?.overdueCount > 0 ? `\u{1F6A8} Acil Bor\xE7 Hat\u0131rlatmas\u0131: ${analysis.overdueCount} Adet Gecikmi\u015F \xD6demeniz Bulunuyor!` : `\u{1F4C5} G\xFCnl\xFCk Bor\xE7 ve \xD6deme \xD6zeti: Bug\xFCn ${analysis?.dueTodayCount || 0} Adet \xD6demeniz Var`;
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
    messageId: sendResult.messageId
  });
});
setInterval(async () => {
  try {
    const nowTime = Date.now();
    let hasChanges = false;
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1e3;
    for (const [emailKey, sub] of Object.entries(emailSubscribersMap)) {
      if (!sub.verified || !sub.alertOverdue && !sub.alertDueToday) continue;
      const lastSent = sub.lastEmailSentAt || 0;
      if (nowTime - lastSent > TWELVE_HOURS_MS) {
        const subDebts = sub.debts || [];
        const subInstDebts = sub.installmentDebts || [];
        const analysis = analyzeUserDebts(subDebts, subInstDebts);
        const { overdueDebts, dueTodayDebts } = analysis;
        const qualifyingOverdue = overdueDebts.filter((d) => d.remaining >= (sub.minAmountThreshold || 0));
        const qualifyingDueToday = dueTodayDebts.filter((d) => d.amount >= (sub.minAmountThreshold || 0));
        if (sub.alertOverdue && qualifyingOverdue.length > 0 || sub.alertDueToday && qualifyingDueToday.length > 0) {
          console.log(`[Email Alert Engine] Automated background overdue alert triggered for verified subscriber: ${sub.email}`);
          const filteredAnalysis = {
            ...analysis,
            overdueDebts: qualifyingOverdue,
            dueTodayDebts: qualifyingDueToday,
            totalOverdueAmount: qualifyingOverdue.reduce((s, d) => s + (Number(d.remaining) || 0), 0),
            totalDueTodayAmount: qualifyingDueToday.reduce((s, d) => s + (Number(d.amount) || 0), 0)
          };
          const html = generateOverdueEmailHtml(
            sub.email,
            sub.user || "B\xFCt\xE7em Pro Kullan\u0131c\u0131s\u0131",
            filteredAnalysis,
            false,
            false
          );
          const text = generateOverdueEmailText(
            sub.email,
            sub.user || "B\xFCt\xE7em Pro Kullan\u0131c\u0131s\u0131",
            filteredAnalysis,
            false,
            false
          );
          const subject = `${qualifyingOverdue.length > 0 ? `B\xFCt\xE7em Pro: ${qualifyingOverdue.length} Adet Gecikmi\u015F Bor\xE7 Bildirimi` : "B\xFCt\xE7em Pro: Bug\xFCn Vadesi Dolan \xD6deme Hat\u0131rlatmas\u0131"}`;
          await sendMailHelper({
            to: sub.email,
            subject,
            html,
            text
          });
          sub.lastEmailSentAt = nowTime;
          sub.lastSentDebtSummary = `${qualifyingOverdue.length} gecikmi\u015F, ${qualifyingDueToday.length} bug\xFCn vadesi gelen (Toplam Kalan: \u20BA${analysis.totalActiveDebt})`;
          saveEmailSubscribersToFile();
        }
      }
    }
    for (const [endpointHash, details] of Object.entries(subscriptionsMap)) {
      if (!details || !details.subscription) continue;
      if (details.alarms && details.alarms.length > 0) {
        const remainingAlarms = [];
        const triggeredAlarms = [];
        details.alarms.forEach((alarm) => {
          if (!alarm) return;
          let alarmTime = NaN;
          if (alarm.timestamp) {
            alarmTime = Number(alarm.timestamp);
          } else if (alarm.date) {
            try {
              alarmTime = new Date(alarm.date).getTime();
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
            if (nowTime - alarmTime < 24 * 60 * 60 * 1e3) {
              triggeredAlarms.push(alarm);
            }
          } else {
            remainingAlarms.push(alarm);
          }
        });
        if (triggeredAlarms.length > 0) {
          hasChanges = true;
          details.alarms = remainingAlarms;
          for (const alarm of triggeredAlarms) {
            const alarmTitle = alarm.title || "\xD6deme / Bor\xE7 Hat\u0131rlatmas\u0131";
            const payload = JSON.stringify({
              title: "B\xFCt\xE7em Pro: \xD6deme Vakti Geldi! \u23F0",
              body: `${alarmTitle} - Hat\u0131rlat\u0131c\u0131 zaman\u0131 geldi!`,
              alarmId: alarm.id,
              type: "alarm",
              tag: `alarm-${alarm.id || Date.now()}`,
              action: "alarm-trigger",
              syncTag: "server-cron-sync",
              icon: "/logo.png",
              badge: "/logo.png",
              vibrate: [500, 150, 500, 150, 450, 150, 600],
              requireInteraction: true,
              silent: false,
              url: "/?tab=notifications"
            });
            console.log(`[Push Server] Sending high-urgency background alarm push for "${alarmTitle}" to user "${details.user}"`);
            try {
              await import_web_push.default.sendNotification(details.subscription, payload, {
                headers: {
                  "Urgency": "high",
                  "Topic": `alarm-${alarm.id || "alert"}`
                },
                TTL: 86400
                // 24 hours so FCM/Apple holds it if phone was asleep/turned off!
              });
              console.log(`[Push Server] Successfully sent lockscreen push notification for alarm: "${alarmTitle}"`);
            } catch (pushErr) {
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
      const SIX_HOURS_MS = 6 * 60 * 60 * 1e3;
      const lastOverdueTime = details.lastOverduePushTime || 0;
      const hasDebts = details.debts && details.debts.length > 0 || details.installmentDebts && details.installmentDebts.length > 0;
      if (hasDebts && nowTime - lastOverdueTime > SIX_HOURS_MS) {
        const { overdueDebts, dueTodayDebts } = analyzeUserDebts(details.debts || [], details.installmentDebts || []);
        if (overdueDebts.length > 0 || dueTodayDebts.length > 0) {
          let title = "B\xFCt\xE7em Pro: Bor\xE7 Hat\u0131rlatmas\u0131 \u23F0";
          let body = "";
          if (overdueDebts.length > 0) {
            const totalOverdue = overdueDebts.reduce((sum, d) => sum + d.remaining, 0);
            const topDebt = overdueDebts[0];
            title = `\u26A0\uFE0F Gecikmi\u015F Bor\xE7 Uyar\u0131s\u0131 (${overdueDebts.length} Adet)`;
            body = `\xD6demesi ge\xE7en borcunuz var: "${topDebt.name}" (\u20BA${topDebt.remaining.toLocaleString("tr-TR")}, ${topDebt.daysLate} g\xFCn gecikti). Toplam: \u20BA${totalOverdue.toLocaleString("tr-TR")}.`;
          } else if (dueTodayDebts.length > 0) {
            const totalDue = dueTodayDebts.reduce((sum, d) => sum + d.amount, 0);
            const topDebt = dueTodayDebts[0];
            title = `\u{1F6A8} Bug\xFCn Vadesi Gelen \xD6demeniz Var!`;
            body = `"${topDebt.name}" i\xE7in \u20BA${topDebt.amount.toLocaleString("tr-TR")} tutar\u0131ndaki \xF6demenizin vadesi bug\xFCn!`;
          }
          const payload = JSON.stringify({
            title,
            body,
            tag: "overdue-periodic-" + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
            action: "trigger-sync",
            syncTag: "server-cron-sync",
            icon: "/logo.png",
            badge: "/logo.png",
            url: "/?tab=debts"
          });
          try {
            console.log(`[Push Server] Sending periodic background overdue reminder to user: "${details.user}"`);
            await import_web_push.default.sendNotification(details.subscription, payload, {
              headers: { "Urgency": "high" },
              TTL: 86400
            });
            details.lastOverduePushTime = nowTime;
            hasChanges = true;
          } catch (pushErr) {
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
}, 1e4);
app.use((err, _req, res, _next) => {
  console.error("[Express Global Error Handler]:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Sunucu hatas\u0131 engellendi", message: err?.message || "Bilinmeyen hata" });
  }
});
var serveStaticPlainTextFile = (fileName, defaultContent, contentType = "text/plain; charset=utf-8") => {
  return (_req, res) => {
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const possibleFiles = [
      import_path.default.join(process.cwd(), "public", fileName),
      import_path.default.join(process.cwd(), "dist", fileName),
      import_path.default.join(process.cwd(), fileName)
    ];
    for (const fp of possibleFiles) {
      if (import_fs.default.existsSync(fp)) {
        try {
          const content = import_fs.default.readFileSync(fp, "utf-8");
          return res.status(200).send(content);
        } catch {
        }
      }
    }
    return res.status(200).send(defaultContent);
  };
};
app.get("/ads.txt", serveStaticPlainTextFile("ads.txt", "google.com, pub-4449700232321088, DIRECT, f08c47fec0942fa0\n"));
app.get("/app-ads.txt", serveStaticPlainTextFile("app-ads.txt", "google.com, pub-4449700232321088, DIRECT, f08c47fec0942fa0\n"));
app.get("/robots.txt", serveStaticPlainTextFile("robots.txt", "User-agent: *\nAllow: /\n\nUser-agent: Mediapartners-Google\nAllow: /\n\nUser-agent: Googlebot\nAllow: /\n\nSitemap: https://borctakipyonetimi.github.io/sitemap.xml\n"));
app.get("/sitemap.xml", serveStaticPlainTextFile("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://borctakipyonetimi.github.io/</loc><priority>1.0</priority></url>\n</urlset>', "application/xml; charset=utf-8"));
app.get(privacyPaths, (req, res) => {
  const possibleFiles = [
    import_path.default.join(process.cwd(), "dist", "privacy-policy.html"),
    import_path.default.join(process.cwd(), "public", "privacy-policy.html"),
    import_path.default.join(process.cwd(), "privacy-policy.html")
  ];
  for (const fp of possibleFiles) {
    if (import_fs.default.existsSync(fp)) {
      return res.sendFile(fp);
    }
  }
  res.status(404).send("Gizlilik politikas\u0131 dosyas\u0131 bulunamad\u0131. L\xFCtfen /public/privacy-policy.html dosyas\u0131n\u0131n varl\u0131\u011F\u0131ndan emin olun.");
});
app.use("/api/*", (req, res) => {
  res.status(404).json({ success: false, error: `API u\xE7 noktas\u0131 bulunamad\u0131: ${req.originalUrl}` });
});
app.use((err, req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith("/api")) {
    console.error("[API Error Handler]:", err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || "Sunucuda beklenmeyen bir API hatas\u0131 olu\u015Ftu."
    });
  }
  next(err);
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
