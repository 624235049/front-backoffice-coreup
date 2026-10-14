import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTenants } from '@/features/platform/api';
import { type Contact, fetchContactPrefill, useCreateContact, usePatchContact } from '../api';
import { isOptionalEmailOk, isOptionalTaxIdOk } from '../lib/tax-id';
import { useDebounced } from '../lib/use-debounced';
import { Combobox } from './combobox';
import { FormField, SwitchRow } from './form-field';

type Kind = Contact['kind'];

type FormState = {
  kind: Kind;
  name: string;
  taxId: string;
  branchCode: string;
  address: string;
  contactPerson: string;
  phone: string;
  email: string;
  note: string;
  linkedTenantId: string | null;
  linkedTenantName: string;
  isActive: boolean;
};

const empty = (kind: Kind): FormState => ({
  kind,
  name: '',
  taxId: '',
  branchCode: '00000',
  address: '',
  contactPerson: '',
  phone: '',
  email: '',
  note: '',
  linkedTenantId: null,
  linkedTenantName: '',
  isActive: true,
});

const fromContact = (c: Contact): FormState => ({
  kind: c.kind,
  name: c.name,
  taxId: c.taxId ?? '',
  branchCode: c.branchCode ?? '',
  address: c.address ?? '',
  contactPerson: c.contactPerson ?? '',
  phone: c.phone ?? '',
  email: c.email ?? '',
  note: c.note ?? '',
  linkedTenantId: c.linkedTenantId,
  linkedTenantName: c.linkedTenantName ?? '',
  isActive: c.isActive,
});

/** Create or edit a contact (customer / vendor / both), optionally linked to a CoreUp shop with auto-fill. */
export function ContactDialog({
  open,
  onOpenChange,
  contact,
  defaultKind = 'customer',
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  defaultKind?: Kind;
  onSaved?: (c: Contact) => void;
}) {
  const { t } = useTranslation('accounting');
  const [f, setF] = useState<FormState>(empty(defaultKind));
  const [touched, setTouched] = useState(false);
  const create = useCreateContact();
  const patch = usePatchContact();
  const [shopQ, setShopQ] = useState('');
  const shopQuery = useDebounced(shopQ, 250);
  const shops = useTenants({ q: shopQuery || undefined, limit: 8 });

  useEffect(() => {
    if (open) {
      setF(contact ? fromContact(contact) : empty(defaultKind));
      setTouched(false);
      setShopQ('');
    }
  }, [open, contact, defaultKind]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const errors = {
    name: f.name.trim() === '' ? t('validation.required') : undefined,
    taxId: isOptionalTaxIdOk(f.taxId) ? undefined : t('validation.taxId'),
    branchCode: f.branchCode === '' || /^\d{5}$/.test(f.branchCode) ? undefined : t('validation.branchCode'),
    email: isOptionalEmailOk(f.email) ? undefined : t('validation.email'),
  };
  const invalid = Object.values(errors).some(Boolean);
  const pending = create.isPending || patch.isPending;

  const pickShop = async (id: string, name: string) => {
    try {
      const p = await fetchContactPrefill(id);
      if (p.existingContactId && p.existingContactId !== contact?.id)
        toast.info(t('contacts.shopAlreadyLinked'));
      setF((s) => ({
        ...s,
        linkedTenantId: id,
        linkedTenantName: name,
        name: s.name.trim() ? s.name : p.name,
        address: s.address.trim() ? s.address : (p.address ?? ''),
        email: s.email.trim() ? s.email : (p.email ?? ''),
        phone: s.phone.trim() ? s.phone : (p.phone ?? ''),
      }));
    } catch {
      toast.error(t('contacts.prefillFailed'));
    }
  };

  const submit = async () => {
    setTouched(true);
    if (invalid) return;
    const body = {
      kind: f.kind,
      name: f.name.trim(),
      taxId: f.taxId.trim() || null,
      branchCode: f.branchCode.trim() || null,
      address: f.address.trim() || null,
      contactPerson: f.contactPerson.trim() || null,
      phone: f.phone.trim() || null,
      email: f.email.trim() || null,
      note: f.note.trim() || null,
      linkedTenantId: f.linkedTenantId,
      isActive: f.isActive,
    };
    const saved = contact
      ? await patch.mutateAsync({ id: contact.id, body })
      : await create.mutateAsync(body);
    toast.success(t('contacts.saved'));
    onOpenChange(false);
    onSaved?.(saved);
  };

  const show = (e: string | undefined) => (touched ? e : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{contact ? t('contacts.edit') : t('contacts.add')}</DialogTitle>
          <DialogDescription>{t('contacts.dialogHint')}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('contacts.kind')} htmlFor="ct-kind">
              <Select value={f.kind} onValueChange={(v) => set('kind', v as Kind)}>
                <SelectTrigger id="ct-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['customer', 'vendor', 'both'] as const).map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`contacts.kinds.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t('contacts.linkedShop')} hint={t('contacts.linkedShopHint')}>
              <Combobox
                value={f.linkedTenantId}
                selectedLabel={f.linkedTenantName}
                options={(shops.data ?? []).map((s) => ({ value: s.id, label: s.name, hint: s.slug }))}
                onSearch={setShopQ}
                onSelect={(o) => void pickShop(o.value, o.label)}
                onClear={() => setF((s) => ({ ...s, linkedTenantId: null, linkedTenantName: '' }))}
                clearLabel={t('clear')}
                placeholder={t('contacts.pickShop')}
                emptyText={t('contacts.noShops')}
                loading={shops.isFetching}
                aria-label={t('contacts.linkedShop')}
              />
            </FormField>
          </div>

          <FormField label={t('contacts.name')} htmlFor="ct-name" required error={show(errors.name)}>
            <Input
              id="ct-name"
              value={f.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={200}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('contacts.taxId')} htmlFor="ct-tax" error={show(errors.taxId)}>
              <Input
                id="ct-tax"
                inputMode="numeric"
                maxLength={13}
                value={f.taxId}
                onChange={(e) => set('taxId', e.target.value.replace(/\D/g, ''))}
              />
            </FormField>
            <FormField
              label={t('contacts.branchCode')}
              htmlFor="ct-branch"
              error={show(errors.branchCode)}
              hint={t('contacts.branchHint')}
            >
              <Input
                id="ct-branch"
                inputMode="numeric"
                maxLength={5}
                value={f.branchCode}
                onChange={(e) => set('branchCode', e.target.value.replace(/\D/g, ''))}
              />
            </FormField>
          </div>

          <FormField label={t('contacts.address')} htmlFor="ct-addr">
            <Textarea
              id="ct-addr"
              rows={2}
              value={f.address}
              onChange={(e) => set('address', e.target.value)}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={t('contacts.contactPerson')} htmlFor="ct-person">
              <Input
                id="ct-person"
                value={f.contactPerson}
                onChange={(e) => set('contactPerson', e.target.value)}
              />
            </FormField>
            <FormField label={t('contacts.phone')} htmlFor="ct-phone">
              <Input
                id="ct-phone"
                inputMode="tel"
                value={f.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </FormField>
            <FormField label={t('contacts.email')} htmlFor="ct-email" error={show(errors.email)}>
              <Input
                id="ct-email"
                type="email"
                value={f.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </FormField>
          </div>

          <FormField label={t('contacts.note')} htmlFor="ct-note">
            <Textarea id="ct-note" rows={2} value={f.note} onChange={(e) => set('note', e.target.value)} />
          </FormField>

          {contact ? (
            <SwitchRow
              checked={f.isActive}
              onCheckedChange={(v) => set('isActive', v)}
              label={t('contacts.active')}
            />
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
