/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BookOpen, HelpCircle, Mail, MessageSquare, Shield, Star, User, Award, Zap, 
  BarChart3, Layers, Lock, ThumbsUp, Calendar, ArrowRight, Heart, Send, 
  CheckCircle2, AlertTriangle, ShieldCheck, PenSquare, ArrowUpRight, Scale
} from "lucide-react";

interface HelpAndGuidesProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
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
    { id: "suggestion", label: "💡 İstek & Öneri", color: "border-indigo-100 text-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20 dark:text-indigo-450 dark:border-indigo-900/30" },
    { id: "bug", label: "🐛 Hata Bildirimi", color: "border-rose-100 text-rose-750 bg-rose-50/50 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/30" },
    { id: "cooperation", label: "🤝 Ortaklık", color: "border-emerald-100 text-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/30" }
  ];

  const handleSendMessage = () => {
    if (!contactMsg) {
      return;
    }

    const currentUrl = window.location.href;
    const catLabel = feedbackCategories.find(c => c.id === feedbackCategory)?.label || feedbackCategory;
    const ratingStars = feedbackRating > 0 ? "⭐".repeat(feedbackRating) : "Derecelendirme yok";
    
    const mailtoUrl = `mailto:info.borctakipyonetimi@gmail.com?subject=Bütçem Pro Geri Bildirim&body=Gönderen: ${encodeURIComponent(contactName || "Anonim Kullanıcı")}%0D%0AKategori: ${encodeURIComponent(catLabel)}%0D%0ADerecelendirme: ${encodeURIComponent(ratingStars)}%0D%0AMesaj: ${encodeURIComponent(contactMsg)}%0D%0ACihaz Adresi: ${encodeURIComponent(currentUrl)}`;
    
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

  if (activeTab === "help") {
    return (
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin">
        {/* Centered & Animated Page Title */}
        <div className="flex flex-col items-center justify-center text-center py-4 select-none">
          <motion.h2
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
          >
            <HelpCircle className="w-7 h-7 text-indigo-500 animate-pulse" /> SİSTEM KULLANIM REHBERİ
          </motion.h2>
          <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
        </div>

        {/* Modern Interactive Header inside Guide */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-tr from-indigo-500/10 via-purple-500/5 to-transparent p-6 rounded-3xl border border-indigo-550/15 text-center space-y-3 relative overflow-hidden"
        >
          {/* Neon lights backdrop */}
          <div className="absolute -top-12 -left-12 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-12 -right-12 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl" />
          
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium max-w-lg mx-auto relative z-10 leading-relaxed">
            Akıllı sistemimizdeki modülleri, taksit hesaplama yapılarını ve asistan yeteneklerini keşfederek finansal bağımsızlığınız için bütçenizi kontrol altına alın.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 1. Finansal Genel Bakış */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs space-y-2 hover:border-indigo-400 dark:hover:border-indigo-800/80 hover:shadow-xs transition duration-300">
            <span className="text-xl">📊</span>
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wide">1. ÖZET VE FİNANSAL YÖNETİM MERKEZİ</h4>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Dashboard genel bakış paneli finansal sağlığınızın yönetim üssüdür. Toplam borcunuzu, ödediğiniz kısımları ve kalan borcunuzu anlık izler. Gelirleriniz ile harcama bütçenizi kıyaslayarak <strong>Net Kalan Rezervinizi</strong> hesaplar ve bütçe durumunu görselleştirir.
            </p>
          </div>

          {/* 2. Harcamalar ve Kategoriler */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs space-y-2 hover:border-rose-400 dark:hover:border-rose-800/80 hover:shadow-xs transition duration-300">
            <span className="text-xl">🛒</span>
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wide">2. HARCAMA VE DİNAMİK KATEGORİ SEÇİCİ</h4>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Kategorilerinize özel renkler ve emojiler (simgeler) tanımlayabilirsiniz. Mevcut ay harcamalarınız bütçenizin <strong>%90 limitini</strong> aştığında Expenses listesinde bir dikkat bandı belirir. Veri grafikleriyle de anlık harcama dağılımını inceleyebilirsiniz.
            </p>
          </div>

          {/* 3. Borçlar ve Geri Ödemeler */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs space-y-2 hover:border-emerald-400 dark:hover:border-emerald-800/80 hover:shadow-xs transition duration-300">
            <span className="text-xl">💳</span>
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wide">3. BORÇ VE DETAYLI GERİ ÖDEME PLANI</h4>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Tek seferlik kişisel veya kurumsal tüm borçlarınızı buraya kaydedin. Bölümdeki <strong>Geri Ödeme Ekle</strong> butonu ile borçlarınızı parça parça ödeyebilir ve ödeme geçmişi loglarıyla her bir ödemenin tarihini takip edebilirsiniz.
            </p>
          </div>

          {/* 4. Gelir Kaynakları */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs space-y-2 hover:border-sky-400 dark:hover:border-sky-800/80 hover:shadow-xs transition duration-300">
            <span className="text-xl">🏦</span>
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wide">4. GELİR VE AKTİF REZERV YÖNETİMİ</h4>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Maaş, ek kazançlar veya kira geliri gibi kaynaklarınızı kaydedin. Bu veriler toplam borç/ödeme dengesi raporlama motoruna anlık aktarılır. Asistan analiz algoritmasında gelirinize düşen borç yükünü oranlayarak rasyonel veriler sağlar.
            </p>
          </div>

          {/* 5. Taksitli Alışverişler */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs space-y-2 hover:border-purple-400 dark:hover:border-purple-800/80 hover:shadow-xs transition duration-300">
            <span className="text-xl">📊</span>
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wide">5. TAKSİTLİ HARCAMA VE KREDİLER</h4>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Kredi kartı taksitleri, taşıt/konut kredileri gibi vadeli ödeme planlarınız için bu modülü kullanın. Toplam taksit adedini ve ödenen taksit miktarını girdiğinizde kalan borç anlık gösterilir. <strong>Taksit Öde</strong> butonu yeni taksit kaydetmenizi sağlar.
            </p>
          </div>

          {/* 6. AI Asistan */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs space-y-2 hover:border-amber-400 dark:hover:border-amber-800/80 hover:shadow-xs transition duration-300">
            <span className="text-xl">🤖</span>
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wide">6. YAPAY ZEKA DESTEKLİ BÜTÇE ASİSTANI</h4>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              <strong>Gemini AI</strong> motoruna dayalı anlık asistan finans durumunuzu saniyeler içinde analiz eder. Finansal risk seviyenizi (Düşük, Orta, Yüksek, Kritik) ölçerek, gelir-gider dağılımınızı iyileştirmeniz için özel ve rasyonel tavsiyeler üretir.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={() => onNavigate("blog")}
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-700 text-white font-extrabold text-xs rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <BookOpen className="w-4 h-4 animate-pulse" /> Akademik Finansal Strateji Rehberlerini İnceleyin
          </button>
        </div>
      </div>
    );
  }

  if (activeTab === "blog") {
    return (
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin">
        {/* Centered & Animated Page Title */}
        <div className="flex flex-col items-center justify-center text-center py-4 select-none">
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
          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold max-w-xl">
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

                  <p className="text-[11.5px] text-slate-500 dark:text-slate-450 leading-relaxed font-semibold mb-4">
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
                              <span className="inline-flex w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300 font-extrabold text-[10px] items-center justify-center mb-1">
                                0{idx + 1}
                              </span>
                              <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-none">
                                {tip.title}
                              </h4>
                              <p className="text-[10.5px] text-slate-500 dark:text-slate-450 leading-relaxed font-semibold">
                                {tip.desc}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-start gap-3 mt-4">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-450 leading-relaxed font-semibold">
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
                    className="px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95"
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

  if (activeTab === "feedback") {
    return (
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin">
        {/* Editorial Subheader */}
        <div className="border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
          <h2 className="text-lg font-black flex items-center gap-2 text-slate-800 dark:text-slate-100 uppercase tracking-tight">
            <Mail className="w-5 h-5 text-rose-500" /> BİZE ULAŞIN & GERİ BİLDİRİM
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-505 mt-1 font-semibold">
            Bütçem Pro uygulamasını en kusursuz ve profesyonel hale getirmek için fikirleriniz bizim için hazinedir.
          </p>
        </div>

        {/* Dual Column Layout for Feedback Hub */}
        <div className="grid gap-6 md:grid-cols-5 items-start">
          {/* Form Side - Span 3 */}
          <div className="md:col-span-3 bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-250 dark:border-slate-750/70 shadow-sm space-y-5">
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
                {/* Name field */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">ADINIZ SOYADINIZ (İSTEĞE BAĞLI)</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Örn. Ahmet Yılmaz"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Feedback Categories Grid */}
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

                {/* Dynamic Star Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">UYGULAMA PUANINIZ</label>
                  <div className="flex items-center gap-1.5 bg-linear-to-r from-slate-50 to-transparent dark:from-slate-900 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        onMouseEnter={() => setShowRatingHover(star)}
                        onMouseLeave={() => setShowRatingHover(null)}
                        className="text-slate-350 dark:text-slate-700 transition transform hover:scale-125 cursor-pointer text-base"
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

                {/* Message field */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">MESAJINIZ / ÖNERİNİZ</label>
                  <div className="relative">
                    <PenSquare className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <textarea
                      value={contactMsg}
                      onChange={(e) => setContactMsg(e.target.value)}
                      rows={4}
                      placeholder="Kullanıcı deneyimini güçlendirmek için her türlü fikre, geliştirilmesini istediğiniz ek modül önerilerine açığız..."
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all leading-relaxed"
                    />
                  </div>
                </div>

                {/* Send Button */}
                <button
                  disabled={!contactMsg}
                  onClick={handleSendMessage}
                  className="w-full py-3 bg-linear-to-r from-rose-500 via-pink-600 to-rose-600 text-white font-extrabold text-xs rounded-2xl shadow-md hover:shadow-lg disabled:opacity-40 select-none transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> E-POSTA İLE GERİ BİLDİRİM GÖNDER
                </button>
              </div>
            )}
          </div>

          {/* Quick Support Info Side - Span 2 */}
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
                <p className="text-slate-500 dark:text-slate-450 leading-normal font-semibold">
                  Proje açık kaynaklı olup, Serkan Sağlam mentörlüğünde geliştirilmektedir.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-3xl space-y-2">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block leading-none">DOĞRUDAN İRTİBAT HATTI</span>
              <div className="flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-500">📧 E-posta:</p>
                <a 
                  href="mailto:info.borctakipyonetimi@gmail.com" 
                  className="font-black underline text-indigo-500 dark:text-indigo-400 hover:text-indigo-650 tracking-wide break-all"
                >
                  info.borctakipyonetimi@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "privacy") {
    return (
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin">
        {/* Centered & Animated Page Title */}
        <div className="flex flex-col items-center justify-center text-center py-4 select-none">
          <motion.h2
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
          >
            <Shield className="w-7 h-7 text-indigo-500 animate-pulse" /> GİZLİLİK POLİTİKASI
          </motion.h2>
          <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
        </div>

        <div className="space-y-4 text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed overflow-y-auto pr-2">
          <p className="font-semibold text-slate-700 dark:text-slate-300">Son Güncelleme: 2 Haziran 2026</p>
          
          <p>
            <strong>Bütçem Pro</strong> bireysel finans yönetimi, borç ve taksit takip platformu olarak, kullanıcı gizliliğini ve veri egemenliğini en üst öncelik olarak kabul eder. Uygulamamızı kullanırken mali verilerinizin gizliliği ve güvenliği hakkında bilmeniz gereken tüm detaylar aşağıda açıklanmıştır:
          </p>

          <div className="space-y-2.5">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight text-xs">
              1. Verilerin Tamamen Yerel Depolanması (Zero-Server Architecture)
            </h3>
            <p>
              Girdiğiniz hiçbir hassas finansal veri (maaş, ek gelir, her türlü borç, taksit tutarı, harcama kayıtları veya işlem detayları) harici bir bulut veritabanına ya da sunucularımıza <strong>kaydedilmez</strong>. Tüm mali kayıtlarınız, sadece kendi cihazınızın tarayıcısında çalışan güvenli yerel depolama biriminde (<strong>Local Storage / IndexedDB</strong>) barındırılır. Verilerinize erişim, kontrol ve silme yetkisi tamamen fiziksel olarak cihaza sahip olan kullanıcıya aittir.
            </p>
          </div>

          <div className="space-y-2.5">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight text-xs">
              2. Fiş Tarayıcı (OCR) ve Kamera İzinleri Çalışma Mantığı
            </h3>
            <p>
              Uygulamadaki Fiş/Fatura Tarayıcı özelliğini kullandığınızda, cihazınızın kamerasına erişim veya galeriden dosya yükleme izni istenir. Kameradan alınan anlık akış veya yüklenen görsel, faturadaki verileri (tutar, tarih, KDV oranı vb.) OCR teknolojisi ile otomatik olarak ayıklamak üzere güvenli API uç noktamıza şifreli (HTTPS) bağlantı aracılığıyla gönderilir. 
              <strong> Bu görsel dosyalar sunucu tarafında veri okuma işleminin hemen ardından bellekten anında, kalıcı olarak silinir;</strong> sunucu disklerinde hiçbir şekilde yedeklenmez ve depolanmaz.
            </p>
          </div>

          <div className="space-y-2.5">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight text-xs">
              3. Yapay Zeka Finans Asistanı ve API Anahtarları
            </h3>
            <p>
              Bütçem Pro yerleşik yapay zeka asistanı (Gemini AI), finansal verilerinizi rasyonel şekilde analiz etmek üzere tasarlanmıştır. Asistanla konuşurken veya otomatik analiz gerçekleştirilirken, yerelde kayıtlı özet bütçe metrikleriniz API çağrısına güvenli üst bilgi şeklinde dahil edilir. Kullanıcılar kendi kişbileyici Gemini API anahtarlarını girmek isterlerse, bu anahtar yine sadece cihazlarında yerel olarak saklanır. AI etkileşim geçmişiniz hiçbir reklam platformu veya veri brokeri ile ticari amaçla kesinlikle paylaşılmaz.
            </p>
          </div>

          <div className="space-y-2.5">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight text-xs">
              4. Çerezler ve Üçüncü Taraf Reklam Servisleri (AdMob / AdSense)
            </h3>
            <p>
              Uygulamanın ücretsiz sürümünde yer alan reklam alanları için Google AdMob kullanılmaktadır. Google AdMob, size daha ilgi çekici veya ülkenizin mevzuatına uygun reklamlar sunabilmek adına geçici reklam tanımlayıcıları ve çerezler (cookies) kullanabilir. "Reklamsız Pro Sürüm" tercih edildiğinde bu çerezlerin ve reklam takip mekanizmalarının tamamı devre dışı bırakılır.
            </p>
          </div>

          <div className="space-y-2.5">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight text-xs">
              5. Veri Yedekleme, Taşınabilirlik ve İmha Haklarınız
            </h3>
            <p>
              Yedekleme ve cihazlar arası veri transferi amacıyla "Cevrimdışı JSON Yedek İndir" özelliğini dilediğiniz zaman kullanabilirsiniz. This işlem verilerinizi tamamen şifresiz bir metin dosyası olarak cihazınıza kaydeder. Dosyanın güvenliğini sağlamak sizin sorumluluğunuzdadır. İstediğiniz an uygulamanın Ayarlar menüsünden "Tüm Verileri Sıfırla" butonuna dokunarak veya tarayıcı önbelleğinizi temizleyerek Bütçem Pro bünyesindeki tüm kayıtlarınızı geri dönülemez biçimde kalıcı olarak imha edebilirsiniz.
            </p>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <p>
              Gizlilik sözleşmemiz veya veri güvenliği politikamızla ilgili merak ettiğiniz tüm sorular ya da geri bildirimler için bizimle <a href="mailto:info.borctakipyonetimi@gmail.com" className="underline font-bold text-indigo-500 hover:text-indigo-650 transition">info.borctakipyonetimi@gmail.com</a> adresinden doğrudan iletişime geçebilirsiniz.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // default to About ("about")
  return (
    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin">
      {/* Centered & Animated Page Title */}
      <div className="flex flex-col items-center justify-center text-center py-4 select-none">
        <motion.h2
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
        >
          <BookOpen className="w-7 h-7 text-indigo-500 animate-pulse" /> HAKKIMIZDA
        </motion.h2>
        <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
      </div>

      {/* Premium Header Banner */}
      <div className="p-6 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-3xl shadow-md border border-indigo-500/30 space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 select-none pointer-events-none">
          <Star className="w-32 h-32 text-white animate-spin-slow" />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 bg-indigo-500/40 border border-indigo-400/40 text-[10px] font-black tracking-widest uppercase rounded-lg">
            Sürüm 5.0 Ultimate Edition
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

      {/* Core Systems Feature Bento Grid */}
      <div className="space-y-3">
        <h4 className="text-xs font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase">
          SİSTEM ENTEGRASYONLARI VE YETENEKLERİ
        </h4>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Card 1: Debt Tracker */}
          <div className="p-4 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-805 rounded-2xl flex items-start gap-3 hover:border-indigo-100 dark:hover:border-slate-700 transition">
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

          {/* Card 2: AI Advisor */}
          <div className="p-4 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-805 rounded-2xl flex items-start gap-3 hover:border-emerald-100 dark:hover:border-slate-705 transition">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h5 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Yapay Zeka Danışmanı</h5>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                Gemini AI veri motoruyla desteklenen, gelir ve harcama profilinize analiz yapan akıllı bütçe asistanı.
              </p>
            </div>
          </div>

          {/* Card 3: Charts & Statistics */}
          <div className="p-4 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-805 rounded-2xl flex items-start gap-3 hover:border-amber-100 dark:hover:border-slate-705 transition">
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

          {/* Card 4: Local Storage Safety */}
          <div className="p-4 bg-slate-50/70 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-805 rounded-2xl flex items-start gap-3 hover:border-blue-100 dark:hover:border-slate-705 transition">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h5 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Yüzde Yüz Veri Güvenliği</h5>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                Tüm mali bilgileriniz sadece sizin tarayıcınızda (Local Storage) barındırılır, harici sunucularla kesinlikle paylaşılmaz.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Developer and License Badge Block */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
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
