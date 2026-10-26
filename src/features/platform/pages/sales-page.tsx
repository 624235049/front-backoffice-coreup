import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { SalesControlBar } from '../components/sales-control-bar';
import { formatDateTime } from '../format';
import {
  type SalesConfig,
  type SalesLead,
  useFlagSalesReply,
  usePatchSalesLead,
  usePreviewBroadcast,
  useSalesBoard,
  useSalesBroadcasts,
  useSalesConfig,
  useSalesFeatureRequests,
  useSalesLead,
  useSalesReplies,
  useSalesTest,
  useSaveSalesConfig,
  useSendBroadcast,
} from '../sales-api';

const STAGES = [
  ['new', 'ใหม่'],
  ['talking', 'คุยแล้ว'],
  ['trial_link_sent', 'ส่งลิงก์ทดลอง'],
  ['signed_up', 'สมัครแล้ว'],
  ['setup_stuck', 'ตั้งร้านค้าง'],
  ['ready_to_pay', 'พร้อมจ่าย'],
  ['paid', 'จ่ายแล้ว'],
  ['not_interested', 'ไม่สนใจ'],
  ['lost', 'หาย'],
] as const;
const STUCK: Record<string, string> = {
  price: 'ราคา',
  not_understood: 'ไม่เข้าใจระบบ',
  line_connect: 'เชื่อม LINE ไม่ได้',
  no_time: 'ไม่มีเวลาตั้ง',
  partner: 'รอปรึกษาหุ้นส่วน',
  not_needed: 'ยังไม่จำเป็น',
  other: 'อื่น ๆ',
};
const CHANNEL: Record<string, string> = { line: 'LINE', messenger: 'Messenger', instagram: 'Instagram' };
const OUTCOME = [
  ['talked', 'คุยแล้ว'],
  ['no_answer', 'ไม่รับสาย'],
  ['reschedule', 'นัดใหม่'],
] as const;

/** CoreUp's AI salesperson: the leads board, callbacks, answers to review, broadcast, settings and the test chat. */
export function SalesPage() {
  const { lead } = useSearch({ from: '/_app/platform/sales' });
  const navigate = useNavigate();
  const [stage, setStage] = useState<string | undefined>(undefined);
  const board = useSalesBoard({ stage });
  const cfg = useSalesConfig();
  const b = board.data;
  return (
    <div className="mx-auto grid max-w-6xl gap-4">
      <PageHeader
        title="AI ขาย"
        description="ลูกค้าที่ AI คุยอยู่ ติดตรงไหน ใครพร้อมจ่าย และใครรอให้โทรกลับ"
        actions={
          b ? (
            <span className="text-sm text-muted-foreground">
              🔥 พร้อมจ่าย {b.hot} · โทรกลับรอ {b.callbacks.length}
            </span>
          ) : undefined
        }
      />
      {cfg.data ? <SalesControlBar view={cfg.data} /> : null}
      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">กระดานลีด</TabsTrigger>
          <TabsTrigger value="calls">โทรกลับ ({b?.callbacks.length ?? 0})</TabsTrigger>
          <TabsTrigger value="review">คำตอบที่ถูกบล็อก/ส่งต่อ</TabsTrigger>
          <TabsTrigger value="features">คำขอฟีเจอร์</TabsTrigger>
          <TabsTrigger value="broadcast">บรอดแคสต์</TabsTrigger>
          <TabsTrigger value="test">ทดลองคุย</TabsTrigger>
          <TabsTrigger value="settings">ตั้งค่า</TabsTrigger>
        </TabsList>
        <TabsContent value="board" className="grid gap-3">
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant={stage ? 'outline' : 'default'} onClick={() => setStage(undefined)}>
              ทั้งหมด
            </Button>
            {STAGES.map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                variant={stage === k ? 'default' : 'outline'}
                onClick={() => setStage(k)}
              >
                {label} {b?.counts[k] ?? 0}
              </Button>
            ))}
          </div>
          {b && Object.keys(b.stuck).length > 0 ? (
            <p className="text-sm text-muted-foreground">
              ติดเรื่อง:{' '}
              {Object.entries(b.stuck)
                .map(([k, n]) => `${STUCK[k] ?? k} ${n}`)
                .join(' · ')}
            </p>
          ) : null}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {(b?.leads ?? []).map((l) => (
              <LeadCard
                key={l.id}
                lead={l}
                onOpen={() => navigate({ to: '/platform/sales', search: { lead: l.id } })}
              />
            ))}
            {b && b.leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีลูกค้าในสถานะนี้</p>
            ) : null}
          </div>
        </TabsContent>
        <TabsContent value="calls">
          <Callbacks leads={b?.callbacks ?? []} />
        </TabsContent>
        <TabsContent value="review">
          <Review />
        </TabsContent>
        <TabsContent value="features">
          <FeatureRequests onOpen={(id) => navigate({ to: '/platform/sales', search: { lead: id } })} />
        </TabsContent>
        <TabsContent value="broadcast">
          <Broadcast />
        </TabsContent>
        <TabsContent value="test">
          <TestChat />
        </TabsContent>
        <TabsContent value="settings">
          <Settings />
        </TabsContent>
      </Tabs>
      <LeadSheet id={lead ?? null} onClose={() => navigate({ to: '/platform/sales', search: {} })} />
    </div>
  );
}

function LeadCard({ lead: l, onOpen }: { lead: SalesLead; onOpen: () => void }) {
  const paused = l.aiPausedUntil !== null;
  return (
    <Card className="cursor-pointer transition hover:shadow-md" onClick={onOpen}>
      <CardContent className="grid gap-1.5 p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">
            {l.buySignal ? '🔥 ' : ''}
            {l.name ?? 'ไม่ทราบชื่อ'}
          </span>
          <Badge variant="secondary">{STAGES.find(([k]) => k === l.stage)?.[1]}</Badge>
        </div>
        <div className="text-muted-foreground">
          {CHANNEL[l.channel]} · {l.businessType ?? 'ยังไม่รู้ชนิดร้าน'}
          {l.staffCount ? ` · ${l.staffCount} คน` : ''}
          {l.recommendedPlan ? ` · ${l.recommendedPlan}` : ''}
        </div>
        {l.stuckReason ? (
          <div>
            ติด: <b>{STUCK[l.stuckReason]}</b>
            {l.stuckNote ? ` (${l.stuckNote})` : ''}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span>ล่าสุด {formatDateTime(l.lastContactAt)}</span>
          {l.nextFollowUpAt ? <span>ตามต่อ {formatDateTime(l.nextFollowUpAt)}</span> : null}
          {paused ? <span className="font-medium text-amber-700">คนรับต่อ (AI หยุด)</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function LeadSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useSalesLead(id);
  const patch = usePatchSalesLead();
  const flag = useFlagSalesReply();
  const l = q.data;
  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {l ? `${l.buySignal ? '🔥 ' : ''}${l.name ?? 'ไม่ทราบชื่อ'} · ${CHANNEL[l.channel]}` : 'ลูกค้า'}
          </SheetTitle>
        </SheetHeader>
        {l && id ? (
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              {l.aiPausedUntil ? (
                <Button onClick={() => patch.mutate({ id, body: { aiPaused: false } })}>คืนให้ AI ตอบต่อ</Button>
              ) : (
                <Button onClick={() => patch.mutate({ id, body: { aiPaused: true } })}>
                  ฉันรับต่อเอง (AI หยุด 24 ชม.)
                </Button>
              )}
              <Button variant="outline" onClick={() => patch.mutate({ id, body: { stage: 'paid' } })}>
                จ่ายแล้ว
              </Button>
              <Button variant="outline" onClick={() => patch.mutate({ id, body: { stage: 'lost' } })}>
                หาย
              </Button>
              <Button
                variant="outline"
                onClick={() => patch.mutate({ id, body: { stage: 'not_interested' } })}
              >
                ไม่สนใจ
              </Button>
            </div>
            <div>
              สาเหตุที่ติด:{' '}
              <select
                className="rounded border px-2 py-1"
                value={l.stuckReason ?? ''}
                onChange={(e) =>
                  patch.mutate({ id, body: { stuckReason: (e.target.value || null) as never } })
                }
              >
                <option value="">-</option>
                {Object.entries(STUCK).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <dl className="grid grid-cols-2 gap-1 text-muted-foreground">
              <dt>ชนิดร้าน</dt>
              <dd>{l.businessType ?? '-'}</dd>
              <dt>คน / สาขา</dt>
              <dd>
                {l.staffCount ?? '-'} / {l.branchCount ?? '-'}
              </dd>
              <dt>ปัญหา</dt>
              <dd>{l.pain ?? '-'}</dd>
              <dt>แนะนำ</dt>
              <dd>{l.recommendedPlan ?? '-'}</dd>
              <dt>ข้อโต้แย้ง</dt>
              <dd>{l.objections.join(', ') || '-'}</dd>
              <dt>ร้านที่สมัคร</dt>
              <dd>{l.tenantName ?? '-'}</dd>
              <dt>ตามไปแล้ว</dt>
              <dd>{l.followUpCount} ครั้ง</dd>
            </dl>
            <div>
              <div className="mb-1 font-semibold">แชท (เก็บ 30 วัน)</div>
              <div className="grid max-h-72 gap-1 overflow-y-auto rounded border p-2">
                {l.transcript.map((m, i) => (
                  <div
                    key={`${m.at}-${i}`}
                    className={m.role === 'user' ? 'text-left' : 'text-right text-blue-900'}
                  >
                    <span className="inline-block max-w-[85%] whitespace-pre-wrap rounded bg-muted px-2 py-1">
                      {m.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 font-semibold">คำตอบของ AI (กด 👎 ถ้าไม่ดี → เข้าชุดทดสอบ)</div>
              {l.replies.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-2 border-b py-1">
                  <span className="text-xs">
                    [{r.source}/{r.intent}
                    {r.guard ? ` · ${r.guard}` : ''}] {r.replyText.slice(0, 140)}
                  </span>
                  <Button
                    size="sm"
                    variant={r.flagged ? 'default' : 'ghost'}
                    onClick={() => flag.mutate({ id: r.id, flagged: !r.flagged })}
                  >
                    👎
                  </Button>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 font-semibold">ประวัติ</div>
              {l.events.map((e, i) => (
                <div key={`${e.at}-${i}`} className="text-xs text-muted-foreground">
                  {formatDateTime(e.at)} · {e.kind} {e.detail ?? ''}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Callbacks({ leads }: { leads: SalesLead[] }) {
  const patch = usePatchSalesLead();
  if (leads.length === 0) return <p className="text-sm text-muted-foreground">ไม่มีคนรอให้โทรกลับ</p>;
  return (
    <div className="grid gap-2">
      {leads.map((l) => (
        <Card key={l.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div>
              <div className="font-semibold">
                {l.name ?? 'ไม่ทราบชื่อ'} · {l.businessType ?? '-'}
              </div>
              <div className="text-muted-foreground">
                ช่วง {l.callbackWindow ?? '-'} {l.callbackAt ? `(${formatDateTime(l.callbackAt)})` : ''}
              </div>
              {l.callbackPhone ? (
                <a className="font-medium text-blue-700 underline" href={`tel:${l.callbackPhone}`}>
                  โทร {l.callbackPhone}
                </a>
              ) : null}
            </div>
            <div className="flex gap-1.5">
              <span className="self-center text-xs text-muted-foreground">โทรแล้ว:</span>
              {OUTCOME.filter(([k]) => k !== 'reschedule').map(([k, label]) => (
                <Button
                  key={k}
                  size="sm"
                  variant="outline"
                  onClick={() => patch.mutate({ id: l.id, body: { callbackOutcome: k } })}
                >
                  {label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  patch.mutate({
                    id: l.id,
                    body: {
                      callbackOutcome: 'reschedule',
                      callbackAt: new Date(Date.now() + 86_400_000).toISOString(),
                    },
                  })
                }
              >
                นัดใหม่ (พรุ่งนี้)
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Review() {
  const [filter, setFilter] = useState<'review' | 'flagged' | 'all'>('review');
  const q = useSalesReplies(filter);
  const flag = useFlagSalesReply();
  return (
    <div className="grid gap-2">
      <div className="flex gap-1.5">
        {(['review', 'flagged', 'all'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
          >
            {f === 'review' ? 'ถูกบล็อก/ส่งต่อ' : f === 'flagged' ? 'ติด 👎' : 'ทั้งหมด'}
          </Button>
        ))}
      </div>
      {(q.data ?? []).map((r) => (
        <Card key={r.id}>
          <CardContent className="grid gap-1 p-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {formatDateTime(r.at)} · {r.leadName ?? '-'} · {r.source}/{r.intent}
                {r.guard ? ` · ผิดข้อ ${r.guard}` : ''}
              </span>
              <Button
                size="sm"
                variant={r.flagged ? 'default' : 'ghost'}
                onClick={() => flag.mutate({ id: r.id, flagged: !r.flagged })}
              >
                👎
              </Button>
            </div>
            <div>ลูกค้า: {r.userText}</div>
            <div className="text-blue-900">AI: {r.replyText || '(ส่งข้อความรอ + แจ้งคน)'}</div>
          </CardContent>
        </Card>
      ))}
      {q.data?.length === 0 ? <p className="text-sm text-muted-foreground">ไม่มีรายการ</p> : null}
    </div>
  );
}

function Broadcast() {
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [image, setImage] = useState('');
  const [stages, setStages] = useState<string[]>(['trial_link_sent']);
  const [industry, setIndustry] = useState('');
  const [silent, setSilent] = useState('');
  const [signedUp, setSignedUp] = useState<'' | 'yes' | 'no'>('');
  const preview = usePreviewBroadcast();
  const send = useSendBroadcast();
  const past = useSalesBroadcasts();
  const body = {
    audience: {
      ...(stages.length > 0 ? { stages: stages as never } : {}),
      ...(industry ? { industryKey: industry } : {}),
      ...(silent ? { silentDays: Number(silent) } : {}),
      ...(signedUp ? { signedUp: signedUp === 'yes' } : {}),
    },
    message: { text, ...(link ? { linkUrl: link } : {}), ...(image ? { imageUrl: image } : {}) },
  };
  const p = preview.data;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">เลือกกลุ่มและเขียนข้อความ</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {STAGES.filter(([k]) => !['paid', 'not_interested', 'lost'].includes(k)).map(([k, label]) => (
              <label key={k} className="flex items-center gap-1.5">
                <Checkbox
                  checked={stages.includes(k)}
                  onCheckedChange={(c) => setStages(c ? [...stages, k] : stages.filter((x) => x !== k))}
                />
                {label}
              </label>
            ))}
          </div>
          <Input
            placeholder="ชนิดร้าน (เช่น nail, spa) เว้นว่าง = ทุกชนิด"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
          <Input
            placeholder="ไม่ตอบมาแล้วกี่วัน (เช่น 7)"
            value={silent}
            onChange={(e) => setSilent(e.target.value.replace(/\D/g, ''))}
          />
          <select
            className="rounded border px-2 py-1"
            value={signedUp}
            onChange={(e) => setSignedUp(e.target.value as never)}
          >
            <option value="">สมัครหรือยังก็ได้</option>
            <option value="no">ยังไม่สมัคร</option>
            <option value="yes">สมัครแล้ว</option>
          </select>
          <Textarea
            rows={4}
            maxLength={300}
            placeholder="ข้อความสั้น ๆ (≤ 300 ตัวอักษร)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Input placeholder="ลิงก์ (ไม่บังคับ)" value={link} onChange={(e) => setLink(e.target.value)} />
          <Input placeholder="ลิงก์รูปภาพ (ไม่บังคับ)" value={image} onChange={(e) => setImage(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="outline" disabled={!text} onClick={() => preview.mutate(body as never)}>
              ดูจำนวนก่อนส่ง
            </Button>
            <Button
              disabled={!text || !p || p.recipients === 0 || send.isPending}
              onClick={() => send.mutate(body as never)}
            >
              ส่ง LINE {p ? `${p.recipients} คน` : ''}
            </Button>
          </div>
          {p ? (
            <div className="rounded bg-muted p-2 text-xs">
              จะส่ง <b>{p.recipients}</b> ข้อความ (นับโควตา push LINE) · วันนี้เหลือ {p.pushesLeftToday} · ข้ามไว้:
              Meta {p.skipped.meta} (ส่งนอก 24 ชม. ไม่ได้) · ได้รับแล้วใน 7 วัน {p.skipped.cap} · ไม่สนใจ/หยุดส่ง{' '}
              {p.skipped.optOut} · ปิดดีลแล้ว {p.skipped.closed}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ที่ส่งไปแล้ว</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {(past.data ?? []).map((b) => (
            <div key={b.id} className="border-b pb-1">
              <div className="text-xs text-muted-foreground">
                {formatDateTime(b.createdAt)} · ส่งถึง {b.sentCount} คน
              </div>
              <div>{b.message}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

type Msg = { role: 'user' | 'assistant'; content: string };
function TestChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [lead, setLead] = useState<Record<string, unknown> | undefined>(undefined);
  const [text, setText] = useState('');
  const [info, setInfo] = useState('');
  const test = useSalesTest();
  const go = () => {
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setText('');
    test.mutate(
      { messages: next, lead: lead as never },
      {
        onSuccess: (r) => {
          setMsgs([...next, ...r.bubbles.map((b) => ({ role: 'assistant' as const, content: b }))]);
          setLead(r.lead);
          setInfo(
            `${r.source === 'model' ? 'โมเดล' : 'เทมเพลต ฿0'} · ${r.key}${r.alert ? ` · แจ้งเจ้าของ: ${r.alert}` : ''}${r.guard ? ` · guard: ${r.guard}` : ''}${r.costMinor ? ` · ≈ ${(r.costMinor / 100).toFixed(3)} ฿` : ''}`,
          );
        },
      },
    );
  };
  return (
    <Card className="max-w-xl">
      <CardContent className="grid gap-2 p-3 text-sm">
        <div className="grid max-h-96 gap-1 overflow-y-auto rounded border p-2">
          {msgs.map((m, i) => (
            <div
              key={`${i}-${m.content.slice(0, 6)}`}
              className={m.role === 'user' ? 'text-left' : 'text-right'}
            >
              <span
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded px-2 py-1 ${m.role === 'user' ? 'bg-muted' : 'bg-blue-50 text-blue-900'}`}
              >
                {m.content}
              </span>
            </div>
          ))}
          {msgs.length === 0 ? (
            <span className="text-muted-foreground">พิมพ์เป็นลูกค้า เช่น "ร้านทำเล็บค่ะ ทำคนเดียว"</span>
          ) : null}
        </div>
        {info ? <div className="text-xs text-muted-foreground">{info}</div> : null}
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && text && go()}
            placeholder="ข้อความลูกค้า"
          />
          <Button disabled={!text || test.isPending} onClick={go}>
            ส่ง
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setMsgs([]);
              setLead(undefined);
              setInfo('');
            }}
          >
            เริ่มใหม่
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">ใช้แผนและค่าตั้งจริง ไม่ส่งอะไรออกไป ไม่บันทึก ไม่แจ้งเตือนใคร</p>
      </CardContent>
    </Card>
  );
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
const pairs = (s: string) => lines(s).map((l) => l.split('|').map((x) => x.trim()));

function Settings() {
  const q = useSalesConfig();
  const save = useSaveSalesConfig();
  if (!q.data) return null;
  return <SettingsForm view={q.data} onSave={(c) => save.mutate(c)} pending={save.isPending} />;
}

function SettingsForm({
  view,
  onSave,
  pending,
}: {
  view: NonNullable<ReturnType<typeof useSalesConfig>['data']>;
  onSave: (c: SalesConfig) => void;
  pending: boolean;
}) {
  const c = view.config;
  const [faq, setFaq] = useState(c.faq.map((f) => `${f.q} | ${f.a}`).join('\n'));
  const [forbidden, setForbidden] = useState(c.forbidden.join('\n'));
  const [tone, setTone] = useState(c.toneExamples);
  const [f, setF] = useState({
    videoUrl: c.videoUrl,
    signupUrl: c.signupUrl,
    trainingBookingUrl: c.trainingBookingUrl,
    manualUrl: c.manualUrl,
    businessPhone: c.businessPhone,
    summaryEmail: c.summaryEmail,
  });
  const [lineCall, setLineCall] = useState(c.lineCallEnabled);
  const [recipients, setRecipients] = useState(
    c.alertRecipients.map((r) => `${r.label} | ${r.lineUserId}`).join('\n'),
  );
  const [demo, setDemo] = useState(
    Object.entries(c.demoLinks)
      .map(([k, v]) => `${k} | ${v}`)
      .join('\n'),
  );
  const [caps, setCaps] = useState({ push: String(c.lineDailyPushCap), alert: String(c.alertDailyCap) });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });
  const u = view.usage;
  return (
    <div className="grid max-w-3xl gap-3 text-sm">
      <Card>
        <CardContent className="grid gap-3 p-3">
          {!view.modelReady ? (
            <p className="text-amber-700">ยังไม่ได้ตั้ง key โมเดล: เทมเพลตตอบได้ แต่คำถามอิสระจะส่งข้อความรอ + แจ้งทีม</p>
          ) : null}
          <p className="text-xs text-muted-foreground">เปิด/ปิดตามช่องทางอยู่ที่แถบด้านบนของหน้านี้ (บันทึกทันที)</p>
          <div>
            <div className="mb-1 font-medium">
              คำตอบที่อยากให้ตอบ (คำถาม | คำตอบ บรรทัดละข้อ) · ตัวเลขราคา/บัญชีมาจากแผนเอง ไม่ต้องพิมพ์
            </div>
            <Textarea rows={8} value={faq} onChange={(e) => setFaq(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 font-medium">ห้ามพูดว่ามี (บรรทัดละข้อ)</div>
            <Textarea rows={3} value={forbidden} onChange={(e) => setForbidden(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 font-medium">ตัวอย่างแชทจริงของเจ้าของ 10–20 แชท (ใช้เลียนน้ำเสียงเท่านั้น)</div>
            <Textarea rows={6} value={tone} onChange={(e) => setTone(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="ลิงก์วิดีโอสั้น (ส่งตอนขอคิดก่อน)" value={f.videoUrl} onChange={set('videoUrl')} />
            <Input
              placeholder="ลิงก์จองช่วยตั้งร้าน/สอนใช้งาน"
              value={f.trainingBookingUrl}
              onChange={set('trainingBookingUrl')}
            />
            <Input placeholder="ลิงก์คู่มือ" value={f.manualUrl} onChange={set('manualUrl')} />
            <Input
              placeholder="ลิงก์สมัคร (ว่าง = หน้า /onboarding ของแอปร้าน)"
              value={f.signupUrl}
              onChange={set('signupUrl')}
            />
            <Input
              placeholder="เบอร์ธุรกิจที่เสนอให้โทรเอง"
              value={f.businessPhone}
              onChange={set('businessPhone')}
            />
            <Input placeholder="อีเมลสรุป 08:00" value={f.summaryEmail} onChange={set('summaryEmail')} />
          </div>
          <label className="flex items-center gap-2">
            <Switch checked={lineCall} onCheckedChange={setLineCall} /> เปิด LINE Call ไว้ (เสนอพร้อมเบอร์)
          </label>
          <div>
            <div className="mb-1 font-medium">ร้านตัวอย่างตามชนิดร้าน (ชนิด | ลิงก์)</div>
            <Textarea rows={3} value={demo} onChange={(e) => setDemo(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 font-medium">
              ผู้รับแจ้งเตือนใน LINE (ชื่อ | LINE userId) — 🔥 พร้อมจ่าย · 📞 โทรกลับ · 🙋 ส่งต่อ · ❓ ถามเจ้าของ · 🎓 สอน
              · 💰 แจ้งโอน · 🗞 สรุป
            </div>
            <Textarea rows={2} value={recipients} onChange={(e) => setRecipients(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label>
              เพดาน push LINE ตามลูกค้า/วัน{' '}
              <Input
                value={caps.push}
                onChange={(e) => setCaps({ ...caps, push: e.target.value.replace(/\D/g, '') })}
              />
            </label>
            <label>
              เพดานแจ้งเตือนเจ้าของใน LINE/วัน{' '}
              <Input
                value={caps.alert}
                onChange={(e) => setCaps({ ...caps, alert: e.target.value.replace(/\D/g, '') })}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            วันนี้ใช้ push ตามลูกค้า/บรอดแคสต์ {u.followUpPushes}/{u.pushCap} · แจ้งเตือนเจ้าของ {u.alertPushes}/
            {u.alertCap}
          </p>
          <Button
            disabled={pending}
            onClick={() =>
              onSave({
                ...c,
                faq: pairs(faq).flatMap(([q, ...a]) =>
                  q && a.length > 0 ? [{ q, a: a.join('|').trim() }] : [],
                ),
                forbidden: lines(forbidden),
                toneExamples: tone,
                ...f,
                lineCallEnabled: lineCall,
                demoLinks: Object.fromEntries(pairs(demo).flatMap(([k, v]) => (k && v ? [[k, v]] : []))),
                alertRecipients: pairs(recipients).flatMap(([label, id]) =>
                  label && id ? [{ label, lineUserId: id, channelAccountId: null }] : [],
                ),
                lineDailyPushCap: Number(caps.push || 0),
                alertDailyCap: Number(caps.alert || 0),
              })
            }
          >
            บันทึก
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

const FIT_TITLE = { fits: 'เหมาะกับระบบ (ควรทำ)', outside: 'นอกขอบเขต (ทีมพิจารณา)' } as const;

/** Feature requests grouped by fit: what the AI promised to pass on, how many asked, the newest chat to open. */
function FeatureRequests({ onOpen }: { onOpen: (leadId: string) => void }) {
  const q = useSalesFeatureRequests();
  const groups = q.data ?? [];
  return (
    <div className="grid gap-4" data-testid="feature-requests">
      {(['fits', 'outside'] as const).map((fit) => {
        const rows = groups.filter((g) => g.fit === fit);
        return (
          <section key={fit} className="grid gap-2">
            <h3 className="font-semibold">
              {FIT_TITLE[fit]} ({rows.length})
            </h3>
            {rows.length === 0 ? <p className="text-sm text-muted-foreground">ยังไม่มี</p> : null}
            {rows.map((g) => (
              <Card key={`${fit}-${g.text}`}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div>
                    <div className="font-medium">{g.text}</div>
                    <div className="text-xs text-muted-foreground">
                      ถาม {g.count} ครั้ง · ล่าสุด {formatDateTime(g.latestAt)}
                      {g.businessTypes.length > 0 ? ` · ${g.businessTypes.join(', ')}` : ''}
                    </div>
                  </div>
                  {g.leadId ? (
                    <Button size="sm" variant="outline" onClick={() => onOpen(g.leadId as string)}>
                      เปิดแชท
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </section>
        );
      })}
    </div>
  );
}
