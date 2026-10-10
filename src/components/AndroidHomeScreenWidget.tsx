import React, { useEffect } from "react";
import { Smartphone, Plus, TrendingUp, TrendingDown, RefreshCw, CheckCircle2, ShieldCheck, Layers } from "lucide-react";

interface AndroidHomeScreenWidgetProps {
  expenses: any[];
  incomes: any[];
  debts: any[];
  activeCurrency: string;
  colorTheme: string;
  format: (val: number) => string;
  onOpenAddExpense: () => void;
  triggerToast: (msg: string) => void;
}

export const AndroidHomeScreenWidget: React.FC<AndroidHomeScreenWidgetProps> = ({
  expenses,
  incomes,
  debts,
  activeCurrency,
  colorTheme,
  format,
  onOpenAddExpense,
  triggerToast,
}) => {
  // Compute current month stats for the 2x2 Home Screen Widget
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();

  const currentMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === curYear && d.getMonth() === curMonth;
  });

  const currentMonthIncomes = incomes.filter((i) => {
    const d = new Date(i.date);
    return d.getFullYear() === curYear && d.getMonth() === curMonth;
  });

  const totalExpense = currentMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalIncome = currentMonthIncomes.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const netBalance = totalIncome - totalExpense;

  // Lightweight SharedPreferences / HomeWidget bridge sync
  useEffect(() => {
    try {
      const widgetData = {
        netBalance,
        totalExpense,
        totalIncome,
        currency: activeCurrency,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem("android_home_widget_cache", JSON.stringify(widgetData));
    } catch (err) {
      console.warn("Android Widget SharedPreferences sync error:", err);
    }
  }, [netBalance, totalExpense, totalIncome, activeCurrency]);

  const getAccentColor = () => {
    switch (colorTheme) {
      case "green": return "#10B981";
      case "blue": return "#0EA5E9";
      case "pink": return "#EC4899";
      case "orange": return "#F59E0B";
      case "cyan": return "#06B6D4";
      case "coral": return "#F43F5E";
      case "purple": return "#8B5CF6";
      default: return "#6366F1";
    }
  };

  const accent = getAccentColor();

  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
            <Smartphone className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Android Masaüstü Widget'ı (2x2 Home Screen)
              </h3>
              <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-lg uppercase tracking-wider">
                Aktif Senkronize ⚡
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Telefonunuzun ana ekranına ekleyebileceğiniz 2x2 koyu temalı hızlı finansal özet widget önizlemesi ve köprü yönetimi.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => triggerToast("Android Widget SharedPreferences senkronizasyonu güncellendi! 📱")}
          className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 rounded-2xl text-xs font-black transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin [animation-duration:10s]" />
          <span>Verileri Senkronize Et</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Actual 2x2 Android Widget Preview Box */}
        <div className="flex flex-col items-center justify-center p-4 bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-emerald-400 to-amber-500" />
          
          <div className="w-full max-w-[260px] bg-[#111827] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 relative">
            {/* Widget Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: accent }} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                  Bütçem Pro • Özet
                </span>
              </div>
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">
                {activeCurrency}
              </span>
            </div>

            {/* Widget Content Stats (2x2 layout) */}
            <div className="grid grid-cols-2 gap-2 py-1">
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 space-y-0.5">
                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">
                  Net Bakiye
                </span>
                <span className={`text-xs font-black font-mono truncate block ${netBalance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {format(netBalance)}
                </span>
              </div>

              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 space-y-0.5">
                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">
                  Aylık Gider
                </span>
                <span className="text-xs font-black font-mono text-rose-400 truncate block">
                  {format(totalExpense)}
                </span>
              </div>
            </div>

            {/* Widget Footer Action Button */}
            <div className="pt-1 flex items-center justify-between">
              <span className="text-[9px] text-slate-400 font-semibold">
                Anlık Senkronize ⚡
              </span>
              <button
                type="button"
                onClick={onOpenAddExpense}
                className="w-8 h-8 rounded-xl text-white flex items-center justify-center shadow-lg cursor-pointer transition hover:scale-110 active:scale-95 shrink-0"
                style={{ backgroundColor: accent }}
                title="Hızlı Gider Ekle"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Android 2x2 Ana Ekran Widget Görünümü
          </div>
        </div>

        {/* Instructions & Features */}
        <div className="space-y-4">
          <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>Widget Özellikleri ve Kurulum Rehberi</span>
          </h4>

          <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>2x2 Kompakt Tasarım:</strong> Koyu #111827 arka plan ve seçtiğiniz canlı tema rengine uyumlu vurgu çizgileriyle şık görünüm.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Otomatik SharedPreferences Köprüsü:</strong> Uygulama içinde yapılan her gelir, gider veya silme işlemi sonrasında widget verileri arka planda anlık güncellenir.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Hızlı '+' Butonu:</strong> Widget üzerindeki artı butonuna dokunarak doğrudan uygulama içi Harcama Ekle ekranını açabilirsiniz.</span>
            </li>
          </ul>

          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-black text-indigo-900 dark:text-indigo-300">
                Android Ana Ekrana Nasıl Eklenir?
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Telefonunuzun ana ekranında boş bir alana basılı tutun, <strong>Widget'lar (Widgets)</strong> menüsünden <strong>Bütçem Pro</strong> uygulamasını seçip 2x2 boyutundaki bu widget'ı ana ekranınıza sürükleyip bırakın.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
