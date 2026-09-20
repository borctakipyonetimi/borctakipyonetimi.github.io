/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Building2,
  PhoneCall,
  Zap,
  Droplets,
  Flame,
  Wifi,
  Tv,
  CreditCard,
  ShoppingBag,
  Search,
  Check,
  X,
  ChevronDown,
  Sparkles,
  Tag
} from "lucide-react";
import { DEBT_PROVIDERS, DebtProvider, getProviderById, detectProviderFromName } from "../data/providers";

interface ProviderBadgeProps {
  providerId?: string;
  fallbackName?: string;
  category?: string;
  size?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export const ProviderBadge: React.FC<ProviderBadgeProps> = ({
  providerId,
  fallbackName,
  category,
  size = "md",
  showLabel = true,
  className = ""
}) => {
  let provider = getProviderById(providerId);

  // Auto-detect provider if missing but fallback name exists
  if (!provider && fallbackName) {
    provider = detectProviderFromName(fallbackName, category);
  }

  const getCategoryIcon = (cat?: string) => {
    switch (cat) {
      case "bank":
        return <Building2 className="w-3.5 h-3.5" />;
      case "telecom":
        return <PhoneCall className="w-3.5 h-3.5" />;
      case "utility":
        return <Zap className="w-3.5 h-3.5" />;
      case "subscription":
        return <Tv className="w-3.5 h-3.5" />;
      case "shopping":
        return <ShoppingBag className="w-3.5 h-3.5" />;
      default:
        return <CreditCard className="w-3.5 h-3.5" />;
    }
  };

  const dimensions = {
    xs: { badge: "w-5 h-5 text-[9px]", text: "text-[10px]", icon: "w-3 h-3" },
    sm: { badge: "w-6 h-6 text-[10px]", text: "text-xs", icon: "w-3.5 h-3.5" },
    md: { badge: "w-8 h-8 text-xs font-black", text: "text-xs font-bold", icon: "w-4 h-4" },
    lg: { badge: "w-10 h-10 text-sm font-black", text: "text-sm font-black", icon: "w-5 h-5" }
  }[size];

  if (!provider) {
    if (!fallbackName) return null;
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <div className={`${dimensions.badge} rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold border border-slate-200 dark:border-slate-700`}>
          {getCategoryIcon(category)}
        </div>
        {showLabel && (
          <span className={`${dimensions.text} text-slate-600 dark:text-slate-300 truncate max-w-[120px]`}>
            {fallbackName}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div
        className={`${dimensions.badge} rounded-xl shadow-sm flex items-center justify-center shrink-0 border border-black/10 dark:border-white/20 font-black tracking-tighter uppercase transition-transform hover:scale-105`}
        style={{
          backgroundColor: provider.color,
          color: provider.textColor || "#FFFFFF"
        }}
        title={provider.name}
      >
        {provider.shortCode}
      </div>
      {showLabel && (
        <span
          className={`${dimensions.text} font-bold text-slate-800 dark:text-slate-100 truncate`}
        >
          {provider.badgeLabel || provider.name}
        </span>
      )}
    </div>
  );
};

interface ProviderSelectorProps {
  selectedProviderId?: string;
  onSelect: (providerId: string) => void;
  onClear?: () => void;
  debtNameHint?: string;
  categoryHint?: string;
  label?: string;
  language?: "tr" | "en";
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selectedProviderId,
  onSelect,
  onClear,
  debtNameHint,
  categoryHint,
  label,
  language = "tr"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const selectedProvider = getProviderById(selectedProviderId);
  const autoDetected = debtNameHint ? detectProviderFromName(debtNameHint, categoryHint) : undefined;

  const categories = [
    { id: "all", name: language === "tr" ? "Tümü" : "All" },
    { id: "bank", name: language === "tr" ? "Bankalar" : "Banks" },
    { id: "telecom", name: language === "tr" ? "Telefon & GSM" : "Telecom" },
    { id: "utility", name: language === "tr" ? "Elektrik/Su/Gaz/Net" : "Utilities" },
    { id: "subscription", name: language === "tr" ? "Abonelikler" : "Subscriptions" },
    { id: "shopping", name: language === "tr" ? "Alışveriş" : "Shopping" }
  ];

  const filteredProviders = DEBT_PROVIDERS.filter((p) => {
    const matchesCategory = activeCategory === "all" || p.category === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.shortCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.badgeLabel && p.badgeLabel.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-indigo-500" />
          {label || (language === "tr" ? "Banka / Kurum Logosu" : "Bank / Provider Logo")}
        </label>
        {selectedProviderId && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
          >
            {language === "tr" ? "Temizle" : "Clear"}
          </button>
        )}
      </div>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full p-2.5 bg-slate-50 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex items-center justify-between transition cursor-pointer text-left"
      >
        {selectedProvider ? (
          <ProviderBadge providerId={selectedProvider.id} size="md" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-xs border border-dashed border-slate-300 dark:border-slate-700">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {language === "tr" ? "Banka veya Kurum Seçin..." : "Select Bank or Institution..."}
              </p>
              {autoDetected && (
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                  {language === "tr" ? `Öneri: ${autoDetected.name}` : `Suggested: ${autoDetected.name}`}
                </p>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-slate-400">
          {autoDetected && !selectedProviderId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(autoDetected.id);
              }}
              className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 text-[10px] font-black rounded-lg hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              {language === "tr" ? "Uygula" : "Apply"}
            </button>
          )}
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>

      {/* Modal Dropdown Picker */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      {language === "tr" ? "Banka & Kurum Logosu Seçin" : "Select Bank & Provider Logo"}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {language === "tr" ? "Borç ve taksit kartlarında görüntülenecek kurum" : "Select institution displayed on debt cards"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      language === "tr"
                        ? "Ziraat, Garanti, Turkcell, İSKİ, Netflix ara..."
                        : "Search Ziraat, Garanti, Turkcell, ISKI, Netflix..."
                    }
                    className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-0.5 no-scrollbar">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                        activeCategory === cat.id
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Content */}
              <div className="p-4 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filteredProviders.map((provider) => {
                  const isSelected = selectedProviderId === provider.id;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => {
                        onSelect(provider.id);
                        setIsOpen(false);
                      }}
                      className={`p-2.5 rounded-2xl border text-left transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20"
                          : "bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80"
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div
                          className="w-8 h-8 rounded-xl shadow-sm flex items-center justify-center shrink-0 font-black text-xs border border-black/10 tracking-tighter"
                          style={{
                            backgroundColor: provider.color,
                            color: provider.textColor || "#FFFFFF"
                          }}
                        >
                          {provider.shortCode}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {provider.name}
                          </p>
                          <p className="text-[10px] text-slate-400 capitalize">
                            {provider.category}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}

                {filteredProviders.length === 0 && (
                  <div className="col-span-full py-8 text-center space-y-2">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {language === "tr" ? "Aramanıza uygun kurum bulunamadı." : "No matching institution found."}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (onClear) onClear();
                    setIsOpen(false);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  {language === "tr" ? "Logosuz Devam Et" : "Continue Without Logo"}
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {language === "tr" ? "Kapat" : "Close"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
