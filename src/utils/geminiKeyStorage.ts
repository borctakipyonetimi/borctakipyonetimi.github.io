export const USER_GEMINI_API_KEY_STORAGE = "user_gemini_api_key";
export const GEMINI_KEY_UPDATED_EVENT = "gemini-api-key-updated";

const PLACEHOLDER_KEY_REGEX = /^(MY_GEMINI_API_KEY|YOUR_.*|placeholder|undefined|null)$/i;

export function getStoredGeminiApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(USER_GEMINI_API_KEY_STORAGE) || "";
    const trimmed = raw.trim();
    return trimmed.length > 5 && !PLACEHOLDER_KEY_REGEX.test(trimmed) ? trimmed : "";
  } catch {
    return "";
  }
}

export function getBuildGeminiApiKey(): string {
  try {
    const raw = (import.meta as any)?.env?.VITE_GEMINI_API_KEY;
    if (typeof raw !== "string") return "";
    const trimmed = raw.trim();
    return trimmed.length > 5 && !PLACEHOLDER_KEY_REGEX.test(trimmed) ? trimmed : "";
  } catch {
    return "";
  }
}

export function hasAnyGeminiApiKey(): boolean {
  return Boolean(getStoredGeminiApiKey() || getBuildGeminiApiKey());
}

export function saveGeminiApiKey(key: string): string {
  const trimmed = (key || "").trim();
  if (typeof window !== "undefined") {
    try {
      if (trimmed) {
        localStorage.setItem(USER_GEMINI_API_KEY_STORAGE, trimmed);
      } else {
        localStorage.removeItem(USER_GEMINI_API_KEY_STORAGE);
      }
      window.dispatchEvent(new Event(GEMINI_KEY_UPDATED_EVENT));
    } catch {
      // ignore storage errors
    }
  }
  return trimmed;
}

export function clearGeminiApiKey(): void {
  saveGeminiApiKey("");
}
