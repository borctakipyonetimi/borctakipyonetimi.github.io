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
}

export interface NotificationItem {
  id: number;
  title: string;
  desc?: string;
}

export interface InstallmentDebt {
  id: number;
  name: string;
  totalAmount: number;
  installmentCount: number;
  paidInstallmentCount: number;
  firstDueDate: string;
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
  carryOverBalance?: number;
}
