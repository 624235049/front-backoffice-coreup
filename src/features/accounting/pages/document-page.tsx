import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, useIntlLocale } from '@/features/platform/format';
import { useCompany, useConvertDocument, useDocument, useDocuments } from '../api';
import { Combobox } from '../components/combobox';
import { type DocKind, detailPath } from '../lib/doc-meta';
import { formatAmount } from '../lib/format';
import { useDebounced } from '../lib/use-debounced';
import { DocumentEditor } from './document-editor';
import { DocumentView } from './document-view';

/** New credit note: first pick the issued invoice / tax invoice being credited, then edit the copied draft. */
function CreditNoteStart() {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const invoices = useDocuments({ type: 'invoice', q: dq || undefined });
  const taxInvoices = useDocuments({ type: 'tax_invoice', q: dq || undefined });
  const convert = useConvertDocument();
  const [picked, setPicked] = useState<{ id: string; label: string } | null>(null);

  const rows = [...(invoices.data?.pages[0]?.data ?? []), ...(taxInvoices.data?.pages[0]?.data ?? [])].filter(
    (d) => d.status !== 'draft' && d.status !== 'void',
  );

  const start = async () => {
    if (!picked) return;
    const created = await convert.mutateAsync({ id: picked.id, to: 'credit_note' });
    toast.success(t('doc.creditNoteCreated'));
    void navigate({ to: detailPath(created.type, created.id) as never, replace: true });
  };

  return (
    <>
      <PageHeader title={t('list.credit_note.add')} description={t('creditStart.description')} />
      <Card className="max-w-2xl">
        <CardContent className="grid gap-4 pt-6">
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{t('creditStart.pick')}</span>
            <Combobox
              value={picked?.id ?? null}
              selectedLabel={picked?.label}
              options={rows.map((d) => ({
                value: d.id,
                label: `${d.number ?? ''} · ${d.contact.name}`,
                hint: `${formatDate(d.docDate, locale)} · ${formatAmount(d.totalMinor, locale)}`,
              }))}
              onSearch={setQ}
              onSelect={(o) => setPicked({ id: o.value, label: o.label })}
              onClear={() => setPicked(null)}
              clearLabel={t('clear')}
              placeholder={t('creditStart.placeholder')}
              emptyText={t('creditStart.none')}
              loading={invoices.isFetching}
              aria-label={t('creditStart.pick')}
            />
          </div>
          <div>
            <Button onClick={() => void start()} disabled={!picked || convert.isPending}>
              {t('creditStart.create')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

/** One page for every document: new draft, edit draft, or read-only view of an issued one. */
export function DocumentPage({ kind, id }: { kind: DocKind; id?: string }) {
  const company = useCompany();
  const doc = useDocument(id);

  if (!id && kind === 'credit_note') return <CreditNoteStart />;

  return (
    <QueryState query={company}>
      {(c) =>
        id ? (
          <QueryState query={doc}>
            {(d) =>
              d.status === 'draft' ? (
                <DocumentEditor key={`${d.id}:${d.updatedAt}`} type={d.type} company={c} doc={d} />
              ) : (
                <DocumentView doc={d} />
              )
            }
          </QueryState>
        ) : (
          <DocumentEditor
            type={kind === 'receipt' ? (c.vatRegistered ? 'tax_invoice' : 'receipt') : kind}
            company={c}
          />
        )
      }
    </QueryState>
  );
}
