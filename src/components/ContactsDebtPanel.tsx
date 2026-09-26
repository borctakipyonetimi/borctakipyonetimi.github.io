/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
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
  BellRing,
  X,
  Camera,
  Image as ImageIcon,
  Upload,
  ChevronDown,
  Sparkles,
  UserCheck,
  Copy
} from "lucide-react";

import { t } from "../utils/translations";

interface Contact {
  id: string;
  name: string;
  phone: string;
  category: "friend" | "family" | "work" | "other";
  avatarColor: string;
  avatarImage?: string; // base64 or URL
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

  // Ref for VCF File Input and scroll targets
  const vcfFileInputRef = useRef<HTMLInputElement>(null);
  const selectedContactRef = useRef<HTMLDivElement>(null);
  const newContactPhotoInputRef = useRef<HTMLInputElement>(null);
  const editContactPhotoInputRef = useRef<HTMLInputElement>(null);
  const quickPhotoInputRef = useRef<HTMLInputElement>(null);

  // State Management
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<ContactTransaction[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Custom Delete and Edit states
  const [contactToDeleteId, setContactToDeleteId] = useState<string | null>(null);
  const [isConfirmClearAllContactsOpen, setIsConfirmClearAllContactsOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCategory, setEditCategory] = useState<Contact["category"]>("friend");
  const [editAvatarImage, setEditAvatarImage] = useState<string | null>(null);

  // Quick photo target
  const [quickPhotoTargetId, setQuickPhotoTargetId] = useState<string | null>(null);

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

  // Image compressor & reader helper (Max 256x256 high-perf avatar)
  const compressAndReadImage = (file: File, callback: (dataUrl: string) => void) => {
    if (!file.type.startsWith("image/")) {
      showLocalToast("Lütfen geçerli bir resim dosyası seçin! ⚠️");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        callback(compressedDataUrl);
      };
      img.onerror = () => {
        showLocalToast("Görsel yüklenirken bir hata oluştu! ⚠️");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
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
  const [newContactAvatarImage, setNewContactAvatarImage] = useState<string | null>(null);
  const [isAddingContact, setIsAddingContact] = useState(false);

  // Create Transaction Form States
  const [newTxAmount, setNewTxAmount] = useState("");
  const [newTxType, setNewTxType] = useState<"receivable" | "payable">("receivable");
  const [newTxDesc, setNewTxDesc] = useState("");
  const [newTxDueDate, setNewTxDueDate] = useState(() => {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]; // default in +7 days
  });
  const [isAddingTx, setIsAddingTx] = useState(false);

  // Select contact handler with smooth scroll immediately under the list
  const handleSelectContact = (contactId: string, openAddTx = false) => {
    setSelectedContactId(contactId);
    if (openAddTx) {
      setIsAddingTx(true);
    }
    setTimeout(() => {
      selectedContactRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  };

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
    window.dispatchEvent(new Event("contacts-updated"));
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
      avatarImage: newContactAvatarImage || undefined,
      createdAt: new Date().toISOString()
    };

    const updated = [added, ...contacts];
    saveContactsData(updated);
    setIsAddingContact(false);
    setNewContactName("");
    setNewContactPhone("");
    setNewContactAvatarImage(null);
    showLocalToast(`${added.name} başarıyla eklendi! 👤🎉`);

    // Auto-select the newly added contact
    handleSelectContact(added.id);
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
    // Open simulated address book popup
    setIsSimulatedPickerOpen(true);
  };

  const decodeVcardValue = (paramPart: string, valuePart: string): string => {
    let decoded = valuePart.trim();
    const isQp = /ENCODING=QUOTED-PRINTABLE/i.test(paramPart) || /ENCODING=Q/i.test(paramPart);
    
    if (isQp) {
      decoded = decoded.replace(/=\r?\n/g, "");
      try {
        const percentEncoded = decoded.replace(/=([0-9A-F]{2})/gi, "%$1");
        decoded = decodeURIComponent(percentEncoded);
      } catch (e) {
        try {
          decoded = decodeURI(decoded.replace(/=([0-9A-F]{2})/gi, "%$1"));
        } catch {
          const qpMap: { [key: string]: string } = {
            "=C3=9C": "Ü", "=C3=BC": "ü",
            "=C4=B0": "İ", "=C4=B1": "ı",
            "=C3=96": "Ö", "=C3=B6": "ö",
            "=C5=9E": "Ş", "=C5=9F": "ş",
            "=C3=87": "Ç", "=C3=A7": "ç",
            "=C4=9E": "Ğ", "=C4=9F": "ğ"
          };
          let temp = decoded;
          Object.entries(qpMap).forEach(([qp, char]) => {
            temp = temp.replace(new RegExp(qp, "g"), char);
          });
          decoded = temp;
        }
      }
    }
    decoded = decoded
      .replace(/\\;/g, ";")
      .replace(/\\,/g, ",")
      .replace(/\\N/gi, " ")
      .replace(/\\/g, "")
      .trim();
    return decoded;
  };

  const handleVcfImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;
        const unfoldedText = text.replace(/\r?\n[ \t]/g, "");
        const vcardRegex = /BEGIN:VCARD[\s\S]*?END:VCARD/ig;
        const cards = unfoldedText.match(vcardRegex) || [];

        if (cards.length === 0) {
          showLocalToast("Geçerli bir rehber yedek dosyası (.vcf) bulunamadı! ⚠️");
          return;
        }

        const parsedContacts: Array<{ name: string; phone: string; category: "friend" | "family" | "work" | "other" }> = [];

        cards.forEach((card: string) => {
          const lines = card.split(/\r?\n/);
          let fnLine = "";
          let nLine = "";
          const telLines: string[] = [];

          lines.forEach(line => {
            const upperLine = line.toUpperCase();
            if (upperLine.startsWith("FN")) {
              fnLine = line;
            } else if (upperLine.startsWith("N:") || upperLine.startsWith("N;")) {
              nLine = line;
            } else if (upperLine.startsWith("TEL")) {
              telLines.push(line);
            }
          });

          let name = "";
          if (fnLine) {
            const colonIndex = fnLine.indexOf(":");
            if (colonIndex !== -1) {
              const paramPart = fnLine.substring(0, colonIndex);
              const valuePart = fnLine.substring(colonIndex + 1);
              name = decodeVcardValue(paramPart, valuePart);
            }
          }
          if (!name && nLine) {
            const colonIndex = nLine.indexOf(":");
            if (colonIndex !== -1) {
              const paramPart = nLine.substring(0, colonIndex);
              const valuePart = nLine.substring(colonIndex + 1);
              const parts = valuePart.split(";");
              const decodedParts = parts.map(p => decodeVcardValue(paramPart, p));
              const lastName = decodedParts[0] || "";
              const firstName = decodedParts[1] || "";
              name = `${firstName} ${lastName}`.trim();
            }
          }

          let phone = "";
          if (telLines.length > 0) {
            const chosenTelLine = telLines.find(tl => tl.toUpperCase().includes("CELL") || tl.toUpperCase().includes("PREF")) || telLines[0];
            const colonIndex = chosenTelLine.indexOf(":");
            if (colonIndex !== -1) {
              const paramPart = chosenTelLine.substring(0, colonIndex);
              const valuePart = chosenTelLine.substring(colonIndex + 1);
              phone = decodeVcardValue(paramPart, valuePart);
            }
          }

          if (name) {
            parsedContacts.push({
              name,
              phone: phone ? phone : "Belirtilmemiş 📞",
              category: "friend",
            });
          }
        });

        if (parsedContacts.length > 0) {
          setSimulatedDeviceContacts(parsedContacts);
          localStorage.setItem(`${spaceKey}_parsed_vcf_device_contacts`, JSON.stringify(parsedContacts));
          setIsSimulatedPickerOpen(true);
          showLocalToast(`Rehber dosyanızdan ${parsedContacts.length} kişi başarıyla okundu! Listeden dilediğiniz kişiyi 'Hızlı Ekle ➔' seçeneğiyle ekleyebilirsiniz. 📱🎉`);
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
    handleSelectContact(added.id);
  };

  // Delete Contact Handler
  const handleDeleteContact = (id: string) => {
    setContactToDeleteId(id);
  };

  // Quick photo upload trigger for specific contact
  const triggerQuickPhotoUpload = (contactId: string) => {
    setQuickPhotoTargetId(contactId);
    quickPhotoInputRef.current?.click();
  };

  const handleQuickPhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quickPhotoTargetId) return;

    compressAndReadImage(file, (dataUrl) => {
      const updated = contacts.map(c => {
        if (c.id === quickPhotoTargetId) {
          return { ...c, avatarImage: dataUrl };
        }
        return c;
      });
      saveContactsData(updated);
      showLocalToast("Kişi fotoğrafı başarıyla güncellendi! 📷✨");
      setQuickPhotoTargetId(null);
    });

    if (e.target) e.target.value = "";
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
    showLocalToast("İşlem kaydı başarıyla eklendi! 💾✨");
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
    showLocalToast("İşlem kaydı silindi! 🗑️");
  };

  // Clear All Contacts and Transactions
  const handleClearAllContacts = () => {
    saveContactsData([]);
    saveTxsData([]);
    setSelectedContactId(null);
    setIsConfirmClearAllContactsOpen(false);
    showLocalToast("Tüm kişi listesi ve cari hareketler sıfırlandı! 🧹👤");
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
  const strokeDashVal = 314;
  const recDashoffset = strokeDashVal - (strokeDashVal * receivablePercentage) / 100;

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  return (
    <div className="space-y-6 select-none font-sans">
      {/* Hidden global photo inputs */}
      <input
        ref={quickPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleQuickPhotoFileChange}
        className="hidden"
      />

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
          Borç verdiğiniz arkadaşlarınızı, ödeme bekleyen müşterilerinizi veya borçlu olduğunuz akrabalarınızı akıllı rehber ile gruplayın. Her kişi için bağımsız fotoğraf, cari hesap ve borç geçmişi tutun.
        </p>
      </div>

      {/* SECTION 1: Contacts Add & List side-by-side at the very top */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left column: Yeni Kişi Ekleme */}
        <div className="space-y-4">
          <div className="p-5 bg-gradient-to-r from-indigo-500/10 via-slate-500/5 to-emerald-500/10 dark:from-indigo-500/15 dark:to-emerald-500/15 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs h-full flex flex-col justify-between">
            <div className="flex flex-col gap-2">
              <div className="space-y-0.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-indigo-500" />
                  YENİ KİŞİ / CARİ HESAP EKLEME
                </h3>
                <p className="text-[10px] text-slate-400 font-bold">Rehberden otomatik veya fotoğraflı manuel kişi ekleyin</p>
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
                  type="button"
                  onClick={() => vcfFileInputRef.current?.click()}
                  className="px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                  title="Doğrudan rehber yedek dosyasını (.VCF) seçin"
                >
                  📁 .VCF YÜKLE
                </button>
                <input
                  ref={vcfFileInputRef}
                  type="file"
                  accept=".vcf,text/vcard,text/x-vcard,text/plain,*/*"
                  onChange={(e) => {
                    handleVcfImport(e);
                    if (e.target) e.target.value = "";
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => setIsAddingContact((prev) => !prev)}
                  type="button"
                  className="flex-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm shadow-indigo-600/15"
                >
                  <UserPlus className="w-3.5 h-3.5 text-indigo-200" /> MANUEL 👤
                </button>
              </div>
            </div>

            {/* Inline Add Contact Form with Photo Upload */}
            <AnimatePresence>
              {isAddingContact && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mt-2 shadow-md"
                >
                  <form
                    onSubmit={handleAddContactSubmit}
                    className="space-y-3"
                  >
                    {/* Photo Upload Section */}
                    <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                      <div className="relative shrink-0">
                        {newContactAvatarImage ? (
                          <img
                            src={newContactAvatarImage}
                            alt="Önizleme"
                            className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-sm uppercase shadow-sm">
                            {newContactName ? newContactName.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => newContactPhotoInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 p-1 bg-indigo-600 text-white rounded-full shadow-md hover:bg-indigo-700 transition cursor-pointer"
                          title="Fotoğraf Ekle 📷"
                        >
                          <Camera className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => newContactPhotoInputRef.current?.click()}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-lg border border-indigo-200/50 dark:border-indigo-800 transition cursor-pointer flex items-center gap-1"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            {newContactAvatarImage ? "Fotoğrafı Değiştir" : "Kişi Fotoğrafı Ekle"}
                          </button>
                          {newContactAvatarImage && (
                            <button
                              type="button"
                              onClick={() => setNewContactAvatarImage(null)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 text-[10px] font-bold rounded-lg transition"
                            >
                              Kaldır ✕
                            </button>
                          )}
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium mt-1">İsteğe bağlı profil resmi ekleyebilirsiniz</p>
                      </div>

                      <input
                        ref={newContactPhotoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            compressAndReadImage(file, (dataUrl) => setNewContactAvatarImage(dataUrl));
                          }
                          if (e.target) e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </div>

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

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition"
                      >
                        Kişiyi Kaydet 💾
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingContact(false);
                          setNewContactAvatarImage(null);
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right column: Kişi Defteri & Arama */}
        <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700 space-y-3 shadow-xs h-full flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                📖 KİŞİ DEFTERİ ({contacts.length})
              </h3>
              {selectedContact && (
                <span className="text-[9.5px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                  Seçili: {selectedContact.name}
                </span>
              )}
            </div>

            {contacts.length > 0 && (
              <button
                type="button"
                onClick={() => setIsConfirmClearAllContactsOpen(true)}
                className="text-[9px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 px-2 py-1 rounded-lg transition active:scale-95 cursor-pointer flex items-center gap-1"
                title="Tüm kişi ve işlemleri temizle"
              >
                <Trash2 className="w-3 h-3" /> Sıfırla
              </button>
            )}
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="İsim veya telefon ile hızlı ara..."
              className="w-full pl-8 pr-7 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Directory Contact List Items */}
          <div className="space-y-3 max-h-[650px] overflow-y-auto overscroll-contain pr-1">
            {filteredContacts.length === 0 ? (
              <div className="p-6 text-center text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700 font-bold text-xs italic">
                {contacts.length === 0 ? "Henüz kişi eklenmedi. 'Rehberden Seç' veya 'Manuel' ile ekleyin." : "Arama kriterlerine uygun kişi bulunamadı."}
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const totals = getContactTotals(contact.id);
                const isSelected = selectedContactId === contact.id;

                const cTxs = transactions.filter((t) => t.contactId === contact.id);
                const activeTxs = cTxs.filter((t) => !t.isPaid);
                const firstItem = activeTxs.length > 0
                  ? activeTxs[0]
                  : { description: "borç", amount: 1000, dueDate: "2026-10-02" };
                const waPhone = contact.phone.replace(/[^0-9]/g, "");

                const templates = [
                  {
                    title: "✍️ Nazik / Standart",
                    desc: "Gündelik ve kibar hatırlatıcı üslubu.",
                    text: `Merhaba ${contact.name}, umarım iyisin. Bütçe hesaplarımızı güncelliyordum da, ${firstItem.description} konusundaki ${format(firstItem.amount)} tutarındaki ödemeyi müsaitsen yapabilir misin? Çok teşekkürler!`
                  },
                  {
                    title: "🤝 Samimi / Yakın Dost",
                    desc: "Yakın arkadaşlar ve tanıdıklar için samimi dil.",
                    text: `Selam ${contact.name} kanka, ufak bir bütçe sıkışıklığım vardı da, seninle olan ${firstItem.description} (${format(firstItem.amount)}) alacağını müsait bir anında gönderebilirsen çok memnun olurum. Sağ olasın!`
                  },
                  {
                    title: "🔒 Resmi / Ticari Şablon",
                    desc: "İş ortakları veya resmi alacak ilişkileri.",
                    text: `Sayın ${contact.name}, sistem kayıtlarımıza göre ${firstItem.dueDate} vadeli ${firstItem.description} işlemine ait ${format(firstItem.amount)} tutarındaki alacağımız henüz tahsil edilmemiştir. İlgili tutarın hesabımıza havale edilmesini önemle rica eder, iyi çalışmalar dileriz.`
                  }
                ];

                return (
                  <div key={contact.id} className="space-y-2.5">
                    <motion.div
                      onClick={() => handleSelectContact(contact.id)}
                      className={`p-3.5 bg-white dark:bg-slate-800 rounded-2xl border transition duration-200 cursor-pointer flex flex-col xs:flex-row xs:items-center justify-between gap-3 group active:scale-98 shadow-xs ${
                        isSelected
                          ? "border-indigo-600 ring-2 ring-indigo-500/30 shadow-md bg-indigo-50/40 dark:bg-indigo-950/35"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar with photo or colorful initial letter */}
                        <div className="relative group/avatar shrink-0">
                          {contact.avatarImage ? (
                            <img
                              src={contact.avatarImage}
                              alt={contact.name}
                              className="w-11 h-11 rounded-full object-cover border-2 border-indigo-500/60 shadow-xs"
                            />
                          ) : (
                            <div className={`w-11 h-11 rounded-full bg-gradient-to-tr ${contact.avatarColor} text-white flex items-center justify-center font-black text-sm shadow-xs uppercase`}>
                              {contact.name.charAt(0)}
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerQuickPhotoUpload(contact.id);
                            }}
                            type="button"
                            className="absolute -bottom-1 -right-1 p-1 bg-slate-900 hover:bg-indigo-600 text-white rounded-full shadow-md transition cursor-pointer"
                            title="Fotoğraf Ekle / Değiştir 📷"
                          >
                            <Camera className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="min-w-0 leading-tight">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                              {contact.name}
                            </h4>
                            <span className="shrink-0 p-0.5 px-1 bg-slate-100 dark:bg-slate-900 text-[10px] rounded-md border border-slate-200/60 dark:border-slate-800 font-bold">
                              {getCategoryIcon(contact.category)} {getCategoryLabel(contact.category)}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono pt-1 truncate">
                            📞 {contact.phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end xs:self-center shrink-0">
                        <div className="text-right leading-none min-w-[70px]">
                          <div className="text-[10.5px] font-mono leading-tight">
                            {totals.net !== 0 ? (
                              <span className={`font-black ${totals.net > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {totals.net > 0 ? "Alacak: " : "Borç: "}{format(Math.abs(totals.net))}
                              </span>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400 font-extrabold text-[9px] uppercase tracking-wide">
                                DENGELİ ✔️
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick Borç/Alacak Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectContact(contact.id, true);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-xs border ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-700 shadow-indigo-600/20"
                              : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border-indigo-200/50"
                          }`}
                          title="Bu kişiye borç veya alacak ekle"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isSelected ? "Borç/Alacak Açık" : "Borç/Alacak Ekle"}</span>
                        </button>

                        {/* Card Action Buttons (Photo, Edit and Delete) */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerQuickPhotoUpload(contact.id);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 transition cursor-pointer"
                            title="Resim / Fotoğraf Ekle 📷"
                          >
                            <Camera className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setContactToEdit(contact);
                              setEditName(contact.name);
                              setEditPhone(contact.phone === "Belirtilmemiş 📞" ? "" : contact.phone);
                              setEditCategory(contact.category);
                              setEditAvatarImage(contact.avatarImage || null);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 transition cursor-pointer"
                            title="Kişiyi Düzenle 📝"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setContactToDeleteId(contact.id);
                            }}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 dark:text-rose-400 transition cursor-pointer"
                            title="Kişiyi Sil 🗑️"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>

                    {/* INLINE EXPANDED SECTION: Rendered IMMEDIATELY right below the selected contact */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          ref={selectedContactRef}
                          initial={{ opacity: 0, height: 0, y: -8 }}
                          animate={{ opacity: 1, height: "auto", y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -8 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-indigo-500/50 dark:border-indigo-500/40 p-4 sm:p-5 space-y-4 shadow-xl relative overflow-hidden">
                            {/* Selected Indicator Top Strip */}
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

                            {/* Profile Header & Photo Manager */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 pt-1">
                              <div className="flex items-center gap-3">
                                {/* Interactive Photo Avatar */}
                                <div className="relative group cursor-pointer" onClick={() => triggerQuickPhotoUpload(contact.id)}>
                                  {contact.avatarImage ? (
                                    <img
                                      src={contact.avatarImage}
                                      alt={contact.name}
                                      className="w-13 h-13 rounded-full object-cover border-2 border-indigo-500 shadow-md transition group-hover:opacity-90"
                                    />
                                  ) : (
                                    <div className={`w-13 h-13 rounded-full bg-gradient-to-tr ${contact.avatarColor} text-white flex items-center justify-center font-black text-base uppercase shadow-md`}>
                                      {contact.name.charAt(0)}
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="w-4 h-4 text-white" />
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                                      SEÇİLİ KİŞİ CARİ HESABI
                                    </span>
                                  </div>
                                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5">
                                    {contact.name}
                                  </h3>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                    📞 {contact.phone}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Direct Photo Upload Button */}
                                <button
                                  onClick={() => triggerQuickPhotoUpload(contact.id)}
                                  type="button"
                                  className="p-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-black border border-indigo-200/50 dark:border-indigo-800"
                                  title="Fotoğraf Ekle veya Güncelle 📷"
                                >
                                  <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                  <span>{contact.avatarImage ? "Fotoğrafı Değiştir" : "📷 Fotoğraf Ekle"}</span>
                                </button>

                                {contact.avatarImage && (
                                  <button
                                    onClick={() => {
                                      const updated = contacts.map(c => c.id === contact.id ? { ...c, avatarImage: undefined } : c);
                                      saveContactsData(updated);
                                      showLocalToast("Kişi fotoğrafı kaldırıldı 🗑️");
                                    }}
                                    type="button"
                                    className="p-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 text-[10px] font-bold rounded-xl transition cursor-pointer"
                                    title="Fotoğrafı Kaldır"
                                  >
                                    Kaldır ✕
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setContactToEdit(contact);
                                    setEditName(contact.name);
                                    setEditPhone(contact.phone === "Belirtilmemiş 📞" ? "" : contact.phone);
                                    setEditCategory(contact.category);
                                    setEditAvatarImage(contact.avatarImage || null);
                                  }}
                                  className="p-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition text-xs font-bold"
                                  title="Bilgileri Düzenle 📝"
                                >
                                  <Edit className="w-3.5 h-3.5 inline mr-1" /> Düzenle
                                </button>

                                <button
                                  onClick={() => setSelectedContactId(null)}
                                  className="p-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl text-xs font-bold"
                                  title="Kapat"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Balance Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                                <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase block tracking-wider">Kişiden Alacağımız</span>
                                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono block mt-0.5">
                                  {format(totals.receivable)}
                                </span>
                              </div>

                              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
                                <span className="text-[9px] font-black text-rose-700 dark:text-rose-400 uppercase block tracking-wider">Kişiye Borcumuz</span>
                                <span className="text-base font-black text-rose-600 dark:text-rose-400 font-mono block mt-0.5">
                                  {format(totals.payable)}
                                </span>
                              </div>

                              <div className={`p-3 rounded-2xl border ${
                                totals.net > 0
                                  ? "bg-emerald-500/10 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                                  : totals.net < 0
                                  ? "bg-rose-500/10 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300"
                                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                              }`}>
                                <span className="text-[9px] font-black uppercase block tracking-wider">Net Bakiye</span>
                                <span className="text-base font-black font-mono block mt-0.5">
                                  {totals.net > 0 ? "+" : ""}{format(totals.net)}
                                </span>
                              </div>
                            </div>

                            {/* Borç / Alacak Ekleme Bölümü */}
                            <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200/70 dark:border-indigo-800/60 space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                                    <DollarSign className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    {contact.name} İçin Borç / Alacak Ekle
                                  </h4>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Bu kişiye ait yeni bir alacak kaydı veya borç taahhüdü girin</p>
                                </div>

                                <button
                                  onClick={() => setIsAddingTx((prev) => !prev)}
                                  type="button"
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-md shadow-indigo-600/20"
                                >
                                  <Plus className="w-3.5 h-3.5" /> {isAddingTx ? "Formu Gizle" : "+ Yeni İşlem Ekle"}
                                </button>
                              </div>

                              <AnimatePresence>
                                {isAddingTx && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden pt-1"
                                  >
                                    <form
                                      onSubmit={handleAddTxSubmit}
                                      className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-800/70 space-y-3 shadow-sm"
                                    >
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                          <label className="text-[9.5px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">İşlem Yönü</label>
                                          <select
                                            value={newTxType}
                                            onChange={(e) => setNewTxType(e.target.value as any)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                          >
                                            <option value="receivable">🟢 Alacak Senedi (Kişiye Borç Verdim / Alacağım Var)</option>
                                            <option value="payable">🔴 Borç Taahhüdü (Kişiden Borç Aldım / Ödeyeceğim)</option>
                                          </select>
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-[9.5px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Toplam Tutar (TL)</label>
                                          <div className="relative">
                                            <input
                                              required
                                              type="number"
                                              step="any"
                                              min="0.1"
                                              value={newTxAmount}
                                              onChange={(e) => setNewTxAmount(e.target.value)}
                                              placeholder="0.00"
                                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-black font-mono text-base"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {/* Quick Amount Chips */}
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Hızlı:</span>
                                        {[100, 250, 500, 1000, 2500, 5000].map((amt) => (
                                          <button
                                            key={amt}
                                            type="button"
                                            onClick={() => setNewTxAmount(amt.toString())}
                                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold rounded-md transition cursor-pointer"
                                          >
                                            +{amt} ₺
                                          </button>
                                        ))}
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                          <label className="text-[9.5px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Açıklama / Detay</label>
                                          <input
                                            type="text"
                                            value={newTxDesc}
                                            onChange={(e) => setNewTxDesc(e.target.value)}
                                            placeholder="Örn: Elden nakit, yemek hesabı, iş ödemesi"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-[9.5px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Ödeme Vadesi</label>
                                          <input
                                            required
                                            type="date"
                                            value={newTxDueDate}
                                            onChange={(e) => setNewTxDueDate(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                                          />
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 pt-1">
                                        <button
                                          type="submit"
                                          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md shadow-indigo-600/20"
                                        >
                                          <Check className="w-4 h-4" /> İşlemi Kaydet & Deftere Ekle
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setIsAddingTx(false)}
                                          className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase transition cursor-pointer"
                                        >
                                          Kapat
                                        </button>
                                      </div>
                                    </form>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Transaction History for Selected Contact */}
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  📜 {contact.name} İŞLEM GEÇMİŞİ ({cTxs.length})
                                </h4>
                              </div>

                              {cTxs.length === 0 ? (
                                <div className="p-4 text-center bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400 space-y-2">
                                  <p className="text-xs font-bold italic">Bu kişiye ait henüz kayıtlı borç veya alacak işlemi bulunmuyor.</p>
                                  <button
                                    onClick={() => setIsAddingTx(true)}
                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-sm"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> İlk İşlemi Ekle
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                                  {cTxs.map((tx) => (
                                    <div
                                      key={tx.id}
                                      className={`p-3 rounded-2xl border transition duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                        tx.isPaid
                                          ? "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60"
                                          : tx.type === "receivable"
                                          ? "bg-emerald-500/[0.03] border-emerald-200/60 dark:border-emerald-900/30"
                                          : "bg-rose-500/[0.03] border-rose-200/60 dark:border-rose-900/30"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`p-1.5 rounded-xl shrink-0 ${
                                          tx.type === "receivable"
                                            ? "bg-emerald-500/10 text-emerald-600"
                                            : "bg-rose-500/10 text-rose-500"
                                        }`}>
                                          {tx.type === "receivable" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                        </div>

                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                              tx.type === "receivable"
                                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                                : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                            }`}>
                                              {tx.type === "receivable" ? "ALACAK" : "BORÇ"}
                                            </span>
                                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                              {tx.description}
                                            </h5>
                                          </div>
                                          <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                                            Vade: {tx.dueDate} {tx.isPaid && "• Ödendi / Kapatıldı"}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                        <span className={`text-xs sm:text-sm font-black font-mono ${
                                          tx.type === "receivable" ? "text-emerald-600" : "text-rose-500"
                                        }`}>
                                          {format(tx.amount)}
                                        </span>

                                        <div className="flex items-center gap-1">
                                          {/* Mark Paid Toggle */}
                                          <button
                                            onClick={() => handleToggleTxPaid(tx.id)}
                                            className={`p-1 px-2 rounded-lg text-[9.5px] font-black uppercase tracking-tight transition cursor-pointer flex items-center gap-1 ${
                                              tx.isPaid
                                                ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                            }`}
                                            title={tx.isPaid ? "Ödenmedi olarak işaretle" : "Ödendi olarak kapat"}
                                          >
                                            <Check className="w-3 h-3" />
                                            {tx.isPaid ? "Geri Al" : "Ödendi"}
                                          </button>

                                          {/* Set Reminder */}
                                          {onAddAlarm && !tx.isPaid && (
                                            <button
                                              onClick={() => setReminderTx(tx)}
                                              className="p-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 transition cursor-pointer"
                                              title="Hatırlatıcı / Alarm Kur ⏰"
                                            >
                                              <Bell className="w-3 h-3" />
                                            </button>
                                          )}

                                          {/* Delete */}
                                          <button
                                            onClick={() => handleDeleteTx(tx.id)}
                                            className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 transition cursor-pointer"
                                            title="İşlemi Sil"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* WhatsApp Hazır Mesaj Şablonları */}
                            <div className="p-3.5 bg-indigo-50/50 dark:bg-slate-950/60 rounded-2xl border border-indigo-150/40 dark:border-indigo-950/40 space-y-2.5">
                              <div className="flex items-center gap-1.5 border-b border-indigo-100/40 dark:border-indigo-950/40 pb-1.5">
                                <BellRing className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                                <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                                  HAZIR ALACAK HATIRLATMA MESAJLARI (WHATSAPP)
                                </h4>
                              </div>
                              <p className="text-[9.5px] text-slate-500 dark:text-slate-400 font-semibold leading-snug">
                                <strong>{firstItem.description} ({format(firstItem.amount)})</strong> kaydı için hazırlanmış şablonlar:
                              </p>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                {templates.map((tpl, tIdx) => {
                                  const waLink = `https://wa.me/${waPhone || "90"}?text=${encodeURIComponent(tpl.text)}`;
                                  return (
                                    <div
                                      key={tIdx}
                                      className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between space-y-2.5 shadow-2xs"
                                    >
                                      <div className="space-y-1">
                                        <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 block">
                                          {tpl.title}
                                        </span>
                                        <p className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium leading-snug">
                                          {tpl.desc}
                                        </p>
                                        <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-[9.5px] text-slate-700 dark:text-slate-200 font-medium select-all border border-slate-200/80 dark:border-slate-800 line-clamp-4 leading-relaxed">
                                          {tpl.text}
                                        </div>
                                      </div>

                                      <div className="flex gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700/80">
                                        {/* High contrast copy button with dark background in light mode, light background in dark mode */}
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(tpl.text);
                                            showLocalToast("Kopya Başarılı! 📋");
                                          }}
                                          type="button"
                                          className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-black text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-[10px] font-black rounded-xl cursor-pointer transition active:scale-95 text-center flex items-center justify-center gap-1 shadow-xs"
                                        >
                                          <Copy className="w-3 h-3" />
                                          <span>KOPYALA</span>
                                        </button>
                                        {waPhone && (
                                          <a
                                            href={waLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black rounded-xl text-center uppercase flex items-center justify-center gap-1 shadow-md shadow-emerald-600/20 active:scale-95 transition"
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
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: Summary Dashboard Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card: Total Receivables */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs"
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
          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs"
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
          className={`p-4 rounded-2xl border flex items-center justify-between transition shadow-xs ${
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

      {/* SECTION 4: Charts & Categorical Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Custom Interactive SVG Semi-Gauge Graph */}
        <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700 flex flex-col items-center justify-center space-y-4 shadow-xs">
          <div className="text-center">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
              📊 BORÇ-ALACAK DAHİLİ ORAN DURUMU
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
              Kişilere ait genel sermaye dağıtım dengesi
            </p>
          </div>

          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r="50"
                className="stroke-rose-500 dark:stroke-rose-950/70"
                strokeWidth="12"
                fill="none"
              />
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
        <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700 flex flex-col justify-between space-y-4 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
              📊 KATEGORİSEL REHBER YAPISI
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
              Kategorilere göre kişi rehber yoğunluğu
            </p>
          </div>

          <div className="space-y-3 flex-1 justify-center flex flex-col">
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

      {/* MODALS */}

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
                  <p className="text-[9.5px] text-slate-600 dark:text-slate-400 font-semibold leading-relaxed px-1">
                    Gerçek telefon rehberinizi aktarmak çok kolay! Telefonunuzdan <strong className="text-indigo-600 dark:text-indigo-300">Rehber'e girip "Kişileri Paylaş / Dışa Aktar" (.vcf / vCard)</strong> seçeneğiyle indirdiğiniz yedek dosyasını buraya seçin:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => vcfFileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10.5px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all shadow-md shadow-indigo-600/20"
                >
                  📁 .VCF / vCard Dosyası Yükle
                </button>
              </div>

              {/* Search bar inside picker */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={simulatedSearchText}
                  onChange={(e) => setSimulatedSearchText(e.target.value)}
                  placeholder="Rehberde ara..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none"
                />
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[350px]">
                {simulatedDeviceContacts
                  .filter((sc) => sc.name.toLowerCase().includes(simulatedSearchText.toLowerCase()) || sc.phone.includes(simulatedSearchText))
                  .map((sc, idx) => {
                    const isAlreadyAdded = contacts.some((c) => c.name.toLowerCase() === sc.name.toLowerCase());
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-teal-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {sc.name.charAt(0)}
                          </div>
                          <div className="min-w-0 leading-tight">
                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{sc.name}</h5>
                            <p className="text-[10px] text-slate-400 font-mono">{sc.phone}</p>
                          </div>
                        </div>

                        {isAlreadyAdded ? (
                          <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black rounded-lg uppercase tracking-wider shrink-0 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Eklendi
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSimulatedSelect(sc)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg uppercase tracking-wider shrink-0 transition active:scale-95 cursor-pointer shadow-xs"
                          >
                            Hızlı Ekle ➔
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Delete Contact Modal */}
      <AnimatePresence>
        {contactToDeleteId && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-6 space-y-4 text-center"
            >
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase">
                  Kişiyi ve Tüm Defteri Sil
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Bu kişiyi sildiğinizde, kişiye ait tüm borç ve alacak kayıtları da kalıcı olarak silinecektir. Onaylıyor musunuz?
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    const updatedC = contacts.filter((c) => c.id !== contactToDeleteId);
                    const updatedT = transactions.filter((t) => t.contactId !== contactToDeleteId);
                    saveContactsData(updatedC);
                    saveTxsData(updatedT);
                    if (selectedContactId === contactToDeleteId) {
                      setSelectedContactId(null);
                    }
                    setContactToDeleteId(null);
                    showLocalToast("Kişi ve ilişkili tüm kayıtlar silindi! 🗑️");
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition shadow-md shadow-rose-600/20"
                >
                  Evet, Sil ⚠️
                </button>
                <button
                  onClick={() => setContactToDeleteId(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Vazgeç
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Edit Contact Modal with Photo Upload */}
      <AnimatePresence>
        {contactToEdit && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 text-left"
            >
              <div className="flex items-center gap-3 text-indigo-500">
                <div className="p-3 bg-indigo-500/10 rounded-full">
                  <Edit className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Kişiyi Düzenle</h3>
                  <p className="text-[10px] text-slate-400 font-bold">Kişi fotoğrafı, ad soyad, telefon ve kategori ayarları</p>
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
                      category: editCategory,
                      avatarImage: editAvatarImage || undefined
                    };
                  }
                  return c;
                });
                saveContactsData(updated);
                setContactToEdit(null);
                showLocalToast("Kişi bilgileri ve fotoğrafı başarıyla güncellendi! 💾✨");
              }} className="space-y-3.5">
                {/* Photo in Edit Modal */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="relative shrink-0">
                    {editAvatarImage ? (
                      <img
                        src={editAvatarImage}
                        alt="Önizleme"
                        className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500 shadow-sm"
                      />
                    ) : (
                      <div className={`w-14 h-14 rounded-full bg-gradient-to-tr ${contactToEdit.avatarColor} text-white flex items-center justify-center font-black text-base uppercase shadow-sm`}>
                        {editName ? editName.charAt(0).toUpperCase() : contactToEdit.name.charAt(0)}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => editContactPhotoInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 p-1 bg-indigo-600 text-white rounded-full shadow-md hover:bg-indigo-700 transition cursor-pointer"
                      title="Fotoğrafı Değiştir 📷"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => editContactPhotoInputRef.current?.click()}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-xl border border-indigo-200/50 dark:border-indigo-800 transition cursor-pointer flex items-center gap-1"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        {editAvatarImage ? "Fotoğrafı Değiştir" : "Fotoğraf Yükle"}
                      </button>
                      {editAvatarImage && (
                        <button
                          type="button"
                          onClick={() => setEditAvatarImage(null)}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 text-[10px] font-bold rounded-xl transition cursor-pointer"
                        >
                          Fotoğrafı Kaldır
                        </button>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium mt-1">Profil görseli veya vesikalık fotoğraf yükleyin</p>
                  </div>

                  <input
                    ref={editContactPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        compressAndReadImage(file, (dataUrl) => setEditAvatarImage(dataUrl));
                      }
                      if (e.target) e.target.value = "";
                    }}
                    className="hidden"
                  />
                </div>

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

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition shadow-md shadow-indigo-600/20"
                  >
                    Güncellemeleri Kaydet 💾
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactToEdit(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                  >
                    Vazgeç
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Clear All Contacts Modal */}
      <AnimatePresence>
        {isConfirmClearAllContactsOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-6 space-y-4 text-center"
            >
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase">
                  Tüm Kişi Listesini Sıfırla
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Tüm rehber kişilerini ve bunlara ait geçmiş borç-alacak işlemlerini tamamen temizlemek üzeresiniz. Bu işlem geri alınamaz!
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleClearAllContacts}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition shadow-md shadow-rose-600/20"
                >
                  Evet, Tümünü Sıfırla ⚠️
                </button>
                <button
                  onClick={() => setIsConfirmClearAllContactsOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Vazgeç
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reminder / Alarm Setup Modal */}
      <AnimatePresence>
        {reminderTx && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-6 space-y-4 text-left"
            >
              <div className="flex items-center gap-3 text-indigo-500">
                <div className="p-3 bg-indigo-500/10 rounded-full">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Hatırlatıcı Alarm Kur</h3>
                  <p className="text-[10px] text-slate-400 font-bold">Ödeme vadesi için bildirim alarmı oluşturun</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">İşlem Özeti:</span>
                <p className="text-xs font-black text-slate-800 dark:text-slate-100">{reminderTx.description}</p>
                <p className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                  Tutar: {format(reminderTx.amount)} • Vade: {reminderTx.dueDate}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Alarm Zamanı:</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200">
                    <input
                      type="radio"
                      name="reminderOpt"
                      checked={reminderOption === "day_before"}
                      onChange={() => setReminderOption("day_before")}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>1 Gün Önce (Saat 09:00) ⏰</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200">
                    <input
                      type="radio"
                      name="reminderOpt"
                      checked={reminderOption === "on_date"}
                      onChange={() => setReminderOption("on_date")}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Vade Gününde (Saat 09:00) 📅</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200">
                    <input
                      type="radio"
                      name="reminderOpt"
                      checked={reminderOption === "custom"}
                      onChange={() => setReminderOption("custom")}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Özel Tarih & Saat Seç 🕒</span>
                  </label>
                </div>

                {reminderOption === "custom" && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <input
                      type="date"
                      value={customReminderDate}
                      onChange={(e) => setCustomReminderDate(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 text-xs border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                    />
                    <input
                      type="time"
                      value={customReminderTime}
                      onChange={(e) => setCustomReminderTime(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 text-xs border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSetReminderSubmit}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition shadow-md shadow-indigo-600/20"
                >
                  Alarmı Kur ⏰
                </button>
                <button
                  type="button"
                  onClick={() => setReminderTx(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  İptal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
