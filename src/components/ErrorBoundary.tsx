/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[Bütçem Pro ErrorBoundary] Yakalanan sistem hatası:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleRestart = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleSafeReset = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem("exchangeRatesLastUpdated");
      localStorage.removeItem("butcem_temp_cache");
    } catch (e) {
      console.warn("Cache reset error:", e);
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = window.location.pathname;
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 select-none font-sans">
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 backdrop-blur-xl">
            {/* Shield Icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest rounded-full">
                Otomatik Koruma Kalkanı
              </span>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight mt-2">
                Uygulama Güvenle Kurtarıldı
              </h1>
              <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-sm mx-auto">
                Beklenmeyen bir tarayıcı arayüz hatası engellendi. Finansal verileriniz ve bütçe kayıtlarınız güvendedir ve kaybolmamıştır.
              </p>
            </div>

            {/* Error detail (subtle) */}
            {this.state.error && (
              <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl text-left overflow-hidden">
                <p className="text-[10px] font-mono text-slate-400 break-words line-clamp-2">
                  <span className="text-amber-400 font-bold">Hata:</span> {this.state.error.message || "Bilinmeyen arayüz hatası"}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleRestart}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 via-indigo-650 to-purple-600 hover:opacity-95 text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Uygulamayı Yeniden Başlat</span>
              </button>

              <button
                type="button"
                onClick={this.handleSafeReset}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-bold rounded-2xl border border-slate-700/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Önbelleği Temizle & Onar</span>
              </button>
            </div>

            <div className="pt-2 text-[10px] text-slate-500 font-mono">
              Bütçem Pro &copy; {new Date().getFullYear()} - Veri Güvenliği Garantisi
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
