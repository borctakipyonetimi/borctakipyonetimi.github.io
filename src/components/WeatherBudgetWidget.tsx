import React, { useState, useEffect } from "react";
import { 
  Sun, 
  CloudRain, 
  CloudSnow, 
  Cloud, 
  CloudLightning, 
  Thermometer, 
  MapPin, 
  TrendingUp, 
  ShoppingBag, 
  Coffee, 
  Umbrella, 
  Sparkles, 
  RefreshCw, 
  ChevronRight,
  AlertCircle,
  Lightbulb,
  Search,
  Compass
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Expense } from "../types";
import { useCurrency } from "../utils/CurrencyContext";

interface WeatherData {
  city: string;
  temperature: number;
  weatherCode: number;
  condition: "sunny" | "cloudy" | "rainy" | "snowy" | "thunder";
  description: string;
  isDay: boolean;
  windSpeed: number;
  humidity?: number;
}

interface WeatherBudgetWidgetProps {
  expenses?: Expense[];
  language?: "tr" | "en";
}

const PRESET_CITIES = [
  { name: "İstanbul", lat: 41.0082, lon: 28.9784 },
  { name: "Ankara", lat: 39.9334, lon: 32.8597 },
  { name: "İzmir", lat: 38.4237, lon: 27.1428 },
  { name: "Bursa", lat: 40.1885, lon: 29.0610 },
  { name: "Antalya", lat: 36.8969, lon: 30.7133 },
  { name: "Adana", lat: 37.0000, lon: 35.3213 },
  { name: "Trabzon", lat: 41.0027, lon: 39.7168 },
  { name: "Eskişehir", lat: 39.7767, lon: 30.5206 },
];

export const WeatherBudgetWidget: React.FC<WeatherBudgetWidgetProps> = ({
  expenses = [],
  language = "tr",
}) => {
  const { format } = useCurrency();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [searchCity, setSearchCity] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"insights" | "categories" | "tips">("insights");

  // Map WMO Weather Codes to condition and text
  const parseWeatherCode = (code: number): { condition: WeatherData["condition"]; description: string } => {
    if (code === 0) return { condition: "sunny", description: language === "tr" ? "Açık / Güneşli" : "Sunny / Clear" };
    if ([1, 2, 3].includes(code)) return { condition: "cloudy", description: language === "tr" ? "Parçalı Bulutlu" : "Partly Cloudy" };
    if ([45, 48].includes(code)) return { condition: "cloudy", description: language === "tr" ? "Sisli" : "Foggy" };
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { condition: "rainy", description: language === "tr" ? "Yağmurlu" : "Rainy" };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { condition: "snowy", description: language === "tr" ? "Kar Yağışlı" : "Snowy" };
    if ([95, 96, 99].includes(code)) return { condition: "thunder", description: language === "tr" ? "Fırtınalı / Flaş Yağış" : "Thunderstorm" };
    return { condition: "cloudy", description: language === "tr" ? "Bulutlu" : "Cloudy" };
  };

  const fetchWeather = async (lat: number, lon: number, cityName?: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch weather from Open-Meteo
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`
      );
      if (!res.ok) throw new Error("Hava durumu bilgisi alınamadı");
      const data = await res.json();
      const current = data.current_weather;

      // 2. Reverse geocode city name if not provided
      let finalCity = cityName || "Mevcut Konum";
      if (!cityName) {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const address = geoData.address;
            finalCity = address?.city || address?.town || address?.province || address?.state || "Mevcut Konum";
          }
        } catch {
          finalCity = "Konumunuz";
        }
      }

      const { condition, description } = parseWeatherCode(current.weathercode);

      setWeather({
        city: finalCity,
        temperature: Math.round(current.temperature),
        weatherCode: current.weathercode,
        condition,
        description,
        isDay: current.is_day === 1,
        windSpeed: Math.round(current.windspeed),
      });
    } catch (err) {
      console.error("Weather fetch error:", err);
      setError(language === "tr" ? "Hava durumu yüklenemedi" : "Could not load weather");
    } finally {
      setLoading(false);
    }
  };

  // Get current location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchWeather(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn("Geolocation error or denied:", err.message);
          // Default to Istanbul
          fetchWeather(41.0082, 28.9784, "İstanbul");
        },
        { timeout: 8000 }
      );
    } else {
      fetchWeather(41.0082, 28.9784, "İstanbul");
    }
  }, []);

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCity.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          searchCity.trim()
        )}&count=1&language=tr&format=json`
      );
      if (!res.ok) throw new Error("Şehir bulunamadı");
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const place = data.results[0];
        fetchWeather(place.latitude, place.longitude, place.name);
        setSearchCity("");
        setIsSearching(false);
      } else {
        alert(language === "tr" ? "Aranan şehir bulunamadı." : "City not found.");
        setLoading(false);
      }
    } catch (err) {
      alert(language === "tr" ? "Şehir araması başarısız." : "City search failed.");
      setLoading(false);
    }
  };

  // Calculate weather related expenses insights
  const foodOutdoorsTotal = expenses
    .filter((e) => {
      const cat = (e.category || "").toLowerCase();
      return (
        cat.includes("yeme") ||
        cat.includes("restoran") ||
        cat.includes("kafe") ||
        cat.includes("kahve") ||
        cat.includes("dışarı") ||
        cat.includes("food") ||
        cat.includes("dining")
      );
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const onlineShoppingTotal = expenses
    .filter((e) => {
      const cat = (e.category || "").toLowerCase();
      const desc = (e.description || "").toLowerCase();
      return (
        cat.includes("online") ||
        cat.includes("alışveriş") ||
        cat.includes("market") ||
        cat.includes("sipariş") ||
        desc.includes("trendyol") ||
        desc.includes("getir") ||
        desc.includes("yemeksepeti") ||
        desc.includes("amazon")
      );
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const entertainmentTotal = expenses
    .filter((e) => {
      const cat = (e.category || "").toLowerCase();
      return (
        cat.includes("eğlence") ||
        cat.includes("sinema") ||
        cat.includes("etkinlik") ||
        cat.includes("gezi") ||
        cat.includes("ulasim") ||
        cat.includes("ulaşım") ||
        cat.includes("benzin")
      );
    })
    .reduce((sum, e) => sum + e.amount, 0);

  // Weather-based Dynamic Advice
  const getWeatherHabitInsight = () => {
    if (!weather) return null;

    switch (weather.condition) {
      case "rainy":
      case "thunder":
        return {
          title: language === "tr" ? "🌧️ Yağmurlu Gün Bütçe Rehberi" : "🌧️ Rainy Day Budget Guide",
          badge: language === "tr" ? "Online Sipariş Uyarısı" : "Online Order Alert",
          badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          advice:
            language === "tr"
              ? "Yağmurlu günlerde dışarı çıkma isteği azalsa da eve yemek ve online alışveriş siparişleri ortalama %35 artar! Evde taze bir kahve demleyerek ve hazır gıdalar tüketerek bugünkü potansiyel harcamayı önleyebilirsiniz."
              : "On rainy days, online food and shopping deliveries spike by ~35%! Brew coffee at home to curb impulse delivery fees.",
          riskCategory: language === "tr" ? "Yemek & Online Teslimat" : "Food & Online Delivery",
          riskLevel: "Yüksek",
          savableAmount: Math.round(foodOutdoorsTotal * 0.15) || 250,
          actionTip: language === "tr" ? "Evde Yemek & Kahve Modu" : "Cook & Brew at Home Mode",
          icon: <CloudRain className="w-6 h-6 text-blue-500 animate-bounce" />,
          bgGradient: "from-blue-500/10 via-indigo-500/5 to-slate-500/10 dark:from-blue-950/30 dark:to-indigo-950/20",
          borderColor: "border-blue-500/20 dark:border-blue-500/30",
        };
      case "sunny":
        return {
          title: language === "tr" ? "☀️ Güneşli Gün Bütçe Rehberi" : "☀️ Sunny Day Budget Guide",
          badge: language === "tr" ? "Açık Hava & Sosyalleşme Risk" : "Outdoor Social Spending Risk",
          badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          advice:
            language === "tr"
              ? "Güneşli havalarda kafe, soğuk içecek, dışarıda yemek ve spontane gezilerde harcama eğilimi belirgin şekilde yükselir. Kahvenizi veya suyunuzu yanınıza alarak günlük bütçenizi koruyabilirsiniz."
              : "Sunny weather boosts cafe visits, cold drinks, and dining out. Carrying a water bottle or thermos can save extra money today!",
          riskCategory: language === "tr" ? "Dışarıda Yemek & Sosyalleşme" : "Dining Out & Socializing",
          riskLevel: "Orta-Yüksek",
          savableAmount: Math.round(foodOutdoorsTotal * 0.2) || 180,
          actionTip: language === "tr" ? "Termos & Park İçecek Modu" : "Thermos & Park Mode",
          icon: <Sun className="w-6 h-6 text-amber-500 animate-spin-slow" />,
          bgGradient: "from-amber-500/10 via-orange-500/5 to-yellow-500/10 dark:from-amber-950/30 dark:to-yellow-950/20",
          borderColor: "border-amber-500/20 dark:border-amber-500/30",
        };
      case "snowy":
        return {
          title: language === "tr" ? "❄️ Karlı & Soğuk Gün Bütçe Rehberi" : "❄️ Snowy & Cold Budget Guide",
          badge: language === "tr" ? "Isınma & Ev İçi Konfor" : "Heating & Home Comfort",
          badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
          advice:
            language === "tr"
              ? "Soğuk günlerde taksi kullanımı ve ev ısıtma harcamaları öne çıkar. Toplu taşıma tercihi ve fuzuli taksi ücretlerinden kaçınmak bütçenizi rahatlatacaktır."
              : "Cold weather increases taxi and energy costs. Plan transportation in advance to avoid extra taxi fares.",
          riskCategory: language === "tr" ? "Ulaşım & Isınma" : "Transport & Heating",
          riskLevel: "Orta",
          savableAmount: Math.round(entertainmentTotal * 0.15) || 200,
          actionTip: language === "tr" ? "Planlı Ulaşım & Ev Sıcaklığı" : "Planned Transit Mode",
          icon: <CloudSnow className="w-6 h-6 text-cyan-500 animate-pulse" />,
          bgGradient: "from-cyan-500/10 via-blue-500/5 to-sky-500/10 dark:from-cyan-950/30 dark:to-blue-950/20",
          borderColor: "border-cyan-500/20 dark:border-cyan-500/30",
        };
      default:
        return {
          title: language === "tr" ? "⛅ Parçalı Bulutlu Gün Bütçe Rehberi" : "⛅ Cloudy Day Budget Guide",
          badge: language === "tr" ? "Dengeli Harcama Modu" : "Balanced Spending Mode",
          badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
          advice:
            language === "tr"
              ? "Bulutlu ve ılıman havalar yürüyüş ve kontrollü harcamalar için idealdir. Haftalık alışveriş listenizi gözden geçirmek için harika bir fırsat!"
              : "Mild cloudy weather is great for walking and budget reviews. Good time to evaluate your weekly grocery plan!",
          riskCategory: language === "tr" ? "Market & Genel Bütçe" : "Groceries & General",
          riskLevel: "Düşük",
          savableAmount: 150,
          actionTip: language === "tr" ? "Haftalık Liste Hazırlama Modu" : "Weekly List Prep Mode",
          icon: <Cloud className="w-6 h-6 text-indigo-400" />,
          bgGradient: "from-indigo-500/10 via-purple-500/5 to-slate-500/10 dark:from-indigo-950/30 dark:to-purple-950/20",
          borderColor: "border-indigo-500/20 dark:border-indigo-500/30",
        };
    }
  };

  const insight = getWeatherHabitInsight();

  const getWeatherIcon = (cond: WeatherData["condition"]) => {
    switch (cond) {
      case "sunny":
        return <Sun className="w-9 h-9 text-amber-500 animate-spin-slow shrink-0" />;
      case "rainy":
        return <CloudRain className="w-9 h-9 text-blue-500 shrink-0" />;
      case "snowy":
        return <CloudSnow className="w-9 h-9 text-cyan-400 shrink-0" />;
      case "thunder":
        return <CloudLightning className="w-9 h-9 text-yellow-500 shrink-0" />;
      default:
        return <Cloud className="w-9 h-9 text-indigo-400 shrink-0" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800 border ${
        insight ? insight.borderColor : "border-slate-200 dark:border-slate-700"
      } shadow-sm space-y-4 p-5 sm:p-6`}
    >
      {/* Background Subtle Gradient Glow */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${
          insight ? insight.bgGradient : "from-indigo-500/5 to-slate-500/5"
        } pointer-events-none -z-10`}
      />

      {/* Header: Weather Info & Location Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-700/60 pb-3.5">
        <div className="flex items-center gap-3">
          {weather && getWeatherIcon(weather.condition)}
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                {weather?.city || "Konum Bekleniyor..."}
              </span>
              <button
                onClick={() => setIsSearching(!isSearching)}
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer ml-1"
              >
                {isSearching ? (language === "tr" ? "Kapat" : "Close") : (language === "tr" ? "Şehir Değiştir" : "Change City")}
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 mt-1">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-500 font-medium">Hava durumu yükleniyor...</span>
              </div>
            ) : weather ? (
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black font-mono text-slate-800 dark:text-slate-100">
                  {weather.temperature}°C
                </span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {weather.description}
                </span>
              </div>
            ) : (
              <span className="text-xs text-rose-500 font-semibold">{error}</span>
            )}
          </div>
        </div>

        {/* Quick presets or search form toggle */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="bg-indigo-50 dark:bg-slate-700/50 p-1 rounded-2xl flex items-center gap-1">
            <button
              onClick={() => setActiveTab("insights")}
              className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === "insights"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                {language === "tr" ? "Hava & Bütçe Analizi" : "Weather Analysis"}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === "categories"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {language === "tr" ? "Harcama Alışkanlıkları" : "Habits"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* City Search Row */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-2 pt-1"
          >
            <form onSubmit={handleCitySearch} className="flex gap-2">
              <input
                type="text"
                placeholder={language === "tr" ? "Şehir adı girin (örn: İzmir, Bursa)..." : "Enter city name..."}
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition"
              >
                <Search className="w-3.5 h-3.5" />
                {language === "tr" ? "Ara" : "Search"}
              </button>
            </form>

            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] font-bold text-slate-400">Hızlı Konumlar:</span>
              {PRESET_CITIES.slice(0, 5).map((pc) => (
                <button
                  key={pc.name}
                  onClick={() => {
                    fetchWeather(pc.lat, pc.lon, pc.name);
                    setIsSearching(false);
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 rounded-lg cursor-pointer transition"
                >
                  {pc.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Tab Content */}
      {activeTab === "insights" && insight && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {insight.icon}
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                {insight.title}
              </h4>
            </div>
            <span
              className={`px-2.5 py-1 text-[10px] font-extrabold rounded-xl border ${insight.badgeColor} flex items-center gap-1`}
            >
              <Lightbulb className="w-3 h-3" />
              {insight.badge}
            </span>
          </div>

          <p className="text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
            {insight.advice}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="p-3 bg-indigo-50/60 dark:bg-slate-900/40 border border-indigo-100 dark:border-slate-700/60 rounded-2xl space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                Etkilenen Kategori
              </span>
              <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <Coffee className="w-3.5 h-3.5 text-indigo-500" />
                {insight.riskCategory}
              </p>
            </div>

            <div className="p-3 bg-amber-50/60 dark:bg-slate-900/40 border border-amber-100 dark:border-slate-700/60 rounded-2xl space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                Harcama Eğilimi Riski
              </span>
              <p className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                {insight.riskLevel}
              </p>
            </div>

            <div className="p-3 bg-emerald-50/60 dark:bg-slate-900/40 border border-emerald-100 dark:border-slate-700/60 rounded-2xl space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                Tahmini Potansiyel Tasarruf
              </span>
              <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                ~{format(insight.savableAmount)} / Gün
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "categories" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-indigo-500" />
              Hava Şartlarına Duyarlı Harcama Kategorileriniz
            </h4>
            <span className="text-[11px] font-bold text-slate-400">
              Toplam Kayıtlı Giderler
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Coffee className="w-3.5 h-3.5 text-amber-500" /> Dışarıda Yemek / Kafe
                </span>
              </div>
              <p className="text-base font-black font-mono text-slate-800 dark:text-slate-100">
                {format(foodOutdoorsTotal)}
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">
                Güneşli ve açık havalarda en yüksek ivmeyi yakalayan kategori.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-indigo-500" /> Online Sipariş & Market
                </span>
              </div>
              <p className="text-base font-black font-mono text-slate-800 dark:text-slate-100">
                {format(onlineShoppingTotal)}
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">
                Yağmurlu ve soğuk havalarda sipariş sıklığı artan harcamalar.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Umbrella className="w-3.5 h-3.5 text-cyan-500" /> Eğlence & Ulaşım
                </span>
              </div>
              <p className="text-base font-black font-mono text-slate-800 dark:text-slate-100">
                {format(entertainmentTotal)}
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">
                Hava şartlarına göre değişkenlik gösteren mobilite giderleri.
              </p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
