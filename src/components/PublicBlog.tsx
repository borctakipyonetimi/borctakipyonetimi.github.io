import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BookOpen, Search, ArrowLeft, Calendar, User, ChevronRight, 
  ThumbsUp, Clock, Share2, Sparkles, Home, Play, ArrowRight, DollarSign 
} from "lucide-react";

export interface BlogPost {
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

interface PublicBlogProps {
  selectedPostId: string | null;
  onSelectPost: (id: string | null) => void;
  onStartApp: () => void;
  onBackToLanding: () => void;
}

export const blogPosts: BlogPost[] = [
  {
    id: "snowball-avalanche",
    category: "Borç Stratejisi",
    title: "Kartopu (Snowball) vs Çığ (Avalanche) Hangi Metot Sizin İçin Doğru?",
    readTime: "5 dk okuma",
    introduction: "Borçlarınızı eritmek sadece matematiksel değil, aynı zamanda yoğun bir direnç ve motivasyon sürecidir. Finans yazınında en kabul görmüş iki borç ödeme modelini karşılaştırarak bütçe yapınıza en uyan stratejiyi seçmenize rehberlik ediyoruz.",
    icon: "🎯",
    tagColor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30",
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
    tagColor: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30",
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
    tagColor: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-105 dark:border-amber-900/30",
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
    id: "inflation-defense",
    category: "Ekonomik Strateji",
    title: "Yüksek Enflasyon Ortamında Akıllı Borçlanma ve Alışveriş",
    readTime: "5 dk okuma",
    introduction: "Para değerinin hızla değiştiği dalgalı piyasa koşullarında borca girmek veya nakit kalmak kritik bir sanattır. Doğru adımlarla borçları enflasyona karşı bir avantaja nasıl dönüştüreceğinizi açıklıyoruz.",
    icon: "💸",
    tagColor: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/30",
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
  },
  {
    id: "ai-finance",
    category: "Geleceğin Finansı",
    title: "Yapay Zeka (AI) Finansal Hayatımızı ve Bütçemizi Nasıl Değiştiriyor?",
    readTime: "4 dk okuma",
    introduction: "Yapay zeka teknolojileri, kurumsal bankacılıktan kişisel bütçe yönetimine kadar her finansal katmanı yeniden tanımlıyor. Artık yapay zeka sadece bir chat aracı değil, cebinizdeki en akıllı finans direktörüdür.",
    icon: "🧠",
    tagColor: "text-violet-600 bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/30",
    bgColor: "bg-violet-500/[0.02] dark:bg-violet-500/[0.01]",
    borderColor: "border-violet-200/50 dark:border-violet-900/40",
    tips: [
      {
        title: "Öngörücü Harcama Analizleri",
        desc: "Geleneksel bütçeleme geriye dönüktür; yani sadece geçen ay ne harcadığınızı gösterir. AI motorları ise geçmiş alışkanlıklarınızdan öğrenerek bu ayın sonunda nerede bütçe aşımı yaşayabileceğinizi öngörür ve sizi vadesinden önce uyarır."
      },
      {
        title: "Finansal Karar Destek Sistemleri",
        desc: "Önemli bir yatırım veya büyük bir satın alma yapmadan önce yapay zekaya bütçe portföyünüzü aktarabilir ve bu işlemin nakit rezervlerinize etkisini, 12 ay içindeki amortisman oranlarını test edebilirsiniz."
      }
    ],
    conclusion: "Bütçem Pro Yapay Zeka botuna tek tuşla göndereceğiniz bütçe istekleri ile size özel haftalık tasarruf modellerini hemen saniyeler içinde kurgulayabilirsiniz."
  },
  {
    id: "budget-leak",
    category: "Tasarruf Bilimi",
    title: "Bütçe Sızıntılarını Tespit Etme ve Kapatma Sanatı",
    readTime: "5 dk okuma",
    introduction: "Küçük miktarlarla yapılan harcamalar önemsiz görünür. Ancak her gün alınan 50 liralık kahve veya unutulmuş 100 liralık abonelikler, ay sonunda devasa bir bütçe sızıntısına ve para kaybına dönüşür.",
    icon: "💧",
    tagColor: "text-sky-600 bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/30",
    bgColor: "bg-sky-500/[0.02] dark:bg-sky-500/[0.01]",
    borderColor: "border-sky-200/50 dark:border-sky-900/40",
    tips: [
      {
        title: "Pasif Aboneliklerin Denetimi",
        desc: "Spotify, Netflix, Youtube Premium, uygulama içi abonelikler ve premium üyelikler gibi her ay kartınızdan çekilen otomatik ödemeleri listeyin. Son 30 günde kullanmadığınız en az bir tanesini bugün iptal edin."
      },
      {
        title: "Günlük Mikro Rutinlerin Toplam Maliyeti",
        desc: "Günlük harcamalarınızın çarpan gücünü hesaplayın. Haftada 3 kez dışarıda yemek sipariş etmenin yıllık maliyeti sandığınızdan çok daha büyüktür. Bu giderlerden %15 oranında tasarruf etmek birikecek acil durum fonunun temelini atar."
      }
    ],
    conclusion: "Harcamalarınızı Bütçem Pro Giderler ekranından kategorize ederek anlık girdiğinizde, sızıntı haritanız net olarak ortaya çıkacaktır."
  }
];

export const PublicBlog: React.FC<PublicBlogProps> = ({
  selectedPostId,
  onSelectPost,
  onStartApp,
  onBackToLanding
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hasShared, setHasShared] = useState(false);

  // Filter posts
  const filteredPosts = blogPosts.filter((post) => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          post.introduction.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory ? post.category === selectedCategory : true;
    return matchesSearch && matchesCat;
  });

  const categories = Array.from(new Set(blogPosts.map((p) => p.category)));

  const handleShare = (title: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setHasShared(true);
      setTimeout(() => setHasShared(false), 3000);
    }
  };

  const currentPost = blogPosts.find((p) => p.id === selectedPostId);

  // Jump to top of page on change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedPostId]);

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white transition-colors duration-300">
      
      {/* Blog Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-slate-900/95 border-b border-slate-200/50 dark:border-slate-800/80 backdrop-blur-md px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToLanding}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl transition cursor-pointer flex items-center justify-center"
            title="Ana Sayfaya Dön"
          >
            <Home className="w-4 h-4 text-indigo-500" />
          </button>
          <div className="text-left">
            <div className="text-sm sm:text-base font-black tracking-widest uppercase text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>BÜTÇEM PRO</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-md font-bold uppercase tracking-widest border border-indigo-200/20">FİNANS BLOGU</span>
            </div>
          </div>
        </div>

        <button
          onClick={onStartApp}
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-[10.5px] font-black uppercase tracking-wider transition hover:shadow-md cursor-pointer select-none active:scale-97 flex items-center gap-1 shrink-0"
        >
          <span>Uygulamaya Git</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <AnimatePresence mode="wait">
          {!selectedPostId ? (
            <motion.div
              key="post-list"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Blog Title Card */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-450 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100/40">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Kişisel Mali Bilgi Kütüphanesi</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Finansal Bağımsızlık Kılavuzu</h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold max-w-sm sm:max-w-md mx-auto leading-relaxed">
                  Bütçeleme stratejileri, borç kapama taktikleri ve akıllı tasarruf planları hakkında rasyonel makaleler.
                </p>
              </div>

              {/* Filters Box */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-205 dark:border-slate-800 shadow-3xs space-y-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Search query input */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Makalelerde ara..."
                    className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:border-indigo-500 text-slate-800 dark:text-white font-sans"
                  />
                </div>

                {/* Categories */}
                <div className="flex flex-wrap items-center gap-1.5 scrollbar-none shrink-0">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                      selectedCategory === null
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-750"
                    }`}
                  >
                    HEPSİ
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                        selectedCategory === cat
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-805 text-slate-600 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-755"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid block of posts */}
              {filteredPosts.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400">
                  <p className="text-xs font-bold uppercase tracking-wider">Arama kriterlerinize uyan hiçbir makale bulunamadı.</p>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {filteredPosts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => onSelectPost(post.id)}
                      className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-5 hover:border-indigo-400 dark:hover:border-indigo-805 hover:shadow-md transition duration-300 cursor-pointer flex flex-col justify-between"
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-1 rounded-md text-[9px] font-black tracking-wider uppercase ${post.tagColor}`}>
                            {post.category}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {post.readTime}
                          </span>
                        </div>
                        <h3 className="text-base font-black text-[#111] dark:text-white leading-snug hover:text-indigo-600 dark:hover:text-indigo-450 transition">
                          {post.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
                          {post.introduction}
                        </p>
                      </div>

                      <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between text-slate-400 text-[10.5px] font-bold">
                        <span className="flex items-center gap-1 font-mono text-[9px]">
                          👤 Bütçem Pro Akademi
                        </span>
                        <span className="text-indigo-600 font-black tracking-wider uppercase flex items-center gap-0.5 group">
                          Okumaya Başla <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="post-detail"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 sm:p-10 space-y-8"
            >
              {/* Back to Blog Button */}
              <button
                onClick={() => onSelectPost(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-805 hover:bg-slate-200 dark:hover:bg-slate-750 rounded-xl text-xs font-black text-slate-700 dark:text-slate-350 transition cursor-pointer select-none active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kılavuz Listesine Dön</span>
              </button>

              {currentPost && (
                <article className="space-y-6">
                  {/* Article Meta */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-md text-[9.5px] font-black tracking-wider uppercase ${currentPost.tagColor}`}>
                        {currentPost.category}
                      </span>
                      <span className="text-xs text-slate-400 font-extrabold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" /> {currentPost.readTime}
                      </span>
                      <span className="text-xs text-slate-400 font-extrabold flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Haziran 2026
                      </span>
                    </div>

                    <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">
                      {currentPost.title}
                    </h1>
                  </div>

                  {/* Rich Intro Block */}
                  <div className="p-5 bg-gradient-to-r from-indigo-50/20 via-slate-50/50 to-transparent dark:from-indigo-950/10 dark:via-transparent rounded-2xl border-l-[4px] border-indigo-500 dark:border-indigo-600 font-medium text-xs text-slate-600 dark:text-slate-350 leading-relaxed">
                    {currentPost.introduction}
                  </div>

                  {/* Tip cards / Subtitle Sections */}
                  <div className="space-y-5 pt-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">AKADEMİK EYLEM PLANLARI</h3>
                    {currentPost.tips.map((tip, index) => (
                      <div 
                        key={index}
                        className="p-5 bg-slate-50/60 dark:bg-slate-950/40 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-2.5"
                      >
                        <h4 className="font-extrabold text-sm text-[#111] dark:text-white flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[10.5px] font-black shrink-0">{index + 1}</span>
                          <span>{tip.title}</span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                          {tip.desc}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Conclusion */}
                  <div className="p-5 bg-gradient-to-tr from-emerald-500/[0.03] to-indigo-500/[0.03] dark:from-emerald-950/10 dark:to-transparent rounded-2xl border border-dashed border-emerald-500/20 dark:border-emerald-500/30 space-y-2">
                    <h4 className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 animate-pulse" /> ÖZET VE EYLEM PLANI REHBERİ
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                      {currentPost.conclusion}
                    </p>
                  </div>

                  {/* Actions & Sharing Footer */}
                  <div className="pt-6 border-t border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                      onClick={() => handleShare(currentPost.title)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-350 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95"
                    >
                      <Share2 className="w-4 h-4 text-emerald-500" />
                      <span>{hasShared ? "Bağlantı Kopyalandı! ✓" : "Sayfa Linkini Paylaş"}</span>
                    </button>

                    <button
                      onClick={onStartApp}
                      className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition cursor-pointer select-none active:scale-97 flex items-center justify-center gap-1.5"
                    >
                      <span>Bütçemi Yönetmeye Başla ➔</span>
                    </button>
                  </div>
                </article>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
