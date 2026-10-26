import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { OnboardDialog } from '@/features/platform/components/onboard-dialog';
import { buildNewShopMessage } from '@/features/platform/user-helpers';
import common from '@/locales/th/common.json';
import platform from '@/locales/th/platform.json';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/lib/permissions', () => ({ useCan: () => true }));
vi.mock('@/features/platform/components/impersonate-dialog', () => ({
  ImpersonateDialog: ({ open }: { open: boolean }) => (open ? <div>impersonate-open</div> : null),
}));
vi.mock('@/features/platform/api', () => {
  const plan = (code: string, name: string, priceMinor: number, interval: 'month' | 'year' = 'month') => ({
    id: code,
    code,
    name,
    priceMinor,
    interval,
    active: true,
    selfServe: true,
    tenantCount: 0,
    modules: ['core'],
    limits: {},
    // sold plans carry sales copy (the admin's data); the internal ฿0 plan does not. Pro has the card badge = the default
    marketing:
      priceMinor === 0
        ? null
        : {
            sort: code === 'line-pro' ? 30 : 10,
            setupFeeMinor: 0,
            extraBranchMinor: 0,
            th: { ...copy, displayName: name, badge: code === 'line-pro' ? 'แนะนำ' : '' },
            en: { ...copy, displayName: name, badge: '' },
          },
  });
  const copy = {
    displayName: '',
    pitch: '',
    worth: '',
    highlights: [],
    moveUpWhen: '',
    badge: '',
    setupFee: '',
    footnotes: [],
  };
  const plans = [
    plan('multi', 'Multi-branch', 0),
    plan('line-basic', 'Basic', 29_900),
    plan('line-pro', 'Pro', 59_900),
  ];
  return {
    usePlans: () => ({ data: plans }),
    useCreateTenant: () => ({ mutateAsync: mocks.create, isPending: false }),
  };
});

const i18n = i18next.createInstance();
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'th',
    resources: { th: { platform, common } },
    defaultNS: 'platform',
    interpolation: { escapeValue: false },
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const credentials = {
  email: 'owner@shop.test',
  password: 'P96L-LmAc-EbQm',
  loginUrl: 'https://coreup.biz/sign-in',
};

function renderDialog(onCreated = vi.fn(), onOpenChange = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <OnboardDialog open onOpenChange={onOpenChange} onCreated={onCreated} />
    </I18nextProvider>,
  );
  return { onCreated, onOpenChange };
}

function fill() {
  fireEvent.change(screen.getByLabelText('ชื่อร้าน'), { target: { value: 'ร้านดอกไม้' } });
  fireEvent.change(screen.getByLabelText('อีเมลเจ้าของ'), { target: { value: 'Owner@Shop.test' } });
  fireEvent.change(screen.getByLabelText('เบอร์มือถือเจ้าของ'), { target: { value: '0812345678' } });
  fireEvent.change(screen.getByLabelText('ชื่อสาขา 1'), { target: { value: 'สาขาหลัก' } });
}

describe('OnboardDialog', () => {
  it('has the owner fields in order, the email without browser autofill, phone defaulting to +66, Pro preselected and password mode checked', () => {
    renderDialog();
    const order = ['ชื่อร้าน', 'ธุรกิจ', 'แพ็กเกจ', 'ชื่อเจ้าของ', 'อีเมลเจ้าของ', 'เบอร์มือถือเจ้าของ', 'สถานะเริ่มต้น'].map(
      (l) => screen.getByLabelText(l),
    );
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]?.compareDocumentPosition(order[i] as Element)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
    const email = screen.getByLabelText('อีเมลเจ้าของ');
    expect(email.getAttribute('type')).toBe('email');
    expect(email.getAttribute('autocomplete')).toBe('off');
    expect(screen.getByTestId('phone-dial').textContent).toBe('+66');
    // the internal ฿0 plan is never the default: Pro is
    expect(screen.getByLabelText('แพ็กเกจ').textContent).toContain('Pro');
    expect(screen.getByLabelText('แพ็กเกจ').textContent).not.toContain('Multi-branch');
    const [password, invite] = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(password?.checked).toBe(true);
    expect(invite?.checked).toBe(false);
    expect(screen.getByText('สร้างบัญชีพร้อมรหัสผ่าน (แนะนำ)')).toBeTruthy();
    expect(screen.getByText('ส่งลิงก์ตั้งรหัสผ่านทางอีเมล')).toBeTruthy();
  });

  it('refuses to submit without a valid mobile', async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText('ชื่อร้าน'), { target: { value: 'ร้านดอกไม้' } });
    fireEvent.change(screen.getByLabelText('อีเมลเจ้าของ'), { target: { value: 'owner@shop.test' } });
    fireEvent.change(screen.getByLabelText('ชื่อสาขา 1'), { target: { value: 'สาขาหลัก' } });
    fireEvent.click(screen.getByRole('button', { name: 'เปิดร้าน' }));
    await waitFor(() => expect(screen.getByText('กรุณากรอกข้อมูล')).toBeTruthy());
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('sends the normalised phone and account mode, then shows the result screen with a ready message to copy', async () => {
    mocks.create.mockResolvedValue({
      data: {
        tenantId: 'tid-1',
        slug: 'ran-dok-mai',
        ownerUserId: 'u1',
        branchIds: [],
        passwordResetSent: false,
        ownerCredentials: credentials,
        ownerExisted: false,
      },
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { onCreated, onOpenChange } = renderDialog();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'เปิดร้าน' }));

    await waitFor(() => expect(screen.getByTestId('onboard-result')).toBeTruthy());
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ร้านดอกไม้',
        ownerEmail: 'owner@shop.test',
        ownerPhone: '+66812345678',
        ownerAccount: 'password',
        planCode: 'line-pro',
        status: 'trial',
      }),
    );
    const result = screen.getByTestId('onboard-result');
    expect(result.textContent).toContain('https://www.coreup.pro/b/ran-dok-mai');
    expect(result.textContent).toContain(credentials.loginUrl);
    expect(result.textContent).toContain(credentials.email);
    expect(result.textContent).toContain(credentials.password);
    expect(result.textContent).toContain('รหัสผ่านแสดงครั้งเดียว ปิดหน้านี้แล้วดูอีกไม่ได้');
    expect(onCreated).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'คัดลอกข้อความส่งลูกค้า' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenLastCalledWith(
      [
        'สวัสดีค่ะ 😊 ร้าน ร้านดอกไม้ พร้อมใช้งานแล้วค่ะ',
        '🔗 ลิงก์ให้ลูกค้าจอง: https://www.coreup.pro/b/ran-dok-mai',
        '💻 เข้าหลังร้าน: https://coreup.biz/sign-in',
        'อีเมล: owner@shop.test',
        'รหัสผ่าน: P96L-LmAc-EbQm',
        'แนะนำเปลี่ยนรหัสผ่านหลังเข้าใช้ครั้งแรกที่ ตั้งค่า › บัญชี ค่ะ',
        'ทดลองฟรี 1 เดือน มีอะไรสงสัยทักแอดมินทาง LINE ได้เลยค่ะ: lin.ee/YOZXXvW',
      ].join('\n'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'คัดลอกรหัสผ่าน' }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('P96L-LmAc-EbQm'));

    fireEvent.click(screen.getByRole('button', { name: /เข้าดูแทนร้าน/ }));
    expect(screen.getByText('impersonate-open')).toBeTruthy();

    // closing the result is what leaves for the shop page
    fireEvent.click(screen.getByRole('button', { name: /ไปที่หน้าร้าน/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCreated).toHaveBeenCalledWith('tid-1');
  });

  it('invite mode (or an owner who already had an account) shows no password screen: toast and straight to the shop', async () => {
    mocks.create.mockResolvedValue({
      data: {
        tenantId: 'tid-2',
        slug: 's',
        ownerUserId: 'u1',
        branchIds: [],
        passwordResetSent: false,
        ownerCredentials: null,
        ownerExisted: true,
      },
    });
    const { onCreated } = renderDialog();
    fill();
    fireEvent.click(screen.getAllByRole('radio')[1] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'เปิดร้าน' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('tid-2'));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ ownerAccount: 'invite' }));
    expect(screen.queryByTestId('onboard-result')).toBeNull();
    expect(mocks.toast.success).toHaveBeenCalledWith(platform.onboard.createdExisting);
  });
});

describe('buildNewShopMessage', () => {
  it('drops the free-trial sentence for a shop that starts active', () => {
    const msg = buildNewShopMessage({
      shop: 'ร้าน A',
      slug: 'a',
      email: 'a@b.test',
      password: 'pw',
      loginUrl: 'https://coreup.biz/sign-in',
      trial: false,
    });
    expect(msg.split('\n').at(-1)).toBe('มีอะไรสงสัยทักแอดมินทาง LINE ได้เลยค่ะ: lin.ee/YOZXXvW');
  });
});
