import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QueryState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useCreateCategory, useDeleteCategory, useExpenseCategories, usePatchCategory } from '../api';

/** Expense categories: shown in /accounting/settings and under the expenses list (expenses-only staff have no settings page). */
export function CategoriesCard() {
  const { t } = useTranslation('accounting');
  const categories = useExpenseCategories();
  const create = useCreateCategory();
  const patch = usePatchCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('settings.categories')}</CardTitle>
        <CardDescription>{t('settings.categoriesHint')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <QueryState query={categories}>
          {(rows) => (
            <ul className="grid gap-1.5">
              {rows.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
                  {editing?.id === c.id ? (
                    <form
                      className="flex min-w-0 flex-1 gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!editing.name.trim()) return void toast.warning(t('settings.categoryNameNeeded'));
                        if (editing.name.trim())
                          patch.mutate(
                            { id: c.id, body: { name: editing.name.trim() } },
                            { onSuccess: () => setEditing(null) },
                          );
                      }}
                    >
                      <Input
                        value={editing.name}
                        maxLength={80}
                        autoFocus
                        aria-label={t('settings.categoryName')}
                        onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                      />
                      <Button type="submit">{t('save')}</Button>
                      <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                        {t('cancel')}
                      </Button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                        onClick={() => setEditing({ id: c.id, name: c.name })}
                      >
                        {c.name}
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {t('settings.categoryUsed', { count: c.usedCount })}
                      </span>
                      {!c.isActive ? <Badge variant="secondary">{t('contacts.inactiveLabel')}</Badge> : null}
                      <Switch
                        checked={c.isActive}
                        aria-label={t('contacts.active')}
                        onCheckedChange={(v) => patch.mutate({ id: c.id, body: { isActive: v } })}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={t('doc.line.remove')}
                        blockedReason={c.usedCount > 0 && t('settings.categoryInUse')}
                        disabled={remove.isPending}
                        onClick={() =>
                          remove.mutate(c.id, {
                            onSuccess: () => toast.success(t('settings.categoryDeleted')),
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </QueryState>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return void toast.warning(t('settings.categoryNameNeeded'));
            if (name.trim())
              create.mutate(
                { name: name.trim() },
                {
                  onSuccess: () => {
                    setName('');
                    toast.success(t('settings.categoryAdded'));
                  },
                },
              );
          }}
        >
          <Input
            value={name}
            maxLength={80}
            placeholder={t('settings.newCategory')}
            aria-label={t('settings.newCategory')}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={create.isPending}
            blockedReason={!name.trim() && t('settings.categoryNameNeeded')}
          >
            <Plus /> {t('settings.addCategory')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
