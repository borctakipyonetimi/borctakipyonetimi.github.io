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
