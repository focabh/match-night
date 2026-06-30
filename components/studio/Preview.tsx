'use client';
import type { Theme, Matchmaker, Reward } from '@/lib/studio';

export type PreviewModel = {
  theme: Theme;
  name: string;
  venueName: string;
  type: string;
  description: string;
  startsAt: string; // ISO
  endsAt: string;   // ISO
  mm: Matchmaker;
  rewards: Reward[];
  venue?: { address?: string; about?: string; ambient_photos?: string[]; instagram?: string };
};

export type Surface = 'event' | 'home' | 'list' | 'venue' | 'deck' | 'qr';

export const SURFACES: { k: Surface; l: string }[] = [
  { k: 'event', l: 'Evento' },
  { k: 'home', l: 'Home' },
  { k: 'list', l: 'Lista' },
  { k: 'venue', l: 'Local' },
  { k: 'deck', l: 'Deck' },
  { k: 'qr', l: 'QR' },
];

function fmtDay(iso: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  } catch { return ''; }
}
function fmtTime(iso: string) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

const FACES = [
  'https://randomuser.me/api/portraits/women/68.jpg',
  'https://randomuser.me/api/portraits/men/32.jpg',
  'https://randomuser.me/api/portraits/women/44.jpg',
  'https://randomuser.me/api/portraits/men/45.jpg',
];

export function Preview({ m, surface }: { m: PreviewModel; surface: Surface }) {
  return (
    <div className="relative mx-auto w-[300px]">
      {/* moldura de celular */}
      <div className="relative overflow-hidden rounded-[34px] border-[8px] border-black bg-[#0a0710] shadow-2xl"
        style={{ height: 580 }}>
        <div className="absolute left-1/2 top-0 z-30 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-black" />
        <div className="h-full w-full overflow-y-auto">
          {surface === 'event' && <EventSurface m={m} />}
          {surface === 'home' && <HomeSurface m={m} />}
          {surface === 'list' && <ListSurface m={m} />}
          {surface === 'venue' && <VenueSurface m={m} />}
          {surface === 'deck' && <DeckSurface m={m} />}
          {surface === 'qr' && <QrSurface m={m} />}
        </div>
      </div>
    </div>
  );
}

// ---------- EVENTO (landing /e/slug) ----------
function EventSurface({ m }: { m: PreviewModel }) {
  const t = m.theme;
  return (
    <div className="min-h-full text-white" style={{ background: '#0a0710' }}>
      <div className="relative h-52">
        <img src={t.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0a0710 8%, rgba(10,7,16,.35) 60%, rgba(10,7,16,.2))' }} />
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold backdrop-blur"
          style={{ color: t.primary }}>
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: t.primary }} /> AO VIVO AGORA
        </div>
        {t.logo_url
          ? <img src={t.logo_url} alt="" className="absolute bottom-3 left-3 h-12 w-12 rounded-xl object-cover ring-2 ring-white/30" />
          : <div className="absolute bottom-3 left-3 grid h-12 w-12 place-items-center rounded-xl text-xl ring-2 ring-white/20" style={{ background: t.secondary }}>{t.emoji}</div>}
      </div>
      <div className="px-4 pb-5 -mt-2">
        <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: t.secondary }}>{m.type || 'Matchmaker'}</div>
        <h1 className="mt-1 text-2xl font-black leading-tight">{t.headline || m.name}</h1>
        <div className="mt-1 text-sm text-white/70">📍 {m.venueName} · {fmtDay(m.startsAt)} · {fmtTime(m.startsAt)}</div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.badges.filter(Boolean).map((b, i) => (
            <span key={i} className="rounded-full px-2.5 py-1 text-[10px] font-bold"
              style={{ background: hexA(t.primary, .16), color: t.primary, border: `1px solid ${hexA(t.primary, .4)}` }}>{b}</span>
          ))}
        </div>
        <p className="mt-3 text-sm text-white/85">{t.subcopy || m.description}</p>

        {m.rewards.length > 0 && (
          <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: hexA(t.primary, .35), background: hexA(t.primary, .08) }}>
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: t.primary }}>🎁 Prêmios da noite</div>
            <div className="mt-2 space-y-1.5">
              {m.rewards.slice(0, 3).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span>{r.emoji || '🎁'}</span><span className="font-semibold">{r.name}</span>
                  {r.points_required > 0 && <span className="ml-auto text-[10px] text-white/60">{r.points_required} match{r.points_required > 1 ? 'es' : ''}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="mt-5 w-full rounded-full py-3.5 text-center font-bold text-white shadow-lg"
          style={{ background: t.button, boxShadow: `0 10px 30px -8px ${hexA(t.button, .6)}` }}>
          {t.cta_label || 'Entrar no Matchmaker'}
        </button>
        <p className="mt-2 text-center text-[10px] text-white/45">+18 · perfil e matches valem só nesta noite</p>

        {t.rules.filter(Boolean).length > 0 && (
          <div className="mt-4 text-[11px] text-white/55">
            {t.rules.filter(Boolean).map((r, i) => <div key={i}>· {r}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- HOME (card de descoberta) ----------
function HomeSurface({ m }: { m: PreviewModel }) {
  const t = m.theme;
  return (
    <div className="min-h-full bg-[#0a0710] px-4 pt-10 text-white">
      <div className="text-2xl">🌃</div>
      <h1 className="mt-1 text-xl font-black leading-tight">Rolês acontecendo<br /><span style={{ color: t.primary }}>agora</span></h1>
      <div className="mt-4 space-y-3">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]">
          <div className="relative h-24">
            <img src={t.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,7,16,.9), transparent)' }} />
            <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold backdrop-blur"
              style={{ background: 'rgba(0,0,0,.45)', color: t.primary }}>● AO VIVO</span>
            <div className="absolute bottom-1.5 left-2.5 text-lg">{t.emoji}</div>
          </div>
          <div className="p-3">
            <div className="font-black leading-tight">{t.headline || m.name}</div>
            <div className="text-[11px] text-white/60">📍 {m.venueName} · {fmtTime(m.startsAt)}</div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex -space-x-2">{FACES.slice(0, 3).map((f, i) => <img key={i} src={f} className="h-5 w-5 rounded-full ring-2 ring-[#0a0710] object-cover" />)}</div>
              <span className="text-[10px] font-semibold" style={{ color: t.primary }}>+ gente aqui agora</span>
              <span className="ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold text-white" style={{ background: t.button }}>Ver</span>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-white/10 p-3 text-center text-[11px] text-white/35">outros rolês aparecem aqui…</div>
      </div>
    </div>
  );
}

// ---------- LISTA (linha compacta) ----------
function ListSurface({ m }: { m: PreviewModel }) {
  const t = m.theme;
  return (
    <div className="min-h-full bg-[#0a0710] px-4 pt-10 text-white">
      <h1 className="text-lg font-black">Rolês perto de você</h1>
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-2.5">
          <img src={t.cover_url} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold leading-tight">{t.emoji} {t.headline || m.name}</div>
            <div className="truncate text-[11px] text-white/60">{m.venueName} · {fmtDay(m.startsAt)}</div>
            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: hexA(t.primary, .16), color: t.primary }}>● ao vivo</span>
          </div>
          <span className="rounded-full px-3 py-1.5 text-[11px] font-bold text-white" style={{ background: t.button }}>Entrar</span>
        </div>
        {[0, 1].map((i) => <div key={i} className="h-16 rounded-2xl border border-dashed border-white/10" />)}
      </div>
    </div>
  );
}

// ---------- LOCAL (perfil do bar) ----------
function VenueSurface({ m }: { m: PreviewModel }) {
  const t = m.theme;
  const amb = m.venue?.ambient_photos?.length ? m.venue.ambient_photos : [t.cover_url, t.bg_url];
  return (
    <div className="min-h-full bg-[#0a0710] text-white">
      <div className="relative h-28">
        <img src={t.cover_url} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0a0710, transparent)' }} />
      </div>
      <div className="-mt-8 px-4">
        {t.logo_url
          ? <img src={t.logo_url} className="h-16 w-16 rounded-2xl object-cover ring-4 ring-[#0a0710]" />
          : <div className="grid h-16 w-16 place-items-center rounded-2xl text-2xl ring-4 ring-[#0a0710]" style={{ background: t.secondary }}>{t.emoji}</div>}
        <h1 className="mt-2 text-xl font-black">{m.venueName}</h1>
        {m.venue?.address && <div className="text-[11px] text-white/60">📍 {m.venue.address}</div>}
        {m.venue?.instagram && <div className="text-[11px]" style={{ color: t.primary }}>{m.venue.instagram}</div>}
        {m.venue?.about && <p className="mt-2 text-sm text-white/80">{m.venue.about}</p>}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {amb.slice(0, 3).map((p, i) => <img key={i} src={p} className="h-16 w-full rounded-lg object-cover" />)}
        </div>
        <div className="mt-4 text-[11px] font-bold uppercase tracking-wide text-white/50">Próximo rolê</div>
        <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.03] p-2.5">
          <div className="text-lg">{t.emoji}</div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{t.headline || m.name}</div><div className="text-[11px] text-white/60">{fmtDay(m.startsAt)} · {fmtTime(m.startsAt)}</div></div>
          <span className="rounded-full px-3 py-1.5 text-[11px] font-bold text-white" style={{ background: t.button }}>Ir</span>
        </div>
      </div>
    </div>
  );
}

// ---------- DECK (card do matchmaker) ----------
function DeckSurface({ m }: { m: PreviewModel }) {
  const t = m.theme;
  return (
    <div className="flex min-h-full flex-col bg-[#0a0710] px-3 pt-10 text-white">
      <div className="flex items-center justify-between px-1">
        <div className="text-[10px] font-bold uppercase" style={{ color: t.primary }}>Ao vivo · {t.headline || m.name}</div>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px]">💜 Matches</span>
      </div>
      <div className="relative mt-3 flex-1 overflow-hidden rounded-3xl border border-white/10">
        <img src={FACES[0]} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, black, transparent 55%)' }} />
        {m.mm.destaques && <div className="absolute right-3 top-3 rounded-full px-2 py-1 text-[10px] font-black" style={{ background: t.secondary }}>⭐ Destaque</div>}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="text-2xl font-black leading-none">Marina <span className="text-lg font-bold text-white/80">27</span></div>
          <span className="mt-1.5 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: hexA(t.primary, .2), color: t.primary }}>Quero paquerar</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-5 py-4">
        <div className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/5 text-xl">✕</div>
        {m.mm.super_like_quota > 0 && <div className="grid h-10 w-10 place-items-center rounded-full text-lg" style={{ background: hexA(t.secondary, .25), color: t.secondary }}>★</div>}
        <div className="grid h-16 w-16 place-items-center rounded-full text-2xl text-white shadow-lg" style={{ background: t.button, boxShadow: `0 10px 30px -8px ${hexA(t.button, .7)}` }}>❤</div>
      </div>
    </div>
  );
}

// ---------- QR ----------
function QrSurface({ m }: { m: PreviewModel }) {
  const t = m.theme;
  return (
    <div className="grid min-h-full place-items-center bg-[#0a0710] px-6 text-center text-white">
      <div>
        <div className="text-3xl">{t.emoji}</div>
        <div className="mt-1 font-black">{t.headline || m.name}</div>
        <div className="text-[11px] text-white/60">{m.venueName}</div>
        <div className="mx-auto mt-4 grid h-40 w-40 place-items-center rounded-2xl bg-white p-3">
          <div className="grid h-full w-full grid-cols-7 grid-rows-7 gap-0.5">
            {Array.from({ length: 49 }).map((_, i) => (
              <div key={i} className="rounded-[1px]" style={{ background: (i * 7 + i % 5) % 3 === 0 ? '#0a0710' : 'transparent' }} />
            ))}
          </div>
        </div>
        <div className="mt-3 text-[11px] text-white/60">QR final é gerado ao publicar</div>
        <div className="mt-1 text-[11px] font-bold" style={{ color: t.primary }}>→ leva direto pro matchmaker</div>
      </div>
    </div>
  );
}

// hex + alpha helper (#rrggbb -> rgba)
function hexA(hex: string, a: number) {
  const h = (hex || '#ff3d7f').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r || 0},${g || 0},${b || 0},${a})`;
}
