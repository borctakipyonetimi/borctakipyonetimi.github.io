/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { DebtProvider, getProviderById } from "../data/providers";

interface ProviderLogoProps {
  providerId?: string;
  provider?: DebtProvider;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

// Resmî ve orijinal yazısız amblem / ikon haritası (Yazısız standalone amblemler)
export const LOGO_PATHS: Record<string, string> = {
  // --- BANKALAR (Yazısız Orijinal Amblemler & Uygulama İkonları) ---
  ziraat: "/logos/emblems/ziraat.png",
  isbank: "/logos/emblems/isbank.png",
  garanti: "/logos/emblems/garanti.png",
  yapikredi: "/logos/emblems/yapikredi.png",
  akbank: "/logos/emblems/akbank.png",
  vakifbank: "/logos/emblems/vakifbank.png",
  halkbank: "/logos/emblems/halkbank.png",
  qnb: "/logos/emblems/qnb.png",
  enpara: "/logos/emblems/enpara.png",
  denizbank: "/logos/emblems/denizbank.png",
  teb: "/logos/emblems/teb.png",
  kuveytturk: "/logos/emblems/kuveytturk.png",
  turkiyefinans: "/logos/emblems/turkiyefinans.png",
  papara: "/logos/emblems/papara.png",
  ininal: "/logos/emblems/ininal.png",
  hsbc: "/logos/emblems/hsbc.png",
  ing: "/logos/emblems/ing.png",
  odeabank: "/logos/emblems/odeabank.png",
  fibabanka: "/logos/emblems/fibabanka.png",
  sekerbank: "/logos/emblems/sekerbank.png",
  albaraka: "/logos/emblems/albaraka.png",
  paycell: "/logos/emblems/paycell.png",
  tosla: "/logos/emblems/tosla.png",
  aktifbank: "/logos/emblems/nkolay.png",
  nkolay: "/logos/emblems/nkolay.png",
  ziraatkatilim: "/logos/emblems/ziraatkatilim.png",
  vakifkatilim: "/logos/emblems/vakifkatilim.svg",
  emlakkatilim: "/logos/emblems/emlakkatilim.svg",
  anadolubank: "/logos/emblems/anadolubank.svg",
  burgan: "/logos/emblems/burgan.svg",
  citibank: "/logos/emblems/citibank.svg",

  // --- TELEKOM & GSM (Yazısız Orijinal Simgeler) ---
  turkcell: "/logos/emblems/turkcell.png",
  vodafone: "/logos/emblems/vodafone.png",
  turktelekom: "/logos/emblems/turktelekom.png",
  netgsm: "/logos/emblems/netgsm.png",
  bimcell: "/logos/emblems/bimcell.png",

  // --- ELEKTRİK, SU, GAZ, İNTERNET ---
  elektrik_faturasi: "/logos/emblems/elektrik_faturasi.png",
  su_faturasi: "/logos/emblems/su_faturasi.png",
  dogalgaz_faturasi: "/logos/emblems/dogalgaz_faturasi.png",
  superonline: "/logos/emblems/superonline.png",
  turknet: "/logos/emblems/turknet.png",
  kablonet: "/logos/emblems/kablonet.png",
  millenicom: "/logos/emblems/millenicom.png",

  // --- DİJİTAL ABONELİK & YAYIN ---
  netflix: "/logos/emblems/netflix.png",
  spotify: "/logos/emblems/spotify.png",
  youtube: "/logos/emblems/youtube.png",
  amazon: "/logos/emblems/amazon.png",
  disney: "/logos/emblems/disney.png",
  digiturk: "/logos/emblems/digiturk.png",

  // --- ALIŞVERİŞ & TESLİMAT ---
  trendyol: "/logos/emblems/trendyol.png",
  hepsiburada: "/logos/emblems/hepsiburada.png",
  getir: "/logos/emblems/getir.png",
  yemeksepeti: "/logos/emblems/yemeksepeti.png",

  // --- GENEL & KREDİ ---
  kredi_karti: "/logos/emblems/kredi_karti.svg",
  kredi_konut: "/logos/emblems/kredi_konut.svg",
  genel_fatura: "/logos/emblems/genel_fatura.svg",
};

export const ProviderLogo: React.FC<ProviderLogoProps> = ({
  providerId,
  provider: passedProvider,
  size = "md",
  className = ""
}) => {
  const provider = passedProvider || getProviderById(providerId);
  const [imgError, setImgError] = useState(false);

  // Kare, net ve ferah boyutlandırma (Tamamen yazısız kare amblem formatı)
  const dimensions = {
    xs: {
      box: "w-5 h-5 rounded-md",
      text: "text-[9px]"
    },
    sm: {
      box: "w-7 h-7 rounded-lg",
      text: "text-[10px]"
    },
    md: {
      box: "w-9 h-9 rounded-xl",
      text: "text-xs"
    },
    lg: {
      box: "w-11 h-11 rounded-xl",
      text: "text-sm"
    },
    xl: {
      box: "w-14 h-14 rounded-2xl",
      text: "text-base"
    }
  }[size];

  if (!provider) {
    return (
      <div
        className={`${dimensions.box} bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 font-bold shrink-0 ${className}`}
      >
        <span className={dimensions.text}>•</span>
      </div>
    );
  }

  const logoSrc = LOGO_PATHS[provider.id];
  const isSvg = logoSrc?.endsWith(".svg");

  return (
    <div
      className={`inline-flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 shadow-xs shrink-0 select-none overflow-hidden transition-transform duration-150 hover:scale-105 ${dimensions.box} ${className}`}
      title={provider.name}
    >
      {logoSrc && !imgError ? (
        <img
          src={logoSrc}
          alt={provider.name}
          onError={() => setImgError(true)}
          className={`w-full h-full select-none pointer-events-none rounded-[inherit] ${
            isSvg ? "object-contain p-1" : "object-cover"
          }`}
          loading="lazy"
        />
      ) : (
        <span
          className={`font-black truncate tracking-tight text-white px-1 py-0.5 rounded leading-none ${dimensions.text}`}
          style={{ backgroundColor: provider.color }}
        >
          {provider.shortCode || provider.name.slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );
};
