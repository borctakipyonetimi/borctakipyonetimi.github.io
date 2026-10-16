/**
 * Bütçem Pro - Akıllı Finansal NLP & Sesli Komut Çözümleyici
 * Kullanıcının Türkçe sesli/yazılı cümlelerini analiz ederek finansal modüllere eşler.
 */

export interface ParsedVoiceCommand {
  action: 
    | "addContactDebt" 
    | "addExpense" 
    | "addIncome" 
    | "addDebt" 
    | "addInstallment" 
    | "updateDebtPaid" 
    | "deleteExpense" 
    | "deleteIncome" 
    | "deleteDebt" 
    | "statusReport" 
    | "unknown";
  moduleTitle: string; // Örn: "Kişi Borçları", "Harcama Ekleme", "Gelir Ekleme" vb.
  explanation: string;
  data: {
    title: string;          // Borç adı, Harcama açıklaması, Gelir adı veya Kişi ismi
    amount: number;         // Finansal tutar
    date: string;           // YYYY-MM-DD
    category?: string;      // Kategori adı veya kimliği
    categoryId?: number;    // Harcama kategori id'si
    contactType?: "receivable" | "payable"; // Kişi borcu yönü (alacak / verecek)
    installmentCount?: number; // Taksit sayısı
    isAbsolute?: boolean;   // Borç ödeme eşitleme mi ekleme mi
  };
  rawText: string;
}

/**
 * Türkçe sesli sayılan kelimeleri rakamlara çevirir.
 * Örn: "beş bin" -> "5000", "bin iki yüz elli" -> "1250", "bir buçuk milyon" -> "1500000"
 */
export function convertTurkishWordsToNumbers(text: string): string {
  let result = text;

  // Özel ve birleşik kalıplar (büyükten küçüğe)
  const phrases: [RegExp, string][] = [
    [/\bbir buçuk milyon\b/gi, "1500000"],
    [/\biki buçuk milyon\b/gi, "2500000"],
    [/\bbir milyon\b/gi, "1000000"],
    [/\byarım milyon\b/gi, "500000"],
    [/\byüz elli bin\b/gi, "150000"],
    [/\byüz bin\b/gi, "100000"],
    [/\belli bin\b/gi, "50000"],
    [/\bkırk bin\b/gi, "40000"],
    [/\botuz bin\b/gi, "30000"],
    [/\byirmi beş bin\b/gi, "25000"],
    [/\byirmi bin\b/gi, "20000"],
    [/\bon beş bin\b/gi, "15000"],
    [/\bon iki bin\b/gi, "12000"],
    [/\bon bin\b/gi, "10000"],
    [/\bdokuz bin\b/gi, "9000"],
    [/\bsekiz bin\b/gi, "8000"],
    [/\byedi bin beş yüz\b/gi, "7500"],
    [/\byedi bin\b/gi, "7000"],
    [/\baltı bin\b/gi, "6000"],
    [/\bbeş bin beş yüz\b/gi, "5500"],
    [/\bbeş bin\b/gi, "5000"],
    [/\bdört bin beş yüz\b/gi, "4500"],
    [/\bdört bin\b/gi, "4000"],
    [/\büç bin beş yüz\b/gi, "3500"],
    [/\büç bin\b/gi, "3000"],
    [/\biki bin beş yüz\b/gi, "2500"],
    [/\biki bin\b/gi, "2000"],
    [/\bbin beş yüz\b/gi, "1500"],
    [/\bbin iki yüz elli\b/gi, "1250"],
    [/\bbin iki yüz\b/gi, "1200"],
    [/\bbin yüz\b/gi, "1100"],
    [/\bbin\b/gi, "1000"],
    [/\bdokuz yüz elli\b/gi, "950"],
    [/\bdokuz yüz\b/gi, "900"],
    [/\bsekiz yüz elli\b/gi, "850"],
    [/\bsekiz yüz\b/gi, "800"],
    [/\byedi yüz elli\b/gi, "750"],
    [/\byedi yüz\b/gi, "700"],
    [/\baltı yüz elli\b/gi, "650"],
    [/\baltı yüz\b/gi, "600"],
    [/\bbeş yüz elli\b/gi, "550"],
    [/\bbeş yüz\b/gi, "500"],
    [/\bdört yüz elli\b/gi, "450"],
    [/\bdört yüz\b/gi, "400"],
    [/\büç yüz elli\b/gi, "350"],
    [/\büç yüz\b/gi, "300"],
    [/\biki yüz elli\b/gi, "250"],
    [/\biki yüz\b/gi, "200"],
    [/\byüz elli\b/gi, "150"],
    [/\byüz yirmi\b/gi, "120"],
    [/\byüz\b/gi, "100"],
    [/\bdoksan\b/gi, "90"],
    [/\bseksen\b/gi, "80"],
    [/\byetmiş\b/gi, "70"],
    [/\baltmış\b/gi, "60"],
    [/\belli\b/gi, "50"],
    [/\bkırk\b/gi, "40"],
    [/\botuz altı\b/gi, "36"],
    [/\botuz\b/gi, "30"],
    [/\byirmi dört\b/gi, "24"],
    [/\byirmi\b/gi, "20"],
    [/\bon sekiz\b/gi, "18"],
    [/\bon altı\b/gi, "16"],
    [/\bon beş\b/gi, "15"],
    [/\bon iki\b/gi, "12"],
    [/\bon\b/gi, "10"]
  ];

  phrases.forEach(([regex, rep]) => {
    result = result.replace(regex, rep);
  });

  return result;
}

/**
 * İsmin sonundaki Türkçe yönelme/ayrılma eklerini (-e, -a, -ye, -ya, -den, -dan, -ten, -tan, -in vb.) temizler.
 * Örn: "Ahmet'e" -> "Ahmet", "Ahmete" -> "Ahmet", "Mehmet'ten" -> "Mehmet", "Ayşe'ye" -> "Ayşe"
 */
export function cleanTurkishPersonName(rawName: string): string {
  let name = rawName.trim();
  if (!name) return "";

  // Tırnak / kesme işaretini ayır
  if (name.includes("'") || name.includes("’")) {
    name = name.split(/['"’]/)[0].trim();
  }

  // Tırnaksız gelen ekleri temizle
  name = name.replace(
    /(den|dan|ten|tan|nin|nın|nun|nün|ye|ya|de|da|te|ta|e|a)$/gi,
    (match, suffix, offset, fullStr) => {
      // İsmin kökü en az 3 harfli kalıyorsa eki at
      if (fullStr.length - match.length >= 3) {
        return "";
      }
      return match;
    }
  );

  name = name.trim();
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name;
}

/**
 * Cümle içerisindeki göreceli tarihleri YYYY-MM-DD formatına çevirir.
 */
export function extractDateFromTurkishText(text: string): string {
  const norm = text.toLowerCase();
  const now = new Date();

  if (norm.includes("dün")) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return yesterday.toISOString().slice(0, 10);
  }

  if (norm.includes("yarın") || norm.includes("yarin")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }

  // Ayın X'i formatı
  const monthDayMatch = norm.match(/ayın\s+(\d{1,2})/i);
  if (monthDayMatch) {
    const day = parseInt(monthDayMatch[1], 10);
    if (day >= 1 && day <= 31) {
      const targetDate = new Date(now.getFullYear(), now.getMonth(), day);
      return targetDate.toISOString().slice(0, 10);
    }
  }

  // Varsayılan bugün
  return now.toISOString().slice(0, 10);
}

/**
 * Akıllı Türkçe Finansal Cümle Analiz Motoru
 */
export function parseFinancialVoiceCommand(rawInput: string): ParsedVoiceCommand {
  const textWithNums = convertTurkishWordsToNumbers(rawInput);
  const norm = textWithNums.toLowerCase().trim();

  const cleanNorm = norm
    .replace(/['"’\.]/g, "")
    .replace(/\blira\b/gi, "tl")
    .replace(/\btürk lirası\b/gi, "tl")
    .replace(/\btl\b/gi, "");

  const todayStr = extractDateFromTurkishText(norm);

  // 1. Durum / Rapor / Özet Talepleri
  const isStatus =
    norm.includes("durum") ||
    norm.includes("rapor") ||
    norm.includes("özet") ||
    norm.includes("ozet") ||
    norm.includes("param") ||
    norm.includes("bakiyem") ||
    norm.includes("ne kadar") ||
    norm.includes("hesabım");

  if (isStatus && !norm.includes("ekle") && !norm.includes("yaz") && !norm.includes("sil")) {
    return {
      action: "statusReport",
      moduleTitle: "Bütçe Durum Raporu",
      explanation: "Sesli bütçe ve borç durum özetiniz hazırlanıyor...",
      data: {
        title: "Bütçe Durum Özeti",
        amount: 0,
        date: todayStr
      },
      rawText: rawInput
    };
  }

  // 2. Silme Komutları (örn: "Market harcamasını sil", "Ahmet borcunu sil", "Maaş gelirini kaldır")
  if (
    norm.includes("sil") ||
    norm.includes("çıkar") ||
    norm.includes("cikar") ||
    norm.includes("kaldır") ||
    norm.includes("kaldir") ||
    norm.includes("iptal et")
  ) {
    if (norm.includes("gelir")) {
      const name = rawInput
        .replace(/(gelir|sil|çıkar|cikar|kaldır|kaldir|ekle|kaydet|tl|türk lirası|lira|₺)/gi, "")
        .trim();
      return {
        action: "deleteIncome",
        moduleTitle: "Gelir Silme",
        explanation: `"${name || "Gelir"}" kaydınızın silinmesini talep ettiniz.`,
        data: {
          title: name || "Gelir Kaydı",
          amount: 0,
          date: todayStr
        },
        rawText: rawInput
      };
    } else if (norm.includes("borç") || norm.includes("borc")) {
      const name = rawInput
        .replace(/(borç|borc|sil|çıkar|cikar|kaldır|kaldir|ekle|kaydet|tl|türk lirası|lira|₺)/gi, "")
        .trim();
      return {
        action: "deleteDebt",
        moduleTitle: "Borç Silme",
        explanation: `"${name || "Borç"}" kaydınızın silinmesini talep ettiniz.`,
        data: {
          title: name || "Borç Kaydı",
          amount: 0,
          date: todayStr
        },
        rawText: rawInput
      };
    } else {
      const desc = rawInput
        .replace(/(harcama|gider|sil|çıkar|cikar|kaldır|kaldir|ekle|kaydet|tl|türk lirası|lira|₺)/gi, "")
        .trim();
      return {
        action: "deleteExpense",
        moduleTitle: "Harcama Silme",
        explanation: `"${desc || "Harcama"}" kaydınızın silinmesini talep ettiniz.`,
        data: {
          title: desc || "Harcama Kaydı",
          amount: 0,
          date: todayStr
        },
        rawText: rawInput
      };
    }
  }

  // Sayı/Tutar Çıkarma
  const numMatches = [...norm.matchAll(/(\d+[\d\s,.]*)/g)];
  if (numMatches.length === 0) {
    return {
      action: "unknown",
      moduleTitle: "Bilinmeyen Komut",
      explanation: `Söylediğiniz ifadede herhangi bir tutar algılanamadı: "${rawInput}". Lütfen tutar belirterek söyleyin (Örn: "Ahmet'e 5000 TL borç ekle" veya "Market 250 TL").`,
      data: {
        title: rawInput,
        amount: 0,
        date: todayStr
      },
      rawText: rawInput
    };
  }

  // İlk sayıyı tutar olarak al
  let amount = 0;
  const rawNum1 = numMatches[0][1].replace(/\s/g, "");
  if (rawNum1.includes(",") && rawNum1.includes(".")) {
    amount = parseFloat(rawNum1.replace(/\./g, "").replace(/,/g, "."));
  } else if (rawNum1.includes(",")) {
    const parts = rawNum1.split(",");
    if (parts[1].length <= 2) {
      amount = parseFloat(rawNum1.replace(/,/g, "."));
    } else {
      amount = parseFloat(rawNum1.replace(/,/g, ""));
    }
  } else {
    amount = parseFloat(rawNum1);
  }
  amount = isNaN(amount) ? 0 : amount;

  if (amount <= 0) {
    return {
      action: "unknown",
      moduleTitle: "Geçersiz Tutar",
      explanation: `Söylediğiniz ifadedeki tutar geçersiz: "${rawInput}".`,
      data: {
        title: rawInput,
        amount: 0,
        date: todayStr
      },
      rawText: rawInput
    };
  }

  // 3. Taksit Planı (örn: "Telefon taksiti 24000 lira 12 taksit")
  if (norm.includes("taksit")) {
    let installmentCount = 12;
    if (numMatches.length >= 2) {
      const parsedCount = parseInt(numMatches[1][1].replace(/\s/g, ""), 10);
      if (!isNaN(parsedCount) && parsedCount > 0) {
        installmentCount = parsedCount;
      }
    }

    let planName = "Taksit Planı";
    const cleanedName = rawInput
      .replace(/\d+/g, "")
      .replace(/(taksit|taksitli|tl|türk lirası|lira|₺|ekle|kaydet|yaz|borç|borc|için|icin)/gi, "")
      .trim();

    if (cleanedName.length > 2) {
      planName = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
    }

    return {
      action: "addInstallment",
      moduleTitle: "Taksit Planı Ekleme",
      explanation: `${installmentCount} ay vadeli "${planName}" (Toplam ₺${amount.toLocaleString("tr-TR")}) taksit planı oluşturuldu. Onaylıyor musunuz?`,
      data: {
        title: planName,
        amount,
        installmentCount,
        date: todayStr
      },
      rawText: rawInput
    };
  }

  // 4. Borç Ödeme / Borç Güncelleme (örn: "Ahmet borcuna 500 TL ödedim", "Mehmet borcunun ödenen kısmını 1000 TL yap")
  if (
    (norm.includes("borç") || norm.includes("borc")) &&
    (norm.includes("ödenen") ||
      norm.includes("yap") ||
      norm.includes("güncelle") ||
      norm.includes("guncelle") ||
      norm.includes("öde") ||
      norm.includes("ode") ||
      norm.includes("yatırdım") ||
      norm.includes("yatirdim"))
  ) {
    const isAbsolute =
      norm.includes("yap") ||
      norm.includes("olsun") ||
      norm.includes("eşitle") ||
      norm.includes("esitle");

    let personOrDebt = "";
    const matchName = rawInput.match(/^(.*?)(?:borç|borc|ödenen|ode|öde|yap|güncelle|yatır)/i);
    if (matchName && matchName[1].trim().length > 1) {
      personOrDebt = cleanTurkishPersonName(matchName[1]);
    }

    if (personOrDebt) {
      return {
        action: "updateDebtPaid",
        moduleTitle: "Borç Ödemesi",
        explanation: `"${personOrDebt}" borcunun ödenen kısmı ₺${amount.toLocaleString("tr-TR")} ${
          isAbsolute ? "olarak güncellenecek" : "olarak artırılacak"
        }. Onaylıyor musunuz?`,
        data: {
          title: personOrDebt,
          amount,
          date: todayStr,
          isAbsolute
        },
        rawText: rawInput
      };
    }
  }

  // 5. Kişi Borçları / Rehber Alacak & Verecek (örn: "Ahmet'e 5000 TL borç ekle", "Mehmet'ten 3000 TL borç aldım", "Ayşe'ye 200 TL borç verdim")
  // Kontrol: Şahıs eki veya alacak/verecek kelimesi veya borç + kişi adı
  const hasPersonPattern =
    norm.includes("borç verdim") ||
    norm.includes("borc verdim") ||
    norm.includes("borç aldım") ||
    norm.includes("borc aldim") ||
    norm.includes("alacağım var") ||
    norm.includes("alacagim var") ||
    norm.includes("borcum var") ||
    norm.includes("borcum") ||
    norm.includes("vereceğim") ||
    norm.includes("bana borç") ||
    norm.includes("'e ") ||
    norm.includes("'a ") ||
    norm.includes("'ye ") ||
    norm.includes("'ya ") ||
    norm.includes("'den ") ||
    norm.includes("'dan ") ||
    norm.includes("'ten ") ||
    norm.includes("'tan ");

  const isExplicitGeneralDebt =
    norm.includes("banka") ||
    norm.includes("kredi") ||
    norm.includes("vergi") ||
    norm.includes("kredi kartı") ||
    norm.includes("kredi karti");

  if (
    (hasPersonPattern || norm.includes("borç") || norm.includes("borc")) &&
    !isExplicitGeneralDebt &&
    !norm.includes("harcama") &&
    !norm.includes("gider yaz") &&
    !norm.includes("fatura")
  ) {
    // İsim temizleme: cümle başındaki veya "e/a" eki almış ilk kelime
    let rawPerson = "";
    const words = rawInput.split(/\s+/);
    if (words.length > 0) {
      rawPerson = words[0];
    }

    const cleanedPerson = cleanTurkishPersonName(rawPerson);

    // Yön tespiti (Alacak vs Verecek):
    // "verdim", "alacağım", "alacak" -> Biz ona verdik, bizim alacağımız var ("receivable")
    // "aldım", "borçlandım", "borcum var", "borç ekle" -> Biz borçlandık / ona vereceğiz ("payable")
    const isReceivable =
      norm.includes("verdim") ||
      norm.includes("alacak") ||
      norm.includes("alacağım") ||
      norm.includes("alacagim") ||
      norm.includes("bana borç") ||
      norm.includes("bana borc");

    const contactType: "receivable" | "payable" = isReceivable ? "receivable" : "payable";
    const typeLabel = contactType === "receivable" ? "Alacak (Ondan Alacağım Var)" : "Verecek (Ona Borcum Var)";

    if (cleanedPerson && cleanedPerson.length >= 2) {
      return {
        action: "addContactDebt",
        moduleTitle: "Kişi Borçları",
        explanation: `Kişi rehberinizde "${cleanedPerson}" için ₺${amount.toLocaleString("tr-TR")} tutarında "${typeLabel}" kaydı hazırlandı. Onaylıyor musunuz?`,
        data: {
          title: cleanedPerson,
          amount,
          date: todayStr,
          contactType,
          category: "Kişi Borcu"
        },
        rawText: rawInput
      };
    }
  }

  // 6. Genel / Banka Borcu Ekleme (örn: "Banka kredisi 150000 TL borç ekle", "Kredi kartı borcu 5000 TL")
  if (norm.includes("borç") || norm.includes("borc") || isExplicitGeneralDebt) {
    let cat = "Şahıs";
    if (norm.includes("banka") || norm.includes("kredi")) cat = "Banka";
    else if (norm.includes("kart")) cat = "Kredi Kartı";
    else if (norm.includes("vergi")) cat = "Vergi";
    else if (norm.includes("aidat")) cat = "Aidat";

    let debtTitle = "Banka / Kurum Borcu";
    const cleanedTitle = rawInput
      .replace(/\d+/g, "")
      .replace(/(borç|borc|tl|türk lirası|lira|₺|ekle|kaydet|yaz|borçlandım|borcum)/gi, "")
      .trim();

    if (cleanedTitle.length > 2) {
      debtTitle = cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1);
    }

    return {
      action: "addDebt",
      moduleTitle: "Borç Ekleme",
      explanation: `"${debtTitle}" unvanlı ₺${amount.toLocaleString("tr-TR")} tutarında (${cat}) borç kaydı hazırlandı. Onaylıyor musunuz?`,
      data: {
        title: debtTitle,
        amount,
        date: todayStr,
        category: cat
      },
      rawText: rawInput
    };
  }

  // 7. Gelir Ekleme (örn: "Maaş yattı 45000 TL", "Kira geliri 15000 lira aldım", "5000 TL ek gelir yaz")
  if (
    norm.includes("gelir") ||
    norm.includes("maaş") ||
    norm.includes("maas") ||
    norm.includes("kazandım") ||
    norm.includes("kazandim") ||
    norm.includes("yattı") ||
    norm.includes("yatti") ||
    norm.includes("ikramiye")
  ) {
    let incomeTitle = "Gelir Kaydı";
    if (norm.includes("maaş") || norm.includes("maas")) incomeTitle = "Aylık Maaş Geliri";
    else if (norm.includes("kira")) incomeTitle = "Kira Geliri";
    else if (norm.includes("ikramiye")) incomeTitle = "İkramiye / Prim";
    else {
      const cleaned = rawInput
        .replace(/\d+/g, "")
        .replace(/(gelir|maaş|maas|tl|türk lirası|lira|₺|ekle|kaydet|yaz|aldım|aldim|kazandım|kazandim|yattı|yatti)/gi, "")
        .trim();
      if (cleaned.length > 2) {
        incomeTitle = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
    }

    return {
      action: "addIncome",
      moduleTitle: "Gelir Ekleme",
      explanation: `"${incomeTitle}" unvanıyla ₺${amount.toLocaleString("tr-TR")} tutarında gelir kaydı hazırlandı. Onaylıyor musunuz?`,
      data: {
        title: incomeTitle,
        amount,
        date: todayStr,
        category: "Gelir"
      },
      rawText: rawInput
    };
  }

  // 8. Gider / Harcama Ekleme (Varsayılan ve En Yaygın Durum)
  // Örn: "Bugün elektrik faturasına 1200 TL gider yaz", "Market harcaması 350 lira", "Benzin 900 TL"
  let categoryId = 1; // 1: Diğer
  let expenseDesc = "Harcama / Gider";

  if (
    norm.includes("market") ||
    norm.includes("gıda") ||
    norm.includes("gida") ||
    norm.includes("manav") ||
    norm.includes("bakkal") ||
    norm.includes("süpermarket") ||
    norm.includes("supermarket") ||
    norm.includes("kasap")
  ) {
    categoryId = 2; // Market
    expenseDesc = "Market Alışverişi";
  } else if (
    norm.includes("ulaşım") ||
    norm.includes("ulasim") ||
    norm.includes("yol") ||
    norm.includes("taksi") ||
    norm.includes("yakıt") ||
    norm.includes("yakit") ||
    norm.includes("benzin") ||
    norm.includes("mazot") ||
    norm.includes("lpg") ||
    norm.includes("otobüs") ||
    norm.includes("bilet") ||
    norm.includes("metro") ||
    norm.includes("otopark")
  ) {
    categoryId = 3; // Ulaşım
    expenseDesc = "Ulaşım / Yakıt Gideri";
  } else if (
    norm.includes("yemek") ||
    norm.includes("kafe") ||
    norm.includes("cafe") ||
    norm.includes("lokanta") ||
    norm.includes("restoran") ||
    norm.includes("döner") ||
    norm.includes("doner") ||
    norm.includes("pizza") ||
    norm.includes("pide") ||
    norm.includes("kahve") ||
    norm.includes("öğle") ||
    norm.includes("ogle")
  ) {
    categoryId = 4; // Yeme İçme
    expenseDesc = "Yeme & İçme";
  } else if (
    norm.includes("fatura") ||
    norm.includes("elektrik") ||
    norm.includes("su") ||
    norm.includes("gaz") ||
    norm.includes("doğalgaz") ||
    norm.includes("dogalgaz") ||
    norm.includes("telefon") ||
    norm.includes("internet") ||
    norm.includes("aidat") ||
    norm.includes("turkcell") ||
    norm.includes("vodafone") ||
    norm.includes("telekom")
  ) {
    categoryId = 5; // Faturalar
    if (norm.includes("elektrik")) expenseDesc = "Elektrik Faturası";
    else if (norm.includes("su")) expenseDesc = "Su Faturası";
    else if (norm.includes("gaz") || norm.includes("doğalgaz")) expenseDesc = "Doğalgaz Faturası";
    else if (norm.includes("internet")) expenseDesc = "İnternet Faturası";
    else if (norm.includes("telefon")) expenseDesc = "Telefon Faturası";
    else if (norm.includes("aidat")) expenseDesc = "Bina / Site Aidatı";
    else expenseDesc = "Fatura Ödemesi";
  } else {
    // Diğer / Özel Harcama
    const cleaned = rawInput
      .replace(/\d+/g, "")
      .replace(
        /(gider|harcama|tl|türk lirası|lira|₺|ekle|kaydet|yaz|işle|isle|ödedim|odedim|ödeme|odeme|için|icin|satın|aldım|aldim|bugün|bugun|dün|dun|yarın|yarin)/gi,
        ""
      )
      .trim();

    if (cleaned.length > 2) {
      expenseDesc = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }

  return {
    action: "addExpense",
    moduleTitle: "Gider / Harcama Ekleme",
    explanation: `"${expenseDesc}" için ₺${amount.toLocaleString("tr-TR")} tutarında gider kaydı hazırlandı. Onaylıyor musunuz?`,
    data: {
      title: expenseDesc,
      amount,
      categoryId,
      date: todayStr,
      category:
        categoryId === 2
          ? "Market"
          : categoryId === 3
          ? "Ulaşım"
          : categoryId === 4
          ? "Yeme İçme"
          : categoryId === 5
          ? "Faturalar"
          : "Diğer"
    },
    rawText: rawInput
  };
}
