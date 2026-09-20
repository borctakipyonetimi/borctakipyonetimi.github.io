/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AnalyzedDebtItem {
  name: string;
  remaining: number;
  daysLate?: number;
  daysLeft?: number;
  isInstallment: boolean;
  dueDateStr: string;
  status?: string;
  category?: string;
}

export interface DebtAnalysisResult {
  overdueDebts: AnalyzedDebtItem[];
  dueTodayDebts: AnalyzedDebtItem[];
  upcomingDebts: AnalyzedDebtItem[];
  otherActiveDebts: AnalyzedDebtItem[];
  allActiveDebts: AnalyzedDebtItem[];
  totalActiveDebt: number;
  totalOverdueAmount: number;
  totalDueTodayAmount: number;
  overdueCount: number;
  dueTodayCount: number;
  totalActiveCount: number;
}

/**
 * Robust date parser supporting YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, and ISO strings
 */
export function parseDateRobust(dateStr: any): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  if (typeof dateStr === "number") {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(dateStr).trim();
  if (!str) return null;

  // 1. ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(str)) {
    const parts = str.split(/[-/.T ]/);
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const date = new Date(y, m, d);
    return isNaN(date.getTime()) ? null : date;
  }

  // 2. Turkish / European format: DD.MM.YYYY or DD/MM/YYYY
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{4}/.test(str)) {
    const parts = str.split(/[./-]/);
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    const date = new Date(y, m, d);
    return isNaN(date.getTime()) ? null : date;
  }

  // 3. Fallback standard parse
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Robust, client-side & server-side consistent debt analyzer.
 * Correctly calculates remaining balances, due dates, overdue counts,
 * and handles all naming variations (title, name, creditor, description, person).
 */
export function analyzeDebtsComprehensive(
  rawDebts: any[] = [],
  rawInstallments: any[] = []
): DebtAnalysisResult {
  const overdueDebts: AnalyzedDebtItem[] = [];
  const dueTodayDebts: AnalyzedDebtItem[] = [];
  const upcomingDebts: AnalyzedDebtItem[] = [];
  const otherActiveDebts: AnalyzedDebtItem[] = [];
  const allActiveDebts: AnalyzedDebtItem[] = [];

  let totalActiveDebt = 0;
  let totalOverdueAmount = 0;
  let totalDueTodayAmount = 0;
  let totalActiveCount = 0;

  const now = new Date();
  const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // 1. Standard single debts
  if (Array.isArray(rawDebts)) {
    for (const d of rawDebts) {
      if (!d || typeof d !== "object") continue;

      const amount = Number(d.amount) || 0;
      const paid = Number(d.paid) || 0;

      // Extract remaining amount accurately
      let remaining = 0;
      if (d.remaining !== undefined && d.remaining !== null) {
        remaining = Number(d.remaining);
      } else if (d.remainingAmount !== undefined && d.remainingAmount !== null) {
        remaining = Number(d.remainingAmount);
      } else if (amount > 0) {
        remaining = Math.max(0, amount - paid);
      }

      // If debt is flagged as fully paid, skip
      if (d.isPaid === true || remaining <= 0) continue;

      totalActiveDebt += remaining;
      totalActiveCount++;

      const debtName =
        d.name ||
        d.title ||
        d.description ||
        d.person ||
        d.creditor ||
        (d.category ? `${d.category} Borcu` : "Kayıtlı Borç");

      const dateField = d.dueDate || d.date || d.paymentDate || d.vadeTarihi || "";
      let classified = false;

      if (dateField) {
        const due = parseDateRobust(dateField);
        if (due) {
          const dueTime = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
          const diffDays = Math.round((todayTime - dueTime) / (1000 * 60 * 60 * 24));
          const formattedDueDate = due.toLocaleDateString("tr-TR");

          if (diffDays > 0) {
            // Overdue
            overdueDebts.push({
              name: debtName,
              remaining,
              daysLate: diffDays,
              isInstallment: false,
              dueDateStr: formattedDueDate,
              category: d.category,
            });
            allActiveDebts.push({
              name: debtName,
              remaining,
              isInstallment: false,
              status: `${diffDays} gün gecikti 🚨`,
              dueDateStr: formattedDueDate,
              category: d.category,
            });
            totalOverdueAmount += remaining;
            classified = true;
          } else if (diffDays === 0) {
            // Due today
            dueTodayDebts.push({
              name: debtName,
              remaining,
              isInstallment: false,
              dueDateStr: formattedDueDate,
              category: d.category,
            });
            allActiveDebts.push({
              name: debtName,
              remaining,
              isInstallment: false,
              status: "Bugün son gün ⏰",
              dueDateStr: formattedDueDate,
              category: d.category,
            });
            totalDueTodayAmount += remaining;
            classified = true;
          } else {
            // Upcoming
            const daysLeft = Math.abs(diffDays);
            upcomingDebts.push({
              name: debtName,
              remaining,
              daysLeft,
              isInstallment: false,
              dueDateStr: formattedDueDate,
              category: d.category,
            });
            allActiveDebts.push({
              name: debtName,
              remaining,
              isInstallment: false,
              status: `${daysLeft} gün kaldı ⏳`,
              dueDateStr: formattedDueDate,
              category: d.category,
            });
            classified = true;
          }
        }
      }

      if (!classified) {
        otherActiveDebts.push({
          name: debtName,
          remaining,
          isInstallment: false,
          dueDateStr: "Tarih Belirtilmedi",
          category: d.category,
        });
        allActiveDebts.push({
          name: debtName,
          remaining,
          isInstallment: false,
          status: "Vade Tarihi Yok",
          dueDateStr: "Tarih Yok",
          category: d.category,
        });
      }
    }
  }

  // 2. Installment debts
  if (Array.isArray(rawInstallments)) {
    for (const inst of rawInstallments) {
      if (!inst || typeof inst !== "object") continue;

      const totalAmount = Number(inst.totalAmount) || 0;
      const installmentCount = Math.max(1, Number(inst.installmentCount) || 1);
      const paidCount = Math.max(0, Number(inst.paidInstallmentCount) || 0);

      if (paidCount >= installmentCount) continue; // Fully paid

      const remainingInstallments = installmentCount - paidCount;
      const perInstallmentAmount = totalAmount > 0 ? totalAmount / installmentCount : 0;
      const totalRemainingDebt = remainingInstallments * perInstallmentAmount;

      totalActiveDebt += totalRemainingDebt;
      totalActiveCount++;

      const baseName =
        inst.name ||
        inst.title ||
        inst.description ||
        (inst.category ? `${inst.category} Taksiti` : "Taksitli Ödeme");

      const installmentItemName = `${baseName} (Taksit ${paidCount + 1}/${installmentCount})`;
      const dateField = inst.firstDueDate || inst.dueDate || inst.date || "";
      let classified = false;

      if (dateField) {
        const baseDate = parseDateRobust(dateField);
        if (baseDate) {
          // Add paidCount months to calculate next installment due date
          const nextDue = new Date(baseDate.getFullYear(), baseDate.getMonth() + paidCount, baseDate.getDate());
          const nextDueTime = new Date(nextDue.getFullYear(), nextDue.getMonth(), nextDue.getDate()).getTime();
          const diffDays = Math.round((todayTime - nextDueTime) / (1000 * 60 * 60 * 24));
          const formattedDueDate = nextDue.toLocaleDateString("tr-TR");

          if (diffDays > 0) {
            // Overdue installment
            overdueDebts.push({
              name: installmentItemName,
              remaining: perInstallmentAmount,
              daysLate: diffDays,
              isInstallment: true,
              dueDateStr: formattedDueDate,
              category: inst.category,
            });
            allActiveDebts.push({
              name: installmentItemName,
              remaining: perInstallmentAmount,
              isInstallment: true,
              status: `${diffDays} gün gecikti 🚨`,
              dueDateStr: formattedDueDate,
              category: inst.category,
            });
            totalOverdueAmount += perInstallmentAmount;
            classified = true;
          } else if (diffDays === 0) {
            // Due today installment
            dueTodayDebts.push({
              name: installmentItemName,
              remaining: perInstallmentAmount,
              isInstallment: true,
              dueDateStr: formattedDueDate,
              category: inst.category,
            });
            allActiveDebts.push({
              name: installmentItemName,
              remaining: perInstallmentAmount,
              isInstallment: true,
              status: "Bugün son gün ⏰",
              dueDateStr: formattedDueDate,
              category: inst.category,
            });
            totalDueTodayAmount += perInstallmentAmount;
            classified = true;
          } else {
            // Upcoming installment
            const daysLeft = Math.abs(diffDays);
            upcomingDebts.push({
              name: installmentItemName,
              remaining: perInstallmentAmount,
              daysLeft,
              isInstallment: true,
              dueDateStr: formattedDueDate,
              category: inst.category,
            });
            allActiveDebts.push({
              name: installmentItemName,
              remaining: perInstallmentAmount,
              isInstallment: true,
              status: `${daysLeft} gün kaldı ⏳`,
              dueDateStr: formattedDueDate,
              category: inst.category,
            });
            classified = true;
          }
        }
      }

      if (!classified) {
        otherActiveDebts.push({
          name: installmentItemName,
          remaining: perInstallmentAmount,
          isInstallment: true,
          dueDateStr: "Tarih Yok",
          category: inst.category,
        });
        allActiveDebts.push({
          name: installmentItemName,
          remaining: perInstallmentAmount,
          isInstallment: true,
          status: "Vade Tarihi Yok",
          dueDateStr: "Tarih Yok",
          category: inst.category,
        });
      }
    }
  }

  // Sort overdues: highest days late first
  overdueDebts.sort((a, b) => (b.daysLate || 0) - (a.daysLate || 0));

  return {
    overdueDebts,
    dueTodayDebts,
    upcomingDebts,
    otherActiveDebts,
    allActiveDebts,
    totalActiveDebt,
    totalOverdueAmount,
    totalDueTodayAmount,
    overdueCount: overdueDebts.length,
    dueTodayCount: dueTodayDebts.length,
    totalActiveCount,
  };
}

/**
 * Generates an elegant, responsive HTML report matching the server's email design.
 * Guarantees that debt amounts, names, and overdue counts are accurately formatted.
 */
export function generateDiagnosticReportHtml(
  email: string,
  user: string,
  analysis: DebtAnalysisResult,
  isOffline: boolean = false
): string {
  const {
    totalActiveDebt,
    totalOverdueAmount,
    overdueDebts,
    dueTodayDebts,
    allActiveDebts,
    totalActiveCount,
  } = analysis;

  const overdueRows = overdueDebts
    .map(
      (d) => `
    <tr style="border-bottom: 1px solid #ffe4e6;">
      <td style="padding: 10px 14px; font-size: 12px; color: #1e293b; font-weight: 700;">
        ${d.name}
        <div style="font-size: 10px; color: #94a3b8; font-weight: 400;">Vade: ${d.dueDateStr}</div>
      </td>
      <td style="padding: 10px 14px; text-align: right; font-size: 12px; color: #e11d48; font-weight: 800;">
        ₺${d.remaining.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
      </td>
      <td style="padding: 10px 14px; text-align: center;">
        <span style="display: inline-block; padding: 4px 8px; background: #ffe4e6; color: #be123c; font-size: 10px; font-weight: 800; border-radius: 6px;">
          ${d.daysLate ? `${d.daysLate} Gün Gecikti` : "Vadesi Geçti"}
        </span>
      </td>
    </tr>`
    )
    .join("");

  const dueTodayRows = dueTodayDebts
    .map(
      (d) => `
    <tr style="border-bottom: 1px solid #fef3c7;">
      <td style="padding: 10px 14px; font-size: 12px; color: #1e293b; font-weight: 700;">
        ${d.name}
        <div style="font-size: 10px; color: #94a3b8; font-weight: 400;">Vade: Bugün</div>
      </td>
      <td style="padding: 10px 14px; text-align: right; font-size: 12px; color: #b45309; font-weight: 800;">
        ₺${d.remaining.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
      </td>
      <td style="padding: 10px 14px; text-align: center;">
        <span style="display: inline-block; padding: 4px 8px; background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 800; border-radius: 6px;">
          Bugün Son Gün
        </span>
      </td>
    </tr>`
    )
    .join("");

  const allActiveRows = allActiveDebts
    .slice(0, 15)
    .map(
      (d) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 8px 12px; font-size: 11px; color: #334155; font-weight: 600;">
        ${d.name}
      </td>
      <td style="padding: 8px 12px; text-align: center; font-size: 11px; color: #64748b;">
        ${d.dueDateStr}
      </td>
      <td style="padding: 8px 12px; text-align: right; font-size: 11px; color: #0f172a; font-weight: 700;">
        ₺${d.remaining.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
      </td>
      <td style="padding: 8px 12px; text-align: center; font-size: 10px; color: #64748b;">
        ${d.status || "Aktif"}
      </td>
    </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bütçem Pro Borç Raporu</title>
</head>
<body style="margin: 0; padding: 12px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px 20px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 800; letter-spacing: -0.02em;">
          Bütçem Pro Finansal Takip
        </h1>
        <p style="margin: 4px 0 0 0; color: #e0e7ff; font-size: 12px;">
          Güncel Borç ve Ödeme Durumu Raporu
        </p>
      </td>
    </tr>

    ${
      isOffline
        ? `
    <!-- Offline Warning Banner -->
    <tr>
      <td style="padding: 14px 20px 0 20px;">
        <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 12px; text-align: left;">
          <div style="font-weight: 800; font-size: 12px; color: #be123c; margin-bottom: 2px;">
            ⚠️ Çevrimdışı Tanılama Modu (Sunucuya Erişilemedi)
          </div>
          <div style="font-size: 11px; color: #9f1239; line-height: 1.4;">
            Cihazınız merkezi e-posta sunucusuna bağlanamadığı için e-posta fiziksel olarak gönderilemedi. Aşağıda cihazınızdaki gerçek borçlarınız taranarak yerel olarak oluşturulan rapor yer almaktadır.
          </div>
        </div>
      </td>
    </tr>`
        : ""
    }

    <!-- Salutation -->
    <tr>
      <td style="padding: 20px 20px 12px 20px; color: #1e293b; font-size: 13px; line-height: 1.5;">
        Sayın <strong>${user}</strong> (${email}),
        <br><br>
        Sistemimizde kayıtlı finansal hesaplarınız taranarak hazırlanan güncel borç özetiniz aşağıdadır:
      </td>
    </tr>

    <!-- Metric Summary Box -->
    <tr>
      <td style="padding: 0 20px 16px 20px;">
        <table width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="text-align: center; border-right: 1px solid #e2e8f0; padding: 14px 8px; width: 33%;">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Toplam Borç</div>
              <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 4px;">
                ₺${totalActiveDebt.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </div>
            </td>
            <td style="text-align: center; border-right: 1px solid #e2e8f0; padding: 14px 8px; width: 33%;">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Geciken Tutar</div>
              <div style="font-size: 16px; font-weight: 900; color: ${totalOverdueAmount > 0 ? "#e11d48" : "#10b981"}; margin-top: 4px;">
                ${totalOverdueAmount > 0 ? `₺${totalOverdueAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}` : "₺0 (Temiz ✅)"}
              </div>
            </td>
            <td style="text-align: center; padding: 14px 8px; width: 34%;">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Aktif Borç</div>
              <div style="font-size: 16px; font-weight: 900; color: #4f46e5; margin-top: 4px;">
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
    <!-- Overdue Table -->
    <tr>
      <td style="padding: 0 20px 16px 20px;">
        <h3 style="margin: 0 0 8px 0; color: #be123c; font-size: 12px; font-weight: 800; text-transform: uppercase;">
          🚨 Vadesi Geçmiş Borçlar (${overdueDebts.length} Kalem)
        </h3>
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background: #ffffff; border: 1px solid #ffe4e6; border-radius: 10px; overflow: hidden;">
          <thead>
            <tr style="background: #fff1f2; border-bottom: 1px solid #ffe4e6;">
              <th style="padding: 8px 12px; text-align: left; font-size: 10px; color: #9f1239; font-weight: 800; text-transform: uppercase;">Borç / Taksit</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 10px; color: #9f1239; font-weight: 800; text-transform: uppercase;">Tutar</th>
              <th style="padding: 8px 12px; text-align: center; font-size: 10px; color: #9f1239; font-weight: 800; text-transform: uppercase;">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${overdueRows}
          </tbody>
        </table>
      </td>
    </tr>`
        : ""
    }

    ${
      dueTodayDebts.length > 0
        ? `
    <!-- Due Today Table -->
    <tr>
      <td style="padding: 0 20px 16px 20px;">
        <h3 style="margin: 0 0 8px 0; color: #b45309; font-size: 12px; font-weight: 800; text-transform: uppercase;">
          ⏰ Bugün Vadesi Dolanlar (${dueTodayDebts.length} Kalem)
        </h3>
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background: #ffffff; border: 1px solid #fef3c7; border-radius: 10px; overflow: hidden;">
          <thead>
            <tr style="background: #fffbeb; border-bottom: 1px solid #fef3c7;">
              <th style="padding: 8px 12px; text-align: left; font-size: 10px; color: #92400e; font-weight: 800; text-transform: uppercase;">Borç / Taksit</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 10px; color: #92400e; font-weight: 800; text-transform: uppercase;">Tutar</th>
              <th style="padding: 8px 12px; text-align: center; font-size: 10px; color: #92400e; font-weight: 800; text-transform: uppercase;">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${dueTodayRows}
          </tbody>
        </table>
      </td>
    </tr>`
        : ""
    }

    ${
      overdueDebts.length === 0 && dueTodayDebts.length === 0 && allActiveDebts.length > 0
        ? `
    <!-- All Active Debts Table -->
    <tr>
      <td style="padding: 0 20px 16px 20px;">
        <h3 style="margin: 0 0 8px 0; color: #334155; font-size: 12px; font-weight: 800; text-transform: uppercase;">
          📋 Kayıtlı Aktif Borçlar (${allActiveDebts.length} Kalem)
        </h3>
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <th style="padding: 8px 12px; text-align: left; font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase;">Borç / Taksit</th>
              <th style="padding: 8px 12px; text-align: center; font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase;">Vade</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase;">Kalan</th>
              <th style="padding: 8px 12px; text-align: center; font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase;">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${allActiveRows}
          </tbody>
        </table>
      </td>
    </tr>`
        : ""
    }

    <!-- Footer -->
    <tr>
      <td style="background: #f8fafc; padding: 16px 20px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="margin: 0; font-size: 10px; color: #94a3b8;">
          Bütçem Pro &copy; ${new Date().getFullYear()} - Akıllı Bütçe ve Borç Takip Asistanı
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
