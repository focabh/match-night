'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getUserId, loadOnboard, saveOnboard } from '@/lib/session';
import { GENDER_OPTS, PREF_OPTS, PREF_ALL, normalizePrefs, expandPrefs, type EventPublic } from '@/lib/types';
import { themeOf } from '@/lib/studio';
import { getVariant } from '@/lib/variant';
import { EventEnded } from '@/components/States';

const ERR: Record<string, string> = {
  gender_required: 'Toque em uma opção de “Sobre você”.',
  preference_required: 'Escolha pelo menos uma opção de quem quer conhecer.',
  event_not_active: 'Este evento não está mais ativo.',
  event_not_found: 'Não achamos esse evento.',
  consent_required: 'Confirme que tem 18 anos ou mais.',
};

export default function Onboarding() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [ev, setEv] = useState<EventPublic | null>(null);
  const saved = typeof window !== 'undefined' ? loadOnboard() : null;
  const variant = typeof window !== 'undefined' ? getVariant() : { order: 'pref-first', cta: '✨ Entrar no Matchmaker', key: 'canon' } as const;

  const [gender, setGender] = useState(saved?.gender || '');
  const [detail, setDetail] = useState(saved?.gender_detail || '');
  // 1ª vez: nada marcado (exige escolha consciente). Retorno: pré-preenchido.
  const [prefs, setPrefs] = useState<string[]>(saved?.prefs ? expandPrefs(saved.prefs) : []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const errRef = useRef<HTMLParagraphElement | null>(null);
  const tracked = useRef(false);

  useEffect(() => { api.eventByCode(code).then(setEv).catch(() => {}); }, [code]);
  useEffect(() => {
    if (ev?.event_id && !tracked.current) { tracked.current = true; api.track(ev.event_id, getUserId(), 'onboarding_shown', variant.key); }
  }, [ev, variant.key]);

  if (ev && (ev.ended || !ev.is_live)) return <EventEnded name={ev.name} />;

  const t = themeOf(ev);
  const allOn = PREF_ALL.every((v) => prefs.includes(v));
  const togglePref = (v: string) => { setErr(''); setPrefs((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]); };
  const toggleAll = () => { setErr(''); setPrefs(allOn ? [] : [...PREF_ALL]); };

  function fail(msg: string) { setErr(msg); setBusy(false); setTimeout(() => errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40); }

  async function enter() {
    if (busy) return; setErr('');
    if (!gender) return fail(ERR.gender_required);
    if (prefs.length === 0) return fail(ERR.preference_required);
    if (!ev) return fail('Carregando o evento… tente de novo.');
    setBusy(true);
    try {
      await api.quickJoin(ev.event_id, getUserId(), gender, normalizePrefs(prefs), gender === 'other' ? detail : undefined);
      saveOnboard({ gender, gender_detail: detail, prefs });
      api.track(ev.event_id, getUserId(), 'onboarding_done', variant.key, { gender, prefs: normalizePrefs(prefs) });
      router.push(`/event/${code}/deck`);
    } catch (e: any) {
      const key = String(e?.message || '').replace(/^.*?:/, '').trim();
      fail(ERR[key] || 'Não foi possível entrar. Tente de novo.');
    }
  }

  const Pref = (
    <section key="pref">
      <h2 className="text-2xl font-black" style={{ color: t.primary }}>💜 Quem você quer conhecer hoje?</h2>
      <p className="mt-1 text-sm text-muted">Escolha uma ou mais opções.</p>
      <div className="mt-4 space-y-2">
        {PREF_OPTS.map((o) => {
          const on = prefs.includes(o.v);
          return (
            <button key={o.v} type="button" onClick={() => togglePref(o.v)}
              className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition"
              style={{ borderColor: on ? t.primary : 'var(--line,#2c2138)', background: on ? hexA(t.primary, .12) : 'transparent' }}>
              <Check on={on} color={t.primary} />
              <span className="text-base font-semibold">{o.l}</span>
            </button>
          );
        })}
        <button type="button" onClick={toggleAll}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed p-4 text-left transition"
          style={{ borderColor: allOn ? t.primary : 'rgba(255,255,255,.25)', background: allOn ? hexA(t.primary, .12) : 'transparent' }}>
          <Check on={allOn} color={t.primary} square />
          <span className="text-base font-bold">⚡ Todos</span>
        </button>
      </div>
      <p className="mt-3 text-sm text-muted">Você só aparecerá para pessoas compatíveis com essa escolha.</p>
    </section>
  );

  const About = (
    <section key="about" className="mt-8">
      <h2 className="text-xl font-black">Sobre você</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {GENDER_OPTS.map((o) => {
          const on = gender === o.v;
          return (
            <button key={o.v} type="button" onClick={() => { setErr(''); setGender(o.v); }}
              className="rounded-full border px-4 py-2.5 text-sm font-semibold transition"
              style={{ borderColor: on ? t.secondary : 'rgba(255,255,255,.18)', background: on ? hexA(t.secondary, .16) : 'transparent', color: on ? '#fff' : 'rgba(255,255,255,.85)' }}>
              {o.l}
            </button>
          );
        })}
      </div>
      {gender === 'other' && (
        <input className="input mt-3" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Como você se descreve? (opcional)" autoCapitalize="none" maxLength={40} />
      )}
    </section>
  );

  return (
    <main className="px-6 pt-8 pb-28" style={{ minHeight: '100dvh' }}>
      <button onClick={() => router.back()} className="mb-3 text-sm text-muted">← voltar</button>
      <div className="text-xs font-bold uppercase tracking-wide" style={{ color: t.primary }}>{ev?.name || 'Matchmaker'}</div>
      <div className="mt-4">
        {variant.order === 'about-first' ? <>{About}{Pref}</> : <>{Pref}{About}</>}
      </div>
      {err && <p ref={errRef} className="mt-5 rounded-2xl border border-glow/50 bg-glow/15 px-4 py-3 text-sm font-semibold text-white">{err}</p>}

      <div className="fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto max-w-[480px] border-t border-line bg-ink/90 px-6 py-4 backdrop-blur">
          <button onClick={enter} disabled={busy} className="btn w-full py-4 text-lg font-bold shadow-neon"
            style={{ background: t.button, color: readable(t.button) }}>
            {busy ? 'Entrando…' : variant.cta}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted">Foto, nome e mais ficam pra depois — entre primeiro.</p>
        </div>
      </div>
    </main>
  );
}

function Check({ on, color, square }: { on: boolean; color: string; square?: boolean }) {
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center border-2 text-sm font-black text-white"
      style={{ borderRadius: square ? 8 : 999, borderColor: on ? color : 'rgba(255,255,255,.35)', background: on ? color : 'transparent' }}>
      {on ? '✓' : ''}
    </span>
  );
}
function hexA(hex: string, a: number) {
  const h = (hex || '#ff3d7f').replace('#', ''); const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return `rgba(${parseInt(n.slice(0, 2), 16) || 0},${parseInt(n.slice(2, 4), 16) || 0},${parseInt(n.slice(4, 6), 16) || 0},${a})`;
}
function readable(hex: string) {
  const h = (hex || '#000').replace('#', ''); const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16) / 255, g = parseInt(n.slice(2, 4), 16) / 255, b = parseInt(n.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4));
  return (.2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b)) > .45 ? '#0a0710' : '#fff';
}
