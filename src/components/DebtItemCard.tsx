/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Edit, Trash2, CheckCircle2, Circle, Calendar, Coins, BellRing, CheckSquare, Square } from "lucide-react";
import { Debt } from "../types";
import { ProviderBadge } from "./ProviderBadge";
import { getProviderById, detectProviderFromName } from "../data/providers";

export const DEBT_CARD_THEMES = [
  {
    // 0. Sapphire / Indigo Blue
    gradient: "from-blue-100 via-indigo-100/90 to-sky-200/80 dark:from-indigo-950/90 dark:via-indigo-900/80 dark:to-slate-900",
    border: "border-2 border-indigo-400 dark:border-indigo-500/40",
    glow: "shadow-xl shadow-indigo-200/70 dark:shadow-indigo-500/20",
    accent: "text-indigo-800 dark:text-indigo-200",
    badge: "bg-indigo-200/90 text-indigo-950 border-indigo-400/80 dark:bg-white/20 dark:text-white dark:border-white/30 backdrop-blur-xs font-black",
    progressGradient: "from-indigo-600 via-blue-600 to-cyan-500 dark:from-indigo-300 dark:via-cyan-300 dark:to-indigo-200",
    tagBg: "bg-white/95 border-indigo-300 dark:bg-black/20 dark:border-white/10 text-slate-900 dark:text-white/85",
  },
  {
    // 1. Ruby / Crimson Red
    gradient: "from-rose-100 via-pink-100/90 to-red-200/80 dark:from-rose-950/90 dark:via-rose-900/80 dark:to-slate-900",
    border: "border-2 border-rose-400 dark:border-rose-500/40",
    glow: "shadow-xl shadow-rose-200/70 dark:shadow-rose-500/20",
    accent: "text-rose-800 dark:text-rose-200",
    badge: "bg-rose-200/90 text-rose-950 border-rose-400/80 dark:bg-white/20 dark:text-white dark:border-white/30 backdrop-blur-xs font-black",
    progressGradient: "from-rose-600 via-red-600 to-amber-500 dark:from-rose-300 dark:via-amber-300 dark:to-rose-200",
    tagBg: "bg-white/95 border-rose-300 dark:bg-black/20 dark:border-white/10 text-slate-900 dark:text-white/85",
  },
  {
    // 2. Emerald / Forest Green
    gradient: "from-emerald-100 via-teal-100/90 to-green-200/80 dark:from-emerald-950/90 dark:via-emerald-900/80 dark:to-slate-900",
    border: "border-2 border-emerald-400 dark:border-emerald-500/40",
    glow: "shadow-xl shadow-emerald-200/70 dark:shadow-emerald-500/20",
    accent: "text-emerald-800 dark:text-emerald-200",
    badge: "bg-emerald-200/90 text-emerald-950 border-emerald-400/80 dark:bg-white/20 dark:text-white dark:border-white/30 backdrop-blur-xs font-black",
    progressGradient: "from-emerald-600 via-teal-600 to-green-500 dark:from-emerald-300 dark:via-teal-200 dark:to-emerald-300",
    tagBg: "bg-white/95 border-emerald-300 dark:bg-black/20 dark:border-white/10 text-slate-900 dark:text-white/85",
  },
  {
    // 3. Azure / Ocean Cyan
    gradient: "from-cyan-100 via-sky-100/90 to-blue-200/80 dark:from-blue-950/90 dark:via-cyan-950/80 dark:to-slate-900",
    border: "border-2 border-cyan-400 dark:border-cyan-500/40",
    glow: "shadow-xl shadow-cyan-200/70 dark:shadow-blue-500/20",
    accent: "text-cyan-800 dark:text-cyan-200",
    badge: "bg-cyan-200/90 text-cyan-950 border-cyan-400/80 dark:bg-white/20 dark:text-white dark:border-white/30 backdrop-blur-xs font-black",
    progressGradient: "from-cyan-600 via-blue-600 to-indigo-500 dark:from-cyan-300 dark:via-blue-200 dark:to-cyan-300",
    tagBg: "bg-white/95 border-cyan-300 dark:bg-black/20 dark:border-white/10 text-slate-900 dark:text-white/85",
  },
  {
    // 4. Amethyst / Royal Purple
    gradient: "from-purple-100 via-violet-100/90 to-fuchsia-200/80 dark:from-violet-950/90 dark:via-purple-900/80 dark:to-slate-900",
    border: "border-2 border-purple-400 dark:border-purple-500/40",
    glow: "shadow-xl shadow-purple-200/70 dark:shadow-violet-500/20",
    accent: "text-purple-800 dark:text-violet-200",
    badge: "bg-purple-200/90 text-purple-950 border-purple-400/80 dark:bg-white/20 dark:text-white dark:border-white/30 backdrop-blur-xs font-black",
    progressGradient: "from-purple-600 via-violet-600 to-pink-500 dark:from-violet-300 dark:via-fuchsia-300 dark:to-violet-200",
    tagBg: "bg-white/95 border-purple-300 dark:bg-black/20 dark:border-white/10 text-slate-900 dark:text-white/85",
  },
  {
    // 5. Sunset Gold / Amber
    gradient: "from-amber-100 via-orange-100/90 to-yellow-200/80 dark:from-amber-950/90 dark:via-orange-900/80 dark:to-slate-900",
    border: "border-2 border-amber-400 dark:border-amber-500/40",
    glow: "shadow-xl shadow-amber-200/70 dark:shadow-amber-500/20",
    accent: "text-amber-800 dark:text-amber-200",
    badge: "bg-amber-200/90 text-amber-950 border-amber-400/80 dark:bg-white/20 dark:text-white dark:border-white/30 backdrop-blur-xs font-black",
    progressGradient: "from-amber-600 via-orange-600 to-yellow-500 dark:from-amber-300 dark:via-yellow-200 dark:to-orange-300",
    tagBg: "bg-white/95 border-amber-300 dark:bg-black/20 dark:border-white/10 text-slate-900 dark:text-white/85",
  },
  {
    // 6. Fuchsia / Hot Pink
    gradient: "from-pink-100 via-rose-100/90 to-fuchsia-200/80 dark:from-fuchsia-950/90 dark:via-pink-900/80 dark:to-slate-900",
    border: "border-2 border-pink-400 dark:border-pink-500/40",
    glow: "shadow-xl shadow-pink-200/70 dark:shadow-fuchsia-500/20",
    accent: "text-pink-800 dark:text-pink-200",
    badge: "bg-pink-200/90 text-pink-950 border-pink-400/80 dark:bg-white/20 dark:text-white dark:border-white/30 backdrop-blur-xs font-black",
    progressGradient: "from-pink-600 via-rose-600 to-purple-500 dark:from-fuchsia-300 dark:via-pink-200 dark:to-rose-300",
    tagBg: "bg-white/95 border-pink-300 dark:bg-black/20 dark:border-white/10 text-slate-900 dark:text-white/85",
  },
  {
    // 7. Teal / Marine Turquoise
    gradient: "from-teal-100 via-emerald-100/90 to-cyan-200/80 dark:from-teal-950/90 dark:via-teal-900/80 dark:to-slate-900",
    border: "border-2 border-teal-400 dark:border-teal-500/40",
    glow: "shadow-xl shadow-teal-200/70 dark:shadow-teal-500/20",
    accent: "text-teal-800 dark:text-teal-200",
    badge: "bg-teal-200/90 text-teal-950 border-teal-400/80 dark:bg-white/20 dark:text-white dark:border-white/30 backdrop-blur-xs font-black",
    progressGradient: "from-teal-600 via-cyan-600 to-emerald-500 dark:from-teal-300 dark:via-emerald-200 dark:to-cyan-300",
    tagBg: "bg-white/95 border-teal-300 dark:bg-black/20 dark:border-white/10 text-slate-900 dark:text-white/85",
  },
  {
    // 8. Scarlet / Warm Coral
    gradient: "from-orange-100 via-rose-100/90 to-red-200/80 dark:from-red-950/90 dark:via-rose-950/80 dark:to-slate-900",
    border: "border-2 border-orange-400 dark:border-red-500/40",
    glow: "shadow-xl shadow-orange-200/70 dark:shadow-red-500/20",
    accent: "text-orange-800 dark:text-red-200",
    badge: "bg-orange-200/90 text-orange-950 border-orange-400/80 dark:bg-white/20 dark:text-white dark:border-white/30 backdrop-blur-xs font-black",
    progressGradient: "from-red-600 via-rose-600 to-orange-500 dark:from-red-300 dark:via-orange-300 dark:to-rose-200",
    tagBg: "bg-white/95 border-orange-300 dark:bg-black/20 dark:border-white/10 text-slate-900 dark:text-white/85",
  },
  {
    // 9. Midnight Obsidian / Slate-Blue
    gradient: "from-slate-200 via-blue-100/90 to-indigo-200/80 dark:from-slate-800/90 dark:via-slate-900/80 dark:to-slate-950",
    border: "border-2 border-slate-400 dark:border-slate-500/40",
    glow: "shadow-xl shadow-slate-300/70 dark:shadow-slate-500/20",
    accent: "text-slate-900 dark:text-slate-200",
    badge: "bg-slate-300/90 text-slate-950 border-slate-400/80 dark:bg-white/20 dark:text-white dark:border-white/30 backdrop-blur-xs font-black",
    progressGradient: "from-slate-700 via-indigo-600 to-blue-600 dark:from-slate-300 dark:via-indigo-200 dark:to-cyan-300",
    tagBg: "bg-white/95 border-slate-300 dark:bg-black/20 dark:border-white/10 text-slate-900 dark:text-white/85",
  },
];

export interface DebtItemCardProps {
  d: Debt;
  itemIdx: number;
  totalCount: number;
  format: (amount: number) => string;
  onEdit: (d: Debt) => void;
  onDelete: (id: number) => void;
  onTogglePaid: (id: number) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
}

function DebtItemCardComponent({
  d,
  itemIdx,
  totalCount,
  format,
  onEdit,
  onDelete,
  onTogglePaid,
  isSelected = false,
  onToggleSelect,
}: DebtItemCardProps) {
  const isPaid = d.paid >= d.amount;

  // Memoized percentage
  const percentage = useMemo(() => {
    if (!d.amount || d.amount <= 0) return 0;
    return Math.min((d.paid / d.amount) * 100, 100);
  }, [d.paid, d.amount]);

  // Memoized diffDays
  const diffDays = useMemo(() => {
    if (!d.dueDate) return null;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(d.dueDate);
      due.setHours(0, 0, 0, 0);
      const diffTime = due.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  }, [d.dueDate]);

  // Memoized formatted date string
  const formattedDueDate = useMemo(() => {
    if (!d.dueDate) return "";
    try {
      return new Date(d.dueDate).toLocaleDateString("tr-TR");
    } catch {
      return d.dueDate;
    }
  }, [d.dueDate]);

  const isOverdue = !isPaid && diffDays !== null && diffDays < 0;
  const isNearDue = !isPaid && !isOverdue && diffDays !== null && diffDays >= 0 && diffDays <= 3;

  // Memoized color theme per card
  const cardTheme = useMemo(() => {
    const themeIndex = Math.abs((d.id || itemIdx) + (d.name ? d.name.charCodeAt(0) : 0)) % DEBT_CARD_THEMES.length;
    return DEBT_CARD_THEMES[themeIndex];
  }, [d.id, itemIdx, d.name]);

  // Memoized provider detection
  const provider = useMemo(() => {
    return getProviderById(d.providerId) || detectProviderFromName(d.name, d.category);
  }, [d.providerId, d.name, d.category]);

  return (
    <div
      id={`debt-card-${d.id}`}
      style={{
        willChange: "transform",
        transform: "translateZ(0)",
      }}
      className={`p-4 sm:p-5 rounded-3xl border ${cardTheme.border} ${cardTheme.glow} relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 backdrop-blur-md bg-gradient-to-br ${cardTheme.gradient}`}
    >
      {/* Ambient background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/25 via-transparent to-white/15 pointer-events-none" />
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-indigo-500/10 dark:bg-white/10 blur-xl pointer-events-none" />
      <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-purple-500/10 dark:bg-white/5 blur-xl pointer-events-none" />

      <div className="space-y-3 flex-1 relative z-10">
        {/* Top Header Row: Logo & Name on Left, Order Number on Right */}
        <div className="flex items-center justify-between gap-2.5">
          {/* Sol Üst Köşe: Seçim Kutucuğu, Logo & Borç Adı */}
          <div className="flex items-center gap-2.5 min-w-0">
            {onToggleSelect && (
              <button
                type="button"
                onClick={() => onToggleSelect(d.id)}
                className={`p-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400"
                    : "bg-slate-200/90 hover:bg-slate-300 text-slate-500 dark:bg-white/15 dark:hover:bg-white/25 dark:text-white/70"
                }`}
                title={isSelected ? "Seçimi Kaldır" : "Borcu Seç"}
              >
                {isSelected ? (
                  <CheckSquare className="w-4 h-4 text-white" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500 dark:text-white/70" />
                )}
              </button>
            )}
            {provider ? (
              <div className="shrink-0">
                <ProviderBadge providerId={provider.id} size="md" showLabel={false} />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-slate-200/90 dark:bg-white/10 flex items-center justify-center shrink-0 border border-slate-300/70 dark:border-white/20 shadow-xs">
                <Coins className="w-4 h-4 text-slate-700 dark:text-white/80" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight truncate">
                  {d.name}
                </span>
                {provider?.badgeLabel || provider?.name ? (
                  <span className="text-[10px] font-bold text-slate-700 dark:text-white/90 bg-slate-100/90 dark:bg-white/15 px-2 py-0.5 rounded-lg border border-slate-200/80 dark:border-white/20 backdrop-blur-xs shrink-0">
                    {provider.badgeLabel || provider.name}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Sağ Üst Köşe: Borç Sıra Numarası Rozeti */}
          <div
            title={`Borç Sıra Numarası: ${itemIdx + 1} / ${totalCount}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/95 dark:bg-black/45 border-2 border-indigo-400/80 dark:border-white/20 text-slate-900 dark:text-white font-mono font-black text-xs shadow-md shadow-indigo-200/50 dark:shadow-none shrink-0 select-none ml-auto"
          >
            <span className="w-5 h-5 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center text-[10.5px] font-black shadow-xs">
              {itemIdx + 1}
            </span>
            <span className="text-[10px] font-extrabold text-slate-600 dark:text-white/60">/ {totalCount} Borç</span>
          </div>
        </div>

        {/* Badges row: Category, Status, SKT */}
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="px-2.5 py-0.5 bg-slate-100/90 dark:bg-white/15 text-slate-700 dark:text-white text-[10.5px] font-bold rounded-full border border-slate-200/80 dark:border-white/20 backdrop-blur-xs">
            📁 {d.category}
          </span>
          {isPaid ? (
            <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-400/30 text-emerald-700 dark:text-emerald-100 text-[10.5px] font-black rounded-full border border-emerald-200 dark:border-emerald-300/40 backdrop-blur-xs flex items-center gap-1 shadow-xs">
              🟢 Ödendi
            </span>
          ) : (
            <span className="px-2.5 py-0.5 bg-slate-100/90 dark:bg-black/30 text-slate-700 dark:text-white/90 text-[10.5px] font-black rounded-full border border-slate-200/80 dark:border-white/20 backdrop-blur-xs flex items-center gap-1">
              🔴 Ödenmedi
            </span>
          )}
          {formattedDueDate && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-white/85 bg-slate-100/90 dark:bg-black/20 px-2 py-0.5 rounded-lg border border-slate-200/80 dark:border-white/10">
              <Calendar className="w-3.5 h-3.5 text-amber-500 dark:text-amber-300" /> SKT: {formattedDueDate}
            </span>
          )}
        </div>

        {/* Dedicated Animated Status Indicator Row for Overdue or Near Due */}
        {isOverdue && (
          <div className="pt-0.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 text-white text-xs font-black shadow-md shadow-rose-500/25 border border-rose-400/80 select-none animate-pulse">
              <span className="inline-block text-sm">⚠️</span>
              <span>Vadesi Geçmiş {diffDays !== null && `(${Math.abs(diffDays)} gün geçti)`}</span>
            </div>
          </div>
        )}

        {isNearDue && (
          <div className="pt-0.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 text-xs font-black shadow-md shadow-amber-500/25 border border-amber-300 select-none">
              <BellRing className="w-4 h-4 text-slate-950 animate-bounce" />
              <span>Vadesi Yakın {diffDays === 0 ? "(Bugün Son Gün!)" : `(${diffDays} gün kaldı)`}</span>
            </div>
          </div>
        )}

        {/* Amount indicators stats grid */}
        <div className="flex items-center flex-wrap gap-2 text-xs font-medium">
          <div className="bg-slate-100/90 dark:bg-black/20 px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-white/10 flex items-center gap-1.5 shadow-xs">
            <span className="text-slate-500 dark:text-white/60 text-[10px] uppercase font-bold">Tutar:</span>
            <span className="font-black font-mono text-slate-900 dark:text-white text-xs sm:text-sm">{format(d.amount)}</span>
          </div>
          <div className="bg-emerald-50 dark:bg-black/20 px-2.5 py-1 rounded-xl border border-emerald-200/70 dark:border-white/10 flex items-center gap-1.5 shadow-xs">
            <span className="text-emerald-700 dark:text-emerald-300 text-[10px] uppercase font-bold">Ödenen:</span>
            <span className="font-black text-emerald-700 dark:text-emerald-300 font-mono text-xs sm:text-sm">{format(d.paid)}</span>
          </div>
          <div className="bg-rose-50 dark:bg-black/20 px-2.5 py-1 rounded-xl border border-rose-200/70 dark:border-white/10 flex items-center gap-1.5 shadow-xs">
            <span className="text-rose-700 dark:text-rose-300 text-[10px] uppercase font-bold">Kalan:</span>
            <span className="font-black text-rose-700 dark:text-rose-300 font-mono text-xs sm:text-sm">{format(d.amount - d.paid)}</span>
          </div>
        </div>

        {/* High tech progress bar */}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-[10px] text-slate-500 dark:text-white/70 font-mono font-bold">
            <span>Ödeme Oranı</span>
            <span>%{percentage.toFixed(0)}</span>
          </div>
          <div className="w-full bg-slate-200/80 dark:bg-black/30 h-2 rounded-full overflow-hidden shadow-inner border border-slate-300/60 dark:border-white/10">
            <div
              style={{ width: `${percentage}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                isPaid ? "bg-emerald-500 dark:bg-emerald-300 shadow-sm shadow-emerald-400" : `bg-gradient-to-r ${cardTheme.progressGradient}`
              }`}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:self-center relative z-10 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(d)}
          title="Borcu Düzenle"
          className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 dark:text-white/80 dark:hover:text-white dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/15 rounded-xl transition cursor-pointer backdrop-blur-xs shadow-xs"
        >
          <Edit className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(d.id)}
          title="Borcu Sil"
          className="p-2.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 dark:text-rose-200 dark:hover:text-white dark:bg-rose-500/20 dark:hover:bg-rose-500/40 dark:border-rose-400/30 rounded-xl transition cursor-pointer backdrop-blur-xs shadow-xs"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onTogglePaid(d.id)}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shrink-0 select-none cursor-pointer transition-all duration-200 shadow-sm active:scale-95 ${
            isPaid
              ? "bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 dark:bg-white/20 dark:hover:bg-white/30 dark:text-white dark:border-white/30 backdrop-blur-xs"
              : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-md shadow-slate-300/50 dark:shadow-black/20"
          }`}
        >
          {isPaid ? (
            <span className="flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <Circle className="w-4 h-4 text-slate-400 dark:text-slate-600" />
            </span>
          )}
          <span>{isPaid ? "Ödenmedi Yap" : "Ödendi Yap"}</span>
        </button>
      </div>
    </div>
  );
}

export const DebtItemCard = React.memo(DebtItemCardComponent);
