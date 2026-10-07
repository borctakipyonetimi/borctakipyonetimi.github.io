/**
 * Bütçem Pro - Aylık Finansal Faaliyet Raporu E-posta Şablonu
 * Koyu temalı (Dark Mode), Indigo/Purple marka paletine uygun, modern HTML e-posta şablonu.
 *
 * @param {Object} params
 * @param {string} params.user_name - Kullanıcı adı veya hitap
 * @param {string} params.report_month - Raporun ait olduğu ay (Örn: "Eylül 2026", "Ekim 2026")
 * @param {number|string} params.total_income - İlgili aydaki toplam gelir
 * @param {number|string} params.total_expense - İlgili aydaki toplam harcama / gider
 * @param {number|string} params.paid_debts - İlgili ayda kapatılan / ödenen borç ve taksitler
 * @param {number|string} params.net_balance - Net kalan bakiye (Gelir - Gider - Ödenen Borç)
 * @returns {string} - Dinamik ve uyumlu HTML e-posta gövdesi
 */
function generateMonthlyReportEmail({
  user_name = "Değerli Kullanıcımız",
  report_month = "Geçtiğimiz Ay",
  total_income = 0,
  total_expense = 0,
  paid_debts = 0,
  net_balance = 0,
  app_url = "https://ais-pre-sta4ngj4pjhcez5qwcqjac-200839682182.europe-west2.run.app",
  firestore_diagnostic = null
}) {
  // Para birimi formatlama yardımcısı
  const formatCurrency = (val) => {
    if (typeof val === "string" && (val.includes("₺") || val.includes("TL"))) {
      return val;
    }
    const num = Number(val) || 0;
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const numNetBalance = typeof net_balance === "number" ? net_balance : (parseFloat(String(net_balance).replace(/[^0-9.-]+/g, "")) || 0);
  const isPositiveBalance = numNetBalance >= 0;

  const formattedIncome = formatCurrency(total_income);
  const formattedExpense = formatCurrency(total_expense);
  const formattedPaidDebts = formatCurrency(paid_debts);
  const formattedNetBalance = formatCurrency(net_balance);

  const cleanUserName = (user_name && user_name.trim()) ? user_name.trim() : "Değerli Kullanıcımız";

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bütçem Pro - ${report_month} Finansal Raporu</title>
  <style>
    /* Reset & Temel Uyumluluk */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .container-table { width: 100% !important; padding: 12px !important; }
      .grid-card { width: 100% !important; display: block !important; margin-bottom: 12px !important; }
      .kpi-table { width: 100% !important; }
      .header-title { font-size: 20px !important; }
      .balance-amount { font-size: 26px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Dış Arka Plan Sarmalayıcı -->
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #090d16; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Ana Konteyner Tablosu (Maksimum 600px) -->
        <table class="container-table" width="600" border="0" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background-color: #0f172a; border-radius: 24px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          
          <!-- Üst Degrade Işık Çizgisi (Indigo/Purple) -->
          <tr>
            <td style="height: 5px; background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%); line-height: 5px; font-size: 1px;">&nbsp;</td>
          </tr>

          <!-- Başlık ve Logo Bölümü -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <!-- Rozet -->
                    <table border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
                      <tr>
                        <td style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 9999px; padding: 6px 16px; text-align: center;">
                          <span style="color: #a5b4fc; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
                            ✨ PREMIUM AYLIK HESAP ÖZETİ
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- Marka & Başlık -->
                    <h1 class="header-title" style="margin: 0 0 8px 0; color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">
                      Bütçem <span style="background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: #818cf8; color: #818cf8;">Pro</span>
                    </h1>
                    <div style="font-size: 13px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">
                      📅 ${report_month} Finansal Faaliyet Raporu
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Kişiselleştirilmiş Karşılama -->
          <tr>
            <td style="padding: 0 36px 24px 36px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 18px 20px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #f8fafc;">
                      Merhaba ${cleanUserName}, 👋
                    </p>
                    <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #94a3b8;">
                      <strong style="color: #cbd5e1;">${report_month}</strong> döneminde gerçekleştirdiğiniz tüm nakit akışınız, harcamalarınız ve ödediğiniz borç kayıtlarınız analiz edilerek aşağıda özetlenmiştir.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
${firestore_diagnostic ? `
          <!-- Sistem & Firebase Teşhis Bildirimi -->
          <tr>
            <td style="padding: 0 36px 20px 36px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 14px; padding: 14px 18px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 800; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                      ⚠️ Sistem Teşhis Notu: Firebase Yetkilendirme / Erişim
                    </div>
                    <div style="font-size: 12px; color: #e2e8f0; line-height: 1.5;">
                      <strong>Kullanılan Proje:</strong> ${typeof firestore_diagnostic === 'object' ? (firestore_diagnostic.projectId || 'Bilinmiyor') : 'Bilinmiyor'}<br/>
                      <strong>Hata Durumu:</strong> ${typeof firestore_diagnostic === 'object' ? (firestore_diagnostic.error || 'Erişim Kısıtlı') : firestore_diagnostic}<br/>
                      <span style="color: #cbd5e1; font-size: 11px;">${typeof firestore_diagnostic === 'object' && firestore_diagnostic.notice ? firestore_diagnostic.notice : 'Canlı Firestore verilerine erişilemediği için bu test raporu örnek finansal verilerle üretilmiş ve e-posta motoru başarıyla test edilmiştir.'}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
` : ''}
          <!-- Özet Kartlar (KPI Grid) -->
          <tr>
            <td style="padding: 0 36px 12px 36px;">
              <table class="kpi-table" width="100%" border="0" cellspacing="0" cellpadding="0">
                <!-- 1. Satır: Gelir ve Gider -->
                <tr>
                  <td width="48%" style="padding-bottom: 12px; vertical-align: top;">
                    <!-- Toplam Gelir Kartı -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 16px 18px;">
                      <tr>
                        <td>
                          <div style="font-size: 11px; font-weight: 800; color: #6ee7b7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                            🟢 TOPLAM GELİR
                          </div>
                          <div style="font-size: 18px; font-weight: 900; color: #34d399; font-family: 'Courier New', Courier, monospace;">
                            ${formattedIncome}
                          </div>
                          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
                            Maaş ve düzenli kazançlar
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="4%">&nbsp;</td>
                  <td width="48%" style="padding-bottom: 12px; vertical-align: top;">
                    <!-- Toplam Gider Kartı -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 16px; padding: 16px 18px;">
                      <tr>
                        <td>
                          <div style="font-size: 11px; font-weight: 800; color: #fda4af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                            🔴 TOPLAM GİDER
                          </div>
                          <div style="font-size: 18px; font-weight: 900; color: #fb7185; font-family: 'Courier New', Courier, monospace;">
                            ${formattedExpense}
                          </div>
                          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
                            Aylık harcama toplamı
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- 2. Satır: Ödenen Borçlar & Taksitler -->
                <tr>
                  <td colspan="3" style="padding-bottom: 12px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.3); border-radius: 16px; padding: 16px 20px;">
                      <tr>
                        <td>
                          <div style="font-size: 11px; font-weight: 800; color: #7dd3fc; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                            💳 ÖDENEN BORÇ & TAKSİTLER
                          </div>
                          <div style="font-size: 20px; font-weight: 900; color: #38bdf8; font-family: 'Courier New', Courier, monospace;">
                            ${formattedPaidDebts}
                          </div>
                          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
                            Bu ay başarıyla kapatılan borç ve taksit tutarı
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Vurgulu Net Bakiye Kartı (Hero KPI) -->
          <tr>
            <td style="padding: 0 36px 28px 36px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: ${isPositiveBalance ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)' : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(249, 115, 22, 0.15) 100%)'}; border: 2px solid ${isPositiveBalance ? '#10b981' : '#ef4444'}; border-radius: 20px; padding: 22px 24px; text-align: center;">
                <tr>
                  <td align="center">
                    <span style="font-size: 11px; font-weight: 900; color: ${isPositiveBalance ? '#6ee7b7' : '#fca5a5'}; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">
                      ${isPositiveBalance ? '⭐ NET KALAN REZERV' : '⚠️ DÖNEM BAKİYESİ (AÇIK)'}
                    </span>
                    <div class="balance-amount" style="font-size: 32px; font-weight: 900; color: #ffffff; font-family: 'Courier New', Courier, monospace; letter-spacing: -0.5px; margin-bottom: 8px;">
                      ${formattedNetBalance}
                    </div>
                    <p style="margin: 0; font-size: 12px; color: #cbd5e1; line-height: 1.5;">
                      ${isPositiveBalance 
                        ? 'Tebrikler! Gelirleriniz harcama ve borç ödemelerinizin üzerinde gerçekleşti.' 
                        : 'Bu dönem harcama ve borç ödemeleriniz gelirlerinizi aştı. Yeni ayda harcama planı yapmanız önerilir.'}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Akıllı Tavsiye Kutusu -->
          <tr>
            <td style="padding: 0 36px 28px 36px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: #131d33; border-left: 4px solid #8b5cf6; border-radius: 12px; padding: 14px 18px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 800; color: #c4b5fd;">
                      💡 Yeni Ay İçin Tasarruf İpucu
                    </p>
                    <p style="margin: 0; font-size: 11.5px; color: #94a3b8; line-height: 1.5;">
                      Bütçem Pro menüsünden yaklaşan taksitlerinizi inceleyin ve vadesi gelen borçlar için hatırlatıcı kurarak gecikme maliyetlerini sıfırlayın.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Aksiyon Butonu (CTA) -->
          <tr>
            <td align="center" style="padding: 0 36px 36px 36px;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius: 14px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
                    <a href="${app_url}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 800; color: #ffffff; text-decoration: none; border-radius: 14px; letter-spacing: 0.3px;">
                      Bütçem Pro'yu Aç ve İncele ➔
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alt Bilgi (Footer) -->
          <tr>
            <td style="background-color: #0b1120; border-top: 1px solid #1e293b; padding: 24px 36px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #64748b;">
                Bütçem Pro — Akıllı Bireysel Bütçe ve Borç Yönetimi
              </p>
              <p style="margin: 0 0 6px 0; font-size: 10px; color: #475569; line-height: 1.5;">
                Bu e-posta, Bütçem Pro Premium üyeliğiniz kapsamında her ayın başında otomatik olarak gönderilir.
              </p>
              <p style="margin: 0; font-size: 10px; color: #334155;">
                © ${new Date().getFullYear()} Bütçem Pro. Tüm hakları saklıdır.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// CommonJS ve ES Modules ortak dışa aktarımı
if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateMonthlyReportEmail };
  module.exports.default = generateMonthlyReportEmail;
}
export { generateMonthlyReportEmail };
export default generateMonthlyReportEmail;
