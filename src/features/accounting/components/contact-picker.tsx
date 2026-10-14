import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useContacts } from '../api';
import { useDebounced } from '../lib/use-debounced';
import { Combobox } from './combobox';
import { ContactDialog } from './contact-dialog';

/** Type-to-search customer / vendor picker with an inline "new contact" shortcut. */
export function ContactPicker({
  value,
  label,
  onChange,
  kind,
  disabled,
  invalid,
}: {
  value: string | null;
  label: string;
  onChange: (c: { id: string; name: string } | null) => void;
  kind: 'customer' | 'vendor';
  disabled?: boolean;
  invalid?: boolean;
}) {
  const { t } = useTranslation('accounting');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const debounced = useDebounced(q, 250);
  const contacts = useContacts({ q: debounced || undefined, kind, active: true, limit: 20 });

  return (
    <>
      <Combobox
        className={invalid ? '[&_input]:border-destructive' : undefined}
        value={value}
        selectedLabel={label}
        options={(contacts.data ?? []).map((c) => ({
          value: c.id,
          label: c.name,
          hint: [c.taxId, c.linkedTenantName ? `${t('contacts.shop')}: ${c.linkedTenantName}` : null]
            .filter(Boolean)
            .join(' · '),
        }))}
        onSearch={setQ}
        onSelect={(o) => onChange({ id: o.value, name: o.label })}
        onClear={() => onChange(null)}
        clearLabel={t('clear')}
        placeholder={kind === 'vendor' ? t('contacts.pickVendor') : t('contacts.pickCustomer')}
        emptyText={t('contacts.noMatch')}
        loading={contacts.isFetching}
        disabled={disabled}
        aria-label={kind === 'vendor' ? t('contacts.vendor') : t('contacts.customer')}
        footer={
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-2 px-3 text-sm font-medium text-mint-700 hover:bg-mint-50"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setCreating(true)}
          >
            <Plus className="size-4" /> {t('contacts.add')}
          </button>
        }
      />
      <ContactDialog
        open={creating}
        onOpenChange={setCreating}
        defaultKind={kind}
        onSaved={(c) => onChange({ id: c.id, name: c.name })}
      />
    </>
  );
}
