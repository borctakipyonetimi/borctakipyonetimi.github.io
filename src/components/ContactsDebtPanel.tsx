/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Plus,
  Trash2,
  Phone,
  Search,
  Tag,
  Calendar,
  Check,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Clock,
  Briefcase,
  User,
  Heart,
  Store,
  DollarSign,
  AlertCircle,
  TrendingUpDown,
  BookOpen,
  Edit,
  Bell,
  BellRing
} from "lucide-react";

import { t } from "../utils/translations";

interface Contact {
  id: string;
  name: string;
  phone: string;
  category: "friend" | "family" | "work" | "other";
  avatarColor: string;
  createdAt: string;
}

interface ContactTransaction {
  id: string;
  contactId: string;
  type: "receivable" | "payable"; // receivable: Alacak (they owe us), payable: Verecek (we owe them)
  amount: number;
  description: string;
  dueDate: string;
  isPaid: boolean;
  createdAt: string;
}

interface ContactsDebtPanelProps {
  currentUser: string | null;
  format: (amount: number) => string;
  triggerToast?: (msg: string) => void;
  onAddAlarm?: (titleString: string, dateString: string) => void;
  language?: "tr" | "en";
  isPremium?: boolean;
  onUpgradeClick?: () => void;
}

export const ContactsDebtPanel: React.FC<ContactsDebtPanelProps> = ({
  currentUser,
  format,
  triggerToast,
  onAddAlarm,
  language = "tr",
  isPremium = false,
  onUpgradeClick
}) => {
  const translate = (txt: string) => t(txt, language as "tr" | "en");
  const spaceKey = currentUser ? `user_${currentUser}` : "user_anonymous";

  // State Management
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<ContactTransaction[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Custom Delete and Edit states
  const [contactToDeleteId, setContactToDeleteId] = useState<string | null>(null);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCategory, setEditCategory] = useState<Contact["category"]>("friend");

  // Simulated picker States
  const [isSimulatedPickerOpen, setIsSimulatedPickerOpen] = useState(false);
  const [simulatedSearchText, setSimulatedSearchText] = useState("");
  const [simulatedDeviceContacts, setSimulatedDeviceContacts] = useState<Array<{ name: string; phone: string; category: Contact["category"] }>>([]);

  // Reminder / Alarm States
  const [reminderTx, setReminderTx] = useState<ContactTransaction | null>(null);
  const [reminderOption, setReminderOption] = useState<"on_date" | "day_before" | "custom">("day_before");
  const [customReminderDate, setCustomReminderDate] = useState("");
  const [customReminderTime, setCustomReminderTime] = useState("09:00");

  const showLocalToast = (msg: string) => {
    if (triggerToast) {
      triggerToast(msg);
    } else {
      alert(msg);
    }
  };

  const handleSetReminderSubmit = () => {
    if (!onAddAlarm || !reminderTx) return;

    const contact = contacts.find((c) => c.id === reminderTx.contactId);
    const contactName = contact ? contact.name : "Rehber Kişisi";

    let alarmDateStr = "";
    const dueDateStr = reminderTx.dueDate; // YYYY-MM-DD

    if (reminderOption === "on_date") {
      alarmDateStr = `${dueDateStr}T09:00`;
    } else if (reminderOption === "day_before") {
      try {
        const d = new Date(dueDateStr);
        d.setDate(d.getDate() - 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        alarmDateStr = `${year}-${month}-${day}T09:00`;
      } catch {
        alarmDateStr = `${dueDateStr}T09:00`;
      }
    } else {
      alarmDateStr = `${customReminderDate}T${customReminderTime || "09:00"}`;
    }

    onAddAlarm(
      `${contactName} İçin Ödeme Vadesi: ${reminderTx.description} (${format(reminderTx.amount)})`,
      alarmDateStr
    );

    setReminderTx(null);
    showLocalToast("Ödeme Hatırlatıcısı Başarıyla Kuruldu ⏰");
  };

  // Create Contact Form States
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactCategory, setNewContactCategory] = useState<Contact["category"]>("friend");
  const [isAddingContact, setIsAddingContact] = useState(false);

  // Create Transaction Form States
  const [newTxAmount, setNewTxAmount] = useState("");
  const [newTxType, setNewTxType] = useState<"receivable" | "payable">("receivable");
  const [newTxDesc, setNewTxDesc] = useState("");
  const [newTxDueDate, setNewTxDueDate] = useState(() => {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]; // default in +7 days
  });
  const [isAddingTx, setIsAddingTx] = useState(false);

  // Load Data
  useEffect(() => {
    const savedContacts = localStorage.getItem(`${spaceKey}_contacts_directory`);
    const savedTxs = localStorage.getItem(`${spaceKey}_contacts_transactions`);
    const savedVcfDevice = localStorage.getItem(`${spaceKey}_parsed_vcf_device_contacts`);

    if (savedContacts) {
      setContacts(JSON.parse(savedContacts));
    } else {
      setContacts([]);
      localStorage.setItem(`${spaceKey}_contacts_directory`, JSON.stringify([]));
    }

    if (savedTxs) {
      setTransactions(JSON.parse(savedTxs));
    } else {
      setTransactions([]);
      localStorage.setItem(`${spaceKey}_contacts_transactions`, JSON.stringify([]));
    }

    if (savedVcfDevice) {
      try {
        setSimulatedDeviceContacts(JSON.parse(savedVcfDevice));
      } catch (e) {
        setSimulatedDeviceContacts([]);
      }
    } else {
      setSimulatedDeviceContacts([]);
    }
  }, [spaceKey]);

  // Persists
  const saveContactsData = (newConts: Contact[]) => {
    setContacts(newConts);
    localStorage.setItem(`${spaceKey}_contacts_directory`, JSON.stringify(newConts));
  };

  const saveTxsData = (newTxs: ContactTransaction[]) => {
    setTransactions(newTxs);
    localStorage.setItem(`${spaceKey}_contacts_transactions`, JSON.stringify(newTxs));
  };

  // Add Contact Handler
  const handleAddContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim()) return;

    const gradients = [
      "from-emerald-500 to-teal-600",
      "from-indigo-500 to-indigo-700",
      "from-amber-500 to-orange-600",
      "from-pink-500 to-rose-600",
      "from-sky-500 to-blue-700",
      "from-purple-500 to-fuchsia-700"
    ];
    const randomGrad = gradients[Math.floor(Math.random() * gradients.length)];

    const added: Contact = {
      id: "cont_" + Date.now(),
      name: newContactName.trim(),
      phone: newContactPhone.trim() || "Belirtilmemiş 📞",
      category: newContactCategory,
      avatarColor: randomGrad,
      createdAt: new Date().toISOString()
    };

    const updated = [added, ...contacts];
    saveContactsData(updated);
    setIsAddingContact(false);
    setNewContactName("");
    setNewContactPhone("");
  };

  const handleSelectFromDeviceContacts = async () => {
    if (typeof window !== "undefined" && "contacts" in navigator && "select" in (navigator as any).contacts) {
      try {
        const props = ["name", "tel"];
        const opts = { multiple: false };
        const contactsSelected = await (navigator as any).contacts.select(props, opts);
        if (contactsSelected && contactsSelected.length > 0) {
          const deviceContact = contactsSelected[0];
          const selectedName = deviceContact.name?.[0] || "";
          const selectedPhone = deviceContact.tel?.[0] || "";
          if (selectedName) {
            importContactToForm(selectedName, selectedPhone);
            showLocalToast("Kişi bilgileri akıllı rehberden çekildi! 📱");
            return;
          }
        }
      } catch (err) {
        console.warn("Native Contacts Select API canceled or errored", err);
      }
    }
    // Open high fidelity address book mockup popup
    setIsSimulatedPickerOpen(true);
  };

  const handleVcfImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const vcardRegex = /BEGIN:VCARD[\s\S]*?END:VCARD/ig;
        const cards = text.match(vcardRegex) || [];

        if (cards.length === 0) {
          showLocalToast("Geçerli bir rehber yedek dosyası (.vcf) bulunamadı! ⚠️");
          return;
        }

        const parsedContacts: Array<{ name: string; phone: string; category: "friend" | "family" | "work" | "other" }> = [];

        cards.forEach((card: string) => {
          let name = "";
          const fnMatch = card.match(/FN(?:;[^:]*)?:(.*)/i);
          if (fnMatch && fnMatch[1]) {
            name = fnMatch[1].trim();
          } else {
            const nMatch = card.match(/N(?:;[^:]*)?:([^;]+);([^;\r\n]+)?/i);
            if (nMatch) {
              const lastName = nMatch[1] ? nMatch[1].trim() : "";
              const firstName = nMatch[2] ? nMatch[2].trim() : "";
              name = `${firstName} ${lastName}`.trim();
            }
          }

          let tel = "";
          const telMatch = card.match(/TEL(?:;[^:]*)?:([^;\r\n]+)/i);
          if (telMatch && telMatch[1]) {
            tel = telMatch[1].trim();
          }

          name = name.replace(/\\;/g, ";").replace(/\\,/g, ",").replace(/\\/g, "").replace(/\r/g, "");
          
          if (name) {
            parsedContacts.push({
              name,
              phone: tel ? tel.replace(/\r/g, "") : "Belirtilmemiş 📞",
              category: "friend",
            });
          }
        });

        if (parsedContacts.length > 0) {
          setSimulatedDeviceContacts(parsedContacts);
          localStorage.setItem(`${spaceKey}_parsed_vcf_device_contacts`, JSON.stringify(parsedContacts));
          showLocalToast(`Rehber yedek dosyanızdan ${parsedContacts.length} kişi başarıyla okundu! Aşağıdaki listeden dilediğiniz kişiyi tek tek 'Hızlı Ekle ➔' seçeneğiyle ekleyebilirsiniz! 📱🎉`);
        } else {
          showLocalToast("Dosyadan kişi ayrıştırılamadı. Geçerli bir .vcf dosyası olduğundan emin olun.");
        }
      } catch (err) {
        console.error("VCF Import error", err);
        showLocalToast("Dosya okunurken bir hata oluştu! ⚠️");
      }
    };
    reader.readAsText(file);
  };

  const importContactToForm = (name: string, phone: string, cat?: "friend" | "family" | "work" | "other") => {
    setNewContactName(name);
    setNewContactPhone(phone || "Belirtilmemiş 📞");
    if (cat) setNewContactCategory(cat);
    setIsAddingContact(true);
  };

  const handleSimulatedSelect = (simulated: { name: string; phone: string; category: Contact["category"] }) => {
    const gradients = [
      "from-emerald-500 to-teal-600",
      "from-indigo-500 to-indigo-700",
      "from-amber-500 to-orange-600",
      "from-pink-500 to-rose-600",
      "from-sky-500 to-blue-700",
      "from-purple-500 to-fuchsia-700"
    ];
    const randomGrad = gradients[Math.floor(Math.random() * gradients.length)];

    // Check if duplicate contact already exists
    const isDuplicate = contacts.some(c => c.name.toLowerCase() === simulated.name.toLowerCase());
    if (isDuplicate) {
      showLocalToast(`"${simulated.name}" zaten listenizde kayıtlı! ⚠️`);
      setIsSimulatedPickerOpen(false);
      return;
    }

    const added: Contact = {
      id: "cont_" + Date.now(),
      name: simulated.name,
      phone: simulated.phone,
      category: simulated.category,
      avatarColor: randomGrad,
      createdAt: new Date().toISOString()
    };

    const updated = [added, ...contacts];
    saveContactsData(updated);
    setIsSimulatedPickerOpen(false);
    showLocalToast(`${simulated.name} rehberden başarıyla eklendi! 📱🎉`);
  };

  // Delete Contact Handler
  const handleDeleteContact = (id: string) => {
    setContactToDeleteId(id);
  };

  // Add Transaction Handler
  const handleAddTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !newTxAmount || parseFloat(newTxAmount) <= 0) return;

    const added: ContactTransaction = {
      id: "tx_" + Date.now(),
      contactId: selectedContactId,
      type: newTxType,
      amount: parseFloat(newTxAmount),
      description: newTxDesc.trim() || (newTxType === "receivable" ? "Alacak Alındı / Borç Verildi" : "Borç edinildi / Ödeme Yapılacak"),
      dueDate: newTxDueDate,
      isPaid: false,
      createdAt: new Date().toISOString()
    };

    const updated = [added, ...transactions];
    saveTxsData(updated);
    setIsAddingTx(false);
    setNewTxAmount("");
    setNewTxDesc("");
  };

  // Toggle transaction pay state
  const handleToggleTxPaid = (id: string) => {
    const updated = transactions.map((t) => {
      if (t.id === id) {
        return { ...t, isPaid: !t.isPaid };
      }
      return t;
    });
    saveTxsData(updated);
  };

  // Delete Transaction
  const handleDeleteTx = (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    saveTxsData(updated);
  };

  // Calculate stats
  const activeTxs = transactions.filter((t) => !t.isPaid);

  const totalReceivable = activeTxs
    .filter((t) => t.type === "receivable")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPayable = activeTxs
    .filter((t) => t.type === "payable")
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalReceivable - totalPayable;

  // Filtered contacts list
  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  // Helper for Category Badge Icon
  const getCategoryIcon = (cat: Contact["category"]) => {
    switch (cat) {
      case "friend":
        return <Heart className="w-3.5 h-3.5 text-pink-500" />;
      case "family":
        return <Users className="w-3.5 h-3.5 text-amber-500" />;
      case "work":
        return <Briefcase className="w-3.5 h-3.5 text-indigo-500" />;
      default:
        return <Store className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  // Helper for Category Name
  const getCategoryLabel = (cat: Contact["category"]) => {
    switch (cat) {
      case "friend": return "Arkadaş";
      case "family": return "Aile / Akraba";
      case "work": return "İş / Ortaklık";
      default: return "Diğer / Cari";
    }
  };

  // Get active debt breakdown for specific contact
  const getContactTotals = (cId: string) => {
    const cTxs = transactions.filter((t) => t.contactId === cId && !t.isPaid);
    const recAll = cTxs.filter((t) => t.type === "receivable").reduce((sum, t) => sum + t.amount, 0);
    const payAll = cTxs.filter((t) => t.type === "payable").reduce((sum, t) => sum + t.amount, 0);
    return { receivable: recAll, payable: payAll, net: recAll - payAll };
  };

  // Percentage Calculations for Custom SVG Gauge
  const combinedVolume = totalReceivable + totalPayable;
  const receivablePercentage = combinedVolume > 0 ? (totalReceivable / combinedVolume) * 100 : 50;
  const payablePercentage = combinedVolume > 0 ? (totalPayable / combinedVolume) * 100 : 50;

  // Render SVG Ring Arc
  const strokeDashVal = 314; // circumference for r=50 circle roughly
  const recDashoffset = strokeDashVal - (strokeDashVal * receivablePercentage) / 100;

  return (
    <div className="space-y-6 select-none font-sans">
      {/* Centered & Animated Page Title */}
      <div className="flex flex-col items-center justify-center text-center py-4 select-none">
        <motion.h2
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2.5"
        >
          <Users className="w-7 h-7 text-indigo-500 animate-pulse" /> KİŞİ ALACAK & VERECEK DEFTERİ
        </motion.h2>
        <div className="w-16 h-1 bg-indigo-500 rounded-full mt-2 opacity-80" />
      </div>

      {/* Upper Welcome Header */}
      <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700 shadow-sm flex flex-col items-center text-center space-y-2">
        <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl font-medium leading-relaxed">
          Borç verdiğiniz arkadaşlarınızı, ödeme bekleyen müşterilerinizi veya borçlu olduğunuz akrabalarınızı akıllı rehber ile gruplayın. Her kişi için bağımsız veri geçmişi tutun.
        </p>
      </div>

      {/* NEW SECTION: Contacts Add & List side-by-side at the very top */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left column / Card: Yeni Kişi Ekleme */}
        <div className="space-y-4">
          <div className="p-5 bg-gradient-to-r from-indigo-500/10 via-slate-500/5 to-emerald-500/10 dark:from-indigo-500/15 dark:to-emerald-500/15 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs h-full flex flex-col justify-between">
            <div className="flex flex-col gap-2">
              <div className="space-y-0.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-indigo-500" />
                  YENİ KİŞİ / CARİ HESAP EKLEME
                </h3>
                <p className="text-[10px] text-slate-400 font-bold">Rehber ve manuel form üzerinden hızlıca yeni kişi tanımlayın</p>
              </div>
              
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSelectFromDeviceContacts}
                  type="button"
                  className="flex-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm shadow-emerald-600/15"
                  title="Cihaz rehberinizden ya da hazır listeden hızlıca kişi aktarın"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-200 animate-pulse" /> REHBERDEN SEÇ 📱
                </button>
                <button
                  onClick={() => setIsAddingContact((prev) => !prev)}
                  type="button"
                  className="flex-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm shadow-indigo-600/15"
                >
                  <UserPlus className="w-3.5 h-3.5 text-indigo-200" /> MANUEL 👤
                </button>
              </div>
            </div>

            {/* Inline Add Contact Form */}
            <AnimatePresence>
              {isAddingContact && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-205 dark:border-slate-800 p-3.5 mt-2"
                >
                  <form
                    onSubmit={handleAddContactSubmit}
                    className="space-y-3"
                  >
                    <div className="space-y-1 text-left">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Kişi Adı Soyadı</label>
                      <input
                        required
                        type="text"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        placeholder="Örn: Ahmet Yılmaz"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Giriş Telefon Numarası</label>
                      <input
                        type="tel"
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        placeholder="Örn: 0532 123 4567"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Yakınlık Grubu / Kategori</label>
                      <select
                        value={newContactCategory}
                        onChange={(e) => setNewContactCategory(e.target.value as any)}
                        className="w-full px-2.5 py-2.5 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                      >
                        <option value="friend">Arkadaş</option>
                        <option value="family">Aile / Akraba</option>
                        <option value="work">İş / Ticaret</option>
                        <option value="other">Diğer</option>
                      </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsAddingContact(false)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition cursor-pointer"
                      >
                        VAZGEÇ
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition cursor-pointer shadow-indigo-500/20 shadow-md"
                      >
                        KAYDET 💾
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right column / Card: Kişi Listesi */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dashed border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 shrink-0">
              <Users className="w-4 h-4 text-indigo-500" />
              Kişi Listesi ({contacts.length})
            </h3>
          </div>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rehberde kişi arayın... 🔎"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder:text-slate-500 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          {/* Directory Contact List Items */}
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            {filteredContacts.length === 0 ? (
              <div className="p-6 text-center text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700 font-bold text-xs italic">
                Arama kriterlerine uygun kişi bulunamadı.
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const totals = getContactTotals(contact.id);
                const isSelected = selectedContactId === contact.id;

                return (
                  <motion.div
                    key={contact.id}
                    onClick={() => setSelectedContactId(contact.id)}
                    className={`p-3 bg-white dark:bg-slate-800 rounded-2xl border transition duration-200 cursor-pointer flex flex-col xs:flex-row xs:items-center justify-between gap-3 group active:scale-98 ${
                      isSelected
                        ? "border-indigo-600 ring-2 ring-indigo-500/10 dark:ring-indigo-500/20 shadow-md"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar visually colorful initial letter */}
                      <div className={`w-8.5 h-8.5 rounded-full bg-gradient-to-tr ${contact.avatarColor} text-white flex items-center justify-center font-black text-xs shadow-xs uppercase shrink-0`}>
                        {contact.name.charAt(0)}
                      </div>

                      <div className="min-w-0 leading-tight">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-100 truncate">
                            {contact.name}
                          </h4>
                          <span className="shrink-0 p-0.5 bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-100 dark:border-slate-800">
                            {getCategoryIcon(contact.category)}
                          </span>
                        </div>
                        <p className="text-[9.5px] text-slate-500 dark:text-slate-400 font-mono pt-1 truncate">
                          📞 {contact.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end xs:self-center shrink-0">
                      <div className="text-right leading-none min-w-[70px]">
                        <div className="text-[10px] font-mono leading-tight">
                          {totals.net !== 0 ? (
                            <span className={`font-black ${totals.net > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                              {totals.net > 0 ? "Alacak: " : "Borç: "}{format(Math.abs(totals.net))}
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-300 font-extrabold text-[9px] uppercase tracking-wide">
                              DENGELİ ✔️
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Action Buttons (Edit and Delete) */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContactToEdit(contact);
                            setEditName(contact.name);
                            setEditPhone(contact.phone === "Belirtilmemiş 📞" ? "" : contact.phone);
                            setEditCategory(contact.category);
                          }}
                          className="p-1 px-1.5 rounded-lg bg-indigo-50/80 hover:bg-indigo-150 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-400 transition cursor-pointer flex items-center justify-center text-xs"
                          title="Kişiyi Düzenle 📝"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContactToDeleteId(contact.id);
                          }}
                          className="p-1 px-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 dark:text-rose-400 transition cursor-pointer flex items-center gap-0.5 text-xs"
                          title="Kişiyi Sil 🗑️"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-bold">Sil</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Grid Dashboard Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card: Total Receivables */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider block uppercase">Toplayacağımız Toplam Alacak</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono block">
              {format(totalReceivable)}
            </span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium block">Aktif kişi alacak kayıtlarından</span>
          </div>
          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <TrendingUp className="w-5 h-5 animate-bounce" />
          </div>
        </motion.div>

        {/* Card: Total Payables */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 tracking-wider block uppercase">Ödeyeceğimiz Toplam Borç</span>
            <span className="text-xl font-black text-rose-500 dark:text-rose-400 font-mono block">
              {format(totalPayable)}
            </span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium block">Aktif kişi borç ve taahhütlerden</span>
          </div>
          <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
            <TrendingDown className="w-5 h-5 animate-pulse" />
          </div>
        </motion.div>

        {/* Card: Net Status Balance */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`p-4 rounded-2xl border flex items-center justify-between transition ${
            netBalance >= 0
              ? "bg-emerald-500/[0.04] border-emerald-100 dark:border-emerald-900/30"
              : "bg-rose-500/[0.03] border-rose-100 dark:border-rose-900/20"
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-wider block uppercase">Net Defter Durumu</span>
            <span className={`text-xl font-black font-mono block ${netBalance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {netBalance >= 0 ? "+" : ""}{format(netBalance)}
            </span>
            <span className="text-[9px] text-slate-600 dark:text-slate-300 font-bold block">
              {netBalance >= 0 ? "⚠️ Finansal dengemiz artı hanesinde." : "⚠️ Alacaklardan daha fazla borç mevcut."}
            </span>
          </div>
          <div className={`p-2.5 rounded-xl ${netBalance >= 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}`}>
            <TrendingUpDown className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* Visualization Row: SVG High-End Custom Gauge Chart & Quick Presets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Custom Interactive SVG Semi-Gauge Graph */}
        <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700 flex flex-col items-center justify-center space-y-4">
          <div className="text-center">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
              📊 BORÇ-ALACAK DAHİLİ ORAN DURUMU
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
              Kişilere ait genel sermaye dağıtım dengesi
            </p>
          </div>

          <div className="relative w-44 h-44 flex items-center justify-center">
            {/* SVG Custom High contrast circle */}
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              {/* Back Circle */}
              <circle
                cx="60"
                cy="60"
                r="50"
                className="stroke-rose-500 dark:stroke-rose-950/70"
                strokeWidth="12"
                fill="none"
              />
              {/* Front Circle (Receivable percentage) */}
              <motion.circle
                cx="60"
                cy="60"
                r="50"
                className="stroke-emerald-400"
                strokeWidth="12"
                strokeDasharray={strokeDashVal}
                initial={{ strokeDashoffset: strokeDashVal }}
                animate={{ strokeDashoffset: recDashoffset }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">
                %{receivablePercentage.toFixed(0)}
              </span>
              <span className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400 block tracking-wider">
                Alacak Oranı
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5 pt-1 text-xs font-bold justify-center w-full">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-emerald-400 rounded-full" />
              <span className="text-slate-700 dark:text-slate-300">Alacaklar (%{receivablePercentage.toFixed(0)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-rose-500 rounded-full" />
              <span className="text-slate-700 dark:text-slate-300">Borçlar (%{payablePercentage.toFixed(0)})</span>
            </div>
          </div>
        </div>

        {/* Categories statistics breakdown bar */}
        <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700 flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
              📊 KATEGORİSEL REHBER YAPISI
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
              Kategorilere göre kişi rehber yoğunluğu
            </p>
          </div>

          <div className="space-y-3 flex-1 justify-center flex flex-col">
            {/* Category rows mapped with custom responsive bars */}
            {(["friend", "family", "work", "other"] as const).map((cat) => {
              const contsInCat = contacts.filter((c) => c.category === cat);
              const pct = contacts.length > 0 ? (contsInCat.length / contacts.length) * 100 : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                    <span className="flex items-center gap-1.5 select-none text-[11px]">
                      {getCategoryIcon(cat)} {getCategoryLabel(cat)}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{contsInCat.length} Kişi ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: "easeInOut" }}
                      className={`h-full rounded-full bg-gradient-to-r ${
                        cat === "friend"
                          ? "from-pink-400 to-rose-500"
                          : cat === "family"
                          ? "from-amber-400 to-orange-500"
                          : cat === "work"
                          ? "from-indigo-400 to-indigo-600"
                          : "from-slate-400 to-slate-500"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected contact Ledger History details - Full Width section */}
      <div className="w-full">
        <AnimatePresence mode="wait">
            {selectedContactId ? (() => {
              const contact = contacts.find((c) => c.id === selectedContactId);
              if (!contact) return null;

              const cTxs = transactions.filter((t) => t.contactId === contact.id);
              const activeTxs = cTxs.filter((t) => !t.isPaid);
              const totals = getContactTotals(contact.id);

              return (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700 p-5 space-y-4 shadow-sm"
                >
                  {/* Selected contact profile header visual tag */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${contact.avatarColor} text-white flex items-center justify-center font-black text-sm uppercase shadow-sm`}>
                        {contact.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">MÜŞTERİ CARİ & AMORTİSMAN HESABI</h3>
                        <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          {contact.name}
                          <span className="text-[9px] font-black uppercase bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md border border-indigo-100/20">
                            {getCategoryLabel(contact.category)}
                          </span>
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Edit Contact Button */}
                      <button
                        onClick={() => {
                          setContactToEdit(contact);
                          setEditName(contact.name);
                          setEditPhone(contact.phone === "Belirtilmemiş 📞" ? "" : contact.phone);
                          setEditCategory(contact.category);
                        }}
                        className="p-2 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-150/10 rounded-xl transition active:scale-95 cursor-pointer flex items-center gap-1"
                        title="Bilgileri Düzenle 📝"
                      >
                        <Edit className="w-4 h-4" />
                        <span className="text-[11px] font-black uppercase tracking-wider">Düzenle</span>
                      </button>

                      {/* Delete Contact Button */}
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="p-2 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100/30 rounded-xl transition active:scale-95 cursor-pointer flex items-center gap-1"
                        title="Kişiyi & Defteri Sil ⚠️"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-[11px] font-black uppercase tracking-wider">Sil</span>
                      </button>
                    </div>
                  </div>

                  {/* Contact Debt/Credit totals balance strip */}
                  <div className="grid grid-cols-2 gap-3 pb-1">
                    <div className="p-3 rounded-2xl bg-emerald-500/[0.04] border border-emerald-100/30 dark:border-emerald-900/10">
                      <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase block tracking-wider">Kişiden Alacağımız Var</span>
                      <span className="text-sm font-extrabold text-emerald-500 font-mono block mt-1">
                        {format(totals.receivable)}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-rose-500/[0.03] border border-rose-100/30 dark:border-rose-900/10">
                      <span className="text-[8px] font-black text-rose-500 dark:text-rose-400 uppercase block tracking-wider">Kişiye Borcumuz Var</span>
                      <span className="text-sm font-extrabold text-rose-500 font-mono block mt-1">
                        {format(totals.payable)}
                      </span>
                    </div>
                  </div>

                  {/* Transaction add portal trigger line */}
                  <div className="flex items-center justify-between pt-1">
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      📜 ALIŞVERİŞ VE BORÇ GEÇMİŞİ LİSTESİ ({cTxs.length})
                    </h3>
                    <button
                      onClick={() => setIsAddingTx((prev) => !prev)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Borç/Alacak Ekle
                    </button>
                  </div>

                  {/* Transaction additions form */}
                  <AnimatePresence>
                    {isAddingTx && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <form
                          onSubmit={handleAddTxSubmit}
                          className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3"
                        >
                          <span className="text-[9.5px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 block">➕ İŞLEM / FİŞ EKLEME FORMU</span>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">İşlem Yönü</label>
                              <select
                                value={newTxType}
                                onChange={(e) => setNewTxType(e.target.value as any)}
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                              >
                                <option value="receivable">Alacak Senedi (Ona Borç Verdim)</option>
                                <option value="payable">Borç Taahhüdü (Ondan Borç Aldım)</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Toplam Tutar</label>
                              <div className="relative">
                                <input
                                  required
                                  type="number"
                                  step="any"
                                  min="0.1"
                                  value={newTxAmount}
                                  onChange={(e) => setNewTxAmount(e.target.value)}
                                  placeholder="0.00"
                                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold font-mono"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Açıklama / Detay</label>
                              <input
                                type="text"
                                value={newTxDesc}
                                onChange={(e) => setNewTxDesc(e.target.value)}
                                placeholder="Örn: Yemek parası, Ortak gider vb."
                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Ödeme Vadesi</label>
                              <input
                                type="date"
                                value={newTxDueDate}
                                onChange={(e) => setNewTxDueDate(e.target.value)}
                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold font-mono"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1.5">
                            <button
                              type="button"
                              onClick={() => setIsAddingTx(false)}
                              className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition"
                            >
                              VAZGEÇ
                            </button>
                            <button
                              type="submit"
                              className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition"
                            >
                              ONAYLA VE EKLE
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Ledger transactions list container */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {cTxs.length === 0 ? (
                      <div className="text-center py-8 bg-slate-550/5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-1.5 p-4">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300 italic">Kişiye ait alışveriş ve finansal kayıt bulunmuyor.</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">Yukarıdaki butona tıklayarak hemen alacak veya borç kaydı ekleyin.</p>
                      </div>
                    ) : (
                      cTxs.map((tx) => {
                        return (
                          <div
                            key={tx.id}
                            className={`p-3 dark:bg-slate-900 rounded-2xl border transition duration-200 relative overflow-hidden flex items-center justify-between ${
                              tx.isPaid
                                ? "bg-slate-50/75 border-slate-200/50 dark:border-slate-950 dark:opacity-60"
                                : tx.type === "receivable"
                                ? "bg-emerald-500/[0.02] border-emerald-200 dark:border-emerald-900/30"
                                : "bg-rose-500/[0.02] border-rose-200 dark:border-rose-900/20"
                            }`}
                          >
                            <div className="flex gap-2 min-w-0 flex-1 pr-2">
                              {/* Paid Status indicator box */}
                              <button
                                onClick={() => handleToggleTxPaid(tx.id)}
                                className={`w-5 h-5 rounded-full border shrink-0 flex items-center justify-center transition active:scale-90 cursor-pointer ${
                                  tx.isPaid
                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                    : tx.type === "receivable"
                                    ? "border-emerald-300 dark:border-emerald-800 hover:bg-emerald-500/10"
                                    : "border-rose-300 dark:border-rose-800 hover:bg-rose-500/10"
                                }`}
                                title={tx.isPaid ? "Ödenmedi olarak işaretle" : "Ödendi olarak işaretle"}
                              >
                                {tx.isPaid && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>

                              <div className="min-w-0">
                                <h4 className={`text-[11px] font-bold text-slate-800 dark:text-slate-100 uppercase truncate leading-tight ${tx.isPaid ? "line-through text-slate-600" : ""}`}>
                                  {tx.description}
                                </h4>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1 text-[9px] text-slate-500 dark:text-slate-400 font-bold">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-indigo-400" />
                                    Vade: {tx.dueDate}
                                  </span>
                                  <span>•</span>
                                  <span className={tx.type === "receivable" ? "text-emerald-500" : "text-rose-500"}>
                                    {tx.type === "receivable" ? "Bizim Alacağımız" : "Ona Ödeyeceğiz"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0 flex items-center gap-2 pl-2">
                              <span className={`text-[13px] font-black font-mono ${tx.isPaid ? "line-through text-slate-600" : tx.type === "receivable" ? "text-emerald-500" : "text-rose-500"}`}>
                                {tx.type === "receivable" ? "+" : "-"}{format(tx.amount)}
                              </span>
                              {!tx.isPaid && onAddAlarm && (
                                <button
                                  onClick={() => {
                                    if (!isPremium) {
                                      onUpgradeClick?.();
                                    } else {
                                      setReminderTx(tx);
                                      setReminderOption("day_before");
                                      setCustomReminderDate(tx.dueDate || "");
                                      setCustomReminderTime("09:00");
                                    }
                                  }}
                                  className="p-1 rounded-lg bg-indigo-50/80 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 shrink-0 cursor-pointer active:scale-95 transition flex items-center justify-center relative"
                                  title="Hatırlatıcı Alarm Kur ⏰"
                                >
                                  <Bell className="w-3.5 h-3.5" />
                                  {!isPremium && <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5 rounded-full bg-amber-500" />}
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteTx(tx.id)}
                                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-rose-500 shrink-0 cursor-pointer active:scale-95 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Informative advice message */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800 text-[9.5px] leading-relaxed text-slate-600 dark:text-slate-300 font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />
                    <p>
                      <strong>💡 Akıllı Amorti İpuçları:</strong> Herhangi bir borcun solundaki boş yuvarlağa tıkladığınızda işlem "Ödendi" olarak etiketlenir ve üstteki toplam grafiklerden çıkartılır. Karşılıklı transfer tanzimlerinde bu özelliği kullanabilirsiniz.
                    </p>
                  </div>

                  {/* Ready Receivable Reminder Messages */}
                  {(() => {
                    const unpaidReceivs = activeTxs.filter((t) => t.type === "receivable");
                    if (unpaidReceivs.length === 0) return null;

                    // Compute dynamic strings based on first item
                    const firstItem = unpaidReceivs[0];
                    const rawPhone = contact.phone || "";
                    const cleanPhone = rawPhone.replace(/\D/g, "");
                    const waPhone = cleanPhone.startsWith("0") ? "90" + cleanPhone.slice(1) : cleanPhone;

                    const templates = [
                      {
                        title: "✍️ Nazik / Standart",
                        text: `Merhaba ${contact.name}, umarım iyisin. Bütçe hesaplarımızı güncelliyordum da, ${firstItem.description} konusundaki ${format(firstItem.amount)} tutarındaki ödemeyi müsaitsen yapabilir misin? Çok teşekkürler!`,
                        desc: "Gündelik ve kibar hatırlatıcı üslubu."
                      },
                      {
                        title: "🤝 Samimi / Yakın Dost",
                        text: `Selam ${contact.name} kanka, ufak bir bütçe sıkışıklığım vardı da, seninle olan ${firstItem.description} (${format(firstItem.amount)}) alacağını müsait bir anında gönderebilirsen çok memnun olurum. Sağ olasın!`,
                        desc: "Yakın arkadaşlar ve tanıdıklar için samimi dil."
                      },
                      {
                        title: "🔒 Resmi / Ticari Şablon",
                        text: `Sayın ${contact.name}, sistem kayıtlarımıza göre ${firstItem.dueDate} vadeli ${firstItem.description} işlemine ait ${format(firstItem.amount)} tutarındaki alacağımız henüz tahsil edilmemiştir. İlgili tutarın hesabımıza havale edilmesini önemle rica eder, iyi çalışmalar dileriz.`,
                        desc: "İş ortakları veya resmi alacak ilişkileri."
                      }
                    ];

                    return (
                      <div className="p-4 bg-indigo-50/50 dark:bg-slate-900/40 rounded-2xl border border-indigo-150/40 dark:border-indigo-950/40 space-y-3 mt-1">
                        <div className="flex items-center gap-1.5 border-b border-indigo-100/30 dark:border-indigo-950/40 pb-2">
                          <BellRing className="w-4 h-4 text-indigo-500 animate-pulse" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                            HAZIR ALACAK HATIRLATMA MESAJLARI
                          </h4>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                          Seçilen kişi adıyla ve en yakın alacak kaydı olan <strong>{firstItem.description} ({format(firstItem.amount)})</strong> bilgisi ile optimize edilmiş mesaj şablonları:
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {templates.map((tpl, tIdx) => {
                            const waLink = `https://wa.me/${waPhone || "90"}?text=${encodeURIComponent(tpl.text)}`;

                            return (
                              <div
                                key={tIdx}
                                className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-150 dark:border-slate-700/60 flex flex-col justify-between space-y-2 shadow-xs"
                              >
                                <div>
                                  <span className="text-[10px] font-black text-slate-850 dark:text-slate-200 block mb-1">
                                    {tpl.title}
                                  </span>
                                  <p className="text-[9.5px] text-slate-450 dark:text-slate-400 font-bold mb-1.5 leading-snug">
                                    {tpl.desc}
                                  </p>
                                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-[9px] text-slate-600 dark:text-slate-300 font-medium select-all border border-slate-100 dark:border-slate-800/60 line-clamp-4 leading-normal">
                                    {tpl.text}
                                  </div>
                                </div>

                                <div className="flex gap-1.5 pt-1.5 border-t border-dashed border-slate-100 dark:border-slate-700">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(tpl.text);
                                      showLocalToast("Kopya Başarılı! 📋");
                                    }}
                                    className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-705 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[9px] font-extrabold rounded-md cursor-pointer transition active:scale-95 text-center block uppercase"
                                  >
                                    KOPYALA 📋
                                  </button>
                                  {waPhone && (
                                    <a
                                      href={waLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-extrabold rounded-md text-center block uppercase flex items-center justify-center gap-0.5 shadow-sm shadow-emerald-500/10"
                                    >
                                      WP GÖNDER 💬
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              );
            })() : (
              <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700 space-y-4">
                <div className="flex flex-col items-center justify-center space-y-2 text-slate-600 dark:text-slate-300">
                  <div className="p-4 bg-indigo-500/10 rounded-full text-indigo-500 animate-pulse">
                    <BookOpen className="w-10 h-10" />
                  </div>
                  <h4 className="font-black text-sm uppercase">Cari Hesap Seçilmedi</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-sm leading-relaxed">
                    Borç hareketlerini, vade dökümünü ve detaylı finansal notlarını incelemek için sol paneldeki rehberden dilediğiniz bir kişiyi seçin.
                  </p>
                </div>
              </div>
            )}
          </AnimatePresence>

          {/* Simulated Device Contact List Modal Overlay */}
          <AnimatePresence>
            {isSimulatedPickerOpen && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] flex flex-col overflow-hidden text-left"
                >
                  <div className="flex items-center justify-between border-b dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 uppercase">
                        📱 TELEFON REHBERİNDEN SEÇ
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold">Kişilerinizi bir tıkla alacak/verecek dökümünüze aktarın</p>
                    </div>
                    <button
                      onClick={() => setIsSimulatedPickerOpen(false)}
                      type="button"
                      className="p-1 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 hover:text-rose-500 rounded-lg text-xs font-black cursor-pointer transition active:scale-90"
                    >
                      KAPAT ✖
                    </button>
                  </div>

                  {/* Real Device VCF Import Section */}
                  <div className="p-3.5 bg-indigo-500/[0.03] dark:bg-indigo-950/25 border border-indigo-500/10 dark:border-indigo-900/30 rounded-2xl text-center space-y-2.5 font-sans">
                    <div className="space-y-1">
                      <h4 className="text-[10.5px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center justify-center gap-1">
                        🔑 GERÇEK TELEFON REHBERİNİ İTHAL ET
                      </h4>
                      <p className="text-[9.5px] text-slate-600 dark:text-slate-450 font-semibold leading-relaxed px-1">
                        Gerçek telefon rehberinizi aktarmak çok kolay! Telefonunuzdan <strong className="text-indigo-600 dark:text-indigo-300">Rehber'e girip "Kişileri Paylaş / Dışa Aktar" (.vcf / vCard)</strong> seçeneğiyle indirdiğiniz yedek dosyasını buraya seçin:
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all shadow-md shadow-indigo-600/15">
                      📁 REHBER YEDEK DOSYASI SEÇ (.VCF)
                      <input
                        type="file"
                        accept=".vcf"
                        onChange={handleVcfImport}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Search filter for simulated contacts */}
                  <div className="relative">
                    <input
                      type="text"
                      value={simulatedSearchText}
                      onChange={(e) => setSimulatedSearchText(e.target.value)}
                      placeholder={simulatedDeviceContacts.length > 0 ? "Rehberde kişi arayın... 🔎" : "Önce .vcf dosyası yükleyin 🔎"}
                      disabled={simulatedDeviceContacts.length === 0}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold disabled:opacity-50"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>

                  {/* Contacts Row selection */}
                  <div className="space-y-1.5 overflow-y-auto flex-1 pr-1 max-h-80">
                    {simulatedDeviceContacts.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 font-semibold space-y-2">
                        <span className="text-3xl block text-slate-500">📁</span>
                        <p className="text-[10px] leading-relaxed max-w-[285px] mx-auto text-slate-550 dark:text-slate-400">
                          Henüz bir rehber yedek dosyası (.vcf) seçilmedi. Lütfen yukarıdaki butondan telefonunuzun yedek dosyasını yükleyin. Örnek rehber silindi.
                        </p>
                      </div>
                    ) : (() => {
                      const filtered = simulatedDeviceContacts.filter((sim) =>
                        sim.name.toLowerCase().includes(simulatedSearchText.toLowerCase()) ||
                        sim.phone.includes(simulatedSearchText)
                      );
                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-8 text-slate-400 font-semibold">
                            <p className="text-[10px]">Aramanızla eşleşen kişi bulunamadı. 🔎</p>
                          </div>
                        );
                      }
                      return filtered.map((sim, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSimulatedSelect(sim)}
                          className="p-2.5 bg-slate-50 hover:bg-indigo-50/50 dark:bg-slate-950/40 dark:hover:bg-indigo-950/30 rounded-2xl border border-slate-200/50 dark:border-slate-800/85 transition flex items-center justify-between cursor-pointer group hover:border-indigo-500/50 active:scale-[0.99] font-sans"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-400 text-white font-black text-xs flex items-center justify-center uppercase shadow-xs">
                              {sim.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-[11.5px] font-black text-slate-800 dark:text-slate-100 leading-tight">
                                {sim.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-mono">
                                📞 {sim.phone}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/15 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                              Hızlı Ekle ➔
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Custom Delete Confirmation Modal */}
          <AnimatePresence>
            {contactToDeleteId && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-6 space-y-4 text-left"
                >
                  <div className="flex items-center gap-3 text-rose-500">
                    <div className="p-3 bg-rose-500/10 rounded-full">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider">Kişiyi Sil</h3>
                      <p className="text-[10px] text-slate-400 font-bold">Bu işlem geri alınamaz!</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p>
                      Özel listenizdeki <strong className="font-extrabold text-slate-800 dark:text-slate-100">"{(contacts.find(c => c.id === contactToDeleteId))?.name}"</strong> isimli kişiyi ve bu kişiye ait <span className="text-rose-500 font-black">tüm borç, alacak ve bakiye hareket senedini</span> tamamen silmek istediğinizden emin misiniz?
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setContactToDeleteId(null)}
                      type="button"
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition"
                    >
                      VAZGEÇ
                    </button>
                    <button
                      onClick={() => {
                        const id = contactToDeleteId;
                        const updatedConts = contacts.filter((c) => c.id !== id);
                        const updatedTxs = transactions.filter((t) => t.contactId !== id);
                        saveContactsData(updatedConts);
                        saveTxsData(updatedTxs);
                        if (selectedContactId === id) {
                          setSelectedContactId(null);
                        }
                        setContactToDeleteId(null);
                        showLocalToast("Kişi kartı ve tüm hareketleri başarıyla silindi! 🗑️");
                      }}
                      type="button"
                      className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition"
                    >
                      SİL VE TEMİZLE 🗑️
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Custom Edit Contact Modal */}
          <AnimatePresence>
            {contactToEdit && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-6 space-y-4 text-left"
                >
                  <div className="flex items-center gap-3 text-indigo-500">
                    <div className="p-3 bg-indigo-500/10 rounded-full">
                      <Edit className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider">Kişiyi Düzenle</h3>
                      <p className="text-[10px] text-slate-400 font-bold">Kişi ad soyad, telefon ve kategori ayarları</p>
                    </div>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!editName.trim()) return;
                    const updated = contacts.map(c => {
                      if (c.id === contactToEdit.id) {
                        return {
                          ...c,
                          name: editName.trim(),
                          phone: editPhone.trim() || "Belirtilmemiş 📞",
                          category: editCategory
                        };
                      }
                      return c;
                    });
                    saveContactsData(updated);
                    setContactToEdit(null);
                    showLocalToast("Kişi bilgileri başarıyla güncellendi! 💾✨");
                  }} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Adı Soyadı</label>
                      <input
                        required
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Örn: Ahmet Yılmaz"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Telefon Numarası</label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="Örn: 0532 123 4567"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Yakınlık Grubu / Kategori</label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as any)}
                        className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                      >
                        <option value="friend">Arkadaş</option>
                        <option value="family">Aile / Akraba</option>
                        <option value="work">İş / Ticaret</option>
                        <option value="other">Diğer</option>
                      </select>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setContactToEdit(null)}
                        type="button"
                        className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition"
                      >
                        VAZGEÇ
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition"
                      >
                        GÜNCELLE 💾
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Reminder / Alarm Setter Modal Overlay */}
          <AnimatePresence>
            {reminderTx && (
              <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 text-left"
                >
                  <div className="flex items-center justify-between border-b dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 uppercase">
                        ⏰ ÖDEME HATIRLATICISI KUR
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold">Vade yaklaştığında akıllı push uygulama alarmı oluşturun</p>
                    </div>
                    <button
                      onClick={() => setReminderTx(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full cursor-pointer flex items-center justify-center w-6 h-6"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3.5 py-1">
                    {/* Tx Info summary badge */}
                    <div className="p-3 bg-indigo-500/[0.03] border border-indigo-150/15 rounded-2xl space-y-1">
                      <span className="text-[8px] font-black text-indigo-500 uppercase block tracking-widest">İŞLEM DETAYLARI</span>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">{reminderTx.description}</span>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">{format(reminderTx.amount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold">
                        <span>Orijinal Vade Tarihi:</span>
                        <span>{reminderTx.dueDate ? new Date(reminderTx.dueDate).toLocaleDateString("tr-TR") : "Belirtilmemiş"}</span>
                      </div>
                    </div>

                    {/* Alarm Timing options list */}
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">ÖN-TANIMLI HATIRLATICI ZAMANLARI</label>
                       
                       <div className="grid grid-cols-1 gap-2">
                         {/* Option A: 1 Day Before */}
                         <button
                           type="button"
                           onClick={() => setReminderOption("day_before")}
                           className={`p-3 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition ${
                             reminderOption === "day_before"
                               ? "bg-indigo-500/[0.04] border-indigo-500/50 text-indigo-600 dark:text-indigo-400"
                               : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                           }`}
                         >
                           <div className="flex items-center gap-2.5">
                             <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${reminderOption === "day_before" ? "border-indigo-500 bg-indigo-500/20" : "border-slate-300"}`}>
                               {reminderOption === "day_before" && <div className="w-2 h-2 bg-indigo-500 rounded-full" />}
                             </div>
                             <div>
                               <span className="text-xs font-black block">1 Gün Önce</span>
                               <span className="text-[9px] text-slate-400 font-bold block">Ödeme vadesinden 1 gün önce 09:00'da hatırlat</span>
                             </div>
                           </div>
                         </button>

                         {/* Option B: On the Exact Due Date */}
                         <button
                           type="button"
                           onClick={() => setReminderOption("on_date")}
                           className={`p-3 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition ${
                             reminderOption === "on_date"
                               ? "bg-indigo-500/[0.04] border-indigo-500/50 text-indigo-600 dark:text-indigo-400"
                               : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                           }`}
                         >
                           <div className="flex items-center gap-2.5">
                             <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${reminderOption === "on_date" ? "border-indigo-500 bg-indigo-500/20" : "border-slate-300"}`}>
                               {reminderOption === "on_date" && <div className="w-2 h-2 bg-indigo-500 rounded-full" />}
                             </div>
                             <div>
                               <span className="text-xs font-black block">Vade Gününde</span>
                               <span className="text-[9px] text-slate-400 font-bold block">Ödeme vadesinin dolduğu gün sabah 09:00'da hatırlat</span>
                             </div>
                           </div>
                         </button>

                         {/* Option C: Custom Date/Time */}
                         <button
                           type="button"
                           onClick={() => setReminderOption("custom")}
                           className={`p-3 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition ${
                             reminderOption === "custom"
                               ? "bg-indigo-500/[0.04] border-indigo-500/50 text-indigo-600 dark:text-indigo-400"
                               : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                           }`}
                         >
                           <div className="flex items-center gap-2.5">
                             <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${reminderOption === "custom" ? "border-indigo-500 bg-indigo-500/20" : "border-slate-300"}`}>
                               {reminderOption === "custom" && <div className="w-2 h-2 bg-indigo-500 rounded-full" />}
                             </div>
                             <div>
                               <span className="text-xs font-black block">Özel Tarih ve Saat</span>
                               <span className="text-[9px] text-slate-400 font-bold block">Kendi belirleyeceğiniz özel bir zaman dilimini ayarlayın</span>
                             </div>
                           </div>
                         </button>
                       </div>
                    </div>

                    {/* Custom inputs wrapper */}
                    {reminderOption === "custom" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="grid grid-cols-2 gap-3 pt-2"
                      >
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Özel Alarm Tarihi</label>
                          <input
                            type="date"
                            value={customReminderDate}
                            onChange={(e) => setCustomReminderDate(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold font-mono text-center"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Özel Alarm Saati</label>
                          <input
                            type="time"
                            value={customReminderTime}
                            onChange={(e) => setCustomReminderTime(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold font-mono text-center"
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setReminderTx(null)}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition"
                    >
                      İPTAL ET
                    </button>
                    <button
                      type="button"
                      onClick={handleSetReminderSubmit}
                      className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition flex items-center justify-center gap-1"
                    >
                      <BellRing className="w-3.5 h-3.5" /> ALARMI KUR
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
  );
};
