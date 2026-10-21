/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as d3 from "d3";
import { Check, AlertTriangle, TrendingUp, CheckCircle2, Clock, Zap, PieChart as PieChartIcon } from "lucide-react";
import { Debt, InstallmentDebt } from "../types";
import { useCurrency } from "../utils/CurrencyContext";

interface AnimatedDebtStatusPanelProps {
  debts: Debt[];
  installmentDebts?: InstallmentDebt[];
  language?: "tr" | "en";
  className?: string;
  selectedMonth?: number | null;
  selectedYear?: number | null;
}

/**
 * High-performance single-loop count-up hook (0 -> 1)
 * Runs strictly once when in view to prevent redundant renders and CPU load.
 */
function useProgressCountUp(enabled: boolean, duration: number = 900): number {
  const [progress, setProgress] = useState(0);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasRunRef.current) return;
    hasRunRef.current = true;

    let startTime: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const p = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - p, 3);
      setProgress(ease);

      if (p < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setProgress(1);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [enabled, duration]);

  return progress;
}

interface SliceData {
  id: "paid" | "unpaid";
  label: string;
  value: number;
  colorFrom: string;
  colorTo: string;
  glowColor: string;
}

const AnimatedDebtStatusPanelComponent: React.FC<AnimatedDebtStatusPanelProps> = ({
  debts,
  installmentDebts = [],
  language = "tr",
  className = "",
  selectedMonth = null,
  selectedYear = null,
}) => {
  const { format } = useCurrency();
  const [activeHover, setActiveHover] = useState<"paid" | "unpaid" | null>(null);

  // Viewport intersection observer to avoid running infinite animations offscreen
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(true);
  const [hasEverBeenVisible, setHasEverBeenVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      setHasEverBeenVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsInView(visible);
        if (visible) {
          setHasEverBeenVisible(true);
        }
      },
      {
        root: null,
        rootMargin: "80px",
        threshold: 0.1,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 1. Calculations: Direct Single Debts (Memoized)
  const singleDebtsPaid = useMemo(() => {
    return debts.reduce((sum, d) => sum + Math.min(d.paid || 0, d.amount || 0), 0);
  }, [debts]);

  const singleDebtsRemaining = useMemo(() => {
    return debts.reduce((sum, d) => sum + Math.max(0, (d.amount || 0) - (d.paid || 0)), 0);
  }, [debts]);

  const singleDebtsPaidCount = useMemo(() => {
    return debts.filter((d) => (d.paid || 0) >= (d.amount || 0) && (d.amount || 0) > 0).length;
  }, [debts]);

  const singleDebtsUnpaidCount = useMemo(() => {
    return debts.filter((d) => (d.paid || 0) < (d.amount || 0)).length;
  }, [debts]);

  // 2. Calculations: Installments (Memoized)
  const installmentPaidCount = useMemo(() => {
    return installmentDebts.reduce(
      (sum, inst) => sum + Math.min(inst.paidInstallmentCount || 0, inst.installmentCount || 0),
      0
    );
  }, [installmentDebts]);

  const installmentRemainingCount = useMemo(() => {
    return installmentDebts.reduce(
      (sum, inst) => sum + Math.max(0, (inst.installmentCount || 0) - (inst.paidInstallmentCount || 0)),
      0
    );
  }, [installmentDebts]);

  const installmentPaidAmount = useMemo(() => {
    return installmentDebts.reduce((sum, inst) => {
      const monthly = inst.installmentCount > 0 ? inst.totalAmount / inst.installmentCount : 0;
      return sum + (inst.paidInstallmentCount || 0) * monthly;
    }, 0);
  }, [installmentDebts]);

  const installmentRemainingAmount = useMemo(() => {
    return installmentDebts.reduce((sum, inst) => {
      const monthly = inst.installmentCount > 0 ? inst.totalAmount / inst.installmentCount : 0;
      const paid = (inst.paidInstallmentCount || 0) * monthly;
      return sum + Math.max(0, inst.totalAmount - paid);
    }, 0);
  }, [installmentDebts]);

  // 3. Overall Portfolio Totals (Memoized)
  const totalPaid = useMemo(() => singleDebtsPaid + installmentPaidAmount, [singleDebtsPaid, installmentPaidAmount]);
  const totalRemaining = useMemo(
    () => singleDebtsRemaining + installmentRemainingAmount,
    [singleDebtsRemaining, installmentRemainingAmount]
  );
  const grandTotal = useMemo(() => totalPaid + totalRemaining, [totalPaid, totalRemaining]);
  const paymentPercentage = useMemo(
    () => (grandTotal > 0 ? Math.min(100, Math.max(0, (totalPaid / grandTotal) * 100)) : 0),
    [grandTotal, totalPaid]
  );
  const remainingPercentage = useMemo(() => Math.max(0, 100 - paymentPercentage), [paymentPercentage]);

  // 4. Unified single-loop progress animation (Offloaded from multiple state hooks)
  const progress = useProgressCountUp(hasEverBeenVisible, 900);
  const animatedPaidAmount = progress >= 1 ? totalPaid : totalPaid * progress;
  const animatedRemainingAmount = progress >= 1 ? totalRemaining : totalRemaining * progress;
  const animatedPercentage = progress >= 1 ? paymentPercentage : paymentPercentage * progress;
  const animatedPaidInstallments = progress >= 1 ? installmentPaidCount : Math.round(installmentPaidCount * progress);
  const animatedRemainingInstallments =
    progress >= 1 ? installmentRemainingCount : Math.round(installmentRemainingCount * progress);

  // 5. Pie Chart Slices Configuration (Memoized)
  const pieData: SliceData[] = useMemo(() => {
    if (grandTotal === 0) {
      return [
        {
          id: "paid",
          label: language === "tr" ? "Ödenmiş Borçlar" : "Paid Debts",
          value: 1,
          colorFrom: "#10b981",
          colorTo: "#059669",
          glowColor: "rgba(16,185,129,0.5)",
        },
      ];
    }

    const slices: SliceData[] = [];
    if (totalPaid > 0) {
      slices.push({
        id: "paid",
        label: language === "tr" ? "Ödenmiş Borçlar" : "Paid Debts",
        value: totalPaid,
        colorFrom: "#10b981",
        colorTo: "#059669",
        glowColor: "rgba(16,185,129,0.7)",
      });
    }
    if (totalRemaining > 0) {
      slices.push({
        id: "unpaid",
        label: language === "tr" ? "Ödenmemiş Borçlar" : "Unpaid Debts",
        value: totalRemaining,
        colorFrom: "#f43f5e",
        colorTo: "#ea580c",
        glowColor: "rgba(244,63,94,0.7)",
      });
    }
    return slices;
  }, [totalPaid, totalRemaining, grandTotal, language]);

  // D3 Pie & Arc Layout Generators
  const pieGenerator = useMemo(() => {
    return d3
      .pie<SliceData>()
      .value((d) => d.value)
      .sort(null)
      .padAngle(pieData.length > 1 ? 0.045 : 0);
  }, [pieData.length]);

  const arcs = useMemo(() => {
    return pieGenerator(pieData);
  }, [pieGenerator, pieData]);

  const arcGenerator = useMemo(() => {
    return d3
      .arc<d3.PieArcDatum<SliceData>>()
      .innerRadius(64)
      .outerRadius((d) => (activeHover === d.data.id ? 96 : 90))
      .cornerRadius(7);
  }, [activeHover]);

  return (
    <div
      ref={containerRef}
      data-testid="animated-debt-status-panel"
      style={{
        willChange: "transform, opacity",
        transform: "translate3d(0, 0, 0)",
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden",
        contain: "content",
      }}
      className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 backdrop-blur-xl transition-all duration-300 shadow-xl border border-slate-200/70 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/70 ${className}`}
    >
      {/* Decorative ambient background glows with GPU isolation */}
      <div
        style={{ willChange: "transform", transform: "translate3d(0, 0, 0)" }}
        className="absolute -top-16 -left-16 w-60 h-60 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"
      />
      <div
        style={{ willChange: "transform", transform: "translate3d(0, 0, 0)" }}
        className="absolute -bottom-16 -right-16 w-60 h-60 bg-rose-500/10 dark:bg-rose-500/15 rounded-full blur-3xl pointer-events-none"
      />
      <div
        style={{ willChange: "transform", transform: "translate3d(0, 0, 0)" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-36 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"
      />

      <div className="relative z-10 space-y-5">
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <PieChartIcon className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black tracking-wider text-slate-900 dark:text-slate-100 uppercase">
                  {language === "tr" ? "ANİMASYONLU BORÇ DURUM PANELİ" : "ANIMATED DEBT STATUS PANEL"}
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <Zap className="w-2.5 h-2.5" />
                  {language === "tr" ? "Pasta Grafiği Analizi" : "Pie Chart Analysis"}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {language === "tr"
                  ? "Ödenen ve kalan anapara borç portföyünün etkileşimli pasta grafiği görünümü"
                  : "Interactive animated pie chart breakdown of paid vs remaining debt portfolio"}
              </p>
            </div>
          </div>

          {/* Quick Portfolio Stats Badge */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="px-3 py-1.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {language === "tr" ? "Toplam Portföy" : "Total Portfolio"}:
              </span>
              <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-100">
                {format(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Genel İlerleme Çubuğu (Shimmer / Pulse Effect Progress Bar) with GPU offloading */}
        <div
          style={{ willChange: "transform", transform: "translate3d(0, 0, 0)" }}
          className="space-y-2 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-slate-100/80 via-slate-50/80 to-slate-100/80 dark:from-slate-800/40 dark:via-slate-800/60 dark:to-slate-800/40 border border-slate-200/50 dark:border-slate-800 shadow-inner"
        >
          <div className="flex items-center justify-between text-xs font-black">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>{language === "tr" ? "Genel Borç Kapanma İlerlemesi" : "Overall Debt Payoff Progress"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {format(Math.round(animatedPaidAmount))} / {format(grandTotal)}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black font-mono bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
                %{animatedPercentage.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Progress Bar Container with GPU Layer */}
          <div className="relative w-full h-3.5 sm:h-4 bg-slate-200/90 dark:bg-slate-950/80 rounded-full p-0.5 overflow-hidden border border-slate-300/60 dark:border-slate-800 shadow-inner">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: `${paymentPercentage}%` }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ willChange: "transform, width", transform: "translate3d(0, 0, 0)" }}
              className="relative h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] overflow-hidden"
            >
              {/* Shimmer Light Wave: ONLY active when isInView to save battery and GPU cycles */}
              {isInView && (
                <motion.div
                  animate={{ x: ["-100%", "260%"] }}
                  transition={{
                    repeat: Infinity,
                    duration: 2.2,
                    ease: "easeInOut",
                    repeatDelay: 0.3,
                  }}
                  style={{ willChange: "transform", transform: "translate3d(0, 0, 0)" }}
                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-[-20deg] pointer-events-none"
                />
              )}
              {paymentPercentage > 2 && (
                <span className="absolute right-0.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff] animate-ping" />
              )}
            </motion.div>
          </div>
        </div>

        {/* MAIN BODY: HAREKETLİ ANİMASYONLU PASTA GRAFİĞİ + ETKİLEŞİMLİ BENTO DETAY KARTLARI */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* SOL BÖLÜM: Hareketli Animasyonlu Pasta Grafiği (Donut/Pie Chart) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-3">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center select-none">
              {/* Ambient Aura behind Pie (Glow runs only when visible) */}
              <motion.div
                animate={isInView ? { scale: [1, 1.06, 1], opacity: [0.3, 0.5, 0.3] } : undefined}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  willChange: "transform, opacity",
                  transform: "translate3d(0, 0, 0)",
                  background:
                    activeHover === "unpaid"
                      ? "radial-gradient(circle, rgba(244,63,94,0.4) 0%, transparent 70%)"
                      : activeHover === "paid"
                      ? "radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)"
                      : "radial-gradient(circle, rgba(16,185,129,0.3) 0%, rgba(244,63,94,0.2) 60%, transparent 70%)",
                }}
                className="absolute inset-4 rounded-full blur-3xl pointer-events-none transition-colors duration-500"
              />

              {/* SVG Canvas */}
              <svg viewBox="0 0 220 220" className="w-full h-full relative z-10 overflow-visible">
                <defs>
                  {/* Neon Glow Filters */}
                  <filter id="pie-neon-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Gradient for Paid Slice (Neon Yeşil) */}
                  <linearGradient id="grad-paid" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>

                  {/* Gradient for Unpaid Slice (Canlı Turuncu/Mercan) */}
                  <linearGradient id="grad-unpaid" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fb7185" />
                    <stop offset="50%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>
                </defs>

                {/* 1. Futuristic Slow Spinning Dashed Orbit HUD Ring (Active only when visible) */}
                <motion.circle
                  cx="110"
                  cy="110"
                  r="105"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeDasharray="4 8"
                  className="text-slate-300/80 dark:text-slate-700/80"
                  animate={isInView ? { rotate: 360 } : undefined}
                  transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                  style={{
                    transformOrigin: "110px 110px",
                    willChange: "transform",
                    transform: "translate3d(0, 0, 0)",
                  }}
                />

                {/* 2. Reverse Spinning Minor Orbit Ring (Active only when visible) */}
                <motion.circle
                  cx="110"
                  cy="110"
                  r="100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  strokeDasharray="2 12"
                  className="text-indigo-400/40 dark:text-indigo-500/40"
                  animate={isInView ? { rotate: -360 } : undefined}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  style={{
                    transformOrigin: "110px 110px",
                    willChange: "transform",
                    transform: "translate3d(0, 0, 0)",
                  }}
                />

                {/* 3. Orbiting Satellite Beacon */}
                <motion.g
                  animate={isInView ? { rotate: 360 } : undefined}
                  transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                  style={{
                    transformOrigin: "110px 110px",
                    willChange: "transform",
                    transform: "translate3d(0, 0, 0)",
                  }}
                >
                  <circle cx="215" cy="110" r="3" fill="#10b981" />
                  <circle cx="215" cy="110" r="6" fill="#10b981" opacity="0.35" className="animate-ping" />
                </motion.g>

                {/* 4. Slices of the Pie/Donut Chart */}
                <g transform="translate(110, 110)">
                  {arcs.map((arcData, idx) => {
                    const isHovered = activeHover === arcData.data.id;
                    const isOtherHovered = activeHover !== null && !isHovered;
                    const pathD = arcGenerator(arcData) || "";

                    return (
                      <motion.path
                        key={arcData.data.id}
                        d={pathD}
                        fill={`url(#grad-${arcData.data.id})`}
                        filter={isHovered ? "url(#pie-neon-glow)" : undefined}
                        initial={{ scale: 0, opacity: 0, rotate: -30 }}
                        animate={{
                          scale: isHovered ? 1.04 : 1,
                          opacity: isOtherHovered ? 0.6 : 1,
                          rotate: 0,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 280,
                          damping: 24,
                          delay: idx * 0.1,
                        }}
                        style={{ willChange: "transform, opacity", transform: "translate3d(0, 0, 0)" }}
                        onMouseEnter={() => setActiveHover(arcData.data.id)}
                        onMouseLeave={() => setActiveHover(null)}
                        className="cursor-pointer transition-opacity duration-200 outline-none"
                      />
                    );
                  })}
                </g>
              </svg>

              {/* 5. Centerpiece Info Display (Glassmorphism Center HUD) */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  style={{ willChange: "transform", transform: "translate3d(0, 0, 0)" }}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-full backdrop-blur-md bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-slate-800 shadow-xl flex flex-col items-center justify-center p-2 text-center transition-all duration-300"
                >
                  <AnimatePresence mode="wait">
                    {activeHover === "paid" ? (
                      <motion.div
                        key="hover-paid"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-0.5"
                      >
                        <div className="flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                          <span>{language === "tr" ? "ÖDENMİŞ" : "PAID"}</span>
                        </div>
                        <span className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 block leading-tight">
                          %{paymentPercentage.toFixed(1)}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block">
                          {format(Math.round(totalPaid))}
                        </span>
                      </motion.div>
                    ) : activeHover === "unpaid" ? (
                      <motion.div
                        key="hover-unpaid"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-0.5"
                      >
                        <div className="flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>{language === "tr" ? "ÖDENMEMİŞ" : "UNPAID"}</span>
                        </div>
                        <span className="text-base sm:text-lg font-black font-mono text-rose-600 dark:text-rose-400 block leading-tight">
                          %{remainingPercentage.toFixed(1)}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block">
                          {format(Math.round(totalRemaining))}
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="default-center"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-0.5"
                      >
                        <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                          {language === "tr" ? "ÖDENME ORANI" : "PAID RATIO"}
                        </span>
                        <span className="text-xl sm:text-2xl font-black font-mono text-slate-800 dark:text-slate-100 block tracking-tight leading-tight">
                          %{animatedPercentage.toFixed(1)}
                        </span>
                        <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                          {language === "tr" ? "Tamamlandı" : "Completed"}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Micro Caption */}
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 text-center mt-2">
              {language === "tr"
                ? "Dilimlerin üzerine gelerek detayları canlı inceleyebilirsiniz"
                : "Hover over the pie slices for live detail preview"}
            </p>
          </div>

          {/* SAĞ BÖLÜM: ETKİLEŞİMLİ VE MODERN BENTO DETAY KARTLARI (Pasta Grafiği ile Senkronize) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            {/* 1. ÖDENMİŞ BORÇLAR KARTI (Neon Yeşil Vurgulu - GPU Hızlandırmalı) */}
            <div
              style={{
                willChange: "transform, opacity",
                transform: "translate3d(0, 0, 0)",
                WebkitBackfaceVisibility: "hidden",
                backfaceVisibility: "hidden",
              }}
              onMouseEnter={() => setActiveHover("paid")}
              onMouseLeave={() => setActiveHover(null)}
              className={`relative overflow-hidden rounded-2xl p-4 sm:p-4.5 border-2 transition-all duration-200 cursor-pointer ${
                activeHover === "paid"
                  ? "border-emerald-400 bg-emerald-50/90 dark:bg-emerald-950/50 shadow-[0_8px_30px_rgb(16,185,129,0.22)] ring-2 ring-emerald-400/40"
                  : "border-emerald-400/40 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-emerald-100/30 dark:from-emerald-950/30 dark:via-emerald-900/20 dark:to-teal-950/20 shadow-sm hover:shadow-md"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Parlayan '✓' Simgesi with neon-green halo & pulse */}
                  <div className="relative flex items-center justify-center shrink-0">
                    <span className="absolute -inset-1 rounded-full bg-emerald-400/40 dark:bg-emerald-400/50 blur-sm animate-pulse" />
                    <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.8)] border border-emerald-200/60">
                      <Check className="w-5 h-5 stroke-[3]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                        {language === "tr" ? "Ödenmiş Borçlar" : "Paid Debts"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono">
                        %{paymentPercentage.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-700 dark:text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.2)] mt-0.5">
                      {format(Math.round(animatedPaidAmount))}
                    </p>
                  </div>
                </div>

                {/* Installment Badge info */}
                <div className="hidden sm:flex flex-col items-end gap-1 text-right">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/90 dark:bg-emerald-950/70 border border-emerald-300/60 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-black shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {Math.round(animatedPaidInstallments)} {language === "tr" ? "Taksit Ödendi" : "Installments Paid"}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700/80 dark:text-emerald-400/80">
                    {singleDebtsPaidCount} {language === "tr" ? "Tekil Borç Kapatıldı" : "Single Debts Settled"}
                  </span>
                </div>
              </div>

              {/* Mobile Only Sub-Row */}
              <div className="sm:hidden pt-2 mt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                <span>{Math.round(animatedPaidInstallments)} Taksit Ödendi</span>
                <span>{singleDebtsPaidCount} Tekil Borç</span>
              </div>
            </div>

            {/* 2. ÖDENMEMİŞ BORÇLAR KARTI (Canlı Turuncu/Kırmızı Vurgulu - GPU Hızlandırmalı) */}
            <div
              style={{
                willChange: "transform, opacity",
                transform: "translate3d(0, 0, 0)",
                WebkitBackfaceVisibility: "hidden",
                backfaceVisibility: "hidden",
              }}
              onMouseEnter={() => setActiveHover("unpaid")}
              onMouseLeave={() => setActiveHover(null)}
              className={`relative overflow-hidden rounded-2xl p-4 sm:p-4.5 border-2 transition-all duration-200 cursor-pointer ${
                activeHover === "unpaid"
                  ? "border-rose-400 bg-rose-50/90 dark:bg-rose-950/50 shadow-[0_8px_30px_rgb(244,63,94,0.22)] ring-2 ring-rose-400/40"
                  : "border-rose-400/40 dark:border-rose-500/30 bg-gradient-to-br from-rose-50/70 via-orange-50/40 to-amber-100/30 dark:from-rose-950/30 dark:via-orange-950/20 dark:to-rose-950/20 shadow-sm hover:shadow-md"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Parlayan Uyarı Simgesi with neon-rose halo & pulse */}
                  <div className="relative flex items-center justify-center shrink-0">
                    <span className="absolute -inset-1 rounded-full bg-rose-400/40 dark:bg-rose-400/50 blur-sm animate-pulse" />
                    <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-rose-600 via-orange-500 to-amber-400 text-white flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.8)] border border-rose-200/60">
                      <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">
                        {language === "tr" ? "Ödenmemiş Borçlar" : "Unpaid Debts"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-mono">
                        %{remainingPercentage.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.2)] mt-0.5">
                      {format(Math.round(animatedRemainingAmount))}
                    </p>
                  </div>
                </div>

                {/* Installment Badge info */}
                <div className="hidden sm:flex flex-col items-end gap-1 text-right">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/90 dark:bg-rose-950/70 border border-rose-300/60 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-[11px] font-black shadow-xs">
                    <Clock className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                    <span>
                      {Math.round(animatedRemainingInstallments)} {language === "tr" ? "Kalan Taksit" : "Remaining Installments"}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-rose-700/80 dark:text-rose-400/80">
                    {singleDebtsUnpaidCount} {language === "tr" ? "Aktif Borç Bekliyor" : "Active Debts Pending"}
                  </span>
                </div>
              </div>

              {/* Mobile Only Sub-Row */}
              <div className="sm:hidden pt-2 mt-2 border-t border-rose-200/60 dark:border-rose-800/40 flex items-center justify-between text-[11px] font-bold text-rose-700 dark:text-rose-300">
                <span>{Math.round(animatedRemainingInstallments)} Kalan Taksit</span>
                <span>{singleDebtsUnpaidCount} Aktif Borç</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AnimatedDebtStatusPanel = React.memo(AnimatedDebtStatusPanelComponent);
export default AnimatedDebtStatusPanel;
