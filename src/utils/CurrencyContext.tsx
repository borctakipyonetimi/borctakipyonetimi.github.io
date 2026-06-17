import React, { createContext, useContext, useState, useEffect } from "react";
import { getApiUrl } from "./api";

export type CurrencyType = "TRY" | "USD" | "EUR" | "GBP";

interface CurrencyContextProps {
  activeCurrency: CurrencyType;
  setActiveCurrency: (currency: CurrencyType) => void;
  rates: Record<CurrencyType, number>;
  setRates: React.Dispatch<React.SetStateAction<Record<CurrencyType, number>>>;
  convert: (amount: number) => number;
  format: (amount: number) => string;
  currencySymbol: string;
  isFetching: boolean;
  lastUpdated: string | null;
  updateRatesFromAPI: () => Promise<boolean>;
}

const CurrencyContext = createContext<CurrencyContextProps | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCurrency, setActiveCurrencySetting] = useState<CurrencyType>(() => {
    return (localStorage.getItem("activeCurrency") as CurrencyType) || "TRY";
  });

  const [rates, setRates] = useState<Record<CurrencyType, number>>(() => {
    const savedRates = localStorage.getItem("exchangeRates");
    if (savedRates) {
      try {
        return JSON.parse(savedRates);
      } catch (e) {
        console.error("Failed to parse saved exchange rates:", e);
      }
    }
    return {
      TRY: 1,
      USD: 45.85,
      EUR: 49.85,
      GBP: 58.20,
    };
  });

  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(() => {
    return localStorage.getItem("exchangeRatesLastUpdated") || null;
  });

  // Fetch real-time exchange rates from API with an extremely robust, cache-busting multi-endpoint mechanism
  const updateRatesFromAPI = async (): Promise<boolean> => {
    setIsFetching(true);
    let success = false;

    // Phase 1: Try server-side proxy route to completely bypass browser client-side CORS and adblockers
    try {
      const serverRes = await fetch(getApiUrl(`/api/rates?t=${Date.now()}`));
      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (serverData && serverData.success && serverData.rates) {
          const updatedRates = {
            TRY: 1,
            USD: Number(serverData.rates.USD),
            EUR: Number(serverData.rates.EUR),
            GBP: Number(serverData.rates.GBP),
          };

          setRates(updatedRates);
          localStorage.setItem("exchangeRates", JSON.stringify(updatedRates));

          const d = new Date();
          const pad = (n: number) => n.toString().padStart(2, "0");
          const stamp = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          
          setLastUpdated(stamp);
          localStorage.setItem("exchangeRatesLastUpdated", stamp);
          setIsFetching(false);
          return true;
        }
      }
    } catch (err) {
      console.warn("Server rates proxy request failed, falling back to direct browser queries:", err);
    }

    // Phase 2: Secondary back-up directly from the client side browser to multi-fallback APIs
    const apis = [
      "https://api.exchangerate-api.com/v4/latest/USD",
      "https://open.er-api.com/v6/latest/USD"
    ];

    const defaultUsd = 45.85;
    const defaultEur = 49.85;
    const defaultGbp = 58.20;

    for (const baseUrl of apis) {
      try {
        // Appending a timestamp forces CDN/Browser to completely bypass cached entries
        const delimiter = baseUrl.includes("?") ? "&" : "?";
        const url = `${baseUrl}${delimiter}t=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data && data.rates) {
            const baseCode = (data.base || data.base_code || "TRY").toUpperCase();
            const rawRates: Record<string, number> = {};
            for (const key of Object.keys(data.rates)) {
              rawRates[key.toUpperCase()] = Number(data.rates[key]);
            }

            const tryInBase = rawRates.TRY;
            if (!tryInBase && baseCode !== "TRY") {
              throw new Error("TRY currency rate not present in this exchange API response.");
            }

            let usdRate = defaultUsd;
            let eurRate = defaultEur;
            let gbpRate = defaultGbp;

            if (baseCode === "TRY") {
              usdRate = rawRates.USD ? (1 / rawRates.USD) : defaultUsd;
              eurRate = rawRates.EUR ? (1 / rawRates.EUR) : defaultEur;
              gbpRate = rawRates.GBP ? (1 / rawRates.GBP) : defaultGbp;
            } else if (tryInBase) {
              usdRate = tryInBase / (rawRates.USD || 1);
              eurRate = tryInBase / (rawRates.EUR || 1);
              gbpRate = tryInBase / (rawRates.GBP || 1);
            }

            const updatedRates = {
              TRY: 1,
              USD: Number(usdRate.toFixed(4)),
              EUR: Number(eurRate.toFixed(4)),
              GBP: Number(gbpRate.toFixed(4)),
            };

            setRates(updatedRates);
            localStorage.setItem("exchangeRates", JSON.stringify(updatedRates));

            // Generate clean timestamp in DD.MM.YYYY HH:mm:ss format
            const d = new Date();
            const pad = (n: number) => n.toString().padStart(2, "0");
            const stamp = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            
            setLastUpdated(stamp);
            localStorage.setItem("exchangeRatesLastUpdated", stamp);
            success = true;
            break;
          }
        }
      } catch (err) {
        console.warn(`Dynamic rate update failed for backup url: ${baseUrl}`, err);
      }
    }

    setIsFetching(false);
    return success;
  };

  useEffect(() => {
    // Unconditionally fetch fresh real-time exchange rates automatically from the internet upon initial mount
    updateRatesFromAPI();
  }, []);

  const setActiveCurrency = (cur: CurrencyType) => {
    setActiveCurrencySetting(cur);
    localStorage.setItem("activeCurrency", cur);
  };

  const convert = (amount: number): number => {
    if (activeCurrency === "TRY") return amount;
    const rate = rates[activeCurrency] || 1;
    return amount / rate;
  };

  const format = (amount: number): string => {
    const converted = convert(amount);
    
    // Select accurate glyph symbols
    const symbol = 
      activeCurrency === "TRY" ? "₺" : 
      activeCurrency === "USD" ? "$" : 
      activeCurrency === "EUR" ? "€" : "£";

    let locale = "tr-TR";
    if (activeCurrency === "USD") locale = "en-US";
    if (activeCurrency === "EUR") locale = "de-DE";
    if (activeCurrency === "GBP") locale = "en-GB";

    // Set formatting parameters (Try values look best without fractional pennies unless specified, foreign units display cents/pennies)
    const isTry = activeCurrency === "TRY";
    return `${symbol}${converted.toLocaleString(locale, {
      minimumFractionDigits: isTry ? 0 : 2,
      maximumFractionDigits: isTry ? 2 : 2,
    })}`;
  };

  const currencySymbol = 
    activeCurrency === "TRY" ? "₺" : 
    activeCurrency === "USD" ? "$" : 
    activeCurrency === "EUR" ? "€" : "£";

  return (
    <CurrencyContext.Provider value={{ activeCurrency, setActiveCurrency, rates, setRates, convert, format, currencySymbol, isFetching, lastUpdated, updateRatesFromAPI }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
};
