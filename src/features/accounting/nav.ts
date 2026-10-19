import {
  BookUser,
  Building2,
  Calculator,
  ChartColumn,
  FileCheck2,
  FileMinus2,
  FileText,
  Landmark,
  Package,
  ReceiptText,
  Wallet,
} from 'lucide-react';
import type { NavItem } from '@/lib/navigation';
import { BANK_CARD_ID } from './lib/bank-accounts';

const base = { permission: 'platform:accounting', module: 'platform', section: 'accounting' } as const;

export const navItems: NavItem[] = [
  { ...base, to: '/accounting', labelKey: 'nav:accOverview', icon: Calculator, exact: true, order: 10 },
  { ...base, to: '/accounting/quotations', labelKey: 'nav:accQuotations', icon: FileText, order: 20 },
  { ...base, to: '/accounting/invoices', labelKey: 'nav:accInvoices', icon: ReceiptText, order: 30 },
  { ...base, to: '/accounting/receipts', labelKey: 'nav:accReceipts', icon: FileCheck2, order: 40 },
  { ...base, to: '/accounting/credit-notes', labelKey: 'nav:accCreditNotes', icon: FileMinus2, order: 50 },
  { ...base, to: '/accounting/expenses', labelKey: 'nav:accExpenses', icon: Wallet, order: 60 },
  { ...base, to: '/accounting/contacts', labelKey: 'nav:accContacts', icon: BookUser, order: 70 },
  { ...base, to: '/accounting/products', labelKey: 'nav:accProducts', icon: Package, order: 80 },
  { ...base, to: '/accounting/reports', labelKey: 'nav:accReports', icon: ChartColumn, order: 90 },
  { ...base, to: '/accounting/settings', labelKey: 'nav:accSettings', icon: Building2, order: 100 },
  {
    ...base,
    to: '/accounting/settings',
    hash: BANK_CARD_ID,
    labelKey: 'nav:accBankAccounts',
    icon: Landmark,
    order: 105,
  },
];
