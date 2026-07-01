'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getUserId } from '@/lib/session';
import { themeOf } from '@/lib/studio';
import type { EventPublic, MatchRow, Message } from '@/lib/types';
import { EventEnded } from '@/components/States';

const ZONES = ['no bar', 'na pista', 'perto do palco', 'na entrada', 'na área externa'];

export default function Chat() {
  const { code, mid } = useParams<{ code: string; mid: string }>();
  const router = useRouter();
  const find = useSearchParams().get('find') === '1';
  const uid = getUserId();
  const [ev, setEv] = useState<EventPublic | null>(null);
  const [other, setOther] = useState<MatchRow | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [zones, setZones] = useState(find);
  const [gone, setGone] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async (eid: string) => {
    const list: Message[] = await api.messages(eid, uid, mid).catch(() => []);
    setMsgs(list);
    // marca como lida usando o tempo do SERVIDOR (consistente com o badge)
    const maxAt = list.reduce((mx, m) => Math.max(mx, Date.parse(m.created_at) || 0), 0);
    try { if (maxAt) localStorage.setItem(`mn_chatseen_${mid}`, String(maxAt)); } catch {}
  }, [uid, mid]);

  useEffect(() => {
    let timer: any;
    (async () => {
      const e = await api.eventByCode(code); setEv(e);
      if (!e || e.ended || !e.is_live) return;
      const ms = await api.matches(e.event_id, uid).catch(() => [] as MatchRow[]);
      setOther(ms.find((m) => m.match_id === mid) || null);
      await refresh(e.event_id);
      timer = setInterval(() => refresh(e.event_id), 2000);
    })();
    return () => clearInterval(timer);
  }, [code, uid, mid, refresh]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  if (gone) return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-8 text-center">
      <div className="text-5xl">👋</div>
      <h1 className="mt-4 text-2xl font-black">Pronto</h1>
      <p className="mt-2 max-w-xs text-muted">Essa conexão foi encerrada. Tem muita gente boa aqui ainda.</p>
      <button onClick={() => router.push(`/event/${code}/deck`)} className="btn mt-7 bg-glow2 px-6 py-3 text-white">Ver mais pessoas</button>
      <button onClick={() => router.push(`/event/${code}/matches`)} className="btn mt-2 px-6 py-3 text-muted">Meus matches</button>
    </main>
  );
  if (ev && (ev.ended || !ev.is_live)) return <EventEnded name={ev.name} />;
  const t = themeOf(ev);

  async function send(kind: Message['kind'], body: string) {
    if (!ev || !body.trim()) return;
    await api.sendMessage(ev.event_id, uid, mid, kind, body).catch(() => {});
    if (kind === 'meet') api.track(ev.event_id, uid, 'meetup_proposed');
    if (kind === 'here') api.track(ev.event_id, uid, 'find_at_event_tap');
    setText(''); setZones(false); await refresh(ev.event_id);
  }
  async function manage(action: 'unmatch' | 'block' | 'report') {
    if (!ev || !other) return;
    if (action === 'unmatch') { if (!confirm('Desfazer match? A conversa some pros dois e vocês não aparecem de novo nesta noite.')) return; await api.unmatch(ev.event_id, uid, mid).catch(() => {}); api.track(ev.event_id, uid, 'unmatch'); }
    if (action === 'block') { if (!confirm('Bloquear? Vocês não se veem mais (vale também em outros eventos).')) return; await api.block(ev.event_id, uid, other.participant_id).catch(() => {}); api.track(ev.event_id, uid, 'block'); }
    if (action === 'report') { await api.report(ev.event_id, uid, other.participant_id, 'inapropriado').catch(() => {}); api.track(ev.event_id, uid, 'report'); }
    setGone(true);
  }

  const name = other?.display_name || 'Match';
  return (
    <main className="flex min-h-[100dvh] flex-col">
      {/* header */}
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <button onClick={() => router.push(`/event/${code}/matches`)} className="text-xl text-muted">←</button>
        <button onClick={() => other && setShowProfile(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {other?.photo_url
            ? <img src={other.photo_url} className="h-9 w-9 rounded-full object-cover" />
            : <div className="grid h-9 w-9 place-items-center rounded-full bg-ink2 text-sm">{name.charAt(0)}</div>}
          <div className="min-w-0"><div className="truncate font-black leading-tight">{name}{other?.age ? `, ${other.age}` : ''} <span className="text-white/40">ⓘ</span></div><div className="text-[11px]" style={{ color: t.primary }}>🟢 ver perfil</div></div>
        </button>
        <button onClick={() => router.push(`/event/${code}/deck`)} aria-label="Descobrir" className="h-9 w-9 grid shrink-0 place-items-center rounded-full bg-card border border-line text-sm">🔥</button>
        <button onClick={() => setMenu(true)} aria-label="Opções" className="h-9 w-9 grid shrink-0 place-items-center rounded-full bg-card border border-line">•••</button>
      </header>

      {/* revelação pós-match */}
      {other && (other.bio || other.profile_prompt || other.instagram || other.socials?.tiktok || other.socials?.spotify) && (
        <div className="border-b border-line bg-card/40 px-4 py-2.5 text-sm">
          {(other.profile_prompt || other.bio) && <p className="text-white/85">{other.profile_prompt || other.bio}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(other.socials?.instagram || other.instagram) && <a target="_blank" href={`https://instagram.com/${String(other.socials?.instagram || other.instagram).replace('@', '')}`} className="rounded-full bg-glow/15 px-2.5 py-1 text-xs font-bold text-glow">📸 Instagram</a>}
            {other.socials?.tiktok && <a target="_blank" href={`https://tiktok.com/@${other.socials.tiktok.replace('@', '')}`} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">🎵 TikTok</a>}
            {other.socials?.spotify && <a target="_blank" href={/^https?:/.test(other.socials.spotify) ? other.socials.spotify : `https://open.spotify.com/search/${encodeURIComponent(other.socials.spotify)}`} className="rounded-full bg-[#1db954]/20 px-2.5 py-1 text-xs font-bold text-[#1db954]">🎧 Spotify</a>}
          </div>
        </div>
      )}

      {/* mensagens */}
      <section className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {msgs.length === 0 && (
          <div className="mt-6 text-center text-sm text-muted">
            <div className="text-3xl">💞</div>
            <p className="mt-2">Vocês estão no mesmo lugar agora.<br />Que tal já marcar de se ver?</p>
          </div>
        )}
        {msgs.map((m) => <Bubble key={m.id} m={m} theme={t} />)}
        <div ref={endRef} />
      </section>

      {/* ações presenciais */}
      <div className="border-t border-line px-3 pt-2.5">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Quick label="📍 Tô por perto" onClick={() => setZones((z) => !z)} accent={t.secondary} highlight={find} />
          <Quick label="👋 Aceno" onClick={() => send('wave', 'Te dei um aceno 👋 — me acha!')} accent={t.secondary} />
          <Quick label="⏱️ Bora se ver em 5 min" onClick={() => send('meet', 'Bora se ver em 5 min? ⏱️')} accent={t.secondary} />
          <Quick label="🍸 Te pago um drink" onClick={() => send('text', 'Te pago um drink no bar 🍸')} accent={t.secondary} />
        </div>
        {zones && (
          <div className="flex flex-wrap gap-1.5 pb-2">
            {ZONES.map((z) => <button key={z} onClick={() => send('here', `📍 Tô ${z} — vem!`)} className="rounded-full border border-line bg-card px-3 py-1.5 text-xs">{z}</button>)}
          </div>
        )}
        <div className="flex items-center gap-2 pb-3">
          <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem…" onKeyDown={(e) => { if (e.key === 'Enter') send('text', text); }} />
          <button onClick={() => send('text', text)} className="btn h-11 w-11 grid place-items-center text-white" style={{ background: t.button }}>➤</button>
        </div>
      </div>

      {menu && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-end" onClick={() => setMenu(false)}>
          <div className="mx-auto w-full max-w-[480px] rounded-t-3xl bg-card border-t border-line p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => manage('unmatch')} className="btn w-full bg-ink2 py-3 text-white">↩︎ Desfazer match</button>
            <button onClick={() => manage('block')} className="btn w-full bg-ink2 py-3 text-glow">🚫 Bloquear</button>
            <button onClick={() => manage('report')} className="btn w-full bg-ink2 py-3 text-amber">🚩 Denunciar</button>
            <button onClick={() => setMenu(false)} className="btn w-full py-3 text-muted">Cancelar</button>
          </div>
        </div>
      )}

      {showProfile && other && <MatchProfileSheet o={other} theme={t} onClose={() => setShowProfile(false)} />}
    </main>
  );
}

// Perfil COMPLETO do match (pós-match: revela tudo — fotos, bio, redes)
function MatchProfileSheet({ o, theme, onClose }: { o: MatchRow; theme: any; onClose: () => void }) {
  const photos = ((o.photos && o.photos.length ? o.photos : [o.photo_url]).filter(Boolean)) as string[];
  const [i, setI] = useState(0);
  const cur = photos[Math.min(i, photos.length - 1)] || o.photo_url;
  const ig = o.socials?.instagram || o.instagram;
  const tk = o.socials?.tiktok;
  const sp = o.socials?.spotify;
  const spHref = sp ? (/^https?:\/\//.test(sp) ? sp : `https://open.spotify.com/search/${encodeURIComponent(sp)}`) : '';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur sm:items-center" onClick={onClose}>
      <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-ink2 border-t border-line" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-[4/5] w-full bg-card">
          {cur ? <img src={cur} alt="" className="absolute inset-0 h-full w-full object-cover" />
               : <div className="absolute inset-0 grid place-items-center text-7xl text-white" style={{ background: 'radial-gradient(120% 90% at 50% 0%,#3a2e8c,#1b1326)' }}>{(o.display_name || '🙂').charAt(0).toUpperCase()}</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
          {photos.length > 1 && (
            <>
              <div className="absolute inset-x-3 top-2 flex gap-1">{photos.map((_, k) => <div key={k} className="h-1 flex-1 rounded-full" style={{ background: k === i ? '#fff' : 'rgba(255,255,255,.35)' }} />)}</div>
              <button className="absolute left-0 top-0 h-full w-1/3" onClick={() => setI((v) => Math.max(0, v - 1))} aria-label="anterior" />
              <button className="absolute right-0 top-0 h-full w-1/3" onClick={() => setI((v) => Math.min(photos.length - 1, v + 1))} aria-label="próxima" />
            </>
          )}
          <button onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur">✕</button>
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex items-end gap-2"><h2 className="text-3xl font-black">{o.display_name}</h2>{o.age ? <span className="text-2xl font-bold text-white/80">{o.age}</span> : null}</div>
            {o.night_intention && <div className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold" style={{ background: theme.primary + '33', color: '#fff' }}>{o.night_intention}</div>}
          </div>
        </div>
        <div className="p-4 space-y-3">
          {(o.profile_prompt || o.bio) && <p className="text-white/90">{o.profile_prompt || o.bio}</p>}
          {(ig || tk || sp) && (
            <div className="flex flex-wrap gap-1.5">
              {ig && <a target="_blank" href={`https://instagram.com/${String(ig).replace('@', '')}`} className="rounded-full bg-glow/15 px-3 py-1.5 text-xs font-bold text-glow">📸 {String(ig).startsWith('@') ? ig : '@' + ig}</a>}
              {tk && <a target="_blank" href={`https://tiktok.com/@${tk.replace('@', '')}`} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white">🎵 @{tk.replace('@', '')}</a>}
              {sp && <a target="_blank" href={spHref} className="rounded-full bg-[#1db954]/20 px-3 py-1.5 text-xs font-bold text-[#1db954]">🎧 Spotify</a>}
            </div>
          )}
          <button onClick={onClose} className="btn w-full py-3 font-bold text-white" style={{ background: theme.button }}>Voltar pra conversa</button>
        </div>
      </div>
    </div>
  );
}

function Quick({ label, onClick, accent, highlight }: { label: string; onClick: () => void; accent: string; highlight?: boolean }) {
  return <button onClick={onClick} className="shrink-0 rounded-full px-3 py-2 text-xs font-bold" style={{ border: `1px solid ${accent}`, background: highlight ? accent + '26' : accent + '14', color: '#fff' }}>{label}</button>;
}
function Bubble({ m, theme }: { m: Message; theme: any }) {
  const special = m.kind !== 'text';
  return (
    <div className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[78%] rounded-2xl px-3.5 py-2 text-sm"
        style={m.mine ? { background: theme.button, color: '#fff' } : { background: special ? theme.secondary + '22' : '#1b1326', color: '#fff', border: special ? `1px solid ${theme.secondary}` : '1px solid var(--line)' }}>
        {m.body}
      </div>
    </div>
  );
}
