/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { Edit, Trash2, RotateCcw, Wallet } from "lucide-react";
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
      className={`relative overflow-hidden rounded-3xl p-5 border ${cardTheme.border} text-white bg-gradient-to-br ${cardTheme.gradient} shadow-md ${cardTheme.glow} flex flex-col justify-between min-h-[210px] select-none backdrop-blur-md transition-all duration-200 hover:-translate-y-1`}
    >
      {/* Decorative intersecting circles context layout */}
      <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
      <div className="absolute -left-10 -bottom-10 w-36 h-36 rounded-full bg-white/5 blur-xl pointer-events-none" />

      {/* Upper Deck: Chip, Name, and Brand */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Simulated golden SIM card chip */}
          <div className="w-8 h-6 rounded-md bg-amber-400/90 relative overflow-hidden border border-amber-300/60 shadow-xs shrink-0">
            {/* Chip metal grid lines */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-px p-0.5 opacity-60">
              <div className="border border-amber-600/40 rounded-xs"></div>
              <div className="border border-amber-600/40 rounded-xs"></div>
              <div className="border border-amber-600/40 rounded-xs"></div>
              <div className="border border-amber-600/40 rounded-xs"></div>
              <div className="border border-amber-600/40 rounded-xs"></div>
              <div className="border border-amber-600/40 rounded-xs"></div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {provider && (
                <ProviderBadge providerId={provider.id} size="sm" showLabel={false} />
              )}
              <h4 className="text-xs font-black tracking-wide uppercase truncate max-w-[140px] text-white" title={inst.name}>
                {inst.name}
              </h4>
              {provider && (
                <span className="text-[9px] text-white/80 font-bold">
                  ({provider.badgeLabel || provider.name})
                </span>
              )}
            </div>
            <p className="text-[8px] text-white/70 font-mono tracking-widest">{cardTheme.brand}</p>
          </div>
        </div>

        <span className={`px-2 py-0.5 border text-[9px] font-black rounded-md tracking-wider shrink-0 shadow-xs uppercase leading-none ${cardTheme.badge}`}>
          {inst.paidInstallmentCount} / {inst.installmentCount} Taksit
        </span>
      </div>

      {/* Middle Deck: Large display of monthly payment amount */}
      <div className="relative z-10 my-3">
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
          <div className="flex gap-4 font-mono">
            <div>
              <span className="text-[8px] text-white/60 block font-normal leading-none mb-0.5">TOPLAM</span>
              <span className="font-extrabold text-white">{format(inst.totalAmount)}</span>
            </div>
            <div>
              <span className="text-[8px] text-white/60 block font-normal leading-none mb-0.5">KALAN</span>
              <span className="font-extrabold text-amber-300">{format(remaining)}</span>
            </div>
            <div>
              <span className="text-[8px] text-white/60 block font-normal leading-none mb-0.5">VALİD THRU</span>
              <span className="font-extrabold text-white">{expiryText}</span>
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
