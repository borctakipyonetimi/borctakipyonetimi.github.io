/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { Edit, Trash2, RotateCcw, Wallet, AlertCircle, AlertTriangle, Clock, CheckCircle2, CalendarDays } from "lucide-react";
import { InstallmentDebt } from "../types";
import { ProviderBadge } from "./ProviderBadge";
import { getProviderById, detectProviderFromName } from "../data/providers";

export const INSTALLMENT_CARD_THEMES = [
  {
    gradient: "from-indigo-600 via-indigo-700 to-slate-900 dark:from-indigo-950/95 dark:via-indigo-900/90 dark:to-slate-900",
    glow: "shadow-indigo-500/25 dark:shadow-indigo-500/20",
    border: "border-indigo-400/40 dark:border-indigo-400/30",
    brand: "PREMIUM PLATINUM",
    badge: "bg-white/20 text-white border-white/30 backdrop-blur-xs",
  },
  {
    gradient: "from-blue-600 via-blue-700 to-slate-900 dark:from-blue-950/95 dark:via-cyan-950/90 dark:to-slate-900",
    glow: "shadow-blue-500/25 dark:shadow-blue-500/20",
    border: "border-blue-400/40 dark:border-blue-400/30",
    brand: "WORLD SIGNATURE",
    badge: "bg-white/20 text-white border-white/30 backdrop-blur-xs",
  },
  {
    gradient: "from-rose-600 via-rose-700 to-slate-900 dark:from-rose-950/95 dark:via-rose-900/90 dark:to-slate-900",
    glow: "shadow-rose-500/25 dark:shadow-rose-500/20",
    border: "border-rose-400/40 dark:border-rose-400/30",
    brand: "AMEX ULTIMATE",
    badge: "bg-white/20 text-white border-white/30 backdrop-blur-xs",
  },
  {
    gradient: "from-emerald-600 via-emerald-700 to-slate-900 dark:from-emerald-950/95 dark:via-teal-900/90 dark:to-slate-900",
    glow: "shadow-emerald-500/25 dark:shadow-emerald-500/20",
    border: "border-emerald-400/40 dark:border-emerald-400/30",
    brand: "ECO CAPITAL",
    badge: "bg-white/20 text-white border-white/30 backdrop-blur-xs",
  },
  {
    gradient: "from-amber-600 via-orange-700 to-slate-900 dark:from-amber-950/95 dark:via-orange-900/90 dark:to-slate-900",
    glow: "shadow-amber-500/25 dark:shadow-amber-500/20",
    border: "border-amber-400/40 dark:border-amber-400/30",
    brand: "GOLD METALLIC",
    badge: "bg-white/20 text-white border-white/30 backdrop-blur-xs",
  },
  {
    gradient: "from-purple-600 via-violet-700 to-slate-900 dark:from-violet-950/95 dark:via-purple-900/90 dark:to-slate-900",
    glow: "shadow-purple-500/25 dark:shadow-violet-500/20",
    border: "border-purple-400/40 dark:border-violet-400/30",
    brand: "TITANIUM BLACK",
    badge: "bg-white/20 text-white border-white/30 backdrop-blur-xs",
  },
];

export interface InstallmentCardItemProps {
  inst: InstallmentDebt;
  format: (amount: number) => string;
  onEdit: (inst: InstallmentDebt) => void;
  onDelete: (id: number) => void;
  onRevert?: (id: number) => void;
  onPay: (inst: InstallmentDebt) => void;
}

function InstallmentCardItemComponent({
  inst,
  format,
  onEdit,
  onDelete,
  onRevert,
  onPay,
}: InstallmentCardItemProps) {
  // Memoized math calculations
  const singlePayment = useMemo(() => {
    return inst.installmentCount > 0 ? inst.totalAmount / inst.installmentCount : 0;
  }, [inst.totalAmount, inst.installmentCount]);

  const remaining = useMemo(() => {
    return Math.max(0, (inst.installmentCount - inst.paidInstallmentCount) * singlePayment);
  }, [inst.installmentCount, inst.paidInstallmentCount, singlePayment]);

  const percentage = useMemo(() => {
    return inst.installmentCount > 0
      ? Math.min((inst.paidInstallmentCount / inst.installmentCount) * 100, 100)
      : 0;
  }, [inst.paidInstallmentCount, inst.installmentCount]);

  const isCompleted = inst.paidInstallmentCount >= inst.installmentCount;

  // Memoized theme selection
  const cardTheme = useMemo(() => {
    const themeIndex = Math.abs(inst.id || 0) % INSTALLMENT_CARD_THEMES.length;
    return INSTALLMENT_CARD_THEMES[themeIndex];
  }, [inst.id]);

  // Memoized due date status calculation
  const dueDateInfo = useMemo(() => {
    if (isCompleted) {
      return {
        status: "completed" as const,
        label: "Ödendi",
        badgeText: "Ödendi",
        subLabel: "Tüm taksitler tamamlandı",
        diffDays: 0,
        dueDateFormatted: null,
      };
    }

    if (!inst.firstDueDate) {
      return {
        status: "unknown" as const,
        label: "Vade Belirtilmedi",
        badgeText: "Vade Yok",
        subLabel: null,
        diffDays: null,
        dueDateFormatted: null,
      };
    }

    try {
      const parts = inst.firstDueDate.split("-");
      if (parts.length !== 3) {
        return {
          status: "unknown" as const,
          label: "Vade Belirtilmedi",
          badgeText: "Vade Yok",
          subLabel: null,
          diffDays: null,
          dueDateFormatted: null,
        };
      }

      const startYear = parseInt(parts[0], 10);
      const startMonth = parseInt(parts[1], 10) - 1;
      const startDay = parseInt(parts[2], 10);

      // Next due date corresponds to current paidInstallmentCount index
      const targetDate = new Date(startYear, startMonth + inst.paidInstallmentCount, startDay);
      if (isNaN(targetDate.getTime())) {
        return {
          status: "unknown" as const,
          label: "Vade Belirtilmedi",
          badgeText: "Vade Yok",
          subLabel: null,
          diffDays: null,
          dueDateFormatted: null,
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dueMidnight = new Date(targetDate);
      dueMidnight.setHours(0, 0, 0, 0);

      const diffMs = dueMidnight.getTime() - today.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      const dayNum = String(targetDate.getDate()).padStart(2, "0");
      const monthShortNames = [
        "Oca", "Şub", "Mar", "Nis", "May", "Haz",
        "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"
      ];
      const monthShort = monthShortNames[targetDate.getMonth()] || "";
      const yearNum = targetDate.getFullYear();
      const dueDateFormatted = `${dayNum} ${monthShort} ${yearNum}`;

      if (diffDays < 0) {
        const daysLate = Math.abs(diffDays);
        return {
          status: "overdue" as const,
          label: daysLate === 1 ? "Günü Geçti! (1 gün gecikti)" : `Günü Geçti! (${daysLate} gün gecikti)`,
          badgeText: daysLate === 1 ? "Günü Geçti! (1 gün)" : `Günü Geçti! (${daysLate} gün)`,
          subLabel: `Vade: ${dueDateFormatted}`,
          diffDays,
          dueDateFormatted,
        };
      } else if (diffDays === 0) {
        return {
          status: "due_today" as const,
          label: "Vadesi Geldi! (Bugün)",
          badgeText: "Vadesi Geldi! (Bugün)",
          subLabel: "Bugün son ödeme günü",
          diffDays: 0,
          dueDateFormatted,
        };
      } else if (diffDays <= 3) {
        return {
          status: "approaching" as const,
          label: diffDays === 1 ? "Ödeme Yaklaştı (Yarın)" : `Ödeme Yaklaştı (${diffDays} gün kaldı)`,
          badgeText: diffDays === 1 ? "Ödeme Yaklaştı (Yarın)" : `Ödeme Yaklaştı (${diffDays} gün)`,
          subLabel: `Vade: ${dueDateFormatted}`,
          diffDays,
          dueDateFormatted,
        };
      } else {
        return {
          status: "upcoming" as const,
          label: `Sonraki Vade: ${dueDateFormatted}`,
          badgeText: dueDateFormatted,
          subLabel: `${diffDays} gün sonra`,
          diffDays,
          dueDateFormatted,
        };
      }
    } catch {
      return {
        status: "unknown" as const,
        label: "Vade Belirtilmedi",
        badgeText: "Vade Yok",
        subLabel: null,
        diffDays: null,
        dueDateFormatted: null,
      };
    }
  }, [inst.firstDueDate, inst.paidInstallmentCount, isCompleted]);

  // Memoized expiry text
  const expiryText = useMemo(() => {
    try {
      const baseDate = new Date(inst.firstDueDate || new Date().toISOString());
      baseDate.setMonth(baseDate.getMonth() + (inst.installmentCount || 1));
      const mm = String(baseDate.getMonth() + 1).padStart(2, "0");
      const yy = String(baseDate.getFullYear()).slice(-2);
      return `${mm}/${yy}`;
    } catch {
      return "12/28";
    }
  }, [inst.firstDueDate, inst.installmentCount]);

  // Memoized provider lookup
  const provider = useMemo(() => {
    return getProviderById(inst.providerId) || detectProviderFromName(inst.name);
  }, [inst.providerId, inst.name]);

  return (
    <div
      id={`installment-card-${inst.id}`}
      style={{
        willChange: "transform",
        transform: "translateZ(0)",
      }}
      className={`relative overflow-hidden rounded-3xl p-5 border text-white bg-gradient-to-br ${cardTheme.gradient} flex flex-col justify-between min-h-[220px] select-none backdrop-blur-md transition-all duration-300 hover:-translate-y-1 ${cardTheme.border} ${cardTheme.glow} ${
        dueDateInfo.status === "overdue"
          ? "ring-2 ring-rose-500 shadow-xl shadow-rose-950/40"
          : dueDateInfo.status === "due_today"
          ? "ring-2 ring-rose-400 shadow-xl shadow-rose-950/35"
          : dueDateInfo.status === "approaching"
          ? "ring-2 ring-amber-400 shadow-xl shadow-amber-950/30"
          : isCompleted
          ? "opacity-90"
          : ""
      }`}
    >
      {/* Decorative intersecting circles context layout */}
      <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
      <div className="absolute -left-10 -bottom-10 w-36 h-36 rounded-full bg-white/5 blur-xl pointer-events-none" />

      {/* Upper Deck: Provider Logo, Name, and Badges */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {provider && (
            <ProviderBadge providerId={provider.id} size="sm" showLabel={false} className="shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs sm:text-sm font-black tracking-wide uppercase truncate max-w-[150px] sm:max-w-[200px] text-white" title={inst.name}>
                {inst.name}
              </h4>
              {provider && (
                <span className="text-[9px] text-white/80 font-bold truncate max-w-[100px]">
                  ({provider.badgeLabel || provider.name})
                </span>
              )}
            </div>
            <p className="text-[8px] text-white/70 font-mono tracking-widest">{cardTheme.brand}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`px-2 py-0.5 border text-[9px] font-black rounded-md tracking-wider shadow-xs uppercase leading-none ${cardTheme.badge}`}>
            {inst.paidInstallmentCount} / {inst.installmentCount} Taksit
          </span>
          {/* Due date warning badge */}
          {dueDateInfo.status === "overdue" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black tracking-wide border border-rose-300 shadow-md shadow-rose-950/40 animate-pulse">
              <AlertCircle className="w-3 h-3 text-rose-100 shrink-0" />
              {dueDateInfo.badgeText}
            </span>
          )}
          {dueDateInfo.status === "due_today" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-black tracking-wide border border-rose-200 shadow-md shadow-rose-950/40 animate-pulse">
              <AlertCircle className="w-3 h-3 text-rose-100 shrink-0" />
              {dueDateInfo.badgeText}
            </span>
          )}
          {dueDateInfo.status === "approaching" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[9px] font-black tracking-wide border border-amber-200 shadow-sm shadow-amber-950/30">
              <Clock className="w-3 h-3 text-slate-950 shrink-0" />
              {dueDateInfo.badgeText}
            </span>
          )}
          {dueDateInfo.status === "completed" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-200 text-[9px] font-bold border border-emerald-400/40">
              <CheckCircle2 className="w-3 h-3 text-emerald-300 shrink-0" />
              Ödendi
            </span>
          )}
        </div>
      </div>

      {/* Prominent Visual Warning Callout Banner for Vade Durumu */}
      {dueDateInfo.status === "overdue" && (
        <div className="relative z-10 my-2 px-2.5 py-1.5 rounded-xl bg-rose-600/35 border border-rose-400/50 backdrop-blur-xs flex items-center justify-between text-xs font-semibold text-rose-100 shadow-xs">
          <div className="flex items-center gap-1.5 font-black text-white">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-300 animate-bounce shrink-0" />
            <span>GÜNÜ GEÇTİ!</span>
          </div>
          <span className="text-[9.5px] text-rose-200 font-mono font-bold">
            {dueDateInfo.label}
          </span>
        </div>
      )}
      {dueDateInfo.status === "due_today" && (
        <div className="relative z-10 my-2 px-2.5 py-1.5 rounded-xl bg-rose-500/35 border border-rose-300/50 backdrop-blur-xs flex items-center justify-between text-xs font-semibold text-rose-100 shadow-xs">
          <div className="flex items-center gap-1.5 font-black text-white">
            <AlertCircle className="w-3.5 h-3.5 text-rose-200 animate-pulse shrink-0" />
            <span>VADESİ GELDİ!</span>
          </div>
          <span className="text-[9.5px] text-rose-200 font-mono font-bold">
            Bugün Son Gün
          </span>
        </div>
      )}
      {dueDateInfo.status === "approaching" && (
        <div className="relative z-10 my-2 px-2.5 py-1.5 rounded-xl bg-amber-500/30 border border-amber-300/45 backdrop-blur-xs flex items-center justify-between text-xs font-semibold text-amber-100 shadow-xs">
          <div className="flex items-center gap-1.5 font-black text-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>ÖDEME YAKLAŞTI!</span>
          </div>
          <span className="text-[9.5px] text-amber-200 font-mono font-bold">
            {dueDateInfo.label}
          </span>
        </div>
      )}

      {/* Middle Deck: Large display of monthly payment amount */}
      <div className="relative z-10 my-2">
        <span className="text-[9px] text-white/70 font-black uppercase tracking-widest block leading-none mb-1">
          AYLIK ÖDEME TUTARI
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white drop-shadow-xs">
            {format(singlePayment)}
          </span>
          <span className="text-[10px] text-white/80 font-bold">/ ay</span>
        </div>
      </div>

      {/* Bottom Stats & Data section */}
      <div className="relative z-10 space-y-3">
        {/* Real-time slider progress line */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-white/80 font-bold font-mono">
            <span>Ödenen {inst.paidInstallmentCount} Taksit</span>
            <span>%{percentage.toFixed(0)} pay</span>
          </div>
          <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden shadow-inner flex">
            <div
              style={{ width: `${percentage}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                isCompleted ? "bg-emerald-400" : "bg-gradient-to-r from-teal-300 via-emerald-300 to-amber-300"
              }`}
            />
          </div>
        </div>

        {/* Valid-thru, totals description and action buttons */}
        <div className="flex items-center justify-between text-white/90 text-[10px] font-semibold gap-2 border-t border-white/15 pt-2.5">
          <div className="flex gap-3 sm:gap-4 font-mono">
            <div>
              <span className="text-[8px] text-white/60 block font-normal leading-none mb-0.5">TOPLAM</span>
              <span className="font-extrabold text-white">{format(inst.totalAmount)}</span>
            </div>
            <div>
              <span className="text-[8px] text-white/60 block font-normal leading-none mb-0.5">KALAN</span>
              <span className="font-extrabold text-amber-300">{format(remaining)}</span>
            </div>
            <div>
              <span className="text-[8px] text-white/60 block font-normal leading-none mb-0.5">
                {isCompleted ? "DURUM" : "SONRAKİ VADE"}
              </span>
              <span className={`font-extrabold ${
                dueDateInfo.status === "overdue" || dueDateInfo.status === "due_today"
                  ? "text-rose-300"
                  : dueDateInfo.status === "approaching"
                  ? "text-amber-300"
                  : isCompleted
                  ? "text-emerald-300"
                  : "text-white"
              }`}>
                {isCompleted ? "Tamamlandı" : (dueDateInfo.dueDateFormatted || expiryText)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(inst)}
              className="p-1 px-1.5 bg-white/20 hover:bg-white/30 border border-white/20 text-white rounded-md transition shadow-xs cursor-pointer"
              title="Düzenle"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(inst.id)}
              className="p-1 px-1.5 bg-rose-500/30 hover:bg-rose-500/50 border border-rose-300/30 text-white rounded-md transition shadow-xs cursor-pointer"
              title="Sil"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {onRevert && (
              <button
                type="button"
                disabled={inst.paidInstallmentCount === 0}
                onClick={() => onRevert(inst.id)}
                title="Taksiti Geri Al"
                className={`p-1 px-1.5 rounded-md transition shadow-xs cursor-pointer ${
                  inst.paidInstallmentCount === 0
                    ? "opacity-30 cursor-not-allowed text-white/40 border border-transparent"
                    : "bg-white/20 hover:bg-white/30 border border-white/20 text-white"
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            {!isCompleted && (
              <button
                type="button"
                onClick={() => onPay(inst)}
                className="px-2.5 py-1 bg-white hover:bg-white/90 text-slate-900 font-extrabold text-[10px] rounded-md shadow-md transition active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <Wallet className="w-3 h-3 text-slate-900" /> Taksit Öde
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const InstallmentCardItem = React.memo(InstallmentCardItemComponent);
