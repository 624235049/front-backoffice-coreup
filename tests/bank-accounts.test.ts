import { describe, expect, it } from 'vitest';
import {
  BANK_CARD_ID,
  type Bank,
  bankAccountError,
  bankChoice,
  chooseBank,
  OTHER_BANK,
  usedForSubscriptions,
} from '@/features/accounting/lib/bank-accounts';
import {
  buildPromptPayPayload,
  crc16Ccitt,
  isValidPromptPayAccount,
  isValidThaiNationalId,
} from '@/features/accounting/lib/promptpay';
import { navItems } from '@/features/accounting/nav';
import { buildNav } from '@/lib/navigation';
import { membership } from './fixtures';

const bank = (over: Partial<Bank> = {}): Bank => ({
  id: 'b1',
  kind: 'bank',
  bankCode: 'KBANK',
  bankName: 'กสิกรไทย',
  accountName: 'บริษัท คอร์อัพ จำกัด',
  accountNo: '123-4-56789-0',
  branch: null,
  forSubscriptions: true,
  ...over,
});

describe('PromptPay id validation (same rule as the API)', () => {
  it('accepts a Thai mobile, ignoring spaces and dashes', () => {
    expect(isValidPromptPayAccount('0812345678')).toBe(true);
    expect(isValidPromptPayAccount('081-234 5678')).toBe(true);
  });

  it('accepts a 13-digit id only with a correct check digit', () => {
    expect(isValidThaiNationalId('1101700230708')).toBe(true);
    expect(isValidPromptPayAccount('1101700230708')).toBe(true);
    expect(isValidPromptPayAccount('1101700230709')).toBe(false);
  });

  it('rejects wrong lengths, non-mobile prefixes and letters', () => {
    expect(isValidPromptPayAccount('')).toBe(false);
    expect(isValidPromptPayAccount('081234567')).toBe(false);
    expect(isValidPromptPayAccount('0212345678')).toBe(false);
    expect(isValidPromptPayAccount('08123abcde')).toBe(false);
  });
});

describe('sample QR payload', () => {
  it('is a dynamic QR whose CRC matches, with the amount and the 0066 phone form', () => {
    const p = buildPromptPayPayload('0812345678', 100_000);
    expect(p.startsWith('000201010212')).toBe(true);
    expect(p).toContain('0066812345678');
    expect(p).toContain('54071000.00');
    expect(p.slice(-4)).toBe(crc16Ccitt(p.slice(0, -4)));
  });

  it('uses the national-id sub tag for a 13-digit id', () => {
    expect(buildPromptPayPayload('1101700230708', 5_000)).toContain('02131101700230708');
  });
});

describe('receiving account form validation', () => {
  it('passes a complete bank account and a valid PromptPay account', () => {
    expect(bankAccountError(bank())).toBeUndefined();
    expect(
      bankAccountError(
        bank({ kind: 'promptpay', bankCode: 'PROMPTPAY', accountNo: '0812345678', branch: null }),
      ),
    ).toBeUndefined();
  });

  it('requires an account number', () => {
    expect(bankAccountError(bank({ accountNo: '  ' }))).toBe('accountNo');
  });

  it('flags an invalid PromptPay id, even when the account is not for subscriptions', () => {
    const pp = bank({ kind: 'promptpay', bankCode: 'PROMPTPAY', accountNo: '1101700230709' });
    expect(bankAccountError(pp)).toBe('promptpayId');
    expect(bankAccountError({ ...pp, forSubscriptions: false })).toBe('promptpayId');
  });

  it('asks for what shops see (account name, bank name) only when used for subscriptions', () => {
    expect(bankAccountError(bank({ accountName: ' ' }))).toBe('accountName');
    expect(bankAccountError(bank({ accountName: null, forSubscriptions: false }))).toBeUndefined();
    expect(bankAccountError(bank({ bankCode: null, bankName: null }))).toBe('bankName');
  });

  it('keeps rows saved before the picker working: no code shows the free-text name, no flag means "use"', () => {
    const legacy = bank({ bankCode: null, bankName: 'ธนาคารเก่า', forSubscriptions: undefined });
    expect(bankChoice(legacy)).toBe(OTHER_BANK);
    expect(usedForSubscriptions(legacy)).toBe(true);
    expect(bankAccountError(legacy)).toBeUndefined();
    expect(bankChoice(bank({ kind: 'promptpay', bankCode: null }))).toBe('PROMPTPAY');
  });
});

describe('bank picker', () => {
  it('a bank code sets kind and Thai name; PromptPay drops the branch; "other" keeps the typed name', () => {
    const picked = chooseBank(bank({ bankName: null, branch: 'สีลม' }), 'SCB');
    expect(picked).toMatchObject({ kind: 'bank', bankCode: 'SCB', bankName: 'ไทยพาณิชย์', branch: 'สีลม' });
    expect(chooseBank(picked, 'PROMPTPAY')).toMatchObject({
      kind: 'promptpay',
      bankCode: 'PROMPTPAY',
      bankName: 'พร้อมเพย์',
      branch: null,
    });
    expect(chooseBank(picked, OTHER_BANK)).toMatchObject({
      kind: 'bank',
      bankCode: null,
      bankName: 'ไทยพาณิชย์',
    });
  });
});

describe('nav item "บัญชีรับเงินบริษัท"', () => {
  const tos = (permissions: string[]) =>
    buildNav(navItems, membership({ permissions, modules: ['platform'] }), 'full')
      .flatMap((g) => g.items)
      .filter((i) => i.hash);

  it('deep-links to the settings card and needs the same permission as the settings page', () => {
    const [item] = tos(['platform:accounting']);
    expect(item).toMatchObject({ to: '/accounting/settings', hash: BANK_CARD_ID });
    expect(tos(['platform:billing'])).toEqual([]);
  });
});
