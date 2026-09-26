/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DebtProvider {
  id: string;
  name: string;
  category: "bank" | "telecom" | "utility" | "subscription" | "shopping" | "generic";
  color: string;
  textColor?: string;
  shortCode: string;
  badgeLabel?: string;
  description?: string;
}

export const DEBT_PROVIDERS: DebtProvider[] = [
  // --- BANKALAR ---
  { id: "ziraat", name: "Ziraat Bankası", category: "bank", color: "#E30613", textColor: "#FFFFFF", shortCode: "ZRB", badgeLabel: "Ziraat" },
  { id: "isbank", name: "İş Bankası", category: "bank", color: "#003B70", textColor: "#FFFFFF", shortCode: "İŞB", badgeLabel: "İş Bankası" },
  { id: "garanti", name: "Garanti BBVA", category: "bank", color: "#008539", textColor: "#FFFFFF", shortCode: "GBN", badgeLabel: "Garanti" },
  { id: "yapikredi", name: "Yapı Kredi", category: "bank", color: "#002B49", textColor: "#FFFFFF", shortCode: "YKB", badgeLabel: "Yapı Kredi" },
  { id: "akbank", name: "Akbank", category: "bank", color: "#E30613", textColor: "#FFFFFF", shortCode: "AKB", badgeLabel: "Akbank" },
  { id: "vakifbank", name: "VakıfBank", category: "bank", color: "#E5A812", textColor: "#1E293B", shortCode: "VAK", badgeLabel: "VakıfBank" },
  { id: "halkbank", name: "Halkbank", category: "bank", color: "#00549A", textColor: "#FFFFFF", shortCode: "HLK", badgeLabel: "Halkbank" },
  { id: "qnb", name: "QNB Finansbank", category: "bank", color: "#6A1B9A", textColor: "#FFFFFF", shortCode: "QNB", badgeLabel: "QNB" },
  { id: "enpara", name: "Enpara.com", category: "bank", color: "#FF6600", textColor: "#FFFFFF", shortCode: "ENP", badgeLabel: "Enpara" },
  { id: "denizbank", name: "DenizBank", category: "bank", color: "#005BAA", textColor: "#FFFFFF", shortCode: "DNZ", badgeLabel: "DenizBank" },
  { id: "teb", name: "TEB (Türk Ekonomi Bnk)", category: "bank", color: "#00A859", textColor: "#FFFFFF", shortCode: "TEB", badgeLabel: "TEB" },
  { id: "kuveytturk", name: "Kuveyt Türk", category: "bank", color: "#006738", textColor: "#FFFFFF", shortCode: "KVT", badgeLabel: "Kuveyt Türk" },
  { id: "turkiyefinans", name: "Türkiye Finans", category: "bank", color: "#007A3D", textColor: "#FFFFFF", shortCode: "TFC", badgeLabel: "Tr Finans" },
  { id: "papara", name: "Papara", category: "bank", color: "#18181B", textColor: "#FFFFFF", shortCode: "PAP", badgeLabel: "Papara" },
  { id: "ininal", name: "Ininal", category: "bank", color: "#E30613", textColor: "#FFFFFF", shortCode: "INI", badgeLabel: "Ininal" },
  { id: "hsbc", name: "HSBC", category: "bank", color: "#DB0011", textColor: "#FFFFFF", shortCode: "HSBC", badgeLabel: "HSBC" },
  { id: "ing", name: "ING Bank", category: "bank", color: "#FF6200", textColor: "#FFFFFF", shortCode: "ING", badgeLabel: "ING" },
  { id: "odeabank", name: "Odeabank", category: "bank", color: "#002D62", textColor: "#FFFFFF", shortCode: "ODE", badgeLabel: "Odeabank" },
  { id: "fibabanka", name: "Fibabanka", category: "bank", color: "#0F2D69", textColor: "#FFFFFF", shortCode: "FIBA", badgeLabel: "Fibabanka" },
  { id: "sekerbank", name: "Şekerbank", category: "bank", color: "#007A3D", textColor: "#FFFFFF", shortCode: "ŞEK", badgeLabel: "Şekerbank" },
  { id: "albaraka", name: "Albaraka Türk", category: "bank", color: "#8B0000", textColor: "#FFFFFF", shortCode: "ALB", badgeLabel: "Albaraka" },
  { id: "paycell", name: "Paycell", category: "bank", color: "#0B192C", textColor: "#FFC200", shortCode: "PAY", badgeLabel: "Paycell" },
  { id: "tosla", name: "Tosla", category: "bank", color: "#EE0979", textColor: "#FFFFFF", shortCode: "TOS", badgeLabel: "Tosla" },

  // --- TELEKOM & FATURALAR ---
  { id: "turkcell", name: "Turkcell", category: "telecom", color: "#002855", textColor: "#FFC200", shortCode: "TCELL", badgeLabel: "Turkcell" },
  { id: "vodafone", name: "Vodafone", category: "telecom", color: "#E60000", textColor: "#FFFFFF", shortCode: "VODA", badgeLabel: "Vodafone" },
  { id: "turktelekom", name: "Türk Telekom", category: "telecom", color: "#002D62", textColor: "#FFFFFF", shortCode: "TTEL", badgeLabel: "Türk Telekom" },
  { id: "netgsm", name: "Netgsm", category: "telecom", color: "#0088CC", textColor: "#FFFFFF", shortCode: "NETG", badgeLabel: "Netgsm" },
  { id: "bimcell", name: "Bimcell", category: "telecom", color: "#E2001A", textColor: "#FFFFFF", shortCode: "BIM", badgeLabel: "Bimcell" },

  // --- ELEKTRİK, SU, DOĞALGAZ, İNTERNET ---
  { id: "elektrik_faturasi", name: "Elektrik Faturası (Enerjisa vb.)", category: "utility", color: "#F59E0B", textColor: "#FFFFFF", shortCode: "ELEK", badgeLabel: "Elektrik" },
  { id: "su_faturasi", name: "Su Faturası (İSKİ / ASKİ vb.)", category: "utility", color: "#0284C7", textColor: "#FFFFFF", shortCode: "SU", badgeLabel: "Su Faturası" },
  { id: "dogalgaz_faturasi", name: "Doğalgaz Faturası (İGDAŞ vb.)", category: "utility", color: "#2563EB", textColor: "#FFFFFF", shortCode: "GAZ", badgeLabel: "Doğalgaz" },
  { id: "superonline", name: "Turkcell Superonline", category: "utility", color: "#FFB800", textColor: "#002855", shortCode: "SOL", badgeLabel: "Superonline" },
  { id: "turknet", name: "TürkNet", category: "utility", color: "#0052CC", textColor: "#FFFFFF", shortCode: "TNET", badgeLabel: "TürkNet" },
  { id: "kablonet", name: "Türksat Kablonet / TV", category: "utility", color: "#DC2626", textColor: "#FFFFFF", shortCode: "KABLO", badgeLabel: "Kablonet" },
  { id: "millenicom", name: "Millenicom", category: "utility", color: "#7C3AED", textColor: "#FFFFFF", shortCode: "MILLI", badgeLabel: "Millenicom" },

  // --- DİJİTAL SERVİSLER & ABONELİKLER ---
  { id: "netflix", name: "Netflix", category: "subscription", color: "#000000", textColor: "#E50914", shortCode: "NFLX", badgeLabel: "Netflix" },
  { id: "spotify", name: "Spotify", category: "subscription", color: "#1DB954", textColor: "#FFFFFF", shortCode: "SPOT", badgeLabel: "Spotify" },
  { id: "youtube", name: "YouTube Premium", category: "subscription", color: "#FF0000", textColor: "#FFFFFF", shortCode: "YTB", badgeLabel: "YouTube" },
  { id: "amazon", name: "Amazon / Prime", category: "subscription", color: "#131921", textColor: "#FF9900", shortCode: "AMZN", badgeLabel: "Amazon" },
  { id: "disney", name: "Disney+", category: "subscription", color: "#040714", textColor: "#FFFFFF", shortCode: "DISN", badgeLabel: "Disney+" },
  { id: "digiturk", name: "Digiturk / Bein", category: "subscription", color: "#562873", textColor: "#FFFFFF", shortCode: "BEIN", badgeLabel: "Digiturk" },

  // --- ALIŞVERİŞ & TAKSİT ---
  { id: "trendyol", name: "Trendyol", category: "shopping", color: "#F27A1A", textColor: "#FFFFFF", shortCode: "TY", badgeLabel: "Trendyol" },
  { id: "hepsiburada", name: "Hepsiburada", category: "shopping", color: "#FF6000", textColor: "#FFFFFF", shortCode: "HB", badgeLabel: "Hepsiburada" },
  { id: "getir", name: "Getir", category: "shopping", color: "#5D3EBC", textColor: "#FFD300", shortCode: "GET", badgeLabel: "Getir" },
  { id: "yemeksepeti", name: "Yemeksepeti", category: "shopping", color: "#EA004B", textColor: "#FFFFFF", shortCode: "YS", badgeLabel: "Yemeksepeti" },

  // --- GENEL / DİĞER ---
  { id: "kredi_karti", name: "Genel Kredi Kartı", category: "generic", color: "#1E293B", textColor: "#FFFFFF", shortCode: "KART", badgeLabel: "Kredi Kartı" },
  { id: "kredi_konut", name: "Konut / Banka Kredisi", category: "generic", color: "#065F46", textColor: "#FFFFFF", shortCode: "KREDİ", badgeLabel: "Kredi" },
  { id: "genel_fatura", name: "Genel Kurum / Vergi Faturası", category: "generic", color: "#881337", textColor: "#FFFFFF", shortCode: "FAT", badgeLabel: "Fatura" },
];

export function getProviderById(id?: string): DebtProvider | undefined {
  if (!id) return undefined;
  return DEBT_PROVIDERS.find((p) => p.id === id);
}

/**
 * Auto-detect provider if name or category matches a known provider
 */
export function detectProviderFromName(name: string, category?: string): DebtProvider | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase();

  // Bank checks
  if (lower.includes("ziraat") || lower.includes("başak kart") || lower.includes("basak")) return getProviderById("ziraat");
  if (lower.includes("iş bank") || lower.includes("isbank") || lower.includes("is bankasi") || lower.includes("maximum") || lower.includes("maximiles")) return getProviderById("isbank");
  if (lower.includes("garanti") || lower.includes("bbva") || lower.includes("bonus") || lower.includes("miles & smiles") || lower.includes("miles&smiles")) return getProviderById("garanti");
  if (lower.includes("yapı kredi") || lower.includes("yapi kredi") || lower.includes("ykb") || lower.includes("world") || lower.includes("worldcard")) return getProviderById("yapikredi");
  if (lower.includes("akbank") || lower.includes("axess") || lower.includes("wings") || lower.includes("free kart")) return getProviderById("akbank");
  if (lower.includes("vakıf") || lower.includes("vakif") || lower.includes("vakifbank") || lower.includes("vakıfbank")) return getProviderById("vakifbank");
  if (lower.includes("halkbank") || lower.includes("halk bank") || lower.includes("paraf")) return getProviderById("halkbank");
  if (lower.includes("finansbank") || lower.includes("qnb") || lower.includes("cardfinans")) return getProviderById("qnb");
  if (lower.includes("enpara") || lower.includes("encard")) return getProviderById("enpara");
  if (lower.includes("denizbank") || lower.includes("deniz bank")) return getProviderById("denizbank");
  if (lower.includes("teb") || lower.includes("türk ekonomi")) return getProviderById("teb");
  if (lower.includes("kuveyt") || lower.includes("sağlam kart") || lower.includes("saglam kart")) return getProviderById("kuveytturk");
  if (lower.includes("turkiye finans") || lower.includes("türkiye finans") || lower.includes("happy kart")) return getProviderById("turkiyefinans");
  if (lower.includes("papara")) return getProviderById("papara");
  if (lower.includes("ininal")) return getProviderById("ininal");
  if (lower.includes("hsbc") || lower.includes("advantage")) return getProviderById("hsbc");
  if (lower.includes("ing") || lower.includes("ing bank") || lower.includes("pegasus bolbol")) return getProviderById("ing");
  if (lower.includes("odea") || lower.includes("odeabank")) return getProviderById("odeabank");
  if (lower.includes("fiba") || lower.includes("fibabanka")) return getProviderById("fibabanka");
  if (lower.includes("şeker") || lower.includes("seker") || lower.includes("sekerbank") || lower.includes("şekerbank")) return getProviderById("sekerbank");
  if (lower.includes("albaraka")) return getProviderById("albaraka");
  if (lower.includes("paycell")) return getProviderById("paycell");
  if (lower.includes("tosla")) return getProviderById("tosla");

  // Telecom & Bills
  if (lower.includes("turkcell") || lower.includes("turksel") || lower.includes("gnc")) return getProviderById("turkcell");
  if (lower.includes("vodafone") || lower.includes("vodafon") || lower.includes("red")) return getProviderById("vodafone");
  if (lower.includes("türk telekom") || lower.includes("turk telekom") || lower.includes("avea") || lower.includes("ttnet")) return getProviderById("turktelekom");
  if (lower.includes("netgsm")) return getProviderById("netgsm");
  if (lower.includes("bimcell") || lower.includes("bim cell")) return getProviderById("bimcell");

  // Utilities
  if (lower.includes("elektrik") || lower.includes("enerjisa") || lower.includes("ck boğaziçi") || lower.includes("gediz") || lower.includes("ayedaş") || lower.includes("toroslar") || lower.includes("bedaş")) return getProviderById("elektrik_faturasi");
  if (lower.includes("su fat") || lower.includes("su borcu") || lower.includes("iski") || lower.includes("aski") || lower.includes("buski") || lower.includes("izsu") || lower.includes("deski") || lower.includes("su faturası")) return getProviderById("su_faturasi");
  if (lower.includes("doğalgaz") || lower.includes("dogalgaz") || lower.includes("gaz fat") || lower.includes("igdaş") || lower.includes("igdas") || lower.includes("başkentgaz") || lower.includes("izmirgaz")) return getProviderById("dogalgaz_faturasi");
  if (lower.includes("superonline") || lower.includes("süperonline")) return getProviderById("superonline");
  if (lower.includes("türknet") || lower.includes("turknet") || lower.includes("giga")) return getProviderById("turknet");
  if (lower.includes("kablonet") || lower.includes("türksat") || lower.includes("turksat")) return getProviderById("kablonet");
  if (lower.includes("milleni") || lower.includes("millenicom")) return getProviderById("millenicom");

  // Subscriptions & Shopping
  if (lower.includes("netflix")) return getProviderById("netflix");
  if (lower.includes("spotify")) return getProviderById("spotify");
  if (lower.includes("youtube") || lower.includes("yt premium")) return getProviderById("youtube");
  if (lower.includes("amazon") || lower.includes("prime")) return getProviderById("amazon");
  if (lower.includes("disney")) return getProviderById("disney");
  if (lower.includes("digiturk") || lower.includes("bein") || lower.includes("tod")) return getProviderById("digiturk");
  if (lower.includes("trendyol")) return getProviderById("trendyol");
  if (lower.includes("hepsiburada") || lower.includes("hepsi burada")) return getProviderById("hepsiburada");
  if (lower.includes("getir")) return getProviderById("getir");
  if (lower.includes("yemeksepeti") || lower.includes("yemek sepeti")) return getProviderById("yemeksepeti");

  // Generic and category fallbacks
  if (lower.includes("vergi") || lower.includes("gib") || lower.includes("gelir idaresi") || lower.includes("harç") || lower.includes("ceza") || lower.includes("trafik cezası")) return getProviderById("genel_fatura");
  if (lower.includes("konut kredisi") || lower.includes("ev kredisi") || lower.includes("taşıt kredisi") || lower.includes("araba kredisi") || lower.includes("ihtiyaç kredisi")) return getProviderById("kredi_konut");
  if (lower.includes("kredi kart") || lower.includes("ekstre") || category === "Kredi Kartı") return getProviderById("kredi_karti");
  if (lower.includes("fatura") || category === "Fatura") return getProviderById("genel_fatura");

  return undefined;
}
