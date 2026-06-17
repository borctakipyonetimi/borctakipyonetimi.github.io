/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  PlusCircle,
  ShoppingCart,
  Folder,
  Edit,
  Trash2,
  Calendar,
  ClipboardList,
  BarChart3,
  Check,
  AlertTriangle,
  Sparkles,
  X,
  Lightbulb,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import { Expense, ExpenseCategory } from "../types";
import { DoughnutChart, BarChart } from "./BudgetCharts";
import { useCurrency } from "../utils/CurrencyContext";
import ReceiptScanner from "./ReceiptScanner";
import { Camera } from "lucide-react";
import { t } from "../utils/translations";

interface ExpensesListProps {
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  onSaveExpense: (expense: Partial<Expense>) => void;
  onDeleteExpense: (id: number) => void;
  onSaveCategory: (category: Partial<ExpenseCategory>) => void;
  onDeleteCategory: (id: number) => void;
  onUpdateAllCategories?: (categories: ExpenseCategory[]) => void;
  netBalance?: number;
  isPremium?: boolean;
  onUpgradeClick?: () => void;
  language?: "tr" | "en";
}

const getSavingTipForCategory = (name: string, icon: string): string => {
  const norm = name.toLowerCase().trim();

  // Calculate a day-based rotation index (0 to 4) depending on the calendar date
  const date = new Date();
  const dayIndex = (date.getDate() + date.getMonth()) % 5;

  // 1. Market & Gıda & Mutfak
  if (
    norm.includes("market") ||
    norm.includes("mutfak") ||
    norm.includes("gıda") ||
    norm.includes("gida") ||
    norm.includes("bakkal") ||
    norm.includes("manav") ||
    icon === "🛒"
  ) {
    const marketTips = [
      "Market alışverişlerinize gitmeden önce mutlaka haftalık menü planlayın ve tok karnına bir liste ile gidin. Özel markalı (Private Label) ürünlere şans vererek sepet tutarını %30'a kadar düşürebilirsiniz.",
      "Kiloluk veya büyük boy paketler satın alırken birim fiyat analizi yapın. Genellikle alt raflarda yer alan alternatif markaların birim kilo fiyatları göz hizasındakilere göre çok daha avantajlıdır.",
      "Haftalık taze sebze-meyve ihtiyaçlarınızı akşam saatlerinde semt pazarından yapmayı tercih edin. Büyük zincir marketlere kıyasla taze ürünleri %40 tasarrufla temin edebilirsiniz.",
      "Süpermarket sadakat kartlarını ve mobil uygulama indirim kuponlarını senkronize edin. Harcama geçmişinize tanımlanan özel kuponlar sayesinde temel gıda bütçenizi büyük ölçüde hafifletin.",
      "Gıda israfını önlemek için evdeki malzemeleri tamamen tüketmeden yeni bir market turu planlamayın. Buzdolabındaki malzemeleri yaratıcı tariflerle değerlendirerek bütçeyi koruyun."
    ];
    return marketTips[dayIndex];
  }

  // 2. Restoran & Dışarıda Yemek & Kafe
  if (
    norm.includes("yemek") ||
    norm.includes("restoran") ||
    norm.includes("kafe") ||
    norm.includes("burger") ||
    norm.includes("kebap") ||
    norm.includes("dışarı") ||
    icon === "🍔" ||
    icon === "🥩" ||
    icon === "🍷"
  ) {
    const foodOutTips = [
      "Dışarıda yemek siparişlerini haftada maksimum 1 güne düşürün. İş yerinde öğle yemeğini evden pratik kaplarda götürmek veya kendi filtre kahvenizi termosta taşımak devasa bir tasarruf alanı açacaktır.",
      "Hafta içi dışarıdaki restoranlarda iş yemeği yemek yerine, mekanların öğle menüsü indirim saatlerini takip edin veya şirketlerin sunduğu yemek hakkı bakiyelerini rasyonel planlayın.",
      "Arkadaş buluşmalarını pahalı restoranlar yerine park, sahil ve koru gibi sosyal alanlarda planlayarak kişi başı içecek ve servis ücreti ödemelerini %75'e varan oranda azaltabilirsiniz.",
      "Paket servis sipariş uygulamalarındaki abonelikleri ve kayıtlı kartları iptal edin. Bu üyelikler sizde her akşam dürtüsel olarak hazır yemek siparişi verme motivasyonu yaratır.",
      "Hafta sonu akşam buluşmalarını masraflı mekanlar yerine ev ortamında 'herkes sevdiği bir yiyeceği/içeceği getirsin' konseptli tematik geceler düzenleyerek organize edin."
    ];
    return foodOutTips[dayIndex];
  }

  // 3. Kira & Konut & Ev Düzeni
  if (
    norm.includes("kira") ||
    norm.includes("ev") ||
    norm.includes("konut") ||
    norm.includes("site") ||
    norm.includes("aidat") ||
    icon === "🏠"
  ) {
    const homeTips = [
      "Evinizdeki enerji tüketimini optimize edin. Standart ampulleri LED'lerle değiştirmek, akıllı prizler tercih etmek ve televizyon gibi cihazları bekleme modundan çıkarmak faturayı %15 düşürür.",
      "Ortak aidat giderlerini ve bütçe planlarını inceleyin. Site ya da apartman yönetim toplantılarına aktif katılıp harcama şeffaflığı talep etmek gereksiz ortak masrafları önler.",
      "Kışın oda termostatını sadece 1 derece düşürün. Bu küçük ayar, ısınma faturanızda doğrudan %7 oranında tasarruf sağlar. Kapı ve pencere boşluklarını sünger bantlarla yalıtın.",
      "Kullanmadığınız ortak alan aboneliklerini kapatın ve evdeki temizlik işlerinde yüksek fiyatlı kimyasallar yerine sirke ve karbonat gibi doğal, ekonomik alternatifleri benimseyin.",
      "Kira artış dönemlerinde ev sahibiyle dürüst ve yapıcı ilişkiler kurun. Taşınma masraflarını ve yeni emlakçı komisyonlarını göze almak yerine her iki taraf için rasyonel bir oranı hedefleyin."
    ];
    return homeTips[dayIndex];
  }

  // 4. Ulaşım & Yol & Metro
  if (
    norm.includes("ulaşım") ||
    norm.includes("yol") ||
    norm.includes("otobüs") ||
    norm.includes("metro") ||
    norm.includes("taksi") ||
    icon === "🚗" ||
    icon === "✈️"
  ) {
    const transportTips = [
      "Toplu taşıma kullanırken tekli biletler yerine mutlaka aylık sınırsız abonman paketlerini tercih edin. Günlük yolculuk maliyetiniz böylece yarı yarıya düşecektir.",
      "Yakın mesafelerde taksi çağırmak yerine yürümeyi veya bisiklet/scooter gibi alternatifleri alışkanlık haline getirin. Hem cüzdanınızı hem de kondisyonunuzu olumlu etkilersiniz.",
      "Aynı bölgede yaşayan iş arkadaşlarınızla ortak araç kullanımı (ride-sharing) planlayarak yakıt, yol geçiş ve otopark harcamalarını adil şekilde paylaşın.",
      "Kartlı geçiş sistemlerindeki (HGS/OGS) otomatik bakiye yüklemelerini ve ekstrelerini kontrol edin. Hatalı gişelerden kaynaklanan mükerrer ödeme kesintilerini önleyin.",
      "Şehirlerarası veya uluslararası yolculuk planlarınızı en az 3-4 hafta öncesinden planlayarak uçak ve otobüs biletlerinizi en ucuz erken rezervasyon oranlarıyla sabitleyin."
    ];
    return transportTips[dayIndex];
  }

  // 5. Araba & Yakıt & Bakım
  if (
    norm.includes("araba") ||
    norm.includes("araç") ||
    norm.includes("yakıt") ||
    norm.includes("akaryakıt") ||
    norm.includes("benzin") ||
    norm.includes("bakım") ||
    norm.includes("sigorta") ||
    icon === "🔧"
  ) {
    const carTips = [
      "Akaryakıt tasarrufu için aracınızı stabil hız limitlerinde sürün, ani fren ve sert kalkışlardan kaçının. Lastik havalarını düzenli kontrol etmek yakıt harcamasını %3-4 azaltır.",
      "Aracınızın yağ, hava ve polen filtresi gibi periyodik bakımlarını zamanında yaptırın. Tıkalı filtreler motorun çekiş gücünü düşürür ve daha fazla yakıt harcamasına yol açar.",
      "Akaryakıt ve yakıt alımlarınızı bankaların dönemlik kredi kartı kampanyalarıyla birleştirin. Belirli sayıda alıma verilen nakit puanları doğrudan sonraki yakıt dolumuna yansıtın.",
      "Kasko ve Zorunlu Trafik Sigortası tekliflerini yenilemeden önce tek bir acenteye bağlı kalmayın; en az 4-5 farklı sigorta şirketinden karşılaştırmalı teklifler toplayın.",
      "Aracınızın bagajında biriken ve ihtiyaç duyulmayan gereksiz pasif ağırlıkları boşaltın. Bagajdaki her ekstra 50 kg yük, yakıt sarfiyatını %1.5 ila %2 artırır."
    ];
    return carTips[dayIndex];
  }

  // 6. Fatura & Elektrik & Abonelikler
  if (
    norm.includes("fatura") ||
    norm.includes("elektrik") ||
    norm.includes("su") ||
    norm.includes("doğalgaz") ||
    norm.includes("internet") ||
    norm.includes("telefon") ||
    icon === "⚡"
  ) {
    const billsTips = [
      "Kullanmadığınız ve aylardır açmadığınız TV/video ve müzik aboneliklerinizi (Netflix, Spotify vb.) askıya alın. Mevcut planları ise aile/ortak paketlerine taşıyarak faturayı bölüşün.",
      "İletişim ve internet taahhüt bitiş tarihlerini takviminize işleyin. Taahhüt dolmadan 1 ay önce yeni müşteri geçiş kampanyalarını araştırıp fiyat kilitlerinden sıyrılın.",
      "Bulaşık ve çamaşır makinelerini sadece tamamen dilediğinde çalıştırın. Kısa yıkama ve eko-mod programları sayesinde elektrik ve su faturalarınızı doğrudan yarıya yaklaştırın.",
      "Elektrik tüketiminde üç zamanlı (tarihsel avantajlı) tarife bütçenize uygunsa, enerji canavarı olan cihazları (ütü, kurutma makinesi) 22:00'den sonra çalıştırın.",
      "Fatura otomatik ödemelerini devretmek yerine, her ay bizzat kontrol ederek tutarların gelişimini inceleyin. Paranın çıkışını gözlemlemek, gereksiz su ve akım harcamalarını frenler."
    ];
    return billsTips[dayIndex];
  }

  // 7. Giyim & Alışveriş & Moda
  if (
    norm.includes("giyim") ||
    norm.includes("elbise") ||
    norm.includes("ayakkabı") ||
    norm.includes("moda") ||
    norm.includes("alışveriş") ||
    icon === "🎒" ||
    icon === "🛍️" ||
    icon === "💇"
  ) {
    const clothesTips = [
      "Dolabınızda artık kullanmadığınız giyim eşyalarını temizleyerek ikinci el satış platformlarında satın. Elde ettiğiniz bütçeyi sonraki zaruri ihtiyaçlarınıza yönlendirin.",
      "Bir kıyafeti beğenip satın almadan önce en az 48 saat kuralını uygulayın. Ürünü sepete atıp bekleyin; heyecanınızın dindiğini ve dürtüsel iştahın %80 oranda kaybolduğunu göreceksiniz.",
      "Sezon sonu indirim zamanlamalarını rasyonel takip edin. Örneğin kışlık kaban, mont ya da bot ihtiyaçlarınızı ilkbahar dönemindeki tasfiye satışlarından yarı fiyatına alın.",
      "Alışverişe çıkmadan önce dolabınızı detaylı inceleyin ve birbirine çok benzeyen renkli veya tarzdaki parçaların kaydını tutun. Sadece eksik olan parçaları hedefleyin.",
      "Modası çabuk geçecek ucuz ve kalitesiz ürünler yerine zamansız, kumaş ve dikiş kalitesi yüksek parçalar alın. Kısa süreli yıpranmaların yaratacağı mükerrer masrafları önleyin."
    ];
    return clothesTips[dayIndex];
  }

  // 8. Eğlence & Sosyal Aktivite & Kültür
  if (
    norm.includes("eğlence") ||
    norm.includes("sinema") ||
    norm.includes("konser") ||
    norm.includes("tiyatro") ||
    norm.includes("aktivite") ||
    norm.includes("oyun") ||
    icon === "🍿" ||
    icon === "🎸"
  ) {
    const funTips = [
      "Belediyelerin ve kültür müdürlüklerinin düzenlediği ücretsiz söyleşi, tiyatro, açık hava sineması ve konser takvimlerini dijital bültenlerden takip edin.",
      "Sinema biletlerinde, dijital oyun üyeliklerinde veya kafelerdeki tatlı siparişlerinde GSM operatörlerinin ve bankaların '1 alana 1 bedava' kodlarını aktif şekilde kullanın.",
      "Arkadaş gruplarınızla dış mekan etkinlik harcamaları yerine evde masa oyunları, film izleme saatleri veya tematik akşam sohbetleri gibi sıfır bütçeli konseptler üretin.",
      "Aktif oynamadığınız veya artık zevk almadığınız konsol/PC oyun üyeliklerini vakit kaybetmeden iptal edin. Bu küçük kalemler filtre edilmediğinde büyük sızıntı yaratır.",
      "Okumak istediğiniz kitap grupları ya da çizgi romanlar için şehir ve araştırma kütüphanelerini kullanın. Kütüphaneler binlerce eseri size tamamen bedelsiz sunar."
    ];
    return funTips[dayIndex];
  }

  // 9. Sağlık & İlaç & Doktor & Bakım
  if (
    norm.includes("sağlık") ||
    norm.includes("ilaç") ||
    norm.includes("hastane") ||
    norm.includes("doktor") ||
    norm.includes("eczane") ||
    icon === "💊"
  ) {
    const healthTips = [
      "Koruyucu sağlık yatırımlarına (düzenli spor, günlük yürüyüşler, şeker oranı düşük doğal beslenme) yönelin. Sağlıklı yaşam tarzı sizi pahalı ilaç ve klinik tedavi faturalarından korur.",
      "Hafif cilt ve saç bakımlarını eczane ürünleri veya evde hazırlayabileceğiniz doğal, pratik maskelerle gerçekleştirin. Güzellik merkezlerine harcanan taksit bütçelerini azaltın.",
      "Eğer tamamlayıcı ya da özel sağlık sigortanız varsa, hak ettiğiniz yılda 1 ücretsiz diş temizliği, göz muayenesi ve check-up gibi poliçe teminatlarını kaçırmadan tamamlayın.",
      "Reçeteli ilaçlarınızı alırken eczacınıza mutlaka devlet kurumlarının asgari muadil (aynı etken maddeli eşdeğer) ilaç seçeneklerini sorup bütçe dostu tercihler yapın.",
      "Fitness ve spor kulübü üyelikleri yerine belediye tesislerini ve parklardaki ücretsiz açık hava spor alanlarını ve internetteki profesyonel ev egzersiz videolarını değerlendirin."
    ];
    return healthTips[dayIndex];
  }

  // 10. Eğitim & Kitap & Kurslar
  if (
    norm.includes("eğitim") ||
    norm.includes("kurs") ||
    norm.includes("kitap") ||
    norm.includes("okul") ||
    icon === "🎓"
  ) {
    const eduTips = [
      "İnternette yer alan akademik ve teknik eğitim fırsatlarını değerlendirin. Khan Academy, YouTube, Coursera ve edX gibi devler sıfır bütçeyle devasa kütüphaneler sunar.",
      "Mesleki veya edebi her kitabı anında satın almak yerine, arkadaş çevreniz arasında 'kitap takası grupları (kitap kardeşliği)' kurarak kaynakları ortaklaştırın.",
      "Yabancı dil pratiğinizi geliştirmek için pahalı yüz yüze kurslar yerine ücretsiz platformları (örneğin mobil uygulamalar ve konuşma kulüpleri) aktif şekilde kullanın.",
      "Tasarım, yazılım veya mühendislik alanlarında öğrenci ya da akademik e-posta adresine (@edu) sahipseniz, markaların sunduğu %80'e varan devasa indirimlerden yararlanın.",
      "Sertifikalı kariyer gelişim programlarında doğrudan ödeme yapmak yerine, kamu kurumlarının ve odaların sunduğu ücretsiz veya hibeli hobi/meslek edindirme programlarına başvurun."
    ];
    return eduTips[dayIndex];
  }

  // 11. Hediye & Özel Günler & Bağış
  if (
    norm.includes("hediye") ||
    norm.includes("bağış") ||
    norm.includes("yardım") ||
    icon === "🎁" ||
    icon === "💰"
  ) {
    const giftTips = [
      "Özel gün hediyelerinde pahalı fabrikasyon ürünler yerine el emeği sanatsal kutular, mektuplar ya da ortak anıların biriktiği şık dijital albümler yapın. Manevi derinlik daha kalıcıdır.",
      "Doğum günü, evlilik yıldönümü gibi belirli dönem kartopu etkilerini aşmak için her ay bütçenizin bir kenarında minik bir 'özel günler fonu' biriktirerek şok ödemeleri ezin.",
      "Ortak arkadaş buluşmalarındaki hediye alımlarında harcamayı diğer arkadaşlarla eşit şekilde bölüşerek bireysel olarak üstleneceğiniz finansal baskıyı hafifletin.",
      "Özel hediyeleri son ana bırakıp telaşlı ve plansız alışveriş yapmayın. Sıkışık zamanlarda yapılan alışverişler genellikle kıyaslama fırsatı vermez ve %50 daha pahalıya patlar.",
      "Sevdiklerinize fiziki materyaller hediye etmek yerine, zaman ayırıp birlikte gezebileceğiniz keyifli rotalar ya da kendi hazırlayacağınız gurme bir akşam yemeği deneyimi sunun."
    ];
    return giftTips[dayIndex];
  }

  // Fallback dynamic rotating algorithm for custom categories
  // Generates 5 diversified, tailored personal finance methods based on character sum + date
  let charSum = 0;
  for (let i = 0; i < name.length; i++) {
    charSum += name.charCodeAt(i);
  }
  const fallbackId = (charSum + date.getDate()) % 5;

  const fallbackTips = [
    `"${name}" kalemi için bu ay sınır koyun. Her pazartesi kendinize haftalık harcama limiti belirleyin. Limit dolduğunda harcamayı durdurmak, oto-kontrol kasınızı anında güçlendirir.`,
    `Aylık "${name}" harcamalarınızı %15 oranında düşürmek için harcamadan önce 48 saat kuralını uygulayın. İstek mi yoksa acil bir ihtiyaç mı olduğunu kendinize sorarak dürtüsel harcamaların önüne geçin.`,
    `"${name}" ödemelerinde nakit kullanmaya çalışın. Nakit para ile vedalaşmak, kredi kartıyla temassız ödeme yapmaya kıyasla zihnimizde gerçek bir harcama algısı yaratır ve tasarruf yaptırır.`,
    `Gelecek ayki "${name}" giderini düşürmek için alternatif fiyat araştırması yapın. Farklı marka veya hizmet sağlayıcılarının kampanyalarını karşılaştırmak, size şaşırtıcı bir kazanç sağlayacaktır.`,
    `Mevcut bütçenizde "${name}" harcamalarını finanse etmek için "Gider Eşleme" yapın. Yani bu kategoride yaptığınız her ekstra harcama kadar tutarı acil durum birikim hesabınıza da aktarın.`
  ];

  return fallbackTips[fallbackId];
};

export const ExpensesList: React.FC<ExpensesListProps> = ({
  expenses,
  expenseCategories,
  onSaveExpense,
  onDeleteExpense,
  onSaveCategory,
  onDeleteCategory,
  onUpdateAllCategories,
  netBalance,
  isPremium = false,
  onUpgradeClick,
  language = "tr",
}) => {
  const translate = (txt: string) => t(txt, language as "tr" | "en");
  const { format, currencySymbol } = useCurrency();
  
  // Selected Month filter state (defaults to current year & month, e.g. "2026-05")
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Saving Advice / Tip Popover State
  const [showTipCategory, setShowTipCategory] =
    useState<ExpenseCategory | null>(null);

  // Expense Dialog states
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [expModalTitle, setExpModalTitle] = useState("Gider Ekle");

  useEffect(() => {
    if (localStorage.getItem("auto_open_add_expense") === "true") {
      localStorage.removeItem("auto_open_add_expense");
      handleOpenAddExpense();
    }
  }, []);
  const [expenseId, setExpenseId] = useState<number | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number>(1);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [expenseAlarm, setExpenseAlarm] = useState(false);

  // AI OCR scanner state and callback
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const handleScanCompleted = (result: any) => {
    setAmount(result.amount.toString());
    setDescription(result.title);
    if (result.date) {
      setDate(result.date);
    }
    // Fuzzy match suggested category
    if (result.categorySuggestion) {
      const suggested = result.categorySuggestion.toLowerCase();
      const match = expenseCategories.find(
        (c) =>
          c.name.toLowerCase().includes(suggested) ||
          suggested.includes(c.name.toLowerCase())
      );
      if (match) {
        setCategoryId(match.id);
      }
    }
    setIsScannerOpen(false);
    setIsExpModalOpen(true);
  };

  // Category Dialog states
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catModalTitle, setCatModalTitle] = useState("Kategori Ekle");
  const [expenseCategoryId, setExpenseCategoryId] = useState<
    number | undefined
  >(undefined);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#6366f1");
  const [categoryIcon, setCategoryIcon] = useState("🛒");
  const [isInlineEditingCategory, setIsInlineEditingCategory] = useState(false);
  const [selectedFilterCategoryId, setSelectedFilterCategoryId] = useState<
    number | null
  >(null);

  // Track newly added expense IDs for slide-in and glow animation
  const [prevExpenseIds, setPrevExpenseIds] = useState<number[]>([]);
  const [newlyAddedIds, setNewlyAddedIds] = useState<number[]>([]);

  useEffect(() => {
    const currentIds = expenses.map((e) => e.id);
    if (prevExpenseIds.length > 0) {
      const newIds = currentIds.filter((id) => !prevExpenseIds.includes(id));
      if (newIds.length > 0) {
        setNewlyAddedIds((prev) => [...prev, ...newIds]);
        // Remove from list after 4 seconds to stop the premium glow highlights
        const timer = setTimeout(() => {
          setNewlyAddedIds((prev) => prev.filter((id) => !newIds.includes(id)));
        }, 4000);
        return () => clearTimeout(timer);
      }
    }
    setPrevExpenseIds(currentIds);
  }, [expenses]);

  const handleOpenAddExpense = () => {
    setExpModalTitle("Gider Ekle");
    setExpenseId(undefined);
    if (expenseCategories.length > 0) setCategoryId(expenseCategories[0].id);
    setAmount("");
    setDescription("");
    setIsCatDropdownOpen(false);
    
    // Choose dynamic smart default date for past/future monthly addition support
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    if (selectedMonthStr === "all" || selectedMonthStr === currentMonthKey) {
      setDate(today.toISOString().slice(0, 10));
    } else {
      setDate(`${selectedMonthStr}-01`);
    }
    
    setIsExpModalOpen(true);
  };

  const handleOpenEditExpense = (e: Expense) => {
    setExpModalTitle("Gider Düzenle");
    setExpenseId(e.id);
    setCategoryId(e.categoryId);
    setAmount(e.amount.toString());
    setDescription(e.description);
    setDate(
      e.date ? e.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    );
    setIsCatDropdownOpen(false);
    setIsExpModalOpen(true);
  };

  const handleSaveExpense = () => {
    const parsedAmount = parseFloat(amount);
    if (!categoryId) {
      alert("Lütfen önce bir kategori seçin.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Lütfen sıfırdan büyük geçerli bir harcama tutarı girin.");
      return;
    }

    onSaveExpense({
      id: expenseId,
      categoryId,
      amount: parsedAmount,
      description: description.trim(),
      date: date || new Date().toISOString(),
    });
    setIsExpModalOpen(false);
  };

  const handleOpenAddCategory = () => {
    setCatModalTitle("Fatura/Harcama Kategorisi Ekle");
    setExpenseCategoryId(undefined);
    setCategoryName("");
    setCategoryColor("#6366f1");
    setCategoryIcon("🛒");
    setIsCatModalOpen(true);
  };

  const handleOpenEditCategory = (c: ExpenseCategory) => {
    setCatModalTitle("Kategori Düzenle");
    setExpenseCategoryId(c.id);
    setCategoryName(c.name);
    setCategoryColor(c.color || "#6366f1");
    setCategoryIcon(c.icon || "🛒");
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = () => {
    if (!categoryName.trim()) {
      alert("Kategori ismi boş bırakılamaz.");
      return;
    }
    onSaveCategory({
      id: expenseCategoryId,
      name: categoryName.trim(),
      color: categoryColor,
      icon: categoryIcon,
    });
    setIsCatModalOpen(false);
  };

  const handleRandomizeColors = () => {
    try {
      if (!onUpdateAllCategories) {
        console.warn(
          "onUpdateAllCategories prop is missing in ExpensesList! Fallback to local array alert.",
        );
        return;
      }
      const palette = [
        "#ef4444",
        "#f97316",
        "#f59e0b",
        "#10b981",
        "#059669",
        "#14b8a6",
        "#06b6d4",
        "#0ea5e9",
        "#3b82f6",
        "#6366f1",
        "#8b5cf6",
        "#a855f7",
        "#d946ef",
        "#ec4899",
        "#f43f5e",
        "#84cc16",
        "#0284c7",
        "#4f46e5",
        "#b91c1c",
        "#0d9488",
      ];
      const sourceCats = expenseCategories || [];
      // Shuffle helper to assign unique colors safely
      const shuffled = [...palette].sort(() => 0.5 - Math.random());
      const randomized = sourceCats.map((c, idx) => ({
        ...c,
        color: shuffled[idx % shuffled.length],
      }));
      onUpdateAllCategories(randomized);
    } catch (err) {
      console.error("Failed to randomize colors:", err);
    }
  };

  // Drag and drop states for category badges
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (
      draggedIndex === null ||
      draggedIndex === targetIndex ||
      !onUpdateAllCategories
    )
      return;

    const reorderedCategories = [...expenseCategories];
    const [removed] = reorderedCategories.splice(draggedIndex, 1);
    reorderedCategories.splice(targetIndex, 0, removed);

    onUpdateAllCategories(reorderedCategories);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Dynamically filter expenses according to the selected month (e.g. YYYY-MM)
  const filteredMonthExpenses = expenses.filter((e) => {
    if (selectedMonthStr === "all") return true;
    if (!e.date) return false;
    try {
      const eDate = new Date(e.date);
      const val = `${eDate.getFullYear()}-${String(eDate.getMonth() + 1).padStart(2, "0")}`;
      return val === selectedMonthStr;
    } catch {
      return false;
    }
  });

  const totalExpenses = filteredMonthExpenses.reduce((s, e) => s + e.amount, 0);

  // Grouping category totals for the visual stats of the selected month
  const categoryTotals: Record<number, number> = {};
  expenseCategories.forEach((cat) => (categoryTotals[cat.id] = 0));
  filteredMonthExpenses.forEach((e) => {
    if (categoryTotals[e.categoryId] !== undefined) {
      categoryTotals[e.categoryId] += e.amount;
    } else {
      categoryTotals[e.categoryId] = e.amount;
    }
  });

  const colors = [
    "#ef4444",
    "#f59e0b",
    "#3b82f6",
    "#10b981",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#6366f1",
  ];
  const doughnutData = expenseCategories
    .map((c, idx) => ({
      label: c.name,
      value: categoryTotals[c.id] || 0,
      color: c.color || colors[idx % colors.length],
    }))
    .filter((item) => item.value > 0);

  // Giderlerin aylara göre nasıl değiştiğini gösteren son 6 aylık çubuk grafik verisi
  const last6MonthsData: { label: string; value: number; color: string }[] = [];
  const currentDate = new Date();
  const monthsList = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - i,
      1,
    );
    const year = d.getFullYear();
    const monthIndex = d.getMonth();

    const monthlySum = expenses
      .filter((e) => {
        const eDate = new Date(e.date);
        return eDate.getFullYear() === year && eDate.getMonth() === monthIndex;
      })
      .reduce((sum, item) => sum + item.amount, 0);

    last6MonthsData.push({
      label: `${monthsList[monthIndex]} ${year}`,
      value: monthlySum,
      color: "#ec4899", // Pembe/rose renk tonu
    });
  }

  const currentYear = currentDate.getFullYear();
  const currentMonthIndex = currentDate.getMonth();

  const categoryCurrentMonthTotals: Record<number, number> = {};
  expenseCategories.forEach((cat) => {
    categoryCurrentMonthTotals[cat.id] = expenses
      .filter((e) => {
        if (!e.date) return false;
        const eDate = new Date(e.date);
        return (
          eDate.getFullYear() === currentYear &&
          eDate.getMonth() === currentMonthIndex &&
          e.categoryId === cat.id
        );
      })
      .reduce((sum, item) => sum + item.amount, 0);
  });

  // Calculate current month's overall expenses total and load budget goal from local storage
  const currentMonthExpensesTotal = expenses
    .filter((e) => {
      if (!e.date) return false;
      const eDate = new Date(e.date);
      return (
        eDate.getFullYear() === currentYear &&
        eDate.getMonth() === currentMonthIndex
      );
    })
    .reduce((sum, item) => sum + item.amount, 0);

  const budgetGoal = (() => {
    const email = localStorage.getItem("currentUser") || "anonymous";
    const saved = localStorage.getItem(`budget_goal_${email}`);
    return saved ? parseFloat(saved) : 10000;
  })();

  const selectedFilterCategory = expenseCategories.find(
    (c) => c.id === selectedFilterCategoryId,
  );
  const selectedCategoryTotal = selectedFilterCategoryId
    ? filteredMonthExpenses
        .filter((e) => e.categoryId === selectedFilterCategoryId)
        .reduce((sum, e) => sum + e.amount, 0)
    : totalExpenses;

  const selectedCategoryCount = selectedFilterCategoryId
    ? filteredMonthExpenses.filter((e) => e.categoryId === selectedFilterCategoryId).length
    : filteredMonthExpenses.length;

  const percentageOfTotal =
    totalExpenses > 0
      ? ((selectedCategoryTotal / totalExpenses) * 100).toFixed(1)
      : "0.0";

  const filteredExpenses = selectedFilterCategoryId
    ? filteredMonthExpenses.filter((e) => e.categoryId === selectedFilterCategoryId)
    : filteredMonthExpenses;

  return (
    <div className="space-y-6">
      {/* Centered & Animated Page Title */}
      <div className="flex flex-col items-center justify-center text-center py-4 select-none">
        <motion.h2
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
        >
          <ShoppingCart className="w-7 h-7 text-rose-500 animate-pulse" /> HARCAMA GİDERLERİ
        </motion.h2>
        <div className="w-16 h-1 bg-rose-500 rounded-full mt-2 opacity-80" />
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-col gap-3 justify-center sm:flex-row sm:items-center">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={handleOpenAddCategory}
            className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <Folder className="w-4 h-4 text-slate-400" /> Kategori Ekle
          </button>
          <button
            onClick={() => {
              if (!isPremium) {
                onUpgradeClick?.();
              } else {
                setIsScannerOpen(true);
              }
            }}
            className="px-3.5 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
          >
            <Camera className="w-4 h-4" /> AI ile Fiş Tara {!isPremium && <span className="text-[8px] bg-amber-500 text-white px-1 py-0.5 rounded-sm font-black">PRO</span>}
          </button>
          <button
            onClick={handleOpenAddExpense}
            className="px-3.5 py-1.5 bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" /> Gider Ekle
          </button>
        </div>
      </div>

      {/* Month Selection Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-rose-500" />
          <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">HARCAMA DÖNEMİ SEÇİN:</span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedMonthStr}
            onChange={(e) => setSelectedMonthStr(e.target.value)}
            className="w-full sm:w-56 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 font-extrabold cursor-pointer transition"
          >
            <option value="all">📅 Tüm Zamanlar</option>
            {(() => {
              const options: { value: string; label: string }[] = [];
              const now = new Date();
              const startYear = now.getFullYear() - 1;
              const endYear = now.getFullYear();
              
              for (let y = startYear; y <= endYear; y++) {
                const maxMonth = y === endYear ? now.getMonth() + 2 : 11;
                for (let m = 0; m <= maxMonth; m++) {
                  const mStr = String(m + 1).padStart(2, "0");
                  const val = `${y}-${mStr}`;
                  const label = `${monthsList[m]} ${y}`;
                  options.push({ value: val, label });
                }
              }
              
              // Append any extra dates present in actual loaded expenses
              expenses.forEach(e => {
                if (e.date) {
                  try {
                    const d = new Date(e.date);
                    if (!isNaN(d.getTime())) {
                      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                      if (!options.some(opt => opt.value === val)) {
                        options.push({
                          value: val,
                          label: `${monthsList[d.getMonth()]} ${d.getFullYear()}`
                        });
                      }
                    }
                  } catch (e) {}
                }
              });
              
              // Deduplicate and Sort
              const uniqueOptions = options.filter((value, index, self) =>
                index === self.findIndex((t) => t.value === value.value)
              ).sort((a, b) => b.value.localeCompare(a.value));

              return uniqueOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ));
            })()}
          </select>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        whileHover={{ scale: 1.01 }}
        className="p-4 bg-rose-50/50 dark:bg-rose-950/20 text-rose-950 dark:text-rose-300 rounded-2xl flex items-center justify-between font-bold text-xs gap-3"
      >
        <div className="flex items-center gap-2">
          {netBalance !== undefined && (
            netBalance >= 0 ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span id="expense-netbalance-success-badge" className="p-1 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center shrink-0" title="Net Bakiye Artıda - Finansal Durum Sağlıklı">
                  <Check className="w-3.5 h-3.5" />
                </span>
                <motion.span
                  animate={{ opacity: [0.6, 1, 0.6], scale: [0.96, 1.04, 0.96] }}
                  transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
                  className="p-1 px-1.5 bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 rounded-lg flex items-center justify-center gap-1 shrink-0 text-[9px] font-black tracking-wide border border-emerald-500/20"
                  title="Pozitif Tasarruf İvmesi - Tebrikler!"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline text-[8px]">POZİTİF İVME</span>
                </motion.span>
              </div>
            ) : (
              <span id="expense-netbalance-alert-badge" className="p-1 bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg flex items-center justify-center shrink-0 animate-pulse" title="Net Bakiye Ekside - Lütfen Bütçenize Dikkat Edin">
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
            )
          )}
          <span>Aylık Toplam Gider Masrafı:</span>
        </div>
        <span className="text-base text-rose-600 dark:text-rose-400 font-mono shrink-0">
          {format(totalExpenses)}
        </span>
      </motion.div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        {/* Left Side: Listing */}
        <div className="space-y-4 shadow-sm rounded-2xl lg:col-span-7">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <ClipboardList className="w-4 h-4 text-rose-500" /> HARCAMA
                KAYITLARI
              </h4>
              <select
                value={selectedFilterCategoryId || ""}
                onChange={(e) =>
                  setSelectedFilterCategoryId(
                    e.target.value ? parseInt(e.target.value) : null,
                  )
                }
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl px-2.5 py-1 text-slate-700 dark:text-slate-200 font-semibold outline-none focus:ring-1 focus:ring-rose-500/30 transition-all cursor-pointer max-w-[150px] shadow-sm shrink-0"
              >
                <option value="">Tüm Kategoriler</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon || "🛒"} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Seçili Kategori Toplamı Bilgi Kartı */}
            <motion.div
              layout
              className="p-4 rounded-2xl border transition-all duration-500 overflow-hidden relative shadow-sm"
              style={{
                borderColor: selectedFilterCategory
                  ? `${selectedFilterCategory.color}60`
                  : "rgba(99, 102, 241, 0.45)",
                background: selectedFilterCategory
                  ? `linear-gradient(135deg, ${selectedFilterCategory.color}15, ${selectedFilterCategory.color}25)`
                  : "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(244, 63, 94, 0.12))",
              }}
            >
              {/* Decorative dynamic ambient glow corner */}
              <div
                className="absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl opacity-15 dark:opacity-25 transition-all duration-500 animate-pulse"
                style={{
                  backgroundColor: selectedFilterCategory
                    ? selectedFilterCategory.color
                    : "#6366f1",
                }}
              />

              <div className="flex items-center justify-between gap-4 relative z-10">
                <div className="space-y-1">
                  <span className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase block">
                    SEÇİLİ KATEGORİ TOPLAMI
                  </span>
                  <div className="flex items-center gap-1.5">
                    {selectedFilterCategory && (
                      <span
                        className="w-2 h-2 rounded-full inline-block shrink-0"
                        style={{
                          backgroundColor: selectedFilterCategory.color,
                        }}
                      />
                    )}
                    <h5 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 transition-all duration-300">
                      {selectedFilterCategory
                        ? `${selectedFilterCategory.icon || "🛒"} ${selectedFilterCategory.name}`
                        : "Tüm Kategoriler"}
                    </h5>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5 pt-0.5">
                    <span>{selectedCategoryCount} işlem kaydı</span>
                    <span>•</span>
                    <span className="font-bold text-rose-500 dark:text-rose-400">
                      Toplamın %{percentageOfTotal}'i
                    </span>
                  </p>
                </div>

                <div className="text-right space-y-0.5 shrink-0">
                  <span className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 block uppercase">
                    Tutar
                  </span>
                  <motion.div
                    key={selectedCategoryTotal}
                    initial={{ scale: 0.95, opacity: 0.8 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-base sm:text-lg font-black font-mono transition-all duration-300"
                    style={{
                      color: selectedFilterCategory
                        ? selectedFilterCategory.color
                        : "#e11d48",
                    }}
                  >
                    {format(selectedCategoryTotal)}
                  </motion.div>
                </div>
              </div>

              {/* Mini visual indicator bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-700/50 h-1.5 rounded-full mt-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentageOfTotal}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: selectedFilterCategory
                      ? selectedFilterCategory.color
                      : "#e11d48",
                  }}
                />
              </div>
            </motion.div>

            {filteredExpenses.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 font-medium bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl p-4">
                Bu kategoride henüz bir gider harcaması kaydedilmemiş.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {filteredExpenses.map((e) => {
                  const cat = expenseCategories.find(
                    (c) => c.id === e.categoryId,
                  );
                  const isNew = newlyAddedIds.includes(e.id);
                  return (
                    <motion.div
                      key={e.id}
                      layout
                      initial={isNew ? { opacity: 0, y: 30 } : {}}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        isNew
                          ? { duration: 0.5, ease: "easeOut" }
                          : { type: "spring", stiffness: 350, damping: 25 }
                      }
                      className={`relative overflow-hidden p-3 bg-white dark:bg-slate-800 rounded-2xl border flex items-center justify-between transition-all duration-300 ${
                        isNew
                          ? "ring-2 ring-rose-500/50 border-rose-500/70 shadow-[0_0_20px_rgba(244,63,94,0.3)] dark:shadow-[0_0_25px_rgba(244,63,94,0.2)]"
                          : "border-slate-100 dark:border-slate-700/50 shadow-sm"
                      }`}
                    >
                      {/* Premium Shimmering Shine Parıltı Effect */}
                      {isNew && (
                        <motion.div
                          initial={{ left: "-100%" }}
                          animate={{ left: "100%" }}
                          transition={{
                            repeat: Infinity,
                            repeatType: "loop",
                            duration: 1.6,
                            ease: "linear",
                          }}
                          className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-rose-500/15 to-transparent pointer-events-none transform -skew-x-12"
                        />
                      )}

                      {/* Sub-bar indicator for newly highlighted item */}
                      {isNew && (
                        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500 animate-pulse" />
                      )}

                      <div className="space-y-1 relative z-10">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 text-[10px] font-extrabold rounded-full uppercase transition-all duration-500 ease-in-out font-sans shrink-0"
                            style={{
                              backgroundColor: `${cat?.color || "#ec4899"}15`,
                              color: cat?.color || "#ec4899",
                            }}
                          >
                            {cat
                              ? `${cat.icon || "🛒"} ${cat.name}`
                              : "Kategorisiz"}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                            {e.description || "Harcama açıklaması girmediniz"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 flex items-center gap-0.5 font-semibold">
                          <Calendar className="w-3 h-3" />{" "}
                          {new Date(e.date).toLocaleDateString("tr-TR")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 relative z-10">
                        <span className="font-extrabold text-sm text-rose-500 font-mono">
                          {format(e.amount)}
                        </span>
                        <div className="flex items-center">
                          <button
                            onClick={() => handleOpenEditExpense(e)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 rounded-lg transition"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteExpense(e.id)}
                            className="p-1.5 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Categories Management Panel */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                KATEGORİLERİ DÜZENLE
              </h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRandomizeColors();
                  }}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 text-[10px] font-extrabold rounded-lg border border-rose-200/50 dark:border-rose-900/30 shadow-xs transition-all duration-150 flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
                  title="Renk Paletini Rastgele Düzenle"
                >
                  ✨ Renk Paletini Yenile
                </button>
              </div>
            </div>
            <div
              id="expenses-category-list-container"
              className="flex flex-col gap-3 animate-fade-in bg-slate-100/40 dark:bg-slate-900/40 p-3 sm:p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800/60 shadow-inner w-full"
            >
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 select-none">
                <div className="flex items-center gap-3">
                  <span>
                    Tanımlı Kategori Sayısı:{" "}
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                      {expenseCategories.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const config = expenseCategories.map(
                        ({ name, color }) => ({ name, color }),
                      );
                      const blob = new Blob([JSON.stringify(config, null, 2)], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "kategori_ayarlari.json";
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all duration-300 flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Kategori konfigürasyonunu (isimler ve renkler) JSON dosyası olarak dışa aktar"
                  >
                    <span>📥 JSON DIŞA AKTAR</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setIsInlineEditingCategory(!isInlineEditingCategory)
                  }
                  className={`px-3 py-1 rounded-xl text-[10px] font-black tracking-medium uppercase transition-all duration-300 flex items-center gap-1.5 shadow-sm cursor-pointer ${
                    isInlineEditingCategory
                      ? "bg-emerald-500 text-white hover:bg-emerald-600 animate-pulse"
                      : "bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/25"
                  }`}
                >
                  {isInlineEditingCategory ? (
                    <>
                      <Check className="w-3 h-3" /> Düzenlemeyi Bitir
                    </>
                  ) : (
                    <>
                      <Edit className="w-3 h-3" /> Hızlı Düzenleme Modu
                    </>
                  )}
                </button>
              </div>

              {/* Bütçe Limit Uyarısı (Dikkat Bandı) */}
              {budgetGoal > 0 &&
                currentMonthExpensesTotal >= budgetGoal * 0.9 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full p-4 rounded-2xl bg-gradient-to-tr from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/25 dark:border-rose-500/15 text-rose-800 dark:text-rose-200 flex items-start gap-3 shadow-xs mb-1 text-left"
                  >
                    <div className="p-2 bg-rose-500/15 rounded-xl text-rose-600 animate-pulse mt-0.5">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-[11px] font-black tracking-wider uppercase font-sans text-rose-700 dark:text-rose-400">
                        🚨 BÜTÇE SINIRI / DİKKAT!
                      </p>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                        Mevcut ayın bütçe hedefinin (
                        <span className="font-mono font-black">
                          {format(budgetGoal)}
                        </span>
                        ){" "}
                        <span className="text-rose-600 dark:text-rose-400 font-extrabold">
                          %90'ını
                        </span>{" "}
                        geçtiniz! Toplam aylık harcama:{" "}
                        <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                          {format(currentMonthExpensesTotal)}
                        </span>{" "}
                        (Hedefe Oranı:{" "}
                        <span className="font-mono font-black">
                          %
                          {(
                            (currentMonthExpensesTotal / budgetGoal) *
                            100
                          ).toFixed(1)}
                        </span>
                        ). Bütçenizi kontrol altında tutmanızı öneririz.
                      </p>
                    </div>
                  </motion.div>
                )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 w-full">
                {expenseCategories.map((c, idx) => {
                  const isDragged = draggedIndex === idx;
                  const isOver = dragOverIndex === idx;
                  const currentMonthTotal =
                    categoryCurrentMonthTotals[c.id] || 0;
                  const isSelected = selectedFilterCategoryId === c.id;
                  return (
                    <motion.div
                      key={c.id}
                      layout
                      transition={{
                        type: "spring",
                        stiffness: 450,
                        damping: 35,
                      }}
                      draggable={
                        !isInlineEditingCategory && !!onUpdateAllCategories
                      }
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragLeave={() => {
                        if (dragOverIndex === idx) setDragOverIndex(null);
                      }}
                      onClick={() => {
                        if (!isInlineEditingCategory) {
                          setSelectedFilterCategoryId(isSelected ? null : c.id);
                        }
                      }}
                      whileHover={undefined}
                      whileTap={isInlineEditingCategory ? {} : { scale: 0.98 }}
                      className={`relative group flex items-center justify-between gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 border-l-[4px] rounded-xl text-xs font-semibold select-none category-card-animated ${
                        isSelected
                          ? "shadow-md ring-2 ring-indigo-500/30 dark:ring-indigo-400/20 font-bold"
                          : "bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60"
                      } ${
                        isInlineEditingCategory
                          ? "shadow-md ring-1 ring-indigo-500/10 inline-editing"
                          : "cursor-pointer"
                      } ${
                        isDragged
                          ? "opacity-30 border-dashed border-indigo-400 bg-indigo-50/10 scale-95"
                          : ""
                      } ${
                        isOver && !isDragged
                          ? "border-indigo-500 ring-2 ring-indigo-500/20 scale-105"
                          : ""
                      }`}
                      style={{
                        "--cat-color": c.color || "#6366f1",
                        "--cat-bg": isSelected
                          ? `${c.color || "#6366f1"}25`
                          : isDragged
                            ? "transparent"
                            : `${c.color || "#6366f1"}04`,
                        "--cat-bg-hover": isSelected
                          ? `${c.color || "#6366f1"}35`
                          : `${c.color || "#6366f1"}12`,
                        borderLeftColor: "var(--cat-color)",
                        borderTopColor: isSelected ? "var(--cat-color)" : undefined,
                        borderRightColor: isSelected ? "var(--cat-color)" : undefined,
                        borderBottomColor: isSelected ? "var(--cat-color)" : undefined,
                      } as React.CSSProperties}
                      title={
                        isInlineEditingCategory
                          ? "Kategeri ismini veya rengini doğrudan değiştirin"
                          : "Giderleri filtrelemek için tıklayın | Sürükleyip bırakarak öncelik sırasını değiştirin"
                      }
                    >
                      {/* Hover Tooltip - Monthly Category Total (only when not inline editing to save space) */}
                      {!isInlineEditingCategory && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-950/95 dark:bg-slate-900/95 text-white text-[10.5px] rounded-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-[100] shadow-2xl border border-indigo-500/15 flex flex-col items-center gap-0.5 animate-fade-in-fast">
                          <span className="text-slate-400 text-[8px] tracking-widest font-black uppercase">
                            Bu Ayın Toplamı
                          </span>
                          <span className="text-emerald-400 font-black text-xs font-mono">
                            {format(currentMonthTotal)}
                          </span>
                          <div className="w-2 h-2 bg-slate-950 dark:bg-slate-900 rotate-45 border-r border-b border-indigo-500/15 -mb-3 mt-1" />
                        </div>
                      )}

                      {isInlineEditingCategory ? (
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span
                            className="text-sm select-none shrink-0"
                            title="Kategori simgesi"
                          >
                            {c.icon || "🛒"}
                          </span>
                          {/* Premium Custom Inline Color Picker Dot */}
                          <div className="relative w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 overflow-hidden flex items-center justify-center cursor-pointer shadow-sm hover:scale-110 active:scale-95 transition-all">
                            <input
                              type="color"
                              value={c.color || "#6366f1"}
                              onChange={(e) => {
                                onSaveCategory({ ...c, color: e.target.value });
                              }}
                              className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer p-0 m-0 border-0 opacity-100"
                            />
                          </div>
                          <input
                            type="text"
                            value={c.name}
                            onChange={(e) => {
                              onSaveCategory({ ...c, name: e.target.value });
                            }}
                            className="px-2 py-1 max-w-[90px] xs:max-w-[120px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                            placeholder="Kategori Adı"
                          />
                          <button
                            onClick={() => onDeleteCategory(c.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition shrink-0"
                            title="Kategoriyi Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span
                              className="w-1.5 h-1.5 rounded-full inline-block shrink-0 transition-all duration-500 ease-in-out"
                              style={{ backgroundColor: c.color || "#6366f1" }}
                            />
                            <span
                              className="text-sm select-none shrink-0"
                              title={`${c.name} simgesi`}
                            >
                              {c.icon || "🛒"}
                            </span>
                            <span
                              className={`truncate text-xs font-bold leading-none ${isSelected ? "text-indigo-950 dark:text-indigo-200" : "text-slate-700 dark:text-slate-300"}`}
                              title={c.name}
                            >
                              {c.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono font-bold transition-all shrink-0 select-none ${
                                isSelected
                                  ? "bg-indigo-600 text-white dark:bg-indigo-500/50"
                                  : "text-indigo-600 bg-indigo-50 dark:text-indigo-300 dark:bg-slate-900/60 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-500/30"
                              }`}
                              title={`${c.name} bu ayki toplam harcaması`}
                            >
                              {format(currentMonthTotal)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowTipCategory(
                                  showTipCategory?.id === c.id ? null : c,
                                );
                              }}
                              className={`p-1 rounded-lg transition shrink-0 flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 ${
                                showTipCategory?.id === c.id
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 scale-110"
                                  : "text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                              }`}
                              title={`${c.name} için Tasarruf İpucu`}
                            >
                              <Lightbulb className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditCategory(c);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg transition shrink-0 ml-1"
                              title="Düzenle"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCategory(c.id);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-55 dark:hover:bg-rose-950/20 rounded-lg transition shrink-0"
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Selected Category Saving Tip Banner (AI-powered Advice) */}
              {(() => {
                const selectedCat = expenseCategories.find(
                  (c) => c.id === selectedFilterCategoryId,
                );
                if (!selectedCat) return null;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-4 bg-gradient-to-r from-amber-50/60 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/40 dark:border-amber-900/40 rounded-2xl flex items-start gap-3 shadow-xs text-left"
                  >
                    <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 rounded-xl text-amber-600 dark:text-amber-400 shrink-0 select-none text-base">
                      💡
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h5 className="text-[11px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                          {selectedCat.icon || "🔑"} {selectedCat.name} Tasarruf
                          İpucu
                        </h5>
                        <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 text-[8px] font-black tracking-widest rounded-md uppercase">
                          🤖 YAPAY ZEKA TAVSİYESİ
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                        {getSavingTipForCategory(
                          selectedCat.name,
                          selectedCat.icon || "🛒",
                        )}
                      </p>
                    </div>
                  </motion.div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Right Side: Charts */}
        <div className="space-y-6 lg:col-span-5">
          {/* Doughnut Chart */}
          {doughnutData.length > 0 ? (
            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide text-center">
                Gider Dağılım Grafiği
              </h4>
              <DoughnutChart data={doughnutData} />
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 font-medium bg-slate-50/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              Gider dağılım grafiği için harcama kaydı girilmelidir.
            </div>
          )}

          {/* Monthly Expense Bar Chart */}
          <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-rose-500" /> Aylık Harcama
              Değişim Analizi
            </h4>
            <div className="pt-2">
              <BarChart data={last6MonthsData} />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              * Son 6 aya ait harcamalarınızın aylık toplam değişim trendini
              gösterir.
            </p>
          </div>
        </div>
      </div>

      {/* Expense Add/Edit Modal Dial */}
      {isExpModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h4 className="text-base font-bold flex items-center gap-1.5 border-b pb-2 dark:border-slate-700">
              <ShoppingCart className="w-5 h-5 text-rose-500" /> {expModalTitle}
            </h4>

            {/* Quick scanning action */}
            <button
               onClick={() => {
                 if (!isPremium) {
                   onUpgradeClick?.();
                 } else {
                   setIsExpModalOpen(false); // Close to avoid overlay collision
                   setTimeout(() => setIsScannerOpen(true), 150);
                 }
               }}
              className="w-full py-2 sm:py-2.5 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl border border-dashed border-indigo-500/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-3xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse animate-duration-1000" /> Fiş Fotoğrafı ile Otomatik Doldur {!isPremium && <span className="ml-1 text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-md font-black">PRO</span>}
            </button>

            <div className="space-y-3">
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  KATEGORİ SEÇİN
                </label>
                <button
                  type="button"
                  onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    {(() => {
                      const selectedC = expenseCategories.find(c => c.id === categoryId);
                      return selectedC ? (
                        <>
                          <span className="text-sm">{selectedC.icon || "🛒"}</span>
                          <span>{selectedC.name}</span>
                        </>
                      ) : (
                        "Kategori Seçin"
                      );
                    })()}
                  </span>
                  <span className={`text-[10px] text-slate-400 font-extrabold transition-transform duration-200 ${isCatDropdownOpen ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>
                {isCatDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsCatDropdownOpen(false)} />
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 divide-y divide-slate-100 dark:divide-slate-700/50">
                      {expenseCategories.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCategoryId(c.id);
                            setIsCatDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-705 flex items-center gap-2 transition cursor-pointer ${c.id === categoryId ? "bg-rose-50/40 dark:bg-rose-950/20 font-bold" : ""}`}
                        >
                          <span className="text-sm shrink-0">{c.icon || "🛒"}</span>
                          <span className="flex-1 shrink-0">{c.name}</span>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  HARCAMA TUTARI
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="₺350"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  HARCAMA AÇIKLAMASI
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Market faturası, yakıt vb."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  HARCAMA TARİHİ
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                />
              </div>

              <div className="bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center gap-2 cursor-pointer select-none" 
                  onClick={() => {
                    if (!isPremium) {
                      onUpgradeClick?.();
                    } else {
                      setExpenseAlarm(!expenseAlarm);
                    }
                  }}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${expenseAlarm ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"}`}>
                    {expenseAlarm && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    GİDER HATIRLATMA ALARMI KUR {!isPremium && <span className="text-[8px] bg-amber-500 text-white px-1 py-0.5 rounded-sm font-black">PRO</span>}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsExpModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-xl font-bold text-xs"
              >
                İptal
              </button>
              <button
                onClick={handleSaveExpense}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Add/Edit Modal Dial */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl border border-slate-200/50 dark:border-slate-800/80 relative"
          >
            {/* Header info */}
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h4 className="text-sm font-black flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Folder className="w-5 h-5" /> {catModalTitle}
              </h4>
              <button 
                onClick={() => setIsCatModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Card Preview Box */}
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest block">
                🔴 Canlı Kategori Kart Önizlemesi
              </span>
              <motion.div 
                animate={{ scale: [1, 1.015, 1], boxShadow: [`0 2px 8px ${categoryColor}15`, `0 6px 16px ${categoryColor}25`, `0 2px 8px ${categoryColor}15`] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-2xl flex items-center justify-between select-none"
                style={{ borderLeft: `5px solid ${categoryColor}` }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div 
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-xs shrink-0 transition-transform duration-300"
                    style={{ backgroundColor: `${categoryColor}20`, color: categoryColor, textShadow: `0 0 10px ${categoryColor}30` }}
                  >
                    {categoryIcon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {categoryName.trim() || "Kategori Adı Belirtin"}
                    </p>
                    <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wider">
                      Örnek Harcama Grubu
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end shrink-0">
                  <span className="text-xs font-black font-mono" style={{ color: categoryColor }}>
                    0,00 ₺
                  </span>
                  <span className="text-[8px] font-mono font-bold text-slate-400">
                    {categoryColor}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Quick Interactive Templates Section */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest block">
                ⚡ HIZLI VE RENKLİ HAZIR ŞABLONLAR (LİMİTSİZ)
              </span>
              <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-950 p-2 rounded-2xl border border-slate-100 dark:border-slate-850 max-h-36 overflow-y-auto pr-1">
                {[
                  { name: "Market", icon: "🛒", color: "#10b981", d: "Gıda" },
                  { name: "Kira", icon: "🏠", color: "#3b82f6", d: "Ev" },
                  { name: "Ulaşım", icon: "🚗", color: "#f59e0b", d: "Yol" },
                  { name: "Yemek", icon: "🍔", color: "#ec4899", d: "Kafe" },
                  { name: "Faturalar", icon: "⚡", color: "#ef4444", d: "Enerji" },
                  { name: "Eğlence", icon: "🍿", color: "#8b5cf6", d: "Sosyal" },
                  { name: "Eğitim", icon: "🎓", color: "#6366f1", d: "Okul" },
                  { name: "Sağlık", icon: "💊", color: "#f43f5e", d: "İlaç" },
                  { name: "Kişisel", icon: "💇", color: "#14b8a6", d: "Bakım" },
                  { name: "Spor", icon: "⚽", color: "#22c55e", d: "Hobi" },
                  { name: "Borçlar", icon: "💰", color: "#eab308", d: "Banka" },
                  { name: "Hediyeler", icon: "🎁", color: "#d946ef", d: "Özel" },
                ].map((item) => {
                  const isMatch = categoryName.toLowerCase() === item.name.toLowerCase();
                  return (
                    <motion.button
                      key={item.name}
                      type="button"
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setCategoryName(item.name);
                        setCategoryColor(item.color);
                        setCategoryIcon(item.icon);
                      }}
                      className="p-1.5 rounded-xl border flex flex-col items-center justify-center text-center gap-1 min-h-[58px] cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isMatch ? `${item.color}15` : "transparent",
                        borderColor: isMatch ? item.color : "transparent"
                      }}
                    >
                      <span className="text-base select-none leading-none">{item.icon}</span>
                      <span className="text-[8px] font-black tracking-wide truncate max-w-full text-slate-700 dark:text-slate-350">{item.name}</span>
                      <span className="text-[7px] text-slate-400 opacity-80 leading-none truncate">{item.d}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input Form fields */}
            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold text-slate-450 block mb-1">
                  KATEGORİ ADI (MANUEL DEĞİŞTİR)
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Kira, faturalar, eğlence vb."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs dark:text-white outline-none focus:ring-1 focus:ring-indigo-550 focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-450 block mb-1">
                    KATEGORİ RENGİ
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5">
                    <div className="relative w-7 h-7 rounded-full border border-slate-300 dark:border-slate-700 overflow-hidden flex items-center justify-center cursor-pointer shadow-inner shrink-0 hover:scale-105 active:scale-95 transition-all">
                      <input
                        type="color"
                        value={categoryColor}
                        onChange={(e) => setCategoryColor(e.target.value)}
                        className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer p-0 m-0 border-0 opacity-100"
                      />
                    </div>
                    <input
                      type="text"
                      maxLength={7}
                      value={categoryColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith("#") && val.length <= 7) {
                          setCategoryColor(val);
                        } else if (!val.startsWith("#") && val.length <= 6) {
                          setCategoryColor("#" + val);
                        }
                      }}
                      className="text-[10px] font-bold font-mono text-slate-700 dark:text-slate-300 bg-transparent border-none outline-none focus:ring-0 p-0 w-full min-w-0"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-450 block mb-1">
                    SEÇİLİ SİMGE
                  </label>
                  <div className="flex items-center justify-center h-10 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-lg font-bold">
                    <motion.span animate={{ scale: [0.9, 1.1, 1] }} key={categoryIcon}>
                      {categoryIcon}
                    </motion.span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-450 block mb-1">
                  KULLANILABİLİR SİMGELER
                </label>
                <div className="grid grid-cols-6 gap-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 max-h-[105px] overflow-y-auto">
                  {[
                    "🛒", "🏠", "🚗", "🍔", "⚡", "🎒", "💊", "🍿", "✈️", "🎓", "🧸", "💼", 
                    "💰", "🎁", "🐾", "💇", "⚽", "🔧", "❓", "🥩", "🍷", "📱", "💻", "🎸",
                    "🔥", "❤️", "💎", "🩺", "🎭", "📈", "🚌", "☕", "🍕", "🥦", "🛁", "🧴"
                  ].map((emoji) => {
                    const isSelected = categoryIcon === emoji;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setCategoryIcon(emoji)}
                        className={`text-base p-1 rounded-lg transition-all cursor-pointer flex items-center justify-center hover:scale-115 ${
                          isSelected
                            ? "bg-indigo-500/20 border border-indigo-500 scale-105"
                            : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800/80 hover:bg-indigo-50 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Save Actions Buttons */}
            <div className="flex gap-2.5 pt-2 border-t dark:border-slate-800">
              <button
                onClick={() => setIsCatModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition active:scale-95 cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleSaveCategory}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 transition active:scale-95 cursor-pointer"
              >
                Kaydet
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 💡 Yapay Zeka Tasarruf İpucu Popover Kutucuğu */}
      {showTipCategory && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setShowTipCategory(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl border border-amber-200/40 dark:border-amber-900/40 text-left"
          >
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-500 rounded-xl">
                  <span className="text-xl select-none leading-none inline-block">
                    {showTipCategory.icon || "💡"}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                    {showTipCategory.name} Tasarruf İpucu
                  </h4>
                  <p className="text-[9px] text-amber-600 dark:text-amber-400 font-extrabold tracking-wider uppercase">
                    Yapay Zeka Bütçe Önerisi
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTipCategory(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl transition text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-amber-50/55 dark:bg-amber-950/20 border-l-[3px] border-amber-500 rounded-2xl space-y-2">
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  <span className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">
                    Bütçe Asistanı Tavsiyesi
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                  {getSavingTipForCategory(
                    showTipCategory.name,
                    showTipCategory.icon || "🛒",
                  )}
                </p>
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold leading-normal italic text-center">
                🤖 Analiz motorumuz bu tavsiyeyi kategori profiline özel
                üretmiştir.
              </p>
            </div>

            <button
              onClick={() => setShowTipCategory(null)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              Anladım, Kapat
            </button>
          </motion.div>
        </div>
      )}

      {/* Harcama / Gider Sayfası Sponsorlu Reklamı */}
      {!isPremium && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 p-4 bg-rose-500/5 dark:bg-rose-950/10 border border-rose-500/20 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl text-xl shrink-0">
              💳
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[8px] font-black uppercase tracking-wider rounded-md border border-rose-500/20">
                  Harcama Fırsatı
                </span>
                <span className="text-[9px] text-slate-400 font-bold">
                  • QNB Finansbank CardFinans
                </span>
              </div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                Her Market ve Gıda Alışverişinizde %10 Nakit Para İadesi Kazanın! 🎉
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-normal">
                Giderlerinizi avantaja çevirin. CardFinans ile aylık toplam 750 TL'ye varan nakit para (ParaPuan) hesabınıza anında yatırılsın.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <a
              href="https://www.qnbfinansbank.com"
              target="_blank"
              rel="noreferrer referrer"
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black rounded-xl transition shadow-xs cursor-pointer uppercase tracking-wider text-center flex-1 sm:flex-none"
            >
              Kart Başvurusu
            </a>
            <button
              onClick={onUpgradeClick}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-500 text-[10px] font-black rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-1 uppercase tracking-tight shrink-0 flex-1 sm:flex-none"
            >
              Reklamsız
            </button>
          </div>
        </motion.div>
      )}

      {isScannerOpen && (
        <ReceiptScanner
          onScanCompleted={handleScanCompleted}
          onClose={() => setIsScannerOpen(false)}
          defaultType="expense"
        />
      )}
    </div>
  );
};
