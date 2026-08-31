/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BookOpen, HelpCircle, Mail, MessageSquare, Shield, Star, User, Award, Zap, 
  BarChart3, Layers, Lock, ThumbsUp, Calendar, ArrowRight, Heart, Send, 
  CheckCircle2, AlertTriangle, ShieldCheck, PenSquare, ArrowUpRight, Scale,
  Bot, Mic, Camera, Users, CreditCard, Calculator, Cloud, Bell, Sparkles,
  CloudSun, FileSpreadsheet, Search, Check, ChevronDown, ChevronUp, ExternalLink,
  Info, Compass, Smartphone, RefreshCw
} from "lucide-react";

interface HelpAndGuidesProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
}

interface GuideItem {
  id: string;
  category: "ai" | "debt" | "contacts" | "budget" | "tools" | "security";
  categoryLabel: string;
  badgeColor: string;
  icon: string;
  title: string;
  summary: string;
  badge?: string;
  targetTab?: string;
  whatItDoes: string;
  instructions: { step: number; title: string; desc: string }[];
  proTips: string[];
}

interface BlogPost {
  id: string;
  category: string;
  title: string;
  readTime: string;
  introduction: string;
  icon: string;
  tagColor: string;
  bgColor: string;
  borderColor: string;
  tips: { title: string; desc: string }[];
  conclusion: string;
}

export const HelpAndGuides: React.FC<HelpAndGuidesProps> = ({ activeTab, onNavigate }) => {
  // Search & Filter state for Guide section
  const [guideSearchQuery, setGuideSearchQuery] = useState("");
  const [selectedGuideCategory, setSelectedGuideCategory] = useState<string>("all");
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>("gemini-ai");

  // Feedback states
  const [contactName, setContactName] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackCategory, setFeedbackCategory] = useState<string>("general");
  const [isSuccessSubmitted, setIsSuccessSubmitted] = useState(false);
  const [showRatingHover, setShowRatingHover] = useState<number | null>(null);

  // Expanded blog posts
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const feedbackCategories = [
    { id: "general", label: "💬 Genel Görüş", color: "border-slate-200 text-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
    { id: "suggestion", label: "💡 İstek & Öneri", color: "border-indigo-100 text-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30" },
    { id: "bug", label: "🐛 Hata Bildirimi", color: "border-rose-100 text-rose-700 bg-rose-50/50 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" },
    { id: "cooperation", label: "🤝 Ortaklık", color: "border-emerald-100 text-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" }
  ];

  const handleSendMessage = () => {
    if (!contactMsg) {
      return;
    }

    const currentUrl = window.location.href;
    const catLabel = feedbackCategories.find(c => c.id === feedbackCategory)?.label || feedbackCategory;
    const ratingStars = feedbackRating > 0 ? "⭐".repeat(feedbackRating) : "Derecelendirme yok";
    
    const mailtoUrl = `mailto:info.borcodemetakip@gmail.com?subject=Bütçem Pro Geri Bildirim&body=Gönderen: ${encodeURIComponent(contactName || "Anonim Kullanıcı")}%0D%0AKategori: ${encodeURIComponent(catLabel)}%0D%0ADerecelendirme: ${encodeURIComponent(ratingStars)}%0D%0AMesaj: ${encodeURIComponent(contactMsg)}%0D%0ACihaz Adresi: ${encodeURIComponent(currentUrl)}`;
    
    window.location.href = mailtoUrl;
    setIsSuccessSubmitted(true);
    
    // Clear form
    setTimeout(() => {
      setIsSuccessSubmitted(false);
      setContactName("");
      setContactMsg("");
      setFeedbackRating(0);
      setFeedbackCategory("general");
    }, 4500);
  };

  // Comprehensive User Guide Data for All Application Modules and Features
  const guideCategories = [
    { id: "all", label: "Tümü", icon: "✨" },
    { id: "ai", label: "Yapay Zeka & Asistan", icon: "🤖" },
    { id: "debt", label: "Borç & Taksitler", icon: "💳" },
    { id: "contacts", label: "Cari & Rehber", icon: "👤" },
    { id: "budget", label: "Bütçe & Harcamalar", icon: "📊" },
    { id: "tools", label: "Hesaplama Araçları", icon: "🧮" },
    { id: "security", label: "Bulut & Güvenlik", icon: "☁️" },
  ];

  const guideItems: GuideItem[] = [
    {
      id: "gemini-ai",
      category: "ai",
      categoryLabel: "Yapay Zeka",
      badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      icon: "🤖",
      title: "Gemini 3.7 Flash Finans Asistanı & Canlı Piyasa Bilgisi",
      summary: "En güncel Gemini 3.7 Flash modeli, canlı Google Arama entegrasyonu (Döviz, Altın, Enflasyon) ve kişiselleştirilmiş bütçe-borç koçluğu.",
      badge: "Yeni Nesil AI",
      targetTab: "aiStrategy",
      whatItDoes: "Bütçem Pro AI Danışmanı; gelirlerinizi, giderlerinizi, vadesi gelen borçlarınızı ve taksitlerinizi anlık tarayarak size özel tasarruf ve borç kapatma yol haritaları çıkarır. Ayrıca entegre Google Search sayesinde güncel Dolar, Euro kurları, gram/çeyrek altın fiyatları ve piyasa faiz oranlarını anında öğrenmenizi sağlar.",
      instructions: [
        {
          step: 1,
          title: "Yapay Zeka Sekmesine Geçin",
          desc: "Üst gezinme çubuğundaki 'Yapay Zeka' sekmesine tıklayın veya ana sayfadaki asistan butonuna dokunun."
        },
        {
          step: 2,
          title: "Hazır Butonları veya Özel Sorunuzu Kullanın",
          desc: "Sayfadaki '🔍 Bütçe Risk Durumum', '🚀 Borç Kapatma Planı', '🎯 Tasarruf Yönetimi' veya '📈 Güncel Dolar & Altın' hızlı butonlarına tıklayın ya da aklınızdaki soruyu metin kutusuna yazın."
        },
        {
          step: 3,
          title: "Tek Tıkla Aylık Analiz Raporu Oluşturun",
          desc: "Üstteki mor 'Aylık Rapor' butonuna bastığınızda seçili aya ait tüm gelir-gider dengesini, kategori karşılaştırmalarını ve borç risk puanınızı içeren detaylı bir rapor üretilir."
        },
        {
          step: 4,
          title: "Sesli Soru Sorun & Sesli Dinleyin",
          desc: "Giriş kutusundaki mikrofon simgesine basarak konuşabilir, asistanın cevabının altındaki ses simgesine (🔊) dokunarak Türkçe sesli okuma özelliğini dinleyebilirsiniz."
        }
      ],
      proTips: [
        "Kendi ücretsiz Google Gemini API anahtarınızı girerek asistanı kotasız ve ultra hızlı kullanabilirsiniz.",
        "Asistana 'Market harcamalarımı %20 kısmak için bana haftalık alışveriş planı yap' gibi spesifik sorular sorabilirsiniz."
      ]
    },
    {
      id: "voice-assistant",
      category: "ai",
      categoryLabel: "Sesli Asistan",
      badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      icon: "🎙️",
      title: "Akıllı Sesli Asistan (AI Voice Assistant)",
      summary: "Mikrofonla Türkçe konuşarak anında harcama, gelir, borç ekleme ve sesli finansal durum raporu dinleme.",
      badge: "Hands-Free",
      targetTab: "overview",
      whatItDoes: "Klavyeye dokunmadan, günlük konuşma diliyle mali işlemler yapmanızı sağlar. 'Marketten 450 lira harcadım', 'Maaş yattı 35 bin TL', 'Ahmet'e 1500 lira borç verdim' gibi doğal ifadeleri analiz ederek ilgili modüle otomatik veri ekler.",
      instructions: [
        {
          step: 1,
          title: "Sesli Asistanı Başlatın",
          desc: "Ekranın altındaki mor mikrofon simgesine dokunun ve tarayıcınızın mikrofon erişimine izin verin."
        },
        {
          step: 2,
          title: "Komutunuzu Doğal Şekilde Söyleyin",
          desc: "'500 lira benzin aldım', '2000 TL kira ödedim' veya 'Bana durum raporu ver' şeklinde net bir cümle kurun."
        },
        {
          step: 3,
          title: "İşlem Onayını Kontrol Edin",
          desc: "Yapay zeka sesinizi metne döker, tutar ve kategoriyi otomatik ayıklar. Ekrana gelen onay kartında 'Onayla ve Kaydet' düğmesine dokunarak işlemi bitirin."
        },
        {
          step: 4,
          title: "Gürültülü Ortamlarda Manuel Giriş",
          desc: "Çok gürültülü bir ortamdaysanız, sesli asistan penceresindeki klavye kutucuğuna komutu yazarak da aynı akıllı motoru çalıştırabilirsiniz."
        }
      ],
      proTips: [
        "'Bütçe durumumu oku' dediğinizde sesli asistan o anki net bakiyenizi, toplam borcunuzu ve aylık giderinizi Türkçe seslendirir.",
        "Komut içinde kategori belirtirseniz (ör: 'fatura', 'market', 'yakıt'), harcama doğrudan o kategoriye atanır."
      ]
    },
    {
      id: "receipt-scanner",
      category: "ai",
      categoryLabel: "Fiş & Fatura OCR",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      icon: "📸",
      title: "Kamera & Galeri ile AI Fiş / Fatura Tarama (OCR)",
      summary: "Alışveriş fişinizin fotoğrafını çekin; tutar, tarih, dükkan adı ve kategori saniyeler içinde otomatik algılansın.",
      badge: "Görsel Zeka",
      targetTab: "expenses",
      whatItDoes: "Kamera veya galeriden yüklenen alışveriş fişlerini Gemini Vision yapay zeka modeliyle tarar. Fiş üzerindeki toplam tutarı, fiş tarihini, mağaza/şirket ismini ve harcama türünü (Market, Gıda, Akaryakıt vb.) ayıklayıp tek tıkla gider listesine ekler.",
      instructions: [
        {
          step: 1,
          title: "Giderler Sekmesinde Tarayıcıyı Açın",
          desc: "'Giderler' sekmesine gelin ve üst kısımdaki '📸 Fiş / Fatura Tara' butonuna tıklayın."
        },
        {
          step: 2,
          title: "Fotoğraf Çekin veya Galeriden Yükleyin",
          desc: "Kameranızı açarak fişin net bir fotoğrafını çekin veya dosya seçici ile önceden çektiğiniz fiş resmini yükleyin."
        },
        {
          step: 3,
          title: "Otomatik Ayrıştırmayı İnceleyin",
          desc: "Yapay zeka görseli tarayarak Tutar (₺), Tarih, Mağaza Adı ve Kategori bilgilerini ekrandaki kutucuklara otomatik doldurur."
        },
        {
          step: 4,
          title: "Gidere Kaydedin",
          desc: "Bilgileri kontrol ettikten sonra 'Harcama Olarak Kaydet' butonuna basarak harcama listenize dahil edin."
        }
      ],
      proTips: [
        "Fişin düz bir zeminde, gölgesiz ve özellikle alt kısımdaki 'TOPLAM / KDV' satırının okunaklı olması tarama hızını ve kesinliğini artırır.",
        "Yüklenen fiş görselleri sunucularda saklanmaz, analiz tamamlandığı an bellekten kalıcı olarak silinir."
      ]
    },
    {
      id: "contacts-debt",
      category: "contacts",
      categoryLabel: "Cari Hesaplar & Rehber",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      icon: "👤",
      title: "Kişi Rehberi & Cari Borç-Alacak Takibi & WhatsApp Hatırlatma",
      summary: "Arkadaşlarınıza, müşterilerinize ve akrabalarınıza verdiğiniz/aldığınız borçları kişi bazlı takip edin, telefon rehberinizi aktarın ve tek tıkla WhatsApp hatırlatması gönderin.",
      badge: "WhatsApp Entegre",
      targetTab: "contacts",
      whatItDoes: "Kişisel ve ticari borç-alacak ilişkilerinizi dijital bir cari hesap defteri gibi yönetir. Telefon rehberinizdeki kişileri .vcf dosyası ile aktarabilir, her kişi için alacak veya borç kaydı açabilir, parçalı ödemeler kaydedebilir ve tek dokunuşla WhatsApp üzerinden nazik hatırlatma mesajları gönderebilirsiniz.",
      instructions: [
        {
          step: 1,
          title: "Kişiler & Cari Sekmesine Gelin",
          desc: "Menüden 'Kişiler & Cari' sekmesini seçin."
        },
        {
          step: 2,
          title: "Kişi Ekleyin veya Telefon Rehberinizi Yükleyin",
          desc: "'Yeni Kişi Ekle' formundan ad/telefon girin veya '📁 Telefon Rehberini (.vcf) Aktar' butonunu kullanarak telefonunuzdan dışa aktardığınız rehber dosyasını tek tıkla yükleyin."
        },
        {
          step: 3,
          title: "Borç veya Alacak Kaydı Oluşturun",
          desc: "Kişi kartına tıklayarak 'Alacak Ekle' (verdiğiniz borç) veya 'Borç Ekle' (aldığınız borç) butonuna basın; tutar, açıklama ve son ödeme vadesini belirleyin."
        },
        {
          step: 4,
          title: "Tek Tıkla WhatsApp Hatırlatma Gönderin",
          desc: "Kişi kartındaki yeşil WhatsApp simgesine dokunun; sistem kişi adı, kalan bakiye ve vadeyi içeren şık bir mesaj şablonu oluşturarak WhatsApp'ı otomatik açar."
        },
        {
          step: 5,
          title: "Ödeme / Tahsilat Alın",
          desc: "Karşı taraf ödeme yaptıkça 'Tahsilat / Ödeme Ekle' diyerek kalan bakiyeyi parça parça veya tamamen sıfırlayın."
        }
      ],
      proTips: [
        "Filtreleme seçeneklerinden 'Yalnızca Alacaklarım' veya 'Yalnızca Borçlarım'ı seçerek toplam alacak ve borç portföyünüzü anında görebilirsiniz.",
        "İşlem geçmişi sekmesinden yapılan tüm kısmi ödemelerin tarih ve saat dökümünü inceleyebilirsiniz."
      ]
    },
    {
      id: "snowball-avalanche-methods",
      category: "debt",
      categoryLabel: "Borç Stratejileri",
      badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      icon: "🎯",
      title: "Kartopu (Snowball) ve Çığ (Avalanche) Borç Kapatma Metotları",
      summary: "Borçlarınızı rastgele değil, finans dünyasının kabul ettiği bilimsel sıralama modelleriyle en az faiz ve maksimum motivasyonla kapatın.",
      badge: "Bilimsel Finans",
      targetTab: "debts",
      whatItDoes: "Borçlarınızı faiz oranı ve anapara büyüklüklerine göre optimize eder. Kartopu yöntemiyle en küçük borçtan başlayıp psikolojik zaferler kazanabilir, Çığ yöntemiyle en yüksek faizli borca odaklanıp toplam faiz giderinizi binlerce lira azaltabilirsiniz.",
      instructions: [
        {
          step: 1,
          title: "Tüm Borçlarınızı Sisteme Tanımlayın",
          desc: "'Borçlar' sekmesine gidip kredi kartı, ihtiyaç kredisi ve şahıs borçlarınızı faiz oranları ve vadesiyle eksiksiz kaydedin."
        },
        {
          step: 2,
          title: "Stratejinizi Belirleyin",
          desc: "Hızlı zafer ve motivasyon istiyorsanız 'Kartopu', en az faizi ödemek istiyorsanız 'Çığ (Avalanche)' yöntemini seçin."
        },
        {
          step: 3,
          title: "Öncelikli Borca Ekstra Ödeme Yapın",
          desc: "Listede ilk sıradaki borca elinizdeki tüm ekstra tasarruf bütçesini yönlendirirken, diğer borçların asgari tutarlarını aksatmadan ödeyin."
        },
        {
          step: 4,
          title: "Kapanan Borcun Bütçesini Bir Sonrakine Aktarın",
          desc: "İlk borç bittiğinde, onun aylık ödeme tutarını bir sonraki borca ekleyin. Böylece borç ödeme gücünüz bir kartopu gibi katlanarak büyür."
        }
      ],
      proTips: [
        "Yapay zeka asistanına 'Borçlarımı Çığ yöntemiyle sırala ve bu ay hangisine ne kadar ödemeliyim?' diye sorarak anlık simülasyon alabilirsiniz.",
        "Ödeme geçmişi butonundan borcun kalan ana parasının nasıl eridiğini grafiksel olarak izleyin."
      ]
    },
    {
      id: "installment-tracker",
      category: "debt",
      categoryLabel: "Taksitli Borçlar",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      icon: "📅",
      title: "Taksitli Harcama, Kredi ve Vade Planlayıcı",
      summary: "Kredi kartı taksitleri, beyaz eşya, konut ve araç kredilerini ay ay planlayın, kalan taksitleri ve aylık bütçe payını otomatik yönetin.",
      badge: "Otomatik Plan",
      targetTab: "installments",
      whatItDoes: "Gelecek aylara yayılan taksitlerinizi tek ekranda toplar. Toplam taksit sayısı, ödenen taksit sayısı ve aylık taksit tutarını hesaplar. Seçilen ayın bütçesine düşen taksit yükünü otomatik olarak Aylık Finansal Özet paneline aktarır.",
      instructions: [
        {
          step: 1,
          title: "Taksitler Sekmesine Gidin",
          desc: "Menüden 'Taksitler' sekmesini açın ve 'Yeni Taksit Ekle' butonuna tıklayın."
        },
        {
          step: 2,
          title: "Taksit Detaylarını Girin",
          desc: "Taksit adı (Örn: 'Laptop Taksiti'), toplam tutar, taksit adedi (Örn: 6 Ay) ve ilk taksit başlangıç tarihini seçin."
        },
        {
          step: 3,
          title: "Aylık Taksit Ödemelerini Kaydedin",
          desc: "Her ay taksit gününüz geldiğinde ilgili taksit kartındaki 'Taksit Öde' butonuna basarak ödenen taksit sayacını 1 artırın."
        },
        {
          step: 4,
          title: "Gelecek Ayların Taksit Yükünü Önceden Görün",
          desc: "Üst kısımdaki Ay seçicisinden gelecek ayları seçerek önümüzdeki aylarda ne kadar taksit ödeyeceğinizi önceden analiz edin."
        }
      ],
      proTips: [
        "Taksit bittiğinde sistem taksiti otomatik 'Tamamlandı' rozetiyle arşivler.",
        "Taksitli alışverişlerinizi yapmadan önce 'Finansal Araçlar' sekmesindeki Kredi Hesaplayıcı ile toplam maliyetini kontrol edebilirsiniz."
      ]
    },
    {
      id: "weather-budget-widget",
      category: "budget",
      categoryLabel: "Akıllı Tasarruf",
      badgeColor: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      icon: "⛅",
      title: "Hava Durumu & Psikolojik Tasarruf Widget'ı",
      summary: "Yaşadığınız şehrin hava koşullarına göre dürtüsel harcamaları önleyen akıllı davranışsal ekonomi rehberi.",
      badge: "Davranışsal Finans",
      targetTab: "overview",
      whatItDoes: "Hava durumu ile tüketim psikolojisi arasındaki bilimsel bağı analiz eder. Yağmurlu günlerde online sipariş ve kahve harcamalarını, güneşli günlerde dışarıda yeme-içme dürtülerini kontrol altına almanız için anlık bütçe tavsiyeleri sunar.",
      instructions: [
        {
          step: 1,
          title: "Bütçe Özetinde Hava Durumu Kartını Bulun",
          desc: "Dashboard ana sayfasında yer alan 'Hava Durumu & Bütçe Rehberi' bileşenini görüntüleyin."
        },
        {
          step: 2,
          title: "Şehrinizi Seçin veya Konum İzni Verin",
          desc: "Açılır menüden şehrinizi seçerek ya da konum butonuna dokunarak anlık meteorolojik verileri çekin."
        },
        {
          step: 3,
          title: "Günün Tasarruf Stratejisini İnceleyin",
          desc: "Günün hava durumuna özel (Güneşli, Yağmurlu, Karlı, Bulutlu) bütçe tüyolarını okuyarak dürtüsel harcamalarınızı engelleyin."
        }
      ],
      proTips: [
        "Yağmurlu günlerde kurye ve teslimat ücretlerinden kaçınmak için evde yemek hazırlama tavsiyelerini uygulayarak ayda binlerce lira tasarruf sağlayabilirsiniz."
      ]
    },
    {
      id: "debt-search-bar",
      category: "debt",
      categoryLabel: "Borç & Arama",
      badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      icon: "🔍",
      title: "Borç Listesinde Canlı Arama & Filtreleme",
      summary: "Borçlar listesinde kayıtlı borçlarınızı isim veya kategoriye göre anında filtreleyin ve bulun.",
      badge: "Hızlı Filtre",
      targetTab: "debts",
      whatItDoes: "Borçlar sekmesindeki arama çubuğu ile borç adı (ör. 'Garanti Kredi', 'Ahmet Borcu') veya kategori (ör. 'Kredi Kartı', 'Konut') yazarak yüzlerce borç kaydı arasından aradığınız borcu anında filtreleyip görüntüleyebilirsiniz.",
      instructions: [
        {
          step: 1,
          title: "Borçlar Sekmesine Geçin",
          desc: "Menüden veya özetten 'Borçlar' sekmesine tıklayın."
        },
        {
          step: 2,
          title: "Arama Kutusuna Yazmaya Başlayın",
          desc: "Borç listesinin üstündeki 'Borç listesinde ara...' kutusuna aramak istediğiniz borcun adını, kategorisini veya tutarını yazın."
        },
        {
          step: 3,
          title: "Sonuçları İnceleyin veya Temizleyin",
          desc: "Eşleşen borç kayıtları anlık olarak listelenir. Aramayı sıfırlamak için kutudaki 'X' butonuna tıklamanız yeterlidir."
        }
      ],
      proTips: [
        "Arama yaparken aynı zamanda 'Ödenmemiş' / 'Ödenmiş' sekmeleri ve sıralama ölçütleriyle birlikte kombine filtreleme yapabilirsiniz.",
        "Tutar rakamı yazarak (örneğin '5000') o tutara sahip borçları da doğrudan listeleyebilirsiniz."
      ]
    },
    {
      id: "financial-calculator-tools",
      category: "tools",
      categoryLabel: "Mali Araçlar",
      badgeColor: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
      icon: "🧮",
      title: "Finansal Hesaplama & Mali Simülasyon Araçları",
      summary: "Kredi hesaplama, KKDF/BSMV faiz simülatörü, acil durum fonu ve net servet (Net Worth) hesaplayıcı tek merkezde.",
      badge: "Mali Simülatör",
      targetTab: "financialTools",
      whatItDoes: "Karmaşık bankacılık ve yatırım formüllerini tek tıkla çözümler. İhtiyaç/taşıt/konut kredisi taksitlerini faiz ve vergileriyle hesaplar, acil durum fonu ihtiyacınızı belirler ve toplam varlık-yükümlülük dengenizden net servetinizi çıkarır.",
      instructions: [
        {
          step: 1,
          title: "Finansal Araçlar Sekmesine Geçin",
          desc: "Menüden 'Finansal Araçlar' sekmesini açın."
        },
        {
          step: 2,
          title: "Kredi Hesaplayıcı:",
          desc: "Çekmek istediğiniz kredi tutarını, vadeyi (ay) ve aylık faiz oranını girin. KKDF, BSMV dahil aylık taksit ve toplam geri ödeme tutarını anında görün."
        },
        {
          step: 3,
          title: "Acil Durum Fonu Hesaplayıcı:",
          desc: "Aylık zorunlu giderlerinizi (Kira, Fatura, Mutfak) girerek 3 ila 6 aylık güvenli acil durum rezervi hedefinizi hesaplayın."
        },
        {
          step: 4,
          title: "Net Varlık (Net Worth) Hesabı:",
          desc: "Tüm varlıklarınızı (Nakit, Altın, Ev, Araba) ve tüm borçlarınızı girerek gerçek finansal net değerinizi öğrenin."
        }
      ],
      proTips: [
        "Kredi çekmeden önce farklı faiz oranlarını simüle ederek bütçenizi zorlamayacak maksimum taksit tutarını belirleyin."
      ]
    },
    {
      id: "budget-rules-and-analytics",
      category: "budget",
      categoryLabel: "Bütçe Disiplini",
      badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      icon: "📊",
      title: "Aylık/Yıllık Karşılaştırmalı Grafikler & 50/30/20 Kuralı",
      summary: "Gelir-gider dengesini dinamik pasta ve çubuk grafiklerle izleyin, 50/30/20 bütçe oranınızı denetleyin.",
      badge: "Görsel Analiz",
      targetTab: "monthly",
      whatItDoes: "Gelirlerinizi ve giderlerinizi ay bazında karşılaştırır. 50/30/20 kuralına göre %50 Temel İhtiyaçlar, %30 İstekler ve %20 Tasarruf/Borç oranlarınıza ne kadar uyduğunuzu renkli barometrelerle gösterir.",
      instructions: [
        {
          step: 1,
          title: "Aylık veya Yıllık Analiz Sekmesine Gelin",
          desc: "Menüden 'Aylık Analiz' veya 'Yıllık Analiz' sekmesini seçin."
        },
        {
          step: 2,
          title: "Ay / Yıl Seçicisini Kullanın",
          desc: "İncelemek istediğiniz dönemi seçerek o döneme ait net gelir, toplam gider ve kalan rezerv grafiklerini inceleyin."
        },
        {
          step: 3,
          title: "Kategori Dağılımını Gözden Geçirin",
          desc: "En çok hangi kategoride (Örn: Market, Kira, Ulaşım) harcama yaptığınızı pasta grafik üzerinden kontrol edin."
        }
      ],
      proTips: [
        "Aylık harcamanız gelirinizin %90'ını aştığında sistem otomatik risk uyarısı verir."
      ]
    },
    {
      id: "cloud-sync-and-security",
      category: "security",
      categoryLabel: "Bulut & Güvenlik",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      icon: "☁️",
      title: "Google ile Giriş, Bulut Senkronizasyonu & Güvenli Yedekleme",
      summary: "Verilerinizi Firebase Firestore ile cihazlar arası senkronize edin veya %100 çevrimdışı yerel profillerle kullanın. Excel / CSV / JSON dışa aktarma.",
      badge: "Çoklu Cihaz",
      targetTab: "overview",
      whatItDoes: "Tüm finansal kayıtlarınızı ister Google hesabınızla şifreli bulut veritabanında saklayın, ister cihazınızın yerel hafızasında (Local Storage) tamamen anonim tutun. Excel, CSV ve JSON formatlarında tek tıkla veri yedekleme ve geri yükleme imkanı sunar.",
      instructions: [
        {
          step: 1,
          title: "Google ile Giriş Yapın veya Profil Seçin",
          desc: "Sağ üstteki kullanıcı butonuna basarak Google hesabınızla giriş yapabilir ve telefon/bilgisayar arasında verilerinizi anında eşzamanlayabilirsiniz."
        },
        {
          step: 2,
          title: "Çoklu Profil / Aile Alanı Kullanımı",
          desc: "Kişisel, İş veya Aile Bütçesi için ayrı ayrı bağımsız profiller oluşturup aralarında tek tıkla geçiş yapabilirsiniz."
        },
        {
          step: 3,
          title: "Excel / CSV / JSON Yedek İndirin",
          desc: "'Ayarlar' veya 'Profil' menüsünden 'Excel / CSV İndir' butonuna basarak verilerinizi tablo halinde bilgisayarınıza kaydedebilirsiniz."
        },
        {
          step: 4,
          title: "Çevrimdışı Çalışma Garantisi",
          desc: "İnternetiniz olmasa bile tüm işlemlerinizi kaydedebilirsiniz; internet bağlantısı sağlandığında verileriniz otomatik buluta eşitlenir."
        }
      ],
      proTips: [
        "Düzenli aralıklarla 'JSON Yedek Al' butonuna basarak verilerinizin bir kopyasını kendi arşivinizde saklamanız tavsiye edilir."
      ]
    }
  ];

  const filteredGuides = useMemo(() => {
    return guideItems.filter((item) => {
      const matchesCategory = selectedGuideCategory === "all" || item.category === selectedGuideCategory;
      const q = guideSearchQuery.trim().toLowerCase();
      if (!q) return matchesCategory;

      const matchesSearch = 
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.whatItDoes.toLowerCase().includes(q) ||
        item.instructions.some(ins => ins.title.toLowerCase().includes(q) || ins.desc.toLowerCase().includes(q)) ||
        item.proTips.some(tip => tip.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [guideItems, selectedGuideCategory, guideSearchQuery]);

  const blogPosts: BlogPost[] = [
    {
      id: "snowball-avalanche",
      category: "Borç Stratejisi",
      title: "Kartopu (Snowball) vs Çığ (Avalanche) Hangi Metot Sizin İçin Doğru?",
      readTime: "5 dk okuma",
      introduction: "Borçlarınızı eritmek sadece matematiksel değil, aynı zamanda yoğun bir direnç ve motivasyon sürecidir. Finans yazınında en kabul görmüş iki borç ödeme modelini karşılaştırarak bütçe yapınıza en uyan stratejiyi seçmenize rehberlik ediyoruz.",
      icon: "🎯",
      tagColor: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/30",
      bgColor: "bg-indigo-500/[0.02] dark:bg-indigo-500/[0.01]",
      borderColor: "border-indigo-200/50 dark:border-indigo-900/40",
      tips: [
        {
          title: "Kartopu (Snowball) Metodu Nedir?",
          desc: "Tüm borçlarınızı faiz oranına bakılmaksızın en düşük tutardan en yükseğe doğru listeleyin. En küçük borcu kapatmak için ekstra bütçe ayırırken diğerlerine asgari ödeme yapın. En küçük borç kapandığında, oradaki bütçeyi bir sonraki küçük borca aktarın. Hızlı başarılar ile psikolojik ivme kazandırır."
        },
        {
          title: "Çığ (Avalanche) Metodu Nedir?",
          desc: "Tüm borçlarınızı faiz oranı en yüksek olandan en düşük olana doğru sıralayın. Matematiksel olarak en yıpratıcı olan en yüksek faizli borcun ana parası için tüm gücünüzle ödeme yaparken, kalanlara asgari ödeme yapın. Toplamda ödeyeceğiniz faiz miktarını en aza indirgeyerek maksimum tasarruf sağlar."
        },
        {
          title: "Stratejik Değerlendirme Çizelgesi",
          desc: "Eğer erken teslim olup pes etmeye yatkınsanız ve motivasyon arıyorsanız Kartopu yöntemi size göredir. Ancak sabırlıysanız ve toplam finansal maliyeti minimalize etmek istiyorsanız kesinlikle Çığ yöntemini seçmelisiniz."
        }
      ],
      conclusion: "Hangi yöntemi seçerseniz seçin, en kritik unsur istikrardır. Bütçem Pro borç detayları panelini kullanarak her bir ödemenin vadesini ve ilerlemesini anlık kaydetmeyi unutmayın."
    },
    {
      id: "budgeting-rules",
      category: "Kişisel Bütçe",
      title: "50/30/20 Kuralı ile Gelir-Gider Dengesi Nasıl Yönetilir?",
      readTime: "4 dk okuma",
      introduction: "Kazanılan paranın nereye gittiğini hesaplayamamak, borç sarmalının temel sebebidir. Dünyanın önde gelen finans otoritelerinin önerdiği 50/30/20 formülü, bütçenizi karmaşık finans modellerine gerek kalmadan rasyonel şekilde yönetebilmenizi sağlar.",
      icon: "📊",
      tagColor: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/30",
      bgColor: "bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]",
      borderColor: "border-emerald-200/50 dark:border-emerald-900/40",
      tips: [
        {
          title: "%50 Temel İhtiyaçlar (Needs)",
          desc: "Harcamalarınızın yarısı hayatınızı idame ettirmek için zorunlu olan giderlere ayrılmalıdır: Ev kirası, faturalar, mutfak alışverişi, sağlık giderleri ve toplu taşıma/ulaşım. Bu pay %50'yi aşıyorsa, barınma veya temel abonelik maliyetlerinizi gözden geçirmeniz gerekir."
        },
        {
          title: "%30 Kişisel İstekler (Wants)",
          desc: "Gelirinizin bu kısmı hayattan keyif almanızı sağlayacak, ancak zorunlu olmayan kalemleri kapsar: Dışarıda yemek, eğlence, sinema, spor salonu üyelikleri, tatil ve yeni hobiler. Borç ödeme sürecinde bu oranı geçici olarak kısmak borçlarınızı yarı yarıya kısaltabilir."
        },
        {
          title: "%20 Birikim ve Borç Azaltma (Savings & Debts)",
          desc: "Bütçenizin bu hayati dilimi geleceğinizi garantiye alır. Bu bütçe doğrudan; acil durum fonu biriktirme, geleceğe yönelik yatırımlar ve en önemlisi mevcut borçların taksitlerinden daha hızlı ödenmesi amacıyla asgari tutarların üzerine çıkmak için kullanılır."
        }
      ],
      conclusion: "Bütçem Pro ana ekranındaki bütçe analiz motorunu takip ederek harcamalarınızın bu oranlara uyup uymadığını her ayın sonunda kontrol edin ve risk oranınızı dengeleyin."
    },
    {
      id: "credit-score",
      category: "Kredi Yönetimi",
      title: "Kredi Notu (Skoru) Nedir? Kısa Sürede Nasıl Yükseltilir?",
      readTime: "6 dk okuma",
      introduction: "Kredi skoru, bankacılık ve finans kurumlarının gözündeki mali güvenilirlik karnenizdir. Gelecekte uygun faizle taşıt, konut kredisi çekmek veya taksit limitlerini esnetmek istiyorsanız bu skoru yüksek tutmak bir zorunluluktur.",
      icon: "📈",
      tagColor: "text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/30",
      bgColor: "bg-amber-500/[0.02] dark:bg-amber-500/[0.01]",
      borderColor: "border-amber-200/50 dark:border-amber-900/40",
      tips: [
        {
          title: "Kredi Notunu Oluşturan Temel Dinamikler",
          desc: "Kredi notunuz hesaplanırken; Ödeme Alışkanlıkları (faturalar, taksitler, asgari ödeme alışkanlıkları) %35, Mevcut Borç Seviyesi (limit doluluk durumları) %35, Yeni Kredi/Kart Başvuruları %10 ve Kredi Kullanım Yoğunluğu %20 ağırlığa sahiptir."
        },
        {
          title: "Hızlı Yükseltme Stratejisi 1: Gecikmeleri Bitirin",
          desc: "Bir borcu son ödeme tarihinden 1 gün bile sonra ödemek puanınıza zarar verir. Bütçem Pro Alarmlar modülünü aktif kullanarak ödemelerinizi vadesinden önce tamamlayın. Otomatik ödeme talimatları hayat kurtarır."
        },
        {
          title: "Hızlı Yükseltme Stratejisi 2: %25 Limit Kuralı",
          desc: "Kredi kartlarınızın limitlerini sonuna kadar kullanmayın. Toplam limitinizin en fazla %25 - %30 civarını harcamak, finans sistemine 'harcama kontrolüne sahip bir tüketici' mesajı vererek puanınızı hızla yukarı taşır."
        }
      ],
      conclusion: "Kredi kartı limitlerini borç değil, kısa vadeli bir likidite aracı olarak görün ve her dönem ekstresini tamamen kapatmayı alışkanlık edinin."
    },
    {
      id: "inflation-tips",
      category: "Ekonomik Strateji",
      title: "Yüksek Enflasyon Ortamında Akıllı Borçlanma ve Alışveriş",
      readTime: "5 dk okuma",
      introduction: "Para değerinin hızla değiştiği dalgalı piyasa koşullarında borca girmek veya nakit kalmak kritik bir sanattır. Doğru adımlarla borçları enflasyona karşı bir avantaja nasıl dönüştüreceğinizi açıklıyoruz.",
      icon: "💸",
      tagColor: "text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/30",
      bgColor: "bg-rose-500/[0.02] dark:bg-rose-500/[0.01]",
      borderColor: "border-rose-200/50 dark:border-rose-900/40",
      tips: [
        {
          title: "Sabit Faizli Taksitlerin Gücü",
          desc: "Gelecekteki enflasyon oranından daha düşük ve sabit faizle / peşin fiyatına taksitle yapılan borçlanmalar lehinizedir. Çünkü satın aldığınız ürün her geçen gün değerlenirken, her ay ödediğiniz sabit taksit tutarı reel geliriniz karşısında küçülür."
        },
        {
          title: "Asgari Ödeme Tuzağına Dikkat Edin",
          desc: "Enflasyon ortamında kredi kartı akdi faiz oranları yükselir. Ekstre borcunun yalnızca asgari tutarını ödemek, kalan borca bileşik ve yüksek gecikme faizi binmesine neden olur ve borcunuzu geometrik düzende katlar."
        },
        {
          title: "Yatırımlık Gider Ayrıştırması",
          desc: "Sizi üretime, eğitime veya finansal sermayeye götürecek ekipman ve araçlar için yapılan borçlanmalar 'İyi Borç' sınıfındadır. Tüketim odaklı, keyfi borçlanmalar ise yüksek enflasyonda nakit açığınızı büyüterek krize neden olur."
        }
      ],
      conclusion: "Gereksiz borçlanmalardan kaçınarak, gelecekteki taksit yükümlülüklerinizi Bütçem Pro 'Taksitli Borçlar' sekmesinden her ay için tek tek takip edip bütçenizi önceden rezerve edin."
    }
  ];

  // 1. KULLANIM KILAVUZU & DETAYLI TALİMATLAR (activeTab === "help")
  if (activeTab === "help") {
    return (
      <div className="space-y-6 animate-fade-in w-full max-w-5xl mx-auto">
        
        {/* Modern Interactive Header inside Guide */}
        <div className="p-6 sm:p-7 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl shadow-lg border border-indigo-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 text-[11px] font-bold tracking-wide uppercase">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Bütçem Pro Kapsamlı Kullanım Kılavuzu</span>
              </div>
              <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center md:justify-start gap-2.5">
                <Compass className="w-7 h-7 text-indigo-400" /> UYGULAMA VE ÖZELLİK REHBERİ
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium leading-relaxed">
                Gemini 3.7 Flash yapay zeka koçu, sesli asistan, kamera ile fiş tarama, kişi rehberi & WhatsApp borç takibi ve finansal hesaplama araçlarının tüm kullanma talimatlarını adım adım keşfedin.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center shrink-0">
              <button
                onClick={() => onNavigate("aiStrategy")}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Bot className="w-4 h-4" /> Asistanı Dene
              </button>
              <button
                onClick={() => onNavigate("blog")}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl border border-white/15 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <BookOpen className="w-4 h-4" /> Finans Kütüphanesi
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar & Category Filter Chips */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              value={guideSearchQuery}
              onChange={(e) => setGuideSearchQuery(e.target.value)}
              placeholder="Kılavuzda özellik, komut veya talimat arayın (Örn: Fiş Tarama, WhatsApp, Kartopu, Sesli Asistan, Kredi)..."
              className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {guideSearchQuery && (
              <button
                onClick={() => setGuideSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Temizle
              </button>
            )}
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {guideCategories.map((cat) => {
              const isSelected = selectedGuideCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedGuideCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs shadow-indigo-500/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Detailed Guide Cards Grid */}
        <div className="space-y-4">
          {filteredGuides.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
              <span className="text-4xl">🔍</span>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Aradığınız kriterlere uygun kılavuz bulunamadı</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Arama kelimenizi değiştirerek veya kategori filtresini 'Tümü' yaparak tekrar deneyebilirsiniz.
              </p>
              <button
                onClick={() => { setGuideSearchQuery(""); setSelectedGuideCategory("all"); }}
                className="px-4 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 font-bold text-xs rounded-xl"
              >
                Filtreleri Sıfırla
              </button>
            </div>
          ) : (
            filteredGuides.map((guide) => {
              const isExpanded = expandedGuideId === guide.id;

              return (
                <motion.div
                  key={guide.id}
                  layout
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-200 hover:border-indigo-500/40"
                >
                  {/* Card Header (Clickable Accordion) */}
                  <div
                    onClick={() => setExpandedGuideId(isExpanded ? null : guide.id)}
                    className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-3.5 cursor-pointer select-none transition bg-slate-50/40 dark:bg-slate-900/40 hover:bg-indigo-50/30 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 flex-1">
                      <div className="text-2xl sm:text-3xl p-2.5 rounded-2xl bg-indigo-50 dark:bg-slate-800 shrink-0 border border-indigo-100 dark:border-slate-700">
                        {guide.icon}
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-lg border ${guide.badgeColor}`}>
                            {guide.categoryLabel}
                          </span>
                          {guide.badge && (
                            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              {guide.badge}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                          {guide.title}
                        </h3>

                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2 leading-relaxed">
                          {guide.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hidden sm:inline">
                        {isExpanded ? "Daralt" : "Kılavuzu İncele"}
                      </span>
                      <div className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="border-t border-slate-100 dark:border-slate-800 p-4 sm:p-6 space-y-5 bg-white dark:bg-slate-900"
                      >
                        {/* What It Does Box */}
                        <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                            <Info className="w-4 h-4" />
                            <span>Bu Özellik Ne İşe Yarar?</span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                            {guide.whatItDoes}
                          </p>
                        </div>

                        {/* Step-by-Step Instructions */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>Adım Adım Kullanım Talimatları:</span>
                          </h4>

                          <div className="grid gap-2.5 sm:grid-cols-2">
                            {guide.instructions.map((step) => (
                              <div
                                key={step.step}
                                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 space-y-1"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                    {step.step}
                                  </span>
                                  <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-100">
                                    {step.title}
                                  </h5>
                                </div>
                                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium pl-8">
                                  {step.desc}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Pro Tips */}
                        {guide.proTips && guide.proTips.length > 0 && (
                          <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                              <Sparkles className="w-4 h-4 text-amber-500" />
                              <span>Uzman İpuçları & Püf Noktaları:</span>
                            </div>
                            <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 font-medium">
                              {guide.proTips.map((tip, tIdx) => (
                                <li key={tIdx} className="flex items-start gap-2">
                                  <span className="text-amber-500 font-bold">•</span>
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Direct Action Navigation Button */}
                        {guide.targetTab && (
                          <div className="pt-2 flex justify-end">
                            <button
                              onClick={() => onNavigate(guide.targetTab!)}
                              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                            >
                              <span>Bu Özelliğe Git</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Bottom CTA to Knowledge Base */}
        <div className="p-5 bg-gradient-to-r from-slate-100 to-indigo-50 dark:from-slate-800 dark:to-indigo-950/30 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">Daha Fazla Finansal Strateji mi Arıyorsunuz?</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              50/30/20 kuralı, kredi skoru yükseltme ve enflasyonist ortamda borçlanma makalelerimizi okuyun.
            </p>
          </div>
          <button
            onClick={() => onNavigate("blog")}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <BookOpen className="w-4 h-4" /> Makaleleri Oku
          </button>
        </div>

      </div>
    );
  }

  // 2. AKADEMİK FİNANS KÜTÜPHANESİ & BLOG (activeTab === "blog")
  if (activeTab === "blog") {
    return (
      <div className="space-y-6 animate-fade-in w-full max-w-5xl mx-auto">
        {/* Centered & Animated Page Title */}
        <div className="flex flex-col items-center justify-center text-center py-2 select-none">
          <motion.h2
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
          >
            <BookOpen className="w-7 h-7 text-indigo-500 animate-pulse" /> AKADEMİK FİNANS KÜTÜPHANESİ
          </motion.h2>
          <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
        </div>

        {/* Modern Blog Header Banner */}
        <div className="flex flex-col items-center justify-center text-center p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold max-w-xl">
            Mali geleceğinizi planlamak ve borç sarmalından bilimsel metotlarla kurtulmak için hazırlanan finans içerikleri.
          </p>
        </div>

        {/* Dynamic Blog Post Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {blogPosts.map((post) => {
            const isExpanded = selectedPostId === post.id;
            
            return (
              <motion.div
                key={post.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className={`p-5 rounded-3xl border transition-all duration-300 flex flex-col justify-between ${post.bgColor} ${post.borderColor} ${isExpanded ? 'md:col-span-2 shadow-sm scale-100 bg-white dark:bg-slate-800/80' : 'hover:shadow-xs hover:border-slate-300 dark:hover:border-slate-700'}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <span className={`px-2.5 py-0.5 border text-[10px] font-extrabold uppercase rounded-lg ${post.tagColor}`}>
                      {post.category}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {post.readTime}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-snug mb-2 flex items-start gap-2">
                    <span className="text-lg shrink-0">{post.icon}</span>
                    <span>{post.title}</span>
                  </h3>

                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold mb-4">
                    {post.introduction}
                  </p>

                  {/* Expandable Tips container */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60 mt-4 overflow-hidden"
                      >
                        <div className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-1">
                          🛠️ STRATEJİK EYLEM ADIMLARI
                        </div>
                        
                        <div className="grid gap-3 sm:grid-cols-3">
                          {post.tips.map((tip, idx) => (
                            <div key={idx} className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1 hover:border-slate-350 dark:hover:border-slate-700 transition duration-300 shadow-3xs">
                              <span className="inline-flex w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-[10px] items-center justify-center mb-1">
                                0{idx + 1}
                              </span>
                              <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-none">
                                {tip.title}
                              </h4>
                              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                                {tip.desc}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-start gap-3 mt-4">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 leading-relaxed font-semibold">
                            <strong>Özet Öneri:</strong> {post.conclusion}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex justify-end">
                  <button
                    onClick={() => setSelectedPostId(isExpanded ? null : post.id)}
                    className="px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95"
                  >
                    {isExpanded ? (
                      <span>📖 OKUMAYI KAPAT</span>
                    ) : (
                      <span className="flex items-center gap-1 border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600">
                        İŞLEMLERİ İNCELE <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // 3. GERİ BİLDİRİM & İLETİŞİM (activeTab === "feedback")
  if (activeTab === "feedback") {
    return (
      <div className="space-y-6 animate-fade-in w-full max-w-5xl mx-auto">
        <div className="border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
          <h2 className="text-lg font-black flex items-center gap-2 text-slate-800 dark:text-slate-100 uppercase tracking-tight">
            <Mail className="w-5 h-5 text-rose-500" /> BİZE ULAŞIN & GERİ BİLDİRİM
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-semibold">
            Bütçem Pro uygulamasını en kusursuz ve profesyonel hale getirmek için fikirleriniz bizim için hazinedir.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-5 items-start">
          <div className="md:col-span-3 bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
            {isSuccessSubmitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8 space-y-3"
              >
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">GERİ BİLDİRİM HAZIRLANDI</h4>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400 font-semibold max-w-xs mx-auto leading-relaxed">
                  Posta istemciniz mailto şablonuyla tetiklendi. Gönderdiğiniz fikirler için canı gönülden teşekkür ederiz!
                </p>
                <span className="inline-block text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded-lg">
                  Form verileri 4 saniye içinde sıfırlanacaktır...
                </span>
              </motion.div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">ADINIZ SOYADINIZ (İSTEĞE BAĞLI)</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Örn. Ahmet Yılmaz"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">GERİ BİLDİRİM TÜRÜ</label>
                  <div className="grid grid-cols-2 gap-2">
                    {feedbackCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFeedbackCategory(cat.id)}
                        className={`px-3 py-2 border text-[11px] font-extrabold rounded-xl transition duration-300 text-left select-none cursor-pointer ${feedbackCategory === cat.id ? 'ring-2 ring-indigo-500 border-transparent bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black' : 'bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">UYGULAMA PUANINIZ</label>
                  <div className="flex items-center gap-1.5 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-900 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        onMouseEnter={() => setShowRatingHover(star)}
                        onMouseLeave={() => setShowRatingHover(null)}
                        className="text-slate-300 dark:text-slate-700 transition transform hover:scale-125 cursor-pointer text-base"
                      >
                        <Star 
                          className="w-5 h-5 transition-colors" 
                          fill={(showRatingHover !== null ? star <= showRatingHover : star <= feedbackRating) ? "#eab308" : "none"}
                          color={(showRatingHover !== null ? star <= showRatingHover : star <= feedbackRating) ? "#eab308" : "currentColor"}
                        />
                      </button>
                    ))}
                    <span className="text-[10px] font-black uppercase text-slate-400 ml-2">
                      {feedbackRating > 0 ? `${feedbackRating} / 5 Yıldız` : "Seçim Yapın"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">MESAJINIZ / ÖNERİNİZ</label>
                  <div className="relative">
                    <PenSquare className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <textarea
                      value={contactMsg}
                      onChange={(e) => setContactMsg(e.target.value)}
                      rows={4}
                      placeholder="Kullanıcı deneyimini güçlendirmek için her türlü fikre, geliştirilmesini istediğiniz ek modül önerilerine açığız..."
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all leading-relaxed"
                    />
                  </div>
                </div>

                <button
                  disabled={!contactMsg}
                  onClick={handleSendMessage}
                  className="w-full py-3 bg-gradient-to-r from-rose-500 via-pink-600 to-rose-600 text-white font-extrabold text-xs rounded-2xl shadow-md hover:shadow-lg disabled:opacity-40 select-none transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> E-POSTA İLE GERİ BİLDİRİM GÖNDER
                </button>
              </div>
            )}
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="p-5 bg-gradient-to-br from-indigo-500/10 to-transparent dark:from-indigo-950/10 rounded-3xl border border-indigo-200/30 dark:border-indigo-900/40 space-y-4">
              <span className="p-2 bg-indigo-500/15 text-indigo-500 rounded-xl inline-block">
                <ShieldCheck className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-1">DESTEK POLİTİKASI</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                  Tüm geri bildirimler geliştirici ekibimiz tarafından titizlikle tasnif edilmekte ve haftalık güncelleme bülteninde projeye zemin hazırlamaktadır.
                </p>
              </div>
              
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1 text-[11px]">
                <p className="text-slate-400 font-bold uppercase tracking-wide text-[9px] block">İnceleme Süresi</p>
                <p className="text-slate-700 dark:text-slate-300 font-black">24 Saat içerisinde yanıt garantisi</p>
                <p className="text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                  Proje açık kaynaklı olup, Serkan Sağlam mentörlüğünde geliştirilmektedir.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-3xl space-y-2">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block leading-none">DOĞRUDAN İRTİBAT HATTI</span>
              <div className="flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-500">📧 E-posta:</p>
                <a 
                  href="mailto:info.borcodemetakip@gmail.com" 
                  className="font-black underline text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 tracking-wide break-all"
                >
                  info.borcodemetakip@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. GİZLİLİK POLİTİKASI (activeTab === "privacy")
  if (activeTab === "privacy") {
    return (
      <div className="space-y-4 animate-fade-in w-full max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center text-center py-2 select-none">
          <motion.h2
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
          >
            <Shield className="w-7 h-7 text-indigo-500 animate-pulse" /> GİZLİLİK POLİTİKASI
          </motion.h2>
          <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
        </div>

        <div className="space-y-4 text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed pr-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="font-semibold text-slate-700 dark:text-slate-300">Son Güncelleme: 2 Haziran 2026</p>
          
          <p>
            <strong>Bütçem Pro</strong> bireysel finans yönetimi, borç ve taksit takip platformu olarak, kullanıcı gizliliğini ve veri egemenliğini en üst öncelik olarak kabul eder. Uygulamamızı kullanırken mali verilerinizin gizliliği ve güvenliği hakkında bilmeniz gereken tüm detaylar aşağıda açıklanmıştır:
          </p>

          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight text-xs">
              1. Verilerin Tamamen Yerel Depolanması & Güvenli Bulut Opsiyonu
            </h3>
            <p>
              Girdiğiniz hassas finansal veriler (maaş, ek gelir, borç, taksit tutarı, harcama kayıtları) varsayılan olarak cihazınızın tarayıcısında çalışan güvenli yerel depolama biriminde (<strong>Local Storage / IndexedDB</strong>) barındırılır. Google ile giriş yaptığınızda ise verileriniz Firebase Firestore bulut altyapısında şifreli olarak korunur.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight text-xs">
              2. Fiş Tarayıcı (OCR) ve Kamera İzinleri Çalışma Mantığı
            </h3>
            <p>
              Uygulamadaki Fiş/Fatura Tarayıcı özelliğini kullandığınızda kamera erişimi veya dosya yükleme izni istenir. 
              <strong> Bu görsel dosyalar veri okuma işleminin hemen ardından bellekten anında kalıcı olarak silinir;</strong> sunucu disklerinde hiçbir şekilde yedeklenmez ve depolanmaz.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight text-xs">
              3. Yapay Zeka Finans Asistanı ve API Anahtarları
            </h3>
            <p>
              Bütçem Pro yerleşik yapay zeka asistanı (Gemini AI), finansal verilerinizi rasyonel şekilde analiz etmek üzere tasarlanmıştır. Kullanıcılar kendi Gemini API anahtarlarını girmek isterlerse, bu anahtar sadece cihazlarında yerel olarak saklanır.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight text-xs">
              4. Çerezler ve Üçüncü Taraf Reklam Servisleri (AdMob / AdSense)
            </h3>
            <p>
              Uygulamanın ücretsiz sürümünde yer alan reklam alanları için Google AdMob/AdSense kullanılmaktadır. Reklam tanımlayıcıları mevzuata uygun şekilde yönetilir.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <p>
              Gizlilik sözleşmemiz veya veri güvenliği politikamızla ilgili merak ettiğiniz tüm sorular için <a href="mailto:info.borcodemetakip@gmail.com" className="underline font-bold text-indigo-500 hover:text-indigo-600 transition">info.borcodemetakip@gmail.com</a> adresinden bizimle iletişime geçebilirsiniz.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 5. HAKKIMIZDA (activeTab === "about")
  return (
    <div className="space-y-6 animate-fade-in w-full max-w-4xl mx-auto">
      <div className="flex flex-col items-center justify-center text-center py-2 select-none">
        <motion.h2
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
        >
          <BookOpen className="w-7 h-7 text-indigo-500 animate-pulse" /> HAKKIMIZDA
        </motion.h2>
        <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
      </div>

      <div className="p-6 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-3xl shadow-md border border-indigo-500/30 space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 select-none pointer-events-none">
          <Star className="w-32 h-32 text-white animate-spin-slow" />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 bg-indigo-500/40 border border-indigo-400/40 text-[10px] font-black tracking-widest uppercase rounded-lg">
            Sürüm 5.2 Ultimate Edition
          </span>
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
        </div>
        <h3 className="text-xl font-black tracking-tight leading-none">
          BÜTÇEM PRO & BORÇ TAKİP SİSTEMİ
        </h3>
        <p className="text-xs text-indigo-100 font-medium leading-relaxed max-w-xl">
          Bireysel ve hanehalkı bütçe akışınızı planlamak, borç yükünüzü optimize etmek ve yapay zeka entegrasyonuyla finansal riskleri erkenden saptamak üzere geliştirilmiş üstün asistanlık yazılımı.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase">
          SİSTEM ENTEGRASYONLARI VE YETENEKLERİ
        </h4>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="p-4 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-start gap-3 hover:border-indigo-100 dark:hover:border-slate-700 transition">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h5 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Dinamik Borç Takibi</h5>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                Tek seferlik ve taksitli borçların her birini faiz, vade (SKT) ve ödeme durumları ile kayıt altına alan altyapı.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-start gap-3 hover:border-emerald-100 dark:hover:border-slate-700 transition">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h5 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Gemini 3.7 Flash Danışmanı</h5>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                Google Search ve akıllı finans motoruyla desteklenen, gelir ve harcama profilinize analiz yapan akıllı bütçe asistanı.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-start gap-3 hover:border-amber-100 dark:hover:border-slate-700 transition">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h5 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Görsel İstatistikler</h5>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                Bütçe dağılımlarını, ödeme ilerleme durumlarını ve borç-gelir oranını pürüzsüz interaktif SVG grafiklerle sunan ekranlar.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-start gap-3 hover:border-blue-100 dark:hover:border-slate-700 transition">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h5 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Yüzde Yüz Veri Güvenliği</h5>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                Mali bilgileriniz şifreli yerel depolamada ve güvenli Firestore bulutunda tam gizlilikle barındırılır.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase leading-none">GELİŞTİRİCİ SİSTEM BİLGİSİ</p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-bold">Serkan SAĞLAM tarafından MIT Açık Kaynak ile tasarlanmıştır.</p>
          </div>
        </div>
        <span className="self-start sm:self-center px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30 text-[10px] font-extrabold rounded-lg">
          React SPA / ESM Engine
        </span>
      </div>
    </div>
  );
};
