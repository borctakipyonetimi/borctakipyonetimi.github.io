/**
 * Bütçem Pro - Aylık Finansal Faaliyet Raporu E-posta Şablonu
 * Modern kart mimarisine sahip Premium HTML e-posta tasarımı.
 */

function formatNumberTR(val) {
  if (val === null || val === undefined) return "0,00";
  if (typeof val === "string") {
    val = val.replace(/[₺TL\s]/g, "").trim();
  }
  const num = Number(val) || 0;
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

const MONTHLY_REPORT_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aylık Finansal Rapor</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; background-color: #111827; padding: 32px 24px; border-radius: 16px; border: 1px solid #1f2937; }
    .brand { text-align: center; margin-bottom: 24px; }
    .brand-title { font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .brand-badge { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; margin-left: 8px; vertical-align: middle; }
    .period-title { font-size: 14px; text-align: center; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 28px; }
    
    .greeting-card { background: #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #6366f1; }
    .greeting-title { font-size: 18px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0; }
    .greeting-text { font-size: 14px; color: #9ca3af; margin: 0; line-height: 1.5; }

    .grid-2 { width: 100%; border-collapse: separate; border-spacing: 12px; margin: -12px -12px 12px -12px; }
    .stat-card { background: #1f2937; border-radius: 12px; padding: 18px; border: 1px solid #374151; }
    .stat-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .stat-value { font-size: 22px; font-weight: 700; margin: 0; }

    .income .stat-label { color: #10b981; }
    .income .stat-value { color: #34d399; }
    .expense .stat-label { color: #f43f5e; }
    .expense .stat-value { color: #fb7185; }

    .full-card { background: #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #374151; }
    .full-card .stat-label { color: #3b82f6; }
    .full-card .stat-value { color: #60a5fa; }

    .status-card { border-radius: 12px; padding: 22px; text-align: center; margin-bottom: 24px; }
    .status-positive { background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; }
    .status-positive .status-title { color: #34d399; }
    .status-negative { background: rgba(244, 63, 94, 0.1); border: 1px solid #f43f5e; }
    .status-negative .status-title { color: #fb7185; }

    .status-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
    .status-value { font-size: 28px; font-weight: 800; color: #ffffff; margin-bottom: 8px; }
    .status-desc { font-size: 13px; color: #d1d5db; margin: 0; }

    .tip-card { background: #1e1b4b; border-radius: 12px; padding: 16px; border: 1px solid #4338ca; }
    .tip-title { font-size: 13px; font-weight: 600; color: #a5b4fc; margin-bottom: 4px; }
    .tip-text { font-size: 13px; color: #c7d2fe; margin: 0; line-height: 1.4; }

    .footer { text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid #1f2937; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div style="padding: 20px 10px;">
    <div class="container">
      
      <!-- Brand & Header -->
      <div class="brand">
        <span class="brand-title">Bütçem<span class="brand-badge">PRO</span></span>
      </div>
      <div class="period-title">📅 {{RAPOR_DONEMI}} Finansal Özeti</div>

      <!-- User Greeting -->
      <div class="greeting-card">
        <h2 class="greeting-title">Merhaba {{KULLANICI_ADI}} 👋</h2>
        <p class="greeting-text">{{RAPOR_DONEMI}} dönemine ait tüm gelir, gider ve ödediğiniz borç kayıtlarınız analiz edilerek aşağıda özetlenmiştir.</p>
      </div>

      <!-- Stats Grid -->
      <table class="grid-2" width="100%">
        <tr>
          <td width="50%" class="stat-card income">
            <div class="stat-label">🟢 Toplam Gelir</div>
            <div class="stat-value">₺{{TOPLAM_GELIR}}</div>
          </td>
          <td width="50%" class="stat-card expense">
            <div class="stat-label">🔴 Toplam Gider</div>
            <div class="stat-value">₺{{TOPLAM_GIDER}}</div>
          </td>
        </tr>
      </table>

      <!-- Debt Card -->
      <div class="full-card">
        <div class="stat-label">💳 Ödenen Borç & Taksitler</div>
        <div class="stat-value">₺{{ODENEN_BORC}}</div>
      </div>

      <!-- Net Balance Status -->
      <!-- Pozitif Durum için status-positive, Negatif Durum için status-negative sınıfını kullanın -->
      <div class="status-card {{BAKIYE_DURUM_SINIFI}}">
        <div class="status-title">{{BAKIYE_DURUM_BASLIK}}</div>
        <div class="status-value">₺{{NET_BAKIYE}}</div>
        <p class="status-desc">{{BAKIYE_DURUM_ACIKLAMA}}</p>
      </div>

      <!-- AI / Smart Tip -->
      <div class="tip-card">
        <div class="tip-title">💡 Yeni Ay İçin İpucu</div>
        <div class="tip-text">Bütçem Pro uygulamasından yaklaşan taksitlerinize hatırlatıcı kurarak gecikme maliyetlerini sıfırlayabilirsiniz.</div>
      </div>

      <!-- Footer -->
      <div class="footer">
        Bu e-posta Bütçem Pro Premium üyelerine özel otomatik olarak üretilmiştir.<br>
        © 2026 Bütçem Pro. Tüm hakları saklıdır.
      </div>

    </div>
  </div>
</body>
</html>`;

/**
 * Dinamik değişkenleri doldurarak HTML e-posta gövdesini oluşturur
 */
function generateMonthlyReportEmail({
  user_name = "Değerli Kullanıcımız",
  report_month = "Ekim 2026",
  total_income = 0,
  total_expense = 0,
  paid_debts = 0,
  net_balance = 0
}) {
  const numNetBalance = typeof net_balance === "number" ? net_balance : (parseFloat(String(net_balance).replace(/[^0-9.-]+/g, "")) || 0);
  const isPositive = numNetBalance >= 0;

  const raporDonemi = report_month || "Ekim 2026";
  const kullaniciAdi = (user_name && user_name.trim()) ? user_name.trim() : "Değerli Kullanıcımız";
  const toplamGelir = formatNumberTR(total_income);
  const toplamGider = formatNumberTR(total_expense);
  const odenenBorc = formatNumberTR(paid_debts);

  const bakiyeDurumSinifi = isPositive ? "status-positive" : "status-negative";
  const bakiyeDurumBaslik = isPositive ? "Net Kalan Rezerve" : "Dönem Bakiyesi (Açık)";
  const bakiyeDurumAciklama = isPositive
    ? "Tebrikler! Gelirleriniz harcama ve borç ödemelerinizin üzerinde gerçekleşti."
    : "Bu dönem harcama ve borç ödemeleriniz gelirlerinizi aştı. Yeni ayda harcama planı yapmanız önerilir.";

  let html = MONTHLY_REPORT_HTML_TEMPLATE;
  html = html.replace(/\{\{RAPOR_DONEMI\}\}/g, raporDonemi);
  html = html.replace(/\{\{KULLANICI_ADI\}\}/g, kullaniciAdi);
  html = html.replace(/\{\{TOPLAM_GELIR\}\}/g, toplamGelir);
  html = html.replace(/\{\{TOPLAM_GIDER\}\}/g, toplamGider);
  html = html.replace(/\{\{ODENEN_BORC\}\}/g, odenenBorc);

  if (numNetBalance < 0) {
    html = html.replace("₺{{NET_BAKIYE}}", `-₺${formatNumberTR(Math.abs(numNetBalance))}`);
    html = html.replace(/\{\{NET_BAKIYE\}\}/g, `-${formatNumberTR(Math.abs(numNetBalance))}`);
  } else {
    html = html.replace(/\{\{NET_BAKIYE\}\}/g, formatNumberTR(numNetBalance));
  }

  html = html.replace(/\{\{BAKIYE_DURUM_SINIFI\}\}/g, bakiyeDurumSinifi);
  html = html.replace(/\{\{BAKIYE_DURUM_BASLIK\}\}/g, bakiyeDurumBaslik);
  html = html.replace(/\{\{BAKIYE_DURUM_ACIKLAMA\}\}/g, bakiyeDurumAciklama);

  return html;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateMonthlyReportEmail, MONTHLY_REPORT_HTML_TEMPLATE };
  module.exports.default = generateMonthlyReportEmail;
}
export { generateMonthlyReportEmail, MONTHLY_REPORT_HTML_TEMPLATE };
export default generateMonthlyReportEmail;
