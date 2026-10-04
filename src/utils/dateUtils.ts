/**
 * Safely parse date strings (e.g. YYYY-MM-DD, ISO 8601, DD.MM.YYYY) into local year, 0-indexed month, and day.
 * Avoids timezone shift bugs associated with new Date("YYYY-MM-DD").
 */
export function parseDateParts(dateStr: string | undefined | null): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (!str) return null;

  // Handle YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoPart = str.split("T")[0];
  const dashParts = isoPart.split("-");
  if (dashParts.length === 3) {
    const y = parseInt(dashParts[0], 10);
    const m = parseInt(dashParts[1], 10) - 1; // 0-indexed month
    const d = parseInt(dashParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && y > 1900 && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      return { year: y, month: m, day: d };
    }
  }

  // Handle DD.MM.YYYY
  const dotParts = isoPart.split(".");
  if (dotParts.length === 3) {
    const d = parseInt(dotParts[0], 10);
    const m = parseInt(dotParts[1], 10) - 1;
    const y = parseInt(dotParts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && y > 1900 && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      return { year: y, month: m, day: d };
    }
  }

  // Fallback to JS Date object
  try {
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) {
      return { year: dt.getFullYear(), month: dt.getMonth(), day: dt.getDate() };
    }
  } catch {}

  return null;
}

/**
 * Checks if a given date string matches a specific year and 0-indexed month.
 */
export function isSameMonthYear(
  dateStr: string | undefined | null,
  targetMonth: number | null,
  targetYear: number | null
): boolean {
  if (targetMonth === null || targetYear === null) return true;
  const parts = parseDateParts(dateStr);
  if (!parts) return false;
  return parts.year === targetYear && parts.month === targetMonth;
}

/**
 * Converts a parsed date into a standard YYYY-MM-DD string for safe lexical comparison.
 */
export function normalizeToYMD(dateStr: string | undefined | null): string | null {
  const parts = parseDateParts(dateStr);
  if (!parts) return null;
  return `${parts.year}-${String(parts.month + 1).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/**
 * Formats a Date object into local YYYY-MM-DD string without timezone distortion.
 */
export function formatToLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Checks if a given date string falls within [startDate, endDate] (inclusive).
 * Safely parses any date format (YYYY-MM-DD, DD.MM.YYYY, ISO).
 * If startDate or endDate is not specified, that boundary is ignored.
 */
export function isDateWithinRange(
  dateStr: string | undefined | null,
  startDate?: string | null,
  endDate?: string | null
): boolean {
  const cleanStart = startDate?.trim() || null;
  const cleanEnd = endDate?.trim() || null;

  // Filtre yoksa tüm kayıtlar geçerlidir
  if (!cleanStart && !cleanEnd) return true;

  // Belirli bir tarih aralığı filtrelenirken tarihi olmayan kayıtlar aralığa dahil edilemez
  if (!dateStr || !dateStr.trim()) return false;

  const itemYMD = normalizeToYMD(dateStr);
  if (!itemYMD) return false;

  if (cleanStart) {
    const startYMD = normalizeToYMD(cleanStart) || cleanStart.slice(0, 10);
    if (itemYMD < startYMD) return false;
  }

  if (cleanEnd) {
    const endYMD = normalizeToYMD(cleanEnd) || cleanEnd.slice(0, 10);
    if (itemYMD > endYMD) return false;
  }

  return true;
}

/**
 * Rapor tarih aralıklarını yerel zaman dilimine göre hesaplar (Timezone kayması yaşanmaz).
 */
export function getReportPresetDates(
  preset: "today" | "this_week" | "this_month" | "last_month" | "this_year" | "last_year" | "all"
): { startDate: string; endDate: string } {
  const now = new Date();

  if (preset === "today") {
    const todayStr = formatToLocalYMD(now);
    return { startDate: todayStr, endDate: todayStr };
  }

  if (preset === "this_week") {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Pazartesi
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { startDate: formatToLocalYMD(monday), endDate: formatToLocalYMD(sunday) };
  }

  if (preset === "this_month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: formatToLocalYMD(firstDay), endDate: formatToLocalYMD(lastDay) };
  }

  if (preset === "last_month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: formatToLocalYMD(firstDay), endDate: formatToLocalYMD(lastDay) };
  }

  if (preset === "this_year") {
    const firstDay = new Date(now.getFullYear(), 0, 1);
    const lastDay = new Date(now.getFullYear(), 11, 31);
    return { startDate: formatToLocalYMD(firstDay), endDate: formatToLocalYMD(lastDay) };
  }

  if (preset === "last_year") {
    const firstDay = new Date(now.getFullYear() - 1, 0, 1);
    const lastDay = new Date(now.getFullYear() - 1, 11, 31);
    return { startDate: formatToLocalYMD(firstDay), endDate: formatToLocalYMD(lastDay) };
  }

  return { startDate: "", endDate: "" };
}

/**
 * Kullanıcının arayüzden seçtiği bildirim periyodu saatini milisaniye cinsinden hesaplar.
 * - "2" (Günde 2 Kez) = 12 saat = 43.200.000 milisaniye (12 Saat Kilidi)
 * - "1" (Günde 1 Kez) = 24 saat = 86.400.000 milisaniye
 * - "3" (Günde 3 Kez) = 8 saat = 28.800.000 milisaniye
 * - "4" (Günde 4 Kez) = 6 saat = 21.600.000 milisaniye
 * - "hourly" (2 Saatte Bir) = 2 saat = 7.200.000 milisaniye
 */
export function getNotificationPeriodMs(frequency: string | number | undefined | null): number {
  if (!frequency) return 12 * 60 * 60 * 1000; // Varsayılan: Günde 2 Kez = 12 saat = 43.200.000 ms
  const str = String(frequency).trim().toLowerCase();
  if (str === "2") return 12 * 60 * 60 * 1000; // 12 saat = 43.200.000 ms (12 Saat Kilidi)
  if (str === "1") return 24 * 60 * 60 * 1000; // 24 saat = 86.400.000 ms
  if (str === "3") return 8 * 60 * 60 * 1000;  // 8 saat = 28.800.000 ms
  if (str === "4") return 6 * 60 * 60 * 1000;  // 6 saat = 21.600.000 ms
  if (str === "hourly") return 2 * 60 * 60 * 1000; // 2 saat = 7.200.000 ms

  const num = parseFloat(str);
  if (!isNaN(num) && num > 0) {
    if (num === 2) return 12 * 60 * 60 * 1000;
    if (num === 1) return 24 * 60 * 60 * 1000;
    if (num === 3) return 8 * 60 * 60 * 1000;
    if (num === 4) return 6 * 60 * 60 * 1000;
    return num * 60 * 60 * 1000;
  }
  return 12 * 60 * 60 * 1000; // Varsayılan 12 saat
}

