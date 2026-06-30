'use client';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { studioApi } from '@/lib/api';
import {
  TEMPLATES, templateByKey, REWARD_KINDS, EVENT_TYPES,
  type Theme, type Matchmaker, type Reward,
} from '@/lib/studio';
import { Preview, SURFACES, type Surface, type PreviewModel } from '@/components/studio/Preview';

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

type Draft = {
  venueId: string | null;
  venueName: string;
  type: string;
  name: string;
  description: string;
  date: string; start: string; end: string;
  theme: Theme;
  mm: Matchmaker;
  rewards: Reward[];
  venueExtra: { address: string; instagram: string; about: string; ambient_photos: string[]; map_url: string };
};

const STEPS = ['Local', 'Tipo', 'Quando', 'Visual', 'Matchmaker', 'Prêmios', 'Revisar', 'Publicar'];

function todayStr() {
  const d = new Date(); const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function toISO(date: string, time: string, addDayIfBefore?: string) {
  if (!date || !time) return '';
  let d = new Date(`${date}T${time}:00`);
  if (addDayIfBefore && time <= addDayIfBefore) d = new Date(d.getTime() + 86400_000);
  return d.toISOString();
}

export default function Studio() {
  const [key, setKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState('');
  useEffect(() => { const k = localStorage.getItem('mn_admin_key'); if (k) { setKey(k); login(k); } }, []);
  async function login(k: string) {
    try { await studioApi.listVenues(k); setAuthed(true); localStorage.setItem('mn_admin_key', k); setAuthErr(''); }
    catch { setAuthErr('Chave inválida.'); setAuthed(false); }
  }
  if (!authed) return (
    <main className="px-6 pt-24">
      <h1 className="text-2xl font-black">Studio · criar evento</h1>
      <p className="mt-1 text-sm text-muted">Entre com a chave de organizador.</p>
      <input className="input mt-6" type="password" placeholder="Chave admin" value={key} onChange={(e) => setKey(e.target.value)} />
      {authErr && <p className="mt-2 text-sm text-glow">{authErr}</p>}
      <button onClick={() => login(key)} className="btn mt-3 w-full bg-glow2 py-3 text-white">Entrar</button>
    </main>
  );
  return <Wizard adminKey={key} />;
}

function Wizard({ adminKey }: { adminKey: string }) {
  const t0 = TEMPLATES[0];
  const [step, setStep] = useState(0);
  const [surface, setSurface] = useState<Surface>('event');
  const [venues, setVenues] = useState<any[]>([]);
  const [published, setPublished] = useState<{ slug: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [d, setD] = useState<Draft>({
    venueId: null, venueName: '', type: t0.type, name: t0.theme.headline,
    description: t0.theme.subcopy, date: todayStr(), start: '21:00', end: '02:00',
    theme: { ...t0.theme, logo_url: '' }, mm: t0.matchmaker, rewards: t0.rewards,
    venueExtra: { address: '', instagram: '', about: '', ambient_photos: [], map_url: '' },
  });
  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));
  const setTheme = (patch: Partial<Theme>) => setD((p) => ({ ...p, theme: { ...p.theme, ...patch } }));
  const setMM = (patch: Partial<Matchmaker>) => setD((p) => ({ ...p, mm: { ...p.mm, ...patch } }));

  useEffect(() => { studioApi.listVenues(adminKey).then(setVenues).catch(() => {}); }, [adminKey]);

  function applyTemplate(key: string) {
    const tp = templateByKey(key);
    setD((p) => ({
      ...p, type: tp.type,
      name: p.name && p.name !== p.theme.headline ? p.name : tp.theme.headline,
      description: tp.theme.subcopy,
      theme: {
        ...tp.theme, logo_url: p.theme.logo_url,
        // mantém identidade do local se já escolhida
        primary: p.venueId && p.theme.primary !== TEMPLATES.find(x => x.theme.primary === p.theme.primary)?.theme.primary ? p.theme.primary : tp.theme.primary,
        cover_url: p.theme.cover_url && p.venueId ? p.theme.cover_url : tp.theme.cover_url,
        bg_url: tp.theme.bg_url,
      },
      mm: tp.matchmaker, rewards: tp.rewards,
    }));
  }
  function chooseVenue(v: any) {
    set({
      venueId: v.id, venueName: v.name,
      venueExtra: { address: v.address || '', instagram: v.instagram || '', about: v.about || '', ambient_photos: v.ambient_photos || [], map_url: v.map_url || '' },
    });
    setTheme({
      ...(v.primary_color ? { primary: v.primary_color } : {}),
      ...(v.secondary_color ? { secondary: v.secondary_color } : {}),
      ...(v.button_color ? { button: v.button_color } : {}),
      ...(v.logo_url ? { logo_url: v.logo_url } : {}),
      ...(v.cover_url ? { cover_url: v.cover_url, bg_url: v.bg_url || v.cover_url } : {}),
    });
  }

  const startsAt = toISO(d.date, d.start);
  const endsAt = toISO(d.date, d.end, d.start);
  const slug = slugify(`${d.venueName}-${d.name}`) || 'evento';

  const model: PreviewModel = useMemo(() => ({
    theme: d.theme, name: d.name, venueName: d.venueName || 'Seu bar', type: d.type,
    description: d.description, startsAt, endsAt, mm: d.mm, rewards: d.rewards,
    venue: d.venueExtra,
  }), [d, startsAt, endsAt]);

  async function publish() {
    setErr('');
    if (!d.venueName.trim()) { setErr('Defina o local.'); setStep(0); return; }
    if (!d.name.trim()) { setErr('Defina o nome do evento.'); setStep(3); return; }
    if (!startsAt || !endsAt) { setErr('Defina data e horário.'); setStep(2); return; }
    setBusy(true);
    try {
      const payload = {
        venue: d.venueId ? { id: d.venueId } : {
          name: d.venueName, logo_url: d.theme.logo_url, cover_url: d.theme.cover_url, bg_url: d.theme.bg_url,
          primary_color: d.theme.primary, secondary_color: d.theme.secondary, button_color: d.theme.button,
          address: d.venueExtra.address, instagram: d.venueExtra.instagram, about: d.venueExtra.about,
          map_url: d.venueExtra.map_url, ambient_photos: d.venueExtra.ambient_photos,
        },
        event: {
          name: d.name, type: d.type, description: d.description, slug,
          starts_at: startsAt, ends_at: endsAt, status: 'active',
          theme: d.theme, matchmaker: d.mm,
        },
        rewards: d.rewards,
      };
      const r = await studioApi.createEvent(adminKey, payload);
      setPublished({ slug: r.slug, code: r.public_code });
    } catch (e: any) { setErr('Não foi possível publicar: ' + (e?.message || '')); }
    finally { setBusy(false); }
  }

  if (published) return <Published slug={published.slug} code={published.code} theme={d.theme} name={d.name} />;

  return (
    <main className="px-4 pb-28 pt-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">Studio · {STEPS[step]}</h1>
        <a href="/admin" className="text-xs text-muted">sair</a>
      </div>
      <Stepper step={step} onJump={setStep} />

      {/* PREVIEW AO VIVO */}
      <div className="mt-3 rounded-3xl border border-line bg-ink2/60 p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SURFACES.map((s) => (
            <button key={s.k} onClick={() => setSurface(s.k)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${surface === s.k ? 'bg-white text-ink' : 'bg-white/5 text-muted'}`}>{s.l}</button>
          ))}
        </div>
        <Preview m={model} surface={surface} />
      </div>

      <div className="mt-4">
        {step === 0 && <StepVenue d={d} set={set} venues={venues} chooseVenue={chooseVenue} setTheme={setTheme} />}
        {step === 1 && <StepTemplate current={d.theme.template} onPick={applyTemplate} />}
        {step === 2 && <StepWhen d={d} set={set} startsAt={startsAt} endsAt={endsAt} />}
        {step === 3 && <StepVisual d={d} set={set} setTheme={setTheme} />}
        {step === 4 && <StepMatchmaker d={d} setMM={setMM} />}
        {step === 5 && <StepRewards d={d} set={set} />}
        {step === 6 && <StepReview d={d} slug={slug} startsAt={startsAt} setStep={setStep} setSurface={setSurface} />}
        {step === 7 && <StepPublish d={d} slug={slug} err={err} busy={busy} publish={publish} />}
      </div>

      {/* NAV */}
      <div className="fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto flex max-w-[480px] gap-2 border-t border-line bg-ink/90 px-4 py-3 backdrop-blur">
          {step > 0 && <button onClick={() => setStep(step - 1)} className="btn flex-1 border border-line bg-card py-3 text-white">Voltar</button>}
          {step < 7
            ? <button onClick={() => setStep(step + 1)} className="btn flex-[2] bg-glow2 py-3 font-bold text-white">Próximo</button>
            : <button onClick={publish} disabled={busy} className="btn flex-[2] py-3 font-bold text-white shadow-neon" style={{ background: d.theme.button }}>{busy ? 'Publicando…' : '🚀 Publicar evento'}</button>}
        </div>
      </div>
    </main>
  );
}

function Stepper({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  return (
    <div className="mt-3 flex gap-1">
      {STEPS.map((_, i) => (
        <button key={i} onClick={() => onJump(i)} className="h-1.5 flex-1 rounded-full transition"
          style={{ background: i <= step ? '#7b5cff' : 'rgba(255,255,255,.12)' }} />
      ))}
    </div>
  );
}

// ---------- STEP 0: LOCAL ----------
function StepVenue({ d, set, venues, chooseVenue, setTheme }: any) {
  const [novo, setNovo] = useState(!venues.length);
  return (
    <Card title="Escolha o local" sub="Selecione um bar já cadastrado ou crie um novo. A identidade do local entra no evento.">
      {venues.length > 0 && !novo && (
        <div className="space-y-2">
          {venues.map((v: any) => (
            <button key={v.id} onClick={() => chooseVenue(v)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${d.venueId === v.id ? 'border-glow2 bg-glow2/10' : 'border-line bg-card'}`}>
              {v.logo_url ? <img src={v.logo_url} className="h-10 w-10 rounded-lg object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-lg bg-ink2">🏠</div>}
              <div className="min-w-0"><div className="truncate font-bold">{v.name}</div>{v.address && <div className="truncate text-xs text-muted">{v.address}</div>}</div>
              {v.primary_color && <span className="ml-auto h-5 w-5 rounded-full" style={{ background: v.primary_color }} />}
            </button>
          ))}
          <button onClick={() => { setNovo(true); set({ venueId: null }); }} className="w-full rounded-2xl border border-dashed border-line py-3 text-sm font-semibold text-glow2">+ Novo local</button>
        </div>
      )}
      {(novo || !venues.length) && (
        <div className="space-y-3">
          <Field label="Nome do bar / local *"><input className="input" value={d.venueName} onChange={(e) => set({ venueId: null, venueName: e.target.value })} placeholder="Ex.: Laicos" /></Field>
          <Field label="Endereço"><input className="input" value={d.venueExtra.address} onChange={(e) => set({ venueExtra: { ...d.venueExtra, address: e.target.value } })} placeholder="Rua, bairro" /></Field>
          <Field label="Instagram"><input className="input" value={d.venueExtra.instagram} onChange={(e) => set({ venueExtra: { ...d.venueExtra, instagram: e.target.value } })} placeholder="@dobar" autoCapitalize="none" /></Field>
          <Field label="Logo (URL)"><input className="input" value={d.theme.logo_url} onChange={(e) => setTheme({ logo_url: e.target.value })} placeholder="https://…" autoCapitalize="none" /></Field>
          <Field label="Sobre o local"><textarea className="input" rows={2} value={d.venueExtra.about} onChange={(e) => set({ venueExtra: { ...d.venueExtra, about: e.target.value } })} placeholder="Uma linha sobre a casa" /></Field>
          {venues.length > 0 && <button onClick={() => setNovo(false)} className="text-sm font-semibold text-muted">← usar local existente</button>}
        </div>
      )}
    </Card>
  );
}

// ---------- STEP 1: TEMPLATE ----------
function StepTemplate({ current, onPick }: { current: string; onPick: (k: string) => void }) {
  return (
    <Card title="Escolha o tipo de evento" sub="Cada template já vem com copy, cores, CTA, badges, regras e matchmaker configurado. Dá pra ajustar tudo depois.">
      <div className="grid grid-cols-2 gap-2">
        {TEMPLATES.map((t) => (
          <button key={t.key} onClick={() => onPick(t.key)}
            className={`rounded-2xl border p-3 text-left transition ${current === t.key ? 'border-glow2 bg-glow2/10' : 'border-line bg-card'}`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xl" style={{ background: t.theme.primary + '22' }}>{t.emoji}</div>
            <div className="mt-2 text-sm font-bold leading-tight">{t.label}</div>
            <div className="mt-1 flex gap-1">
              <span className="h-3 w-3 rounded-full" style={{ background: t.theme.primary }} />
              <span className="h-3 w-3 rounded-full" style={{ background: t.theme.secondary }} />
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ---------- STEP 2: QUANDO ----------
function StepWhen({ d, set, startsAt, endsAt }: any) {
  return (
    <Card title="Data e horário" sub="Quando o matchmaker fica no ar. Termina sozinho no horário de fim (tudo expira).">
      <Field label="Data *"><input type="date" className="input" value={d.date} onChange={(e) => set({ date: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início *"><input type="time" className="input" value={d.start} onChange={(e) => set({ start: e.target.value })} /></Field>
        <Field label="Fim *"><input type="time" className="input" value={d.end} onChange={(e) => set({ end: e.target.value })} /></Field>
      </div>
      {startsAt && endsAt && (
        <p className="text-xs text-muted">⏱️ No ar de {new Date(startsAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} até {new Date(endsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{d.end <= d.start ? ' (vira o dia)' : ''}.</p>
      )}
    </Card>
  );
}

// ---------- STEP 3: VISUAL ----------
function StepVisual({ d, set, setTheme }: any) {
  return (
    <Card title="Identidade visual" sub="Capa, cores, logo e textos. O preview atualiza na hora.">
      <Field label="Nome do evento *"><input className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      <Field label="Tipo"><select className="input" value={d.type} onChange={(e) => set({ type: e.target.value })}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
      <Field label="Título de destaque"><input className="input" value={d.theme.headline} onChange={(e) => setTheme({ headline: e.target.value })} /></Field>
      <Field label="Descrição / chamada"><textarea className="input" rows={2} value={d.theme.subcopy} onChange={(e) => setTheme({ subcopy: e.target.value })} /></Field>
      <Field label="Texto do botão (CTA)"><input className="input" value={d.theme.cta_label} onChange={(e) => setTheme({ cta_label: e.target.value })} /></Field>
      <Field label="Foto de capa (URL)"><input className="input" value={d.theme.cover_url} onChange={(e) => setTheme({ cover_url: e.target.value, bg_url: e.target.value })} autoCapitalize="none" /></Field>
      <Field label="Emoji do evento"><input className="input" value={d.theme.emoji} onChange={(e) => setTheme({ emoji: e.target.value })} maxLength={4} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <ColorField label="Primária" value={d.theme.primary} onChange={(v) => setTheme({ primary: v })} />
        <ColorField label="Secundária" value={d.theme.secondary} onChange={(v) => setTheme({ secondary: v })} />
        <ColorField label="Botão" value={d.theme.button} onChange={(v) => setTheme({ button: v })} />
      </div>
      <Field label="Badges (separe por vírgula)"><input className="input" value={d.theme.badges.join(', ')} onChange={(e) => setTheme({ badges: e.target.value.split(',').map((s: string) => s.trim()) })} /></Field>
      <Field label="Regras (uma por linha)"><textarea className="input" rows={3} value={d.theme.rules.join('\n')} onChange={(e) => setTheme({ rules: e.target.value.split('\n') })} /></Field>
    </Card>
  );
}

// ---------- STEP 4: MATCHMAKER ----------
function StepMatchmaker({ d, setMM }: any) {
  const mm = d.mm;
  return (
    <Card title="Configurar Matchmaker" sub="Como a dinâmica de matches funciona neste evento.">
      <Toggle label="Matchmaker ativo" v={mm.enabled} on={(v) => setMM({ enabled: v })} />
      <Field label={`Cota de Super Like: ${mm.super_like_quota}`}><input type="range" min={0} max={10} value={mm.super_like_quota} onChange={(e) => setMM({ super_like_quota: +e.target.value })} className="w-full accent-glow2" /></Field>
      <Toggle label="Match da Hora (notifica match na hora)" v={mm.match_da_hora} on={(v) => setMM({ match_da_hora: v })} />
      <Toggle label="Destaques (perfis em evidência)" v={mm.destaques} on={(v) => setMM({ destaques: v })} />
      <div className="rounded-2xl border border-line bg-card p-3">
        <Toggle label="Happy Hour de Matches" v={mm.happy_hour.enabled} on={(v) => setMM({ happy_hour: { ...mm.happy_hour, enabled: v } })} />
        {mm.happy_hour.enabled && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="De"><input type="time" className="input" value={mm.happy_hour.from} onChange={(e) => setMM({ happy_hour: { ...mm.happy_hour, from: e.target.value } })} /></Field>
            <Field label="Até"><input type="time" className="input" value={mm.happy_hour.to} onChange={(e) => setMM({ happy_hour: { ...mm.happy_hour, to: e.target.value } })} /></Field>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Idade mín: ${mm.age_min}`}><input type="range" min={18} max={70} value={mm.age_min} onChange={(e) => setMM({ age_min: +e.target.value })} className="w-full accent-glow2" /></Field>
        <Field label={`Idade máx: ${mm.age_max}`}><input type="range" min={18} max={80} value={mm.age_max} onChange={(e) => setMM({ age_max: +e.target.value })} className="w-full accent-glow2" /></Field>
      </div>
      <Field label="Público-alvo"><input className="input" value={mm.audience} onChange={(e) => setMM({ audience: e.target.value })} /></Field>
      <Toggle label="Organizador participa do deck" v={mm.organizer_participates} on={(v) => setMM({ organizer_participates: v })} />
      <Field label="Visibilidade">
        <div className="flex gap-2">
          {(['public', 'private'] as const).map((o) => (
            <button key={o} onClick={() => setMM({ visibility: o })} className={`chip flex-1 ${mm.visibility === o ? 'bg-glow2 border-glow2 text-white' : 'bg-card border-line text-white/80'}`}>{o === 'public' ? '🌎 Público' : '🔒 Privado'}</button>
          ))}
        </div>
      </Field>
    </Card>
  );
}

// ---------- STEP 5: PRÊMIOS ----------
function StepRewards({ d, set }: any) {
  const add = () => set({ rewards: [...d.rewards, { name: '', kind: 'drink', emoji: '🍸', qty_total: 50, points_required: 1, redeem_rule: '', valid_from: '', valid_to: '' }] });
  const upd = (i: number, patch: Partial<Reward>) => set({ rewards: d.rewards.map((r: Reward, j: number) => j === i ? { ...r, ...patch } : r) });
  const del = (i: number) => set({ rewards: d.rewards.filter((_: any, j: number) => j !== i) });
  return (
    <Card title="Recompensas e gamificação" sub="Prêmios que a galera resgata por matches/pontos. Opcional, mas dá um up no rolê.">
      <div className="space-y-3">
        {d.rewards.map((r: Reward, i: number) => (
          <div key={i} className="rounded-2xl border border-line bg-card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input className="input w-14 text-center" value={r.emoji} onChange={(e) => upd(i, { emoji: e.target.value })} maxLength={3} />
              <input className="input flex-1" placeholder="Nome do prêmio" value={r.name} onChange={(e) => upd(i, { name: e.target.value })} />
              <button onClick={() => del(i)} className="px-2 text-glow">✕</button>
            </div>
            <select className="input" value={r.kind} onChange={(e) => { const k = REWARD_KINDS.find((x) => x.v === e.target.value); upd(i, { kind: e.target.value as any, emoji: k?.emoji || r.emoji }); }}>
              {REWARD_KINDS.map((k) => <option key={k.v} value={k.v}>{k.emoji} {k.l}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Quantidade"><input type="number" className="input" value={r.qty_total ?? ''} onChange={(e) => upd(i, { qty_total: e.target.value === '' ? null : +e.target.value })} placeholder="∞" /></Field>
              <Field label="Matches p/ resgatar"><input type="number" className="input" value={r.points_required} onChange={(e) => upd(i, { points_required: +e.target.value })} /></Field>
            </div>
            <Field label="Regra de resgate"><input className="input" value={r.redeem_rule} onChange={(e) => upd(i, { redeem_rule: e.target.value })} placeholder="Ex.: mostre o match no balcão" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Válido de"><input type="time" className="input" value={r.valid_from} onChange={(e) => upd(i, { valid_from: e.target.value })} /></Field>
              <Field label="até"><input type="time" className="input" value={r.valid_to} onChange={(e) => upd(i, { valid_to: e.target.value })} /></Field>
            </div>
          </div>
        ))}
        <button onClick={add} className="w-full rounded-2xl border border-dashed border-line py-3 text-sm font-semibold text-glow2">+ Adicionar prêmio</button>
      </div>
    </Card>
  );
}

// ---------- STEP 6: REVISAR ----------
function StepReview({ d, slug, startsAt, setStep, setSurface }: any) {
  const rows: [string, string, number][] = [
    ['Local', d.venueName || '—', 0],
    ['Tipo', d.type, 1],
    ['Quando', startsAt ? new Date(startsAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—', 2],
    ['Nome', d.name, 3],
    ['Matchmaker', d.mm.enabled ? `ativo · ${d.mm.super_like_quota} super likes` : 'desligado', 4],
    ['Prêmios', `${d.rewards.length} cadastrado(s)`, 5],
  ];
  return (
    <Card title="Revisar tudo" sub="Confira pelo preview acima (troque as abas). Toque pra editar qualquer parte.">
      <div className="space-y-1.5">
        {rows.map(([l, v, s]) => (
          <button key={l} onClick={() => setStep(s)} className="flex w-full items-center justify-between rounded-xl border border-line bg-card px-3 py-2.5 text-left">
            <span className="text-xs text-muted">{l}</span><span className="ml-3 flex-1 truncate text-right text-sm font-semibold">{v}</span><span className="ml-2 text-muted">›</span>
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-ink2 px-3 py-2 text-xs"><span className="text-muted">Link: </span><span className="font-bold text-glow2">/e/{slug}</span></div>
      <button onClick={() => { setSurface('event'); }} className="mt-2 text-xs font-semibold text-muted">ver landing no preview ↑</button>
    </Card>
  );
}

// ---------- STEP 7: PUBLICAR ----------
function StepPublish({ d, slug, err, busy, publish }: any) {
  return (
    <Card title="Pronto pra publicar" sub="Ao publicar, o evento entra no ar, gera link próprio e QR Code.">
      <div className="rounded-2xl border p-4" style={{ borderColor: d.theme.primary + '55', background: d.theme.primary + '14' }}>
        <div className="text-3xl">{d.theme.emoji}</div>
        <div className="mt-1 text-lg font-black">{d.theme.headline || d.name}</div>
        <div className="text-sm text-muted">📍 {d.venueName} · /e/{slug}</div>
        <ul className="mt-3 space-y-1 text-sm text-white/80">
          <li>✅ Capa, cores e logo aplicados</li>
          <li>✅ Matchmaker {d.mm.enabled ? 'ativo' : 'desligado'}</li>
          <li>✅ {d.rewards.length} prêmio(s)</li>
          <li>✅ Link próprio + QR ao publicar</li>
        </ul>
      </div>
      {err && <p className="mt-3 rounded-xl border border-glow/50 bg-glow/15 px-3 py-2 text-sm font-semibold text-white">{err}</p>}
      <button onClick={publish} disabled={busy} className="btn mt-4 w-full py-4 text-lg font-bold text-white shadow-neon" style={{ background: d.theme.button }}>{busy ? 'Publicando…' : '🚀 Publicar evento'}</button>
    </Card>
  );
}

// ---------- PUBLISHED (QR + link) ----------
function Published({ slug, code, theme, name }: { slug: string; code: string; theme: Theme; name: string }) {
  const [qr, setQr] = useState('');
  const origin = typeof window !== 'undefined' ? location.origin : '';
  const link = `${origin}/e/${slug}`;
  useEffect(() => { QRCode.toDataURL(link, { width: 360, margin: 1, color: { dark: '#0a0710', light: '#ffffff' } }).then(setQr); }, [link]);
  return (
    <main className="px-6 pb-16 pt-12 text-center">
      <div className="text-5xl">🎉</div>
      <h1 className="mt-3 text-2xl font-black">Evento no ar!</h1>
      <p className="mt-1 text-sm text-muted">{theme.emoji} {theme.headline || name}</p>
      {qr && <img src={qr} alt="QR" className="mx-auto mt-6 w-56 rounded-2xl" />}
      <a href={qr} download={`qr-${slug}.png`} className="mt-2 inline-block text-xs font-bold text-glow2">baixar QR Code</a>
      <div className="mt-5 rounded-2xl border border-line bg-card p-3 text-left">
        <div className="text-xs text-muted">Link do evento</div>
        <div className="truncate text-sm font-bold text-glow2">{link}</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => navigator.clipboard.writeText(link)} className="btn border border-line bg-card py-3 text-white">Copiar link</button>
        <a href={link} className="btn py-3 font-bold text-white" style={{ background: theme.button }}>Abrir landing</a>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <a href={`https://wa.me/?text=${encodeURIComponent(`${theme.headline || name} 🔥 entra no matchmaker: ${link}`)}`} target="_blank" className="btn border border-line bg-card py-2.5 text-white">WhatsApp</a>
        <a href="/admin" className="btn border border-line bg-card py-2.5 text-white">Ir pro painel</a>
      </div>
      <p className="mt-4 text-xs text-muted">Código curto: <code className="rounded bg-ink2 px-1.5 py-0.5">{code}</code></p>
    </main>
  );
}

// ---------- UI helpers ----------
function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card/40 p-4">
      <h2 className="text-lg font-black">{title}</h2>
      {sub && <p className="mt-0.5 mb-3 text-xs text-muted">{sub}</p>}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-2 py-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-8 cursor-pointer rounded bg-transparent" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-xs outline-none" />
      </div>
    </div>
  );
}
function Toggle({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <button onClick={() => on(!v)} className="flex w-full items-center justify-between rounded-2xl border border-line bg-card px-3 py-3 text-left">
      <span className="text-sm font-semibold">{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${v ? 'bg-glow2' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${v ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
