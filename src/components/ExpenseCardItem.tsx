/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { Calendar, Edit, Trash2 } from "lucide-react";
import { Expense } from "../types";

export interface ExpenseCardItemProps {
  e: Expense;
  idx: number;
  cat?: any;
  theme: any;
  isNew: boolean;
  format: (amount: number) => string;
  onEdit: (e: Expense) => void;
  onDelete: (id: number) => void;
}

function ExpenseCardItemComponent({
  e,
  cat,
  theme,
  isNew,
  format,
  onEdit,
  onDelete,
}: ExpenseCardItemProps) {
  // Memoized formatted date
  const formattedDate = useMemo(() => {
    try {
      return new Date(e.date).toLocaleDateString("tr-TR");
    } catch {
      return e.date;
    }
  }, [e.date]);

  return (
    <div
      id={`expense-item-${e.id}`}
      style={{
        borderLeft: cat?.color ? `4px solid ${cat.color}` : undefined,
        willChange: "transform",
        transform: "translateZ(0)",
      }}
      className={`relative overflow-hidden p-4 sm:p-5 bg-gradient-to-br ${theme.cardBg} rounded-3xl border ${theme.cardBorder} shadow-md flex items-center justify-between gap-4 transition-all duration-200 backdrop-blur-md hover:-translate-y-0.5 ${
        isNew
          ? "ring-2 ring-amber-400 border-amber-300 shadow-[0_0_25px_rgba(244,63,94,0.4)]"
          : ""
      }`}
    >
      {/* Ambient decoration */}
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${theme.ambientGlow} blur-xl pointer-events-none`} />

      {/* Sub-bar indicator for newly highlighted item */}
      {isNew && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400 via-rose-300 to-amber-400 animate-pulse" />
      )}

      <div className="space-y-1.5 relative z-10 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider ${theme.tagBg} ${theme.tagText} border ${theme.tagBorder} backdrop-blur-xs shrink-0 shadow-xs flex items-center gap-1`}
            style={cat?.color ? { borderColor: `${cat.color}60` } : undefined}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: cat?.color || undefined }}
            />
            {cat ? `${cat.icon || "🛒"} ${cat.name}` : "Kategorisiz"}
          </span>
          <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate tracking-tight">
            {e.description || "Harcama açıklaması girmediniz"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center gap-1 font-semibold bg-white/70 dark:bg-black/30 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-white/10 w-fit">
            <Calendar className={`w-3 h-3 ${theme.amountColor}`} /> {formattedDate}
          </p>
          {e.paymentMethod && (
            <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold bg-white/80 dark:bg-black/40 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-white/10 flex items-center gap-1">
              {e.paymentMethod === "digital_wallet" ? "👛 Dijital Cüzdan" :
               e.paymentMethod === "bank_transfer" ? "🏦 Havale / FAST" :
               e.paymentMethod === "credit_card" ? "💳 Kredi Kartı" :
               e.paymentMethod === "cash" ? "💵 Nakit" : e.paymentMethod}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 relative z-10 shrink-0">
        <span className={`font-black text-base sm:text-lg ${theme.amountColor} font-mono tracking-tight drop-shadow-xs`}>
          -{format(e.amount)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(e)}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white/80 hover:bg-white border border-slate-200/80 dark:text-white/80 dark:hover:text-white dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/15 rounded-xl transition cursor-pointer backdrop-blur-xs shadow-xs"
            title="Düzenle"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(e.id)}
            className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 dark:text-rose-200 dark:hover:text-white dark:bg-rose-500/20 dark:hover:bg-rose-500/40 dark:border-rose-400/30 rounded-xl transition cursor-pointer backdrop-blur-xs shadow-xs"
            title="Sil"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export const ExpenseCardItem = React.memo(ExpenseCardItemComponent);
