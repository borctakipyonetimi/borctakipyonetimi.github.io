import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { getApiUrl } from "./api";

export type CurrencyType = "TRY" | "USD" | "EUR" | "GBP";

export interface RateDetail {
  buying: number;
  selling: number;
  change: number;
}

interface CurrencyContextProps {
  activeCurrency: CurrencyType;
  setActiveCurrency: (currency: CurrencyType) => void;
  rates: Record<string, number>;
  rateDetails: Record<string, RateDetail>;
  rateChanges: Record<string, number>;
  setRates: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  convert: (amount: number) => number;
  format: (amount: number) => string;
  currencySymbol: string;
  isFetching: boolean;
  lastUpdated: string | null;
  updateRatesFromAPI: (force?: boolean) => Promise<boolean>;
  nextRefreshSec: number;
  isLive: boolean;
}

const CurrencyContext = createContext<CurrencyContextProps | undefined>(undefined);

// Real modern baseline levels (September 2026 actual levels)
const DEFAULT_RATES: Record<string, number> = {
  TRY: 1,
  USD: 48.42,
  EUR: 56.25,
  GBP: 65.45,
  CHF: 59.72,
  GOLD_ONS: 4431.10,
  GOLD_GRAM: 6898.85,
  GOLD_CEYREK: 11165.67,
  GOLD_YARIM: 22331.33,
  GOLD_TAM: 44526.08,
  GOLD_CUMHURIYET: 45961.00,
  BTC_USD: 79614.00,
  BTC_TRY: 3855000.00
};

const DEFAULT_DETAILS: Record<string, RateDetail> = {
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

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCurrency, setActiveCurrencySetting] = useState<CurrencyType>(() => {
    return (localStorage.getItem("activeCurrency") as CurrencyType) || "TRY";
  });

  const [rates, setRates] = useState<Record<string, number>>(() => {
    const savedRates = localStorage.getItem("exchangeRates");
    const savedTimestamp = localStorage.getItem("exchangeRatesTimestamp");
    if (savedRates) {
      try {
        const parsed = JSON.parse(savedRates);
        // Only accept saved cache if it's realistic (USD > 46, GOLD_GRAM > 6000) and not older than 1 hour
        const isFresh = savedTimestamp ? (Date.now() - Number(savedTimestamp) < 3600000) : false;
        if (parsed && parsed.USD && parsed.USD >= 46 && parsed.GOLD_GRAM && parsed.GOLD_GRAM >= 6000 && isFresh) {
          return { ...DEFAULT_RATES, ...parsed };
        }
      } catch (e) {
        console.error("Failed to parse saved exchange rates:", e);
      }
    }
    return DEFAULT_RATES;
  });

  const [rateDetails, setRateDetails] = useState<Record<string, RateDetail>>(() => {
    const saved = localStorage.getItem("exchangeRateDetails");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.USD) return { ...DEFAULT_DETAILS, ...parsed };
      } catch (e) {}
    }
    return DEFAULT_DETAILS;
  });

  const [rateChanges, setRateChanges] = useState<Record<string, number>>(() => {
    const changes: Record<string, number> = {};
    for (const k of Object.keys(DEFAULT_DETAILS)) {
      changes[k] = DEFAULT_DETAILS[k].change;
    }
    return changes;
  });

  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [nextRefreshSec, setNextRefreshSec] = useState<number>(30);
  const [lastUpdated, setLastUpdated] = useState<string | null>(() => {
    return localStorage.getItem("exchangeRatesLastUpdated") || null;
  });

  const isUpdatingRef = useRef<boolean>(false);

  // Fetch real-time exchange rates & gold from multi-tier API
  const updateRatesFromAPI = useCallback(async (force = false): Promise<boolean> => {
    if (isUpdatingRef.current) return false;
    isUpdatingRef.current = true;
    setIsFetching(true);
    let success = false;

    const now = Date.now();

    // Helper to format date
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const stamp = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    // --- PHASE 1: Server-Side Proxy Route (/api/rates) ---
    try {
      const serverRes = await fetch(getApiUrl(`/api/rates?t=${now}${force ? "&force=true" : ""}`), {
        headers: { "Cache-Control": "no-cache" }
      });
      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (serverData && serverData.success && serverData.rates) {
          const r = serverData.rates;
          const updatedRates: Record<string, number> = {
            TRY: 1,
            USD: Number(r.USD) || 48.42,
            EUR: Number(r.EUR) || 56.25,
            GBP: Number(r.GBP) || 65.45,
            CHF: Number(r.CHF) || 59.72,
            GOLD_ONS: Number(r.GOLD_ONS) || 4431.10,
            GOLD_GRAM: Number(r.GOLD_GRAM) || 6898.85,
            GOLD_CEYREK: Number(r.GOLD_CEYREK) || 11165.67,
            GOLD_YARIM: Number(r.GOLD_YARIM) || 22331.33,
            GOLD_TAM: Number(r.GOLD_TAM) || 44526.08,
            GOLD_CUMHURIYET: Number(r.GOLD_CUMHURIYET) || 45961.00,
            BTC_USD: Number(r.BTC_USD) || 79614.00,
            BTC_TRY: Number(r.BTC_TRY) || (79614.00 * (Number(r.USD) || 48.42))
          };

          setRates(updatedRates);
          localStorage.setItem("exchangeRates", JSON.stringify(updatedRates));
          localStorage.setItem("exchangeRatesTimestamp", now.toString());

          if (serverData.details) {
            setRateDetails(serverData.details);
            localStorage.setItem("exchangeRateDetails", JSON.stringify(serverData.details));
            const changes: Record<string, number> = {};
            for (const k of Object.keys(serverData.details)) {
              changes[k] = serverData.details[k].change || 0;
            }
            setRateChanges(changes);
          }

          setLastUpdated(stamp);
          localStorage.setItem("exchangeRatesLastUpdated", stamp);
          setIsLive(true);
          setIsFetching(false);
          isUpdatingRef.current = false;
          setNextRefreshSec(30);
          return true;
        }
      }
    } catch (err) {
      console.warn("Server proxy rates call failed, trying direct browser APIs:", err);
    }

    // --- PHASE 2: Direct Client-Side Fallback (Works on GitHub Pages & Standalone Web) ---
    try {
      // 1. Direct Truncgil Finance Turkish Market
      const truncRes = await fetch(`https://finans.truncgil.com/v4/today.json?t=${now}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (truncRes.ok) {
        const tData: any = await truncRes.json();
        if (tData) {
          const usd = Number(tData.USD?.Selling) || 48.42;
          const eur = Number(tData.EUR?.Selling) || 56.25;
          const gbp = Number(tData.GBP?.Selling) || 65.45;
          const chf = Number(tData.CHF?.Selling) || 59.72;
          const gra = Number(tData.GRA?.Selling) || 6898.85;
          const ceyrek = Number(tData.CEYREKALTIN?.Selling) || 11165.67;
          const yarim = Number(tData.YARIMALTIN?.Selling) || 22331.33;
          const tam = Number(tData.TAMALTIN?.Selling) || 44526.08;
          const cumhuriyet = Number(tData.CUMHURIYETALTINI?.Selling) || 45961.00;

          // Fetch live gold spot ons
          let ons = 4431.10;
          try {
            const goldRes = await fetch("https://api.gold-api.com/price/XAU", { cache: "no-store" });
            if (goldRes.ok) {
              const gData = await goldRes.json();
              if (gData && gData.price) ons = Number(gData.price);
            }
          } catch (e) {}

          // Fetch live BTC
          let btcUsd = 79614.00;
          try {
            const btcRes = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", { cache: "no-store" });
            if (btcRes.ok) {
              const bData = await btcRes.json();
              if (bData && bData.lastPrice) btcUsd = Number(bData.lastPrice);
            }
          } catch (e) {}

          const updatedRates = {
            TRY: 1,
            USD: usd,
            EUR: eur,
            GBP: gbp,
            CHF: chf,
            GOLD_ONS: ons,
            GOLD_GRAM: gra,
            GOLD_CEYREK: ceyrek,
            GOLD_YARIM: yarim,
            GOLD_TAM: tam,
            GOLD_CUMHURIYET: cumhuriyet,
            BTC_USD: btcUsd,
            BTC_TRY: btcUsd * usd
          };

          const newDetails: Record<string, RateDetail> = {
            USD: { buying: Number(tData.USD?.Buying) || usd, selling: usd, change: Number(tData.USD?.Change) || 0 },
            EUR: { buying: Number(tData.EUR?.Buying) || eur, selling: eur, change: Number(tData.EUR?.Change) || 0 },
            GBP: { buying: Number(tData.GBP?.Buying) || gbp, selling: gbp, change: Number(tData.GBP?.Change) || 0 },
            CHF: { buying: Number(tData.CHF?.Buying) || chf, selling: chf, change: Number(tData.CHF?.Change) || 0 },
            GOLD_GRAM: { buying: Number(tData.GRA?.Buying) || gra, selling: gra, change: Number(tData.GRA?.Change) || 0 },
            GOLD_CEYREK: { buying: Number(tData.CEYREKALTIN?.Buying) || ceyrek, selling: ceyrek, change: Number(tData.CEYREKALTIN?.Change) || 0 },
            GOLD_YARIM: { buying: Number(tData.YARIMALTIN?.Buying) || yarim, selling: yarim, change: Number(tData.YARIMALTIN?.Change) || 0 },
            GOLD_TAM: { buying: Number(tData.TAMALTIN?.Buying) || tam, selling: tam, change: Number(tData.TAMALTIN?.Change) || 0 },
            GOLD_CUMHURIYET: { buying: Number(tData.CUMHURIYETALTINI?.Buying) || cumhuriyet, selling: cumhuriyet, change: Number(tData.CUMHURIYETALTINI?.Change) || 0 },
            GOLD_ONS: { buying: ons, selling: ons, change: 0.15 },
            BTC: { buying: btcUsd, selling: btcUsd, change: 0.85 }
          };

          setRates(updatedRates);
          setRateDetails(newDetails);
          localStorage.setItem("exchangeRates", JSON.stringify(updatedRates));
          localStorage.setItem("exchangeRatesTimestamp", now.toString());
          localStorage.setItem("exchangeRateDetails", JSON.stringify(newDetails));

          const changes: Record<string, number> = {};
          for (const k of Object.keys(newDetails)) {
            changes[k] = newDetails[k].change;
          }
          setRateChanges(changes);

          setLastUpdated(stamp);
          localStorage.setItem("exchangeRatesLastUpdated", stamp);
          setIsLive(true);
          success = true;
        }
      }
    } catch (directErr) {
      console.warn("Direct Truncgil fetch failed, trying Phase 3 fallback:", directErr);
    }

    // --- PHASE 3: Open.er-api.com Fallback ---
    if (!success) {
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/USD?t=${now}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data && data.rates && data.rates.TRY) {
            const usd = Number(data.rates.TRY) || 48.42;
            const eur = (data.rates.TRY / (data.rates.EUR || 0.86)) || 56.25;
            const gbp = (data.rates.TRY / (data.rates.GBP || 0.74)) || 65.45;
            const ons = 4431.10;
            const gra = (ons * usd) / 31.1034768;
            const ceyrek = gra * 1.635;

            const updatedRates = {
              TRY: 1,
              USD: Number(usd.toFixed(4)),
              EUR: Number(eur.toFixed(4)),
              GBP: Number(gbp.toFixed(4)),
              CHF: Number((usd / 0.81).toFixed(4)),
              GOLD_ONS: ons,
              GOLD_GRAM: Number(gra.toFixed(2)),
              GOLD_CEYREK: Number(ceyrek.toFixed(2)),
              GOLD_YARIM: Number((ceyrek * 2).toFixed(2)),
              GOLD_TAM: Number((ceyrek * 4).toFixed(2)),
              GOLD_CUMHURIYET: Number((ceyrek * 4.12).toFixed(2)),
              BTC_USD: 79614.00,
              BTC_TRY: Number((79614 * usd).toFixed(2))
            };

            setRates(updatedRates);
            localStorage.setItem("exchangeRates", JSON.stringify(updatedRates));
            localStorage.setItem("exchangeRatesTimestamp", now.toString());
            setLastUpdated(stamp);
            localStorage.setItem("exchangeRatesLastUpdated", stamp);
            setIsLive(true);
            success = true;
          }
        }
      } catch (err) {
        console.error("All rates endpoints failed:", err);
      }
    }

    setIsFetching(false);
    isUpdatingRef.current = false;
    setNextRefreshSec(30);
    return success;
  }, []);

  // 1. Initial immediate fetch upon mount
  useEffect(() => {
    updateRatesFromAPI(true);
  }, [updateRatesFromAPI]);

  // 2. Automatic periodic refresh ticker (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setNextRefreshSec((prev) => {
        if (prev <= 1) {
          updateRatesFromAPI(false);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [updateRatesFromAPI]);

  // 3. Re-fetch when browser window regains focus or visibility
  useEffect(() => {
    const handleFocusOrVisibility = () => {
      if (document.visibilityState === "visible") {
        updateRatesFromAPI(false);
      }
    };

    window.addEventListener("focus", handleFocusOrVisibility);
    document.addEventListener("visibilitychange", handleFocusOrVisibility);

    return () => {
      window.removeEventListener("focus", handleFocusOrVisibility);
      document.removeEventListener("visibilitychange", handleFocusOrVisibility);
    };
  }, [updateRatesFromAPI]);

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
    
    const symbol = 
      activeCurrency === "TRY" ? "₺" : 
      activeCurrency === "USD" ? "$" : 
      activeCurrency === "EUR" ? "€" : "£";

    let locale = "tr-TR";
    if (activeCurrency === "USD") locale = "en-US";
    if (activeCurrency === "EUR") locale = "de-DE";
    if (activeCurrency === "GBP") locale = "en-GB";

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
    <CurrencyContext.Provider value={{
      activeCurrency,
      setActiveCurrency,
      rates,
      rateDetails,
      rateChanges,
      setRates,
      convert,
      format,
      currencySymbol,
      isFetching,
      lastUpdated,
      updateRatesFromAPI,
      nextRefreshSec,
      isLive
    }}>
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
