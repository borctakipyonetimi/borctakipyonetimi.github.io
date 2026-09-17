/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Debt {
  id: number;
  name: string;
  amount: number;
  paid: number;
  category: string;
  dueDate: string;
  date?: string;
  providerId?: string;
  sonBildirimZamani?: number;
  sonGecikmeBildirimZamani?: number;
}

export interface Income {
  id: number;
  name: string;
  amount: number;
  date: string;
  isRecurring?: boolean;
}

export interface Alarm {
  id: number;
  title: string;
  desc?: string;
  date?: string;
  dateTime?: string;
  timestamp?: number;
}

export interface NotificationItem {
  id: number;
  title: string;
  desc?: string;
  message?: string;
  time?: string;
  date?: string;
  isRead?: boolean;
  type?: string;
  link?: string;
}

export interface InstallmentDebt {
  id: number;
  name: string;
  totalAmount: number;
  installmentCount: number;
  paidInstallmentCount: number;
  firstDueDate: string;
  providerId?: string;
  sonBildirimZamani?: number;
  sonGecikmeBildirimZamani?: number;
}

export interface PaymentLog {
  id: number;
  debtId: number;
  amount: number;
  date: string;
  type: 'manual' | 'installment';
}

export interface Expense {
  id: number;
  categoryId: number;
  category?: string;
  amount: number;
  description: string;
  date: string;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  color?: string;
  icon?: string;
}

export interface AppStateData {
  debts: Debt[];
  incomes: Income[];
  alarms: Alarm[];
  notifications: NotificationItem[];
  installmentDebts: InstallmentDebt[];
  payments: PaymentLog[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
}

export interface FinancialStats {
  totalDebt: number;
  totalPaid: number;
  remaining: number;
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  thisMonthTotalBorc: number;
  thisMonthKalanBorc: number;
  thisMonthPaidBorc?: number;
  carryOverBalance?: number;
  contactPayablesTotal?: number;
  contactPayablesRemaining?: number;
  contactPayablesPaid?: number;
  contactReceivablesTotal?: number;
  contactReceivablesRemaining?: number;
  contactReceivablesCollected?: number;
}

export interface CordovaLocalNotificationOptions {
  id: number;
  title?: string;
  text?: string;
  message?: string;
  trigger?: { at?: Date; in?: number; unit?: string };
  foreground?: boolean;
  vibrate?: boolean;
  sound?: boolean | string;
  priority?: number;
  wakeup?: boolean;
  smallIcon?: string;
  icon?: string;
  data?: any;
  actions?: Array<{ id: string; title: string }>;
}

export interface CordovaLocalNotificationPlugin {
  schedule: (options: CordovaLocalNotificationOptions | CordovaLocalNotificationOptions[], callback?: () => void) => void;
  update?: (options: CordovaLocalNotificationOptions | CordovaLocalNotificationOptions[], callback?: () => void) => void;
  clear?: (id: number | number[], callback?: () => void) => void;
  clearAll?: (callback?: () => void) => void;
  cancel: (id: number | number[], callback?: () => void) => void;
  cancelAll?: (callback?: () => void) => void;
  isPresent?: (id: number, callback: (present: boolean) => void) => void;
  isScheduled?: (id: number, callback: (scheduled: boolean) => void) => void;
  hasPermission?: (callback: (granted: boolean) => void) => void;
  requestPermission?: (callback: (granted: boolean) => void) => void;
  setDefaults?: (defaults: any) => void;
  on?: (event: string, callback: (notification: any) => void) => void;
}

declare global {
  var cordova: any;
  interface Window {
    cordova?: {
      plugins?: {
        notification?: {
          local?: CordovaLocalNotificationPlugin;
        };
        [key: string]: any;
      };
      [key: string]: any;
    };
  }
}
