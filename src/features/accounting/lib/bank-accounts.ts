import type { Company } from '../api';
import { isValidPromptPayAccount } from './promptpay';

export type Bank = Company['bankAccounts'][number];
export type BankCode = NonNullable<Bank['bankCode']>;

/** Anchor of the settings card, also the hash of the nav item "บัญชีรับเงินบริษัท" (`/accounting/settings#…`). */
export const BANK_CARD_ID = 'company-bank-accounts';

/** Same list as `THAI_BANKS` in the API schema (keyed by the API enum, so a new code fails the typecheck). */
export const THAI_BANKS: Record<BankCode, { nameTh: string; nameEn: string; color: string }> = {
  KBANK: { nameTh: 'กสิกรไทย', nameEn: 'Kasikornbank', color: '#1DA858' },
  SCB: { nameTh: 'ไทยพาณิชย์', nameEn: 'Siam Commercial Bank', color: '#543186' },
  BBL: { nameTh: 'กรุงเทพ', nameEn: 'Bangkok Bank', color: '#29449D' },
  KTB: { nameTh: 'กรุงไทย', nameEn: 'Krungthai Bank', color: '#1DA8E6' },
  BAY: { nameTh: 'กรุงศรีอยุธยา', nameEn: 'Krungsri', color: '#FFD51C' },
  TTB: { nameTh: 'ทหารไทยธนชาต', nameEn: 'TMBThanachart Bank', color: '#0C55F2' },
  GSB: { nameTh: 'ออมสิน', nameEn: 'Government Savings Bank', color: '#ED1891' },
  BAAC: { nameTh: 'ธ.ก.ส.', nameEn: 'BAAC', color: '#CCA41C' },
  GHB: { nameTh: 'อาคารสงเคราะห์', nameEn: 'GH Bank', color: '#FF8614' },
  KKP: { nameTh: 'เกียรตินาคินภัทร', nameEn: 'Kiatnakin Phatra Bank', color: '#5A547C' },
  CIMB: { nameTh: 'ซีไอเอ็มบี ไทย', nameEn: 'CIMB Thai', color: '#BD1325' },
  UOB: { nameTh: 'ยูโอบี', nameEn: 'UOB', color: '#E41A26' },
  LHB: { nameTh: 'แลนด์ แอนด์ เฮ้าส์', nameEn: 'LH Bank', color: '#727375' },
  TISCO: { nameTh: 'ทิสโก้', nameEn: 'TISCO Bank', color: '#267CBC' },
  ICBC: { nameTh: 'ไอซีบีซี (ไทย)', nameEn: 'ICBC (Thai)', color: '#CD1511' },
  TCR: { nameTh: 'ไทยเครดิต', nameEn: 'Thai Credit Bank', color: '#FF7813' },
  IBANK: { nameTh: 'อิสลามแห่งประเทศไทย', nameEn: 'Islamic Bank of Thailand', color: '#164626' },
  PROMPTPAY: { nameTh: 'พร้อมเพย์', nameEn: 'PromptPay', color: '#0C4370' },
};

export const BANK_CODES = Object.keys(THAI_BANKS) as BankCode[];

/** Picker value for a row that has no `bankCode` (saved before the picker existed): free-text bank name. */
export const OTHER_BANK = 'OTHER';
export type BankChoice = BankCode | typeof OTHER_BANK;

/** Rows saved before `forSubscriptions` existed count as "use for subscriptions" (the API default). */
export const usedForSubscriptions = (b: Bank): boolean => b.forSubscriptions !== false;

export const bankChoice = (b: Bank): BankChoice =>
  b.bankCode ?? (b.kind === 'promptpay' ? 'PROMPTPAY' : OTHER_BANK);

/** Apply a picker choice: the code decides the kind and fills the Thai bank name. */
export function chooseBank(b: Bank, choice: BankChoice): Bank {
  if (choice === OTHER_BANK) return { ...b, kind: 'bank', bankCode: null };
  return {
    ...b,
    kind: choice === 'PROMPTPAY' ? 'promptpay' : 'bank',
    bankCode: choice,
    bankName: THAI_BANKS[choice].nameTh,
    branch: choice === 'PROMPTPAY' ? null : b.branch,
  };
}

export type BankError = 'accountNo' | 'promptpayId' | 'accountName' | 'bankName';

/** First problem with one receiving account (null/undefined when fine). Shops see the accounts flagged for subscriptions. */
export function bankAccountError(b: Bank): BankError | undefined {
  if (b.accountNo.trim() === '') return 'accountNo';
  if (b.kind === 'promptpay' && !isValidPromptPayAccount(b.accountNo)) return 'promptpayId';
  if (!usedForSubscriptions(b)) return undefined;
  if (!b.accountName?.trim()) return 'accountName';
  if (b.kind === 'bank' && !b.bankName?.trim()) return 'bankName';
  return undefined;
}
