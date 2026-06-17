import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Sparkles, TrendingUp, Coins, Calendar, ArrowRight, ShieldCheck, 
  HelpCircle, MessageSquare, Star, Zap, ChevronDown, Check, Play,
  BookOpen, Users, Compass, DollarSign, Wallet
} from "lucide-react";

interface PublicLandingProps {
  onStartApp: () => void;
  onNavigateToBlog: () => void;
  onNavigateToPost: (id: string) => void;
}

export const PublicLanding: React.FC<PublicLandingProps> = ({ 
  onStartApp, 
  onNavigateToBlog,
  onNavigateToPost
}) => {
  // Calculator widget state
  const [calcIncome, setCalcIncome] = useState<string>("25000");
  const [calcRent, setCalcRent] = useState<string>("10000");
  const [calcBills, setCalcBills] = useState<string>("3000");
  const [calcFood, setCalcFood] = useState<string>("4000");
  
  // FAQ Accordion State
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Compute stats for calculator widget
  const incomeVal = parseFloat(calcIncome) || 0;
  const rentVal = parseFloat(calcRent) || 0;
  const billsVal = parseFloat(calcBills) || 0;
  const foodVal = parseFloat(calcFood) || 0;
  
  const totalEssentials = rentVal + billsVal + foodVal;
  const remainingCash = incomeVal - totalEssentials;
  const essentialPct = incomeVal > 0 ? (totalEssentials / incomeVal) * 100 : 0;
  
  let scoreText = "";
  let scoreColor = "";
  if (incomeVal === 0) {
    scoreText = "Lütfen aylık gelirinizi girin.";
    scoreColor = "text-slate-400";
  } else if (essentialPct > 80) {
    scoreText = "🚨 Kritik Durum: Gelirinizin %80'den fazlası temel ihtiyaçlara gidiyor. Acil tasarruf tasarımı yapmalı ve taksit yükünü azaltmalısınız!";
    scoreColor = "text-rose-500 dark:text-rose-400";
  } else if (essentialPct > 51) {
    scoreText = "⚠️ Bütçe Sınırı: Temel gidenler %50 ideal sınırının üzerinde. Kişisel harcamalarınızı (lüks abonelikler, dışarıda yemek) dengeleyin.";
    scoreColor = "text-amber-500";
  } else {
    scoreText = "🟢 Mükemmel Dengeli: 50/30/20 bütçe disiplinine tam uyuyorsunuz! Kalan tutarı birikim ve yatırımlara rahatça yönlendirebilirsiniz.";
    scoreColor = "text-emerald-500";
  }

  const faqItems = [
    {
      q: "Bütçem nedir ve finansal durumumu nasıl iyileştirir?",
      a: "Bütçem, gelirlerinizi, giderlerinizi, borçlarınızı ve düzenli taksitlerinizi tek bir çatı altında takip etmenizi sağlayan bütüncül bir kişisel finans yönetim uygulamasıdır. Gelişmiş limit uyarıları, yapay zeka destekli bütçe analiz raporları ve akıllı borç ödeme planları ile paranızı nerede harcadığınızı kolayca görür, birikim oranınızı artırırsınız."
    },
    {
      q: "Uygulamayı kullanmak için kayıt veya şifre zorunlu mu? Verilerim nerede saklanıyor?",
      a: "Kesinlikle zorunlu değildir! Bütçem çevrimdışı öncelikli (offline-first) bir felsefeyle çalışır. Verileriniz tamamen cihazınızın güvenli yerel tarayıcı belleğinde (localStorage) saklanır ve hiçbir sunucuya izniniz olmaksızın aktarılmaz. Dilerseniz güvenli e-posta veya Google bulut giriş seçeneklerini aktif ederek, verilerinizi bulutta da yedekleyebilirsiniz."
    },
    {
      q: "Kartopu (Snowball) ve Çığ (Avalanche) borç ödeme yöntemleri nedir?",
      a: "İki temel borç kapatma stratejisidir. Kartopu yöntemi en düşük tutarlı borca odaklanıp hızlı başarılarla psikolojik motivasyon kazanmanızı sağlar. Çığ yöntemi ise faiz oranı en yüksek borcu önceleyerek matematiksel olarak ödeyeceğiniz toplam faizi azaltır. Uygulama içerisinden borç listenizi girerek ikisinden birini seçip bütçenizi optimize edebilirsiniz."
    },
    {
      q: "Yapay Zeka Destekli Aylık Analiz Raporu nasıl çalışır?",
      a: "Aktif bulunduğunuz aya ait tüm harcamaları, gelirleri ve taksit oranlarını yapay zeka analiz motoruna göndererek tek tuşla detaylı bir tasarruf raporu alabilirsiniz. Yapay zeka bütçenizi en çok sarsan kategoriyi tespit eder, 15% tasarruf yaptığınızda cebinizde kalacak net kazancı hesaplar ve o kategoriye özel akıllı tasarruf ipuçları üretir."
    },
    {
      q: "Premium sürümün avantajları nelerdir ve ek ücret gerekir mi?",
      a: "Temel kişisel bütçe yönetimi tamamen ücretsiz ve reklamsızdır! Premium yükseltmesi ile yapay zekalı asistanla sınırsız bütçe analizi, döviz kurlarının merkez bankasından otomatik çekilmesi, sınırsız döviz kur çevirici, limitsiz taksit ömür boyu planlaması, gelişmiş yedekleme ve sıfır sponsorlu reklam deneyimine sahip olursunuz."
    }
  ];

  const featuredBlogs = [
    {
      id: "snowball-avalanche",
      title: "Kartopu vs Çığ Metodu: Hangi Borç Kapatma Stratejisi Sizin İçin Uygun?",
      excerpt: "Borçlarınızı bitirmenin matematiksel ve psikolojik yollarını karşılaştırın...",
      category: "Borç Stratejisi",
      icon: "🎯"
    },
    {
      id: "budgeting-rules",
      title: "50/30/20 Bütçeleme Kuralı ile Maaşınızı Profesyonelce Yönetin",
      excerpt: "Zorlanmadan her ay gelirinizin %20'sini birikime ayırma formülü...",
      category: "Kişisel Bütçe",
      icon: "📊"
    },
    {
      id: "credit-score",
      title: "Kredi Notu Nedir? Kısa Sürede 1500+ Seviyesine Çıkarmanın Yolları",
      excerpt: "Bankaların gözünde finansal güvenilirliğinizi hızla artıracak gizli taktikler...",
      category: "Kredi Yönetimi",
      icon: "📈"
    }
  ];

  return (
    <div className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-300">
      
      {/* 1. Hero Section - Stunning SaaS Visuals & Clean Framing */}
      <section className="relative pt-12 pb-20 md:py-32 overflow-hidden border-b border-slate-200/60 dark:border-slate-900/60">
        {/* Lights backdrops */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none">
          <div className="absolute top-12 left-10 w-72 h-72 rounded-full bg-indigo-500/10 blur-[120px] dark:bg-indigo-600/5" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-emerald-500/10 blur-[150px] dark:bg-emerald-600/5 animate-pulse" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-black tracking-widest uppercase rounded-full shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin duration-[4000ms]" />
            <span>YENİ NESİL KİŞİSEL FİNANS MOTORU</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white max-w-3xl mx-auto leading-tight"
          >
            Bütçenizi Kontrol Edin, <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 dark:from-indigo-400 dark:via-purple-400 dark:to-emerald-400 bg-clip-text text-transparent">Geleceğinizi Güvenceye</span> Alın!
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-sm sm:text-lg text-slate-500 dark:text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed"
          >
            Bütçem ile gelir-gider dengenizi hesaplayın, birikim hedefleri oluşturun ve borçlarınızı bilimsel stratejilerle (Kartopu ve Çığ metodları) eritin. Yapay zeka bütçenizi analiz etsin!
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <button
              onClick={onStartApp}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:via-purple-750 hover:to-indigo-850 text-white rounded-2xl shadow-xl hover:shadow-indigo-500/20 font-black text-xs uppercase tracking-widest transition duration-300 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 select-none"
            >
              <span>BÜTÇEMİ YÖNETMEYE BAŞLA</span>
              <Play className="w-3.5 h-3.5 fill-white" />
            </button>
            <button
              onClick={onNavigateToBlog}
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest transition duration-300 cursor-pointer flex items-center justify-center gap-2 select-none"
            >
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <span>FİNANSAL REHBERLER / BLOG</span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* 2. Public Micro Bütçe Hesaplama Simülatörü Widget */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-120px" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="py-12 bg-white dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-2 mb-8">
            <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">İNTERAKTİF DENEYİM</h3>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-850 dark:text-white tracking-tight">Anlık Bütçe Sağlığı Simülatörü</h2>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider">Harcama dengenizi 50/30/20 kuralına göre anında puanlayın</p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800/70 shadow-sm grid md:grid-cols-2 gap-8 items-center">
            {/* Input Segment */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">AYLIK TL GELİRİNİZ</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-indigo-500 font-black text-xs">₺</span>
                  </div>
                  <input 
                    type="number"
                    value={calcIncome}
                    onChange={(e) => setCalcIncome(e.target.value)}
                    placeholder="Gelir miktarı"
                    className="w-full pl-8 pr-4 py-2 text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">EV KİRASI / KONUT SÖZLEŞMESİ</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-slate-400 font-black text-xs">₺</span>
                  </div>
                  <input 
                    type="number"
                    value={calcRent}
                    onChange={(e) => setCalcRent(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">AYLIK TOPLAM FATURALAR</label>
                  <input 
                    type="number"
                    value={calcBills}
                    onChange={(e) => setCalcBills(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">AYLIK MUTFAK HARCAMASI</label>
                  <input 
                    type="number"
                    value={calcFood}
                    onChange={(e) => setCalcFood(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Visualizer Segment */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/40 dark:border-slate-800/40 text-center space-y-4 shadow-3xs">
              <div className="space-y-1">
                <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest">TEMEL GİDER ORANI (%50 İdeal Derece)</span>
                <div className="text-3xl font-black text-slate-800 dark:text-white font-mono">
                  {essentialPct.toFixed(0)}%
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      essentialPct > 80 ? "bg-rose-500" : essentialPct > 50 ? "bg-amber-400" : "bg-emerald-400"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(3, essentialPct))}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-left">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-100 dark:border-slate-850 rounded-xl text-center">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">TOPLAM ALTYAPI GİDER</span>
                  <span className="font-bold text-xs">₺{totalEssentials.toLocaleString("tr-TR")}</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-100 dark:border-slate-850 rounded-xl text-center">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">KALAN BİRİKİM LİMİTİ</span>
                  <span className="font-bold text-xs text-emerald-500">₺{remainingCash.toLocaleString("tr-TR")}</span>
                </div>
              </div>

              <div className={`p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800 rounded-xl text-xs font-bold leading-relaxed text-left ${scoreColor}`}>
                {scoreText}
              </div>

              <button
                onClick={onStartApp}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-widest rounded-xl transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-97"
              >
                <span>Hepsini Uygulamada Takip Et</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 3. Marketing features/USP list - Core Product Benefits */}
      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
        className="py-16 md:py-24 max-w-6xl mx-auto px-4 sm:px-6 space-y-12"
      >
        <div className="text-center space-y-2">
          <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">TEKNOLOJİK ÖZELLİKLER</h3>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Neden Bütçem?</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-lg mx-auto">Sistemimiz sıradan gider listelerinin ötesinde, yapay zekalı asistanlığı mobil estetikle birleştirir.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 border-b-4 border-b-indigo-500 space-y-4 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shadow-inner">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-850 dark:text-white uppercase tracking-tight">Yapay Zeka Raporları</h4>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                Tek tuşla seçtiğiniz aya ait harcama grafiklerini inceler, bütçe sızıntılarını saptar ve bizzat yapay zeka tarafından hazırlanan tasarruf analiz raporunu sunar.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 border-b-4 border-b-purple-500 space-y-4 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center shadow-inner">
                <Coins className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-850 dark:text-white uppercase tracking-tight">Bilimsel Borç Erime</h4>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                Kartopu (Snowball) ve Çığ (Avalanche) metotları sayesinde borçlarınızı rasyonel sırayla ödersiniz. Faiz maliyetinizi sıfıra indirmek hiç bu kadar kolay olmamıştı.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 border-b-4 border-b-emerald-500 space-y-4 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shadow-inner">
                <Calendar className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-850 dark:text-white uppercase tracking-tight">Akıllı Taksit Takvimi</h4>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                Gelecek dönem harcamalarınızı, kredi taksitlerinizi ve faturalarınızı önceden rezerv edip vadesi geldiğinde push alarmları ile pürüzsüzce takip edin.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 border-b-4 border-b-amber-500 space-y-4 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shadow-inner">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-850 dark:text-white uppercase tracking-tight">Kişi Borç Defteri</h4>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                Arkadaşlarınıza verdiğiniz veya aldığınız borçları kişiler listenizde tutun. WhatsApp hatırlatma şablonu özelliğini kullanarak nazikçe vade hatırlatın.
              </p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* 4. Public Finance Blogs Preview - SEO Optimization */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="py-16 bg-slate-100 dark:bg-slate-900/60 border-t border-b border-slate-200/55 dark:border-slate-855"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-left space-y-1">
              <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">AKADEMİK İÇERİKLER</h3>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Finansal Başarı Rehberleri</h2>
              <p className="text-xs text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider">Arama motorlarında en çok aranan rasyonel kişisel finans metotları</p>
            </div>
            <button
              onClick={onNavigateToBlog}
              className="px-5 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl text-[11px] font-black uppercase tracking-wider text-indigo-600 shrink-0 transition cursor-pointer select-none"
            >
              Tüm Makaleleri Oku ➔
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {featuredBlogs.map((b, index) => (
              <motion.div 
                key={b.id} 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.15 }}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/40 dark:border-slate-800 shadow-3xs flex flex-col justify-between hover:border-indigo-400 dark:hover:border-indigo-800 hover:shadow-sm transition duration-300 cursor-pointer"
                onClick={() => onNavigateToPost(b.id)}
              >
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100/30 px-2.5 py-1 rounded-md uppercase tracking-wider inline-block">
                    {b.category}
                  </span>
                  <h4 className="font-extrabold text-[#111] dark:text-white text-sm line-clamp-2 leading-relaxed">
                    {b.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {b.excerpt}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToPost(b.id);
                  }}
                  className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-[10.5px] font-extrabold text-indigo-600 hover:text-indigo-700 hover:underline transition text-left flex items-center gap-1 cursor-pointer"
                >
                  <span>Mali Planı Keşfet {b.icon}</span>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 5. Pricing table - Freemium model details */}
      <motion.section 
        initial={{ opacity: 0, y: 45 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7 }}
        className="py-16 max-w-4xl mx-auto px-4 sm:px-6 space-y-12"
      >
        <div className="text-center space-y-2">
          <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">ÜYELİK PAKETLERİ</h3>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Kendinize En Uygun Planı Seçin</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Standard Free Plan */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center flex flex-col justify-between space-y-6 relative overflow-hidden shadow-xs hover:border-slate-350 dark:hover:border-slate-750 transition duration-300"
          >
            <div className="space-y-3">
              <span className="text-[10px] font-black tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-300 px-3 py-1 rounded-full uppercase">YEREL KONTROL</span>
              <h4 className="text-xl font-black">Standart Sürüm</h4>
              <div className="text-3xl font-black font-mono">₺0 <span className="text-xs font-semibold text-slate-400">/ ÖMÜR BOYU</span></div>
              <p className="text-xs text-slate-500">Temel borç ve gelir-gider verilerini manuel takip etmek isteyen kullanıcılar için ideal başlangıç.</p>
              
              <ul className="text-left text-xs font-semibold text-slate-600 dark:text-slate-400 space-y-2 pt-4">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Sınırsız Gelir, Gider ve Bütçe Takibi</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Kartopu ve Çığ Stratejisi ile Borç Yönetimi</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Cihazda Güvenli Yerel Depolama (AES Şifreli)</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Temel Finansal Hesaplama Araçları</li>
              </ul>
            </div>

            <button
              onClick={onStartApp}
              className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-white font-black text-xs uppercase tracking-widest rounded-xl transition cursor-pointer"
            >
              Ücretsiz Kullan
            </button>
          </motion.div>

          {/* Premium Ultimate Plan */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="p-6 bg-white dark:bg-slate-900 rounded-3xl border-2 border-indigo-500 dark:border-indigo-600 text-center flex flex-col justify-between space-y-6 relative overflow-hidden shadow-md"
          >
            {/* Top popular badge */}
            <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[8.5px] font-black tracking-widest uppercase py-1 px-4 rounded-bl-xl">POPÜLER 👑</div>

            <div className="space-y-3">
              <span className="text-[10px] font-black tracking-widest bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full uppercase">AKILLI ASİSTAN</span>
              <h4 className="text-xl font-black">Ultimate Ultra Pro</h4>
              <div className="text-3xl font-black font-mono text-indigo-600 dark:text-indigo-400">₺299 <span className="text-xs font-semibold text-slate-400">/ TEK SEFER</span></div>
              <p className="text-xs text-slate-500">Limitsiz yapay zeka analiz raporları, otomatik döviz kurları, güvenli e-posta bulut yedekleme ve sıfır reklam garantisi.</p>
              
              <ul className="text-left text-xs font-semibold text-slate-600 dark:text-slate-400 space-y-2 pt-4">
                <li className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400"><Check className="w-4 h-4 text-indigo-500 shrink-0" /> ★ Sınırsız Yapay Zeka Finans Analizleri</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Akıllı Sesli Asistan ile Saniyeler İçi Kayıt</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> TCMB Otomatik Döviz Kur Güncellemesi</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> E-posta ile Çoklu Cihaz Bulut Eşitleme</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Sınırsız Kişi &amp; Taksitli Borç Planlayıcı</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> Reklamları Ömür Boyu Kaldırma</li>
              </ul>
            </div>

            <button
              onClick={onStartApp}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition shadow-lg shadow-indigo-500/20 cursor-pointer animate-pulse"
            >
              Hemen Premium Ol 💎
            </button>
          </motion.div>
        </div>
      </motion.section>

      {/* 6. Comprehensive Accordion FAQ - Crawleable High Quality Content */}
      <motion.section 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-120px" }}
        transition={{ duration: 0.6 }}
        className="py-16 bg-slate-50 dark:bg-slate-950 border-t border-slate-200/50 dark:border-slate-900/60"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center justify-center gap-1.5"><HelpCircle className="w-4 h-4 animate-bounce" /> MERAK EDİLENLER</h3>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Sıkça Sorulan Sorular (S.S.S)</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Kişisel finans bütçe optimizasyonuyla ilgili yanıtlarımız</p>
          </div>

          <div className="space-y-4 pt-4">
            {faqItems.map((item, index) => {
              const isOpen = activeFaq === index;
              return (
                <div 
                  key={index} 
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-3xs overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left text-xs font-extrabold text-slate-850 dark:text-slate-100 cursor-pointer focus:outline-hidden"
                  >
                    <span className="leading-relaxed">{item.q}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold border-t border-slate-50 dark:border-slate-950/40">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* Footer Branding Area */}
      <footer className="py-12 bg-slate-900 text-slate-400 border-t border-slate-800 text-center text-xs space-y-3">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-2">
          <h4 className="text-white font-black tracking-widest text-sm uppercase">💰 BÜTÇEM</h4>
          <p className="text-[11px] font-semibold text-slate-500 leading-relaxed max-w-md mx-auto">
            Harcama alışkanlıklarınızı dönüştürün, borçlarınızı bilimsel olarak yönetin ve finansal bağımsızlığın tadını çıkarın. %100 güvenli, yerel öncelikli bütçeleme platformu.
          </p>
        </div>
        <div className="pt-6 border-t border-slate-800 text-[10px] font-bold text-slate-500 tracking-wider">
          © 2026 BÜTÇEM • TÜM HAKLARI SAKLIDIR.
        </div>
      </footer>
    </div>
  );
};
