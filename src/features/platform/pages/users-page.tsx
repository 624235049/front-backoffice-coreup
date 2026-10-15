import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMe } from '@/lib/me';
import { useMembership } from '@/lib/membership';
import { type UsersQuery, useTenants, useUsers } from '../api';
import { UsersPanel } from '../components/users-panel';

const ALL = '__all__';
const PAGE_SIZE = 25;

/** `/platform/users` — find any account across all shops and help locked-out people (docs/09). Owners change, admins read. */
export function UsersPage() {
  const { t } = useTranslation('users');
  const canChange = useMembership().roles.includes('platform_owner');
  const selfId = useMe().data?.user.id;
  const tenants = useTenants({});
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [tenantId, setTenantId] = useState(ALL);
  const [team, setTeam] = useState(ALL);
  const [page, setPage] = useState(1);

  // search as you type, but only after a short pause (and always from page 1)
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [text]);

  const query: UsersQuery = {
    q: q || undefined,
    tenantId: tenantId === ALL ? undefined : tenantId,
    team: team === ALL ? undefined : (team as 'true' | 'false'),
    page,
    limit: PAGE_SIZE,
  };
  const users = useUsers(query);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={canChange ? t('description.owner') : t('description.readOnly')}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          className="w-full sm:max-w-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
        />
        <Select
          value={tenantId}
          onValueChange={(v) => {
            setTenantId(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-52" aria-label={t('filter.shop')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('filter.allShops')}</SelectItem>
            {(tenants.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={team}
          onValueChange={(v) => {
            setTeam(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label={t('filter.team')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('filter.everyone')}</SelectItem>
            <SelectItem value="true">{t('filter.teamOnly')}</SelectItem>
            <SelectItem value="false">{t('filter.shopsOnly')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <QueryState
        query={users}
        isEmpty={(res) => res.data.length === 0}
        empty={<EmptyState icon={Users} title={t('empty')} />}
      >
        {(res) => (
          <>
            <UsersPanel rows={res.data} canChange={canChange} selfId={selfId} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>{t('total', { count: res.meta?.total ?? res.data.length })}</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label={t('prev')}
                >
                  <ChevronLeft />
                </Button>
                <span>{t('pageNo', { page })}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!res.page.hasMore}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label={t('next')}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
