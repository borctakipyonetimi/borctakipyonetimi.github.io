/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { Wallet, Calendar, Edit, Trash2 } from "lucide-react";
import { Income } from "../types";

export interface IncomeCardItemProps {
  income: Income;
  format: (amount: number) => string;
  onEdit: (income: Income) => void;
  onDelete: (id: number) => void;
}

function IncomeCardItemComponent({
  income,
  format,
  onEdit,
  onDelete,
}: IncomeCardItemProps) {
  const formattedDate = useMemo(() => {
    try {
      return new Date(income.date).toLocaleDateString("tr-TR");
    } catch {
      return income.date;
    }
  }, [income.date]);

  return (
    <div
      id={`income-card-${income.id}`}
      style={{
        willChange: "transform",
        transform: "translateZ(0)",
      }}
      className="p-4 sm:p-5 bg-gradient-to-br from-white/95 via-emerald-50/50 to-slate-50/90 dark:from-emerald-950/90 dark:via-teal-950 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-500/40 rounded-3xl shadow-md shadow-emerald-100/50 dark:shadow-emerald-500/10 flex items-center justify-between gap-4 transition-all duration-200 relative overflow-hidden backdrop-blur-md group hover:-translate-y-0.5"
    >
      {/* Ambient glow */}
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-500/5 dark:bg-white/10 blur-xl pointer-events-none" />

      <div className="flex items-center gap-3.5 relative z-10 min-w-0">
        <div className="w-11 h-11 rounded-2xl bg-emerald-100/80 dark:bg-white/15 border border-emerald-200/80 dark:border-white/20 flex items-center justify-center shrink-0 backdrop-blur-xs shadow-xs">
          <Wallet className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
        </div>
        <div className="min-w-0">
          <p className="font-black text-sm sm:text-base text-slate-900 dark:text-white truncate tracking-tight">{income.name}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <p className="text-[10px] text-slate-600 dark:text-white/80 flex items-center gap-1 font-semibold bg-slate-100/90 dark:bg-black/20 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-white/10">
              <Calendar className="w-3 h-3 text-emerald-600 dark:text-emerald-300" /> {formattedDate}
            </p>
            <span
              className={`px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider backdrop-blur-xs border ${
                income.isRecurring !== false
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-white/20 dark:text-white dark:border-white/30"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-400/30 dark:text-amber-200 dark:border-amber-300/40"
              }`}
            >
              {income.isRecurring !== false ? "🔄 Sabit Gelir" : "✨ Ek Gelir"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 relative z-10 shrink-0">
        <span className="font-black text-base sm:text-lg text-emerald-600 dark:text-emerald-200 font-mono tracking-tight drop-shadow-xs">
          +{format(income.amount)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(income)}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 dark:text-white/80 dark:hover:text-white dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/15 rounded-xl transition cursor-pointer backdrop-blur-xs shadow-xs"
            title="Düzenle"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(income.id)}
            className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 dark:text-rose-200 dark:hover:text-white dark:bg-rose-500/20 dark:hover:bg-rose-500/40 dark:border-rose-400/30 rounded-xl transition cursor-pointer backdrop-blur-xs shadow-xs"
            title="Sil"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export const IncomeCardItem = React.memo(IncomeCardItemComponent);
