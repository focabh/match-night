'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getUserId } from '@/lib/session';
import { themeOf, readableText } from '@/lib/studio';
import type { EventPublic } from '@/lib/types';
import { EventEnded } from '@/components/States';

function hexA(hex: string, a: number) {
  const h = (hex || '#ff3d7f').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r || 0},${g || 0},${b || 0},${a})`;
}
const fmt = (iso: string) => { try { return new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

export default function EventLanding() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [ev, setEv] = useState<EventPublic | null | undefined>(undefined);
  const [confirmed, setConfirmed] = useState(false);
  const [needConsent, setNeedConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const tracked = useRef(false);
  useEffect(() => { api.eventByCode(slug).then(setEv).catch(() => setEv(null)); }, [slug]);
  useEffect(() => {
    if (ev && (ev as any).event_id && !tracked.current) { tracked.current = true; api.track((ev as any).event_id, getUserId(), 'landing'); }
  }, [ev]);

  if (ev === undefined) return <main className="grid min-h-[100dvh] place-items-center text-muted">Carregando…</main>;
  if (ev === null) return <NotFound />;
  if (ev.ended || !ev.is_live) return <EventEnded name={ev.name} />;

  const t = themeOf(ev);
  const code = ev.public_code || slug;
  const rewards = ev.rewards || [];
  const venue = ev.venue || {};

  async function enter() {
    if (!confirmed) { setNeedConsent(true); return; }
    setBusy(true); setErr('');
    api.track(ev!.event_id, getUserId(), 'enter_click');
    try {
      const part = await api.myParticipation(ev!.event_id, getUserId());
      if (part && part.status === 'active') router.push(`/event/${code}/deck`);
      else router.push(`/event/${code}/register`);
    } catch { setErr('Não rolou entrar agora. Tenta de novo.'); setBusy(false); }
  }

  return (
    <main className="min-h-[100dvh] text-white" style={{ background: '#0a0710' }}>
      {/* HERO */}
      <div className="relative h-72">
        <img src={t.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0a0710 6%, rgba(10,7,16,.4) 55%, rgba(10,7,16,.15))' }} />
        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-xs font-bold backdrop-blur" style={{ color: t.primary }}>
          <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: t.primary }} /> AO VIVO AGORA
        </div>
        {t.logo_url
          ? <img src={t.logo_url} alt="" className="absolute bottom-4 left-4 h-16 w-16 rounded-2xl object-cover ring-2 ring-white/30" />
          : <div className="absolute bottom-4 left-4 grid h-16 w-16 place-items-center rounded-2xl text-3xl ring-2 ring-white/20" style={{ background: t.secondary }}>{t.emoji}</div>}
      </div>

      <div className="mx-auto max-w-md px-5 pb-40 -mt-2">
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: t.secondary }}>{ev.type || 'Matchmaker'}</div>
        <h1 className="mt-1 text-3xl font-black leading-tight">{t.headline || ev.name}</h1>
        <div className="mt-1.5 text-sm text-white/75">📍 {ev.venue_name} · {fmt(ev.starts_at)}</div>

        <div className="mt-3 flex flex-wrap gap-2">
          {t.badges.filter(Boolean).map((b, i) => (
            <span key={i} className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: hexA(t.primary, .16), color: t.primary, border: `1px solid ${hexA(t.primary, .4)}` }}>{b}</span>
          ))}
        </div>

        <p className="mt-4 text-white/90">{t.subcopy || ev.description}</p>

        {/* prêmios */}
        {rewards.length > 0 && (
          <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: hexA(t.primary, .35), background: hexA(t.primary, .08) }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: t.primary }}>🎁 Prêmios da noite</div>
            <div className="mt-3 space-y-2.5">
              {rewards.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xl">{r.emoji || '🎁'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-tight">{r.name}</div>
                    {r.redeem_rule && <div className="text-xs text-white/60">{r.redeem_rule}</div>}
                  </div>
                  {r.points_required > 0 && <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: hexA(t.secondary, .2), color: t.secondary }}>{r.points_required} match{r.points_required > 1 ? 'es' : ''}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* como chegar */}
        {(venue.address || venue.map_url || venue.instagram) && (
          <div className="mt-5 rounded-2xl border border-line bg-white/[.03] p-4 text-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-white/50">O local</div>
            {venue.address && <div className="mt-2">📍 {venue.address}</div>}
            <div className="mt-2 flex gap-3">
              {venue.map_url && <a href={venue.map_url} target="_blank" className="font-bold" style={{ color: t.primary }}>Como chegar</a>}
              {venue.instagram && <a href={`https://instagram.com/${String(venue.instagram).replace('@', '')}`} target="_blank" className="font-bold" style={{ color: t.primary }}>{venue.instagram}</a>}
            </div>
          </div>
        )}

        {/* consent */}
        <button type="button" onClick={() => { setConfirmed((v) => !v); setNeedConsent(false); }}
          className="mt-6 flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition"
          style={{ borderColor: confirmed ? t.primary : needConsent ? '#ffb547' : 'rgba(255,255,255,.12)', background: confirmed ? hexA(t.primary, .12) : 'rgba(255,255,255,.03)' }}>
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 text-sm font-black"
            style={{ borderColor: confirmed ? t.primary : 'rgba(255,255,255,.4)', background: confirmed ? t.primary : 'transparent', color: confirmed ? '#fff' : 'transparent' }}>✓</span>
          <span className="text-sm text-white/90">Confirmo que tenho <b>18 anos ou mais</b> e aceito as regras do evento (perfil e matches são temporários e expiram quando a noite acaba).</span>
        </button>
        {needConsent && !confirmed && <p className="mt-2 text-sm font-bold text-amber">👆 Toque pra confirmar 18+ e entrar.</p>}
        {err && <p className="mt-2 text-sm font-bold" style={{ color: t.primary }}>{err}</p>}

        {/* regras */}
        {t.rules.filter(Boolean).length > 0 && (
          <div className="mt-5 text-xs text-white/50">
            {t.rules.filter(Boolean).map((r, i) => <div key={i}>· {r}</div>)}
          </div>
        )}

        {/* assinatura do produto — identidade SEMPRE presente (não some atrás do tema da casa) */}
        <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white/40">
          <span style={{ color: '#ff3d7f' }}>✦</span> Match Night · matchmaker ao vivo
        </div>
      </div>

      {/* CTA fixo */}
      <div className="fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto max-w-md px-5 py-4" style={{ background: 'linear-gradient(to top, #0a0710 70%, transparent)' }}>
          <button onClick={enter} disabled={busy}
            className="w-full rounded-full py-4 text-lg font-bold transition active:scale-95 disabled:opacity-60"
            style={{ background: confirmed ? t.button : hexA(t.button, .6), color: readableText(t.button), boxShadow: `0 12px 36px -10px ${hexA(t.button, .7)}` }}>
            {busy ? 'Entrando…' : (t.cta_label || 'Entrar no Matchmaker')}
          </button>
          <p className="mt-2 text-center text-[11px] text-white/45">+18 · só nesta noite</p>
        </div>
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-8 text-center text-white">
      <div className="text-5xl">🤔</div>
      <h1 className="mt-4 text-2xl font-black">Evento não encontrado</h1>
      <p className="mt-2 text-muted">Confira o link ou escaneie o QR de novo.</p>
      <a href="/" className="btn mt-6 bg-card border border-line px-6 py-3">Início</a>
    </main>
  );
}
