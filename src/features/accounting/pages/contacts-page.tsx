import { BookUser, Plus, Store } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Contact, useContacts } from '../api';
import { ContactDialog } from '../components/contact-dialog';
import { DataTable, DtCell, DtHead, DtRow, DtTh } from '../components/data-table';
import { FilterBar, SearchBox, StatusFilter } from '../components/filter-bar';
import { type ListSearch, useUrlFilters } from '../lib/url-search';

export function ContactsPage() {
  const { t } = useTranslation('accounting');
  const [search, patch] = useUrlFilters<ListSearch>();
  const [editing, setEditing] = useState<Contact | null>(null);
  const [creating, setCreating] = useState(false);

  const kind = search.type === 'customer' || search.type === 'vendor' ? search.type : undefined;
  const active = search.status === 'inactive' ? false : search.status === 'active' ? true : undefined;
  const contacts = useContacts({ q: search.q, kind, active, limit: 200 });
  const hasFilters = Boolean(search.q || search.type || search.status);

  return (
    <>
      <PageHeader
        title={t('contacts.title')}
        description={t('contacts.description')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> {t('contacts.add')}
          </Button>
        }
      />
      <FilterBar
        active={hasFilters}
        onClear={() => patch({ q: undefined, type: undefined, status: undefined })}
      >
        <SearchBox value={search.q ?? ''} onCommit={(q) => patch({ q })} placeholder={t('contacts.search')} />
        <StatusFilter
          value={kind}
          onChange={(v) => patch({ type: v })}
          options={[
            { value: 'customer', label: t('contacts.kinds.customer') },
            { value: 'vendor', label: t('contacts.kinds.vendor') },
          ]}
          allLabel={t('contacts.allKinds')}
          label={t('contacts.kind')}
        />
        <StatusFilter
          value={search.status}
          onChange={(v) => patch({ status: v })}
          options={[
            { value: 'active', label: t('contacts.activeOnly') },
            { value: 'inactive', label: t('contacts.inactiveOnly') },
          ]}
          allLabel={t('contacts.allStatuses')}
          label={t('col.status')}
        />
      </FilterBar>

      <QueryState
        query={contacts}
        isEmpty={(rows) => rows.length === 0}
        empty={
          <EmptyState
            icon={BookUser}
            title={hasFilters ? t('emptyFiltered') : t('contacts.empty')}
            description={hasFilters ? undefined : t('contacts.emptyHint')}
            action={
              hasFilters ? undefined : (
                <Button onClick={() => setCreating(true)}>
                  <Plus /> {t('contacts.add')}
                </Button>
              )
            }
          />
        }
      >
        {(rows) => (
          <>
            <ul className="grid gap-2 md:hidden">
              {rows.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    className="flex w-full flex-col gap-1 rounded-xl border bg-white p-3 text-left shadow-xs active:bg-mint-50"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-medium">{c.name}</span>
                      <Badge variant="secondary">{t(`contacts.kinds.${c.kind}`)}</Badge>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {[c.taxId, c.phone, c.email].filter(Boolean).join(' · ') || '–'}
                    </span>
                    {c.linkedTenantName ? (
                      <span className="inline-flex items-center gap-1 text-xs text-mint-700">
                        <Store className="size-3" /> {c.linkedTenantName}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <DataTable>
                <DtHead>
                  <DtTh>{t('contacts.name')}</DtTh>
                  <DtTh>{t('contacts.kind')}</DtTh>
                  <DtTh>{t('contacts.taxId')}</DtTh>
                  <DtTh>{t('contacts.contactPerson')}</DtTh>
                  <DtTh>{t('contacts.phone')}</DtTh>
                  <DtTh>{t('contacts.email')}</DtTh>
                  <DtTh>{t('contacts.linkedShop')}</DtTh>
                  <DtTh>{t('col.status')}</DtTh>
                </DtHead>
                <tbody>
                  {rows.map((c) => (
                    <DtRow key={c.id} onClick={() => setEditing(c)}>
                      <DtCell className="max-w-64 truncate font-medium">{c.name}</DtCell>
                      <DtCell>
                        <Badge variant="secondary">{t(`contacts.kinds.${c.kind}`)}</Badge>
                      </DtCell>
                      <DtCell className="font-mono text-xs">{c.taxId ?? '–'}</DtCell>
                      <DtCell>{c.contactPerson ?? '–'}</DtCell>
                      <DtCell className="whitespace-nowrap">{c.phone ?? '–'}</DtCell>
                      <DtCell>{c.email ?? '–'}</DtCell>
                      <DtCell>{c.linkedTenantName ?? '–'}</DtCell>
                      <DtCell>
                        <Badge variant={c.isActive ? 'success' : 'secondary'}>
                          {c.isActive ? t('contacts.activeLabel') : t('contacts.inactiveLabel')}
                        </Badge>
                      </DtCell>
                    </DtRow>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </>
        )}
      </QueryState>

      <ContactDialog open={creating} onOpenChange={setCreating} />
      <ContactDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} contact={editing} />
    </>
  );
}
