import { Package, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
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
import { useIntlLocale } from '@/features/platform/format';
import { type Item, useCreateItem, useItems, usePatchItem } from '../api';
import { DataTable, DtCell, DtHead, DtRow, DtTh } from '../components/data-table';
import { FilterBar, SearchBox, StatusFilter } from '../components/filter-bar';
import { FormField, SwitchRow } from '../components/form-field';
import { MoneyInput } from '../components/money-input';
import { formatAmount } from '../lib/format';
import { type ListSearch, useUrlFilters } from '../lib/url-search';

type FormState = {
  code: string;
  name: string;
  description: string;
  unit: string;
  unitPriceMinor: number | null;
  vatType: Item['vatType'];
  isActive: boolean;
};

const blank: FormState = {
  code: '',
  name: '',
  description: '',
  unit: '',
  unitPriceMinor: null,
  vatType: 'vat',
  isActive: true,
};

function ItemDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: Item | null;
}) {
  const { t } = useTranslation('accounting');
  const [f, setF] = useState<FormState>(blank);
  const [touched, setTouched] = useState(false);
  const create = useCreateItem();
  const patch = usePatchItem();

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setF(
      item
        ? {
            code: item.code ?? '',
            name: item.name,
            description: item.description ?? '',
            unit: item.unit ?? '',
            unitPriceMinor: item.unitPriceMinor,
            vatType: item.vatType,
            isActive: item.isActive,
          }
        : blank,
    );
  }, [open, item]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const nameError = f.name.trim() === '' ? t('validation.required') : undefined;
  const priceError = f.unitPriceMinor === null ? t('validation.required') : undefined;

  const submit = async () => {
    setTouched(true);
    if (nameError) return void toast.error(t('products.reason.name'), { id: 'item-invalid' });
    if (priceError) return void toast.error(t('products.reason.price'), { id: 'item-invalid' });
    const body = {
      code: f.code.trim() || null,
      name: f.name.trim(),
      description: f.description.trim() || null,
      unit: f.unit.trim() || null,
      unitPriceMinor: f.unitPriceMinor ?? 0,
      vatType: f.vatType,
      isActive: f.isActive,
    };
    if (item) await patch.mutateAsync({ id: item.id, body });
    else await create.mutateAsync(body);
    toast.success(t('products.saved'));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{item ? t('products.edit') : t('products.add')}</DialogTitle>
          <DialogDescription>{t('products.dialogHint')}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <FormField label={t('products.code')} htmlFor="it-code">
              <Input
                id="it-code"
                value={f.code}
                maxLength={40}
                onChange={(e) => set('code', e.target.value)}
              />
            </FormField>
            <FormField
              label={t('products.name')}
              htmlFor="it-name"
              required
              error={touched ? nameError : undefined}
            >
              <Input
                id="it-name"
                value={f.name}
                maxLength={200}
                onChange={(e) => set('name', e.target.value)}
              />
            </FormField>
          </div>
          <FormField label={t('products.descriptionLabel')} htmlFor="it-desc">
            <Textarea
              id="it-desc"
              rows={2}
              value={f.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={t('products.unit')} htmlFor="it-unit" hint={t('products.unitHint')}>
              <Input
                id="it-unit"
                value={f.unit}
                maxLength={30}
                onChange={(e) => set('unit', e.target.value)}
              />
            </FormField>
            <FormField
              label={t('products.unitPrice')}
              htmlFor="it-price"
              required
              error={touched ? priceError : undefined}
            >
              <MoneyInput id="it-price" value={f.unitPriceMinor} onChange={(v) => set('unitPriceMinor', v)} />
            </FormField>
            <FormField label={t('products.vatType')} htmlFor="it-vat">
              <Select value={f.vatType} onValueChange={(v) => set('vatType', v as Item['vatType'])}>
                <SelectTrigger id="it-vat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['vat', 'none', 'exempt'] as const).map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`vatType.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <SwitchRow
            checked={f.isActive}
            onCheckedChange={(v) => set('isActive', v)}
            label={t('products.active')}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending || patch.isPending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProductsPage() {
  const { t } = useTranslation('accounting');
  const locale = useIntlLocale();
  const [search, patch] = useUrlFilters<ListSearch>();
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const active = search.status === 'inactive' ? false : search.status === 'active' ? true : undefined;
  const items = useItems({ q: search.q, active, limit: 200 });
  const hasFilters = Boolean(search.q || search.status);

  return (
    <>
      <PageHeader
        title={t('products.title')}
        description={t('products.description')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> {t('products.add')}
          </Button>
        }
      />
      <FilterBar active={hasFilters} onClear={() => patch({ q: undefined, status: undefined })}>
        <SearchBox value={search.q ?? ''} onCommit={(q) => patch({ q })} placeholder={t('products.search')} />
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
        query={items}
        isEmpty={(rows) => rows.length === 0}
        empty={
          <EmptyState
            icon={Package}
            title={hasFilters ? t('emptyFiltered') : t('products.empty')}
            description={hasFilters ? undefined : t('products.emptyHint')}
            action={
              hasFilters ? undefined : (
                <Button onClick={() => setCreating(true)}>
                  <Plus /> {t('products.add')}
                </Button>
              )
            }
          />
        }
      >
        {(rows) => (
          <>
            <ul className="grid gap-2 md:hidden">
              {rows.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(i)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border bg-white p-3 text-left shadow-xs active:bg-mint-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{i.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[i.code, i.unit, t(`vatType.${i.vatType}`)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatAmount(i.unitPriceMinor, locale)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <DataTable>
                <DtHead>
                  <DtTh>{t('products.code')}</DtTh>
                  <DtTh>{t('products.name')}</DtTh>
                  <DtTh>{t('products.unit')}</DtTh>
                  <DtTh num>{t('products.unitPrice')}</DtTh>
                  <DtTh>{t('products.vatType')}</DtTh>
                  <DtTh>{t('col.status')}</DtTh>
                </DtHead>
                <tbody>
                  {rows.map((i) => (
                    <DtRow key={i.id} onClick={() => setEditing(i)}>
                      <DtCell className="font-mono text-xs">{i.code ?? '–'}</DtCell>
                      <DtCell className="max-w-80">
                        <div className="truncate font-medium">{i.name}</div>
                        {i.description ? (
                          <div className="truncate text-xs text-muted-foreground">{i.description}</div>
                        ) : null}
                      </DtCell>
                      <DtCell>{i.unit ?? '–'}</DtCell>
                      <DtCell num className="font-medium">
                        {formatAmount(i.unitPriceMinor, locale)}
                      </DtCell>
                      <DtCell>{t(`vatType.${i.vatType}`)}</DtCell>
                      <DtCell>
                        <Badge variant={i.isActive ? 'success' : 'secondary'}>
                          {i.isActive ? t('contacts.activeLabel') : t('contacts.inactiveLabel')}
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
      <ItemDialog open={creating} onOpenChange={setCreating} item={null} />
      <ItemDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} item={editing} />
    </>
  );
}
