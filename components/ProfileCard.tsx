'use client';
import { useEffect, useState } from 'react';
import type { DeckPerson } from '@/lib/types';

export function ProfileCard({ p, onReport, onBlock }: {
  p: DeckPerson; onReport?: () => void; onBlock?: () => void;
}) {
  const photos = ((p.photos && p.photos.length ? p.photos : [p.photo_url]).filter(Boolean)) as string[];
  const [idx, setIdx] = useState(0);
  const [menu, setMenu] = useState(false);
  useEffect(() => { setIdx(0); }, [p.participant_id]); // reseta ao trocar de pessoa
  const i = Math.min(idx, photos.length - 1);
  const cur = photos[i] || p.photo_url;
  const text = p.profile_prompt || p.bio;
  const s = p.socials || {};
  const hasSocial = s.instagram || s.spotify || s.tiktok;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-line bg-card select-none">
      {cur
        ? <img src={cur} alt={p.display_name} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        : <div className="absolute inset-0 grid place-items-center text-7xl"
            style={{ background: 'radial-gradient(120% 90% at 50% 0%,#3a2e8c,#1b1326)' }}>
            <span>{(p.display_name || '🙂').trim().charAt(0).toUpperCase()}</span>
          </div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

      {/* barras de progresso (uma por foto) — estilo Tinder */}
      {photos.length > 1 && (
        <div className="absolute inset-x-3 top-2 z-20 flex gap-1">
          {photos.map((_, k) => (
            <div key={k} className="h-1 flex-1 rounded-full bg-white/30">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: k === i ? '100%' : '0%' }} />
            </div>
          ))}
        </div>
      )}

      {/* zonas de toque: esquerda volta, direita avança (não cobre rodapé/botões) */}
      {photos.length > 1 && (
        <div className="absolute inset-x-0 top-0 z-10 flex" style={{ height: '72%' }}>
          <button aria-label="anterior" className="h-full w-2/5" onClick={(e) => { e.stopPropagation(); setIdx((v) => Math.max(0, v - 1)); }} />
          <button aria-label="próxima" className="h-full w-3/5" onClick={(e) => { e.stopPropagation(); setIdx((v) => Math.min(photos.length - 1, v + 1)); }} />
        </div>
      )}

      <div className="absolute top-3 left-3 z-20 rounded-full bg-black/50 backdrop-blur px-3 py-1 text-xs font-bold text-glow">🟢 aqui agora</div>
      <button onClick={() => setMenu(true)} className="absolute top-3 right-3 z-20 h-9 w-9 grid place-items-center rounded-full bg-black/50 backdrop-blur text-white">⋯</button>

      <div className="absolute inset-x-0 bottom-0 z-20 p-5">
        <div className="flex items-end gap-2">
          <h2 className="text-3xl font-black leading-none">{p.display_name}</h2>
          <span className="text-2xl font-bold text-white/80">{p.age}</span>
        </div>
        <div className="mt-2 inline-flex rounded-full bg-glow/20 border border-glow/40 px-3 py-1 text-xs font-bold text-glow">{p.night_intention}</div>
        {text && <p className="mt-3 text-white/90 leading-snug line-clamp-3">{text}</p>}
        {hasSocial && (
          <div className="mt-3 flex gap-1.5">
            {s.instagram && <span className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-bold backdrop-blur">📸 Instagram</span>}
            {s.tiktok && <span className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-bold backdrop-blur">🎵 TikTok</span>}
            {s.spotify && <span className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-bold backdrop-blur">🎧 Spotify</span>}
            <span className="self-center text-[10px] text-white/45">revela no match</span>
          </div>
        )}
        {photos.length > 1 && <p className="mt-2 text-[11px] text-white/45">toque pra ver mais fotos · {i + 1}/{photos.length}</p>}
      </div>

      {menu && (
        <div className="absolute inset-0 z-30 bg-black/70 flex items-end" onClick={() => setMenu(false)}>
          <div className="mx-auto w-full max-w-[480px] rounded-t-3xl bg-card border-t border-line p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setMenu(false); onReport?.(); }} className="btn w-full bg-ink2 py-3 text-amber">🚩 Denunciar</button>
            <button onClick={() => { setMenu(false); onBlock?.(); }} className="btn w-full bg-ink2 py-3 text-glow">🚫 Bloquear</button>
            <button onClick={() => setMenu(false)} className="btn w-full py-3 text-muted">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
