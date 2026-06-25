'use client';
import { useState } from 'react';
import type { DeckPerson } from '@/lib/types';

export function ProfileCard({ p, onReport, onBlock }: {
  p: DeckPerson; onReport?: () => void; onBlock?: () => void;
}) {
  const [zoom, setZoom] = useState(false);
  const [menu, setMenu] = useState(false);
  const text = p.profile_prompt || p.bio;
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-line bg-card select-none">
      <img src={p.photo_url} alt={p.display_name} draggable={false}
        onClick={() => setZoom(true)}
        className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

      <div className="absolute top-3 left-3 rounded-full bg-black/50 backdrop-blur px-3 py-1 text-xs font-bold text-glow">
        🟢 aqui agora
      </div>
      <button onClick={() => setMenu(true)}
        className="absolute top-3 right-3 h-9 w-9 grid place-items-center rounded-full bg-black/50 backdrop-blur text-white">⋯</button>

      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="flex items-end gap-2">
          <h2 className="text-3xl font-black leading-none">{p.display_name}</h2>
          <span className="text-2xl font-bold text-white/80">{p.age}</span>
        </div>
        <div className="mt-2 inline-flex rounded-full bg-glow/20 border border-glow/40 px-3 py-1 text-xs font-bold text-glow">
          {p.night_intention}
        </div>
        {text && <p className="mt-3 text-white/90 leading-snug line-clamp-3">{text}</p>}
        <p className="mt-2 text-[11px] text-white/50">Toque na foto pra ampliar</p>
      </div>

      {zoom && (
        <div className="absolute inset-0 z-20 bg-black flex flex-col" onClick={() => setZoom(false)}>
          <img src={p.photo_url} alt="" className="flex-1 w-full object-contain" />
          <div className="p-5">
            <div className="text-2xl font-black">{p.display_name}, {p.age}</div>
            {text && <p className="mt-1 text-white/80">{text}</p>}
            <button className="btn mt-4 w-full bg-card border border-line py-3">Fechar</button>
          </div>
        </div>
      )}

      {menu && (
        <div className="absolute inset-0 z-30 bg-black/70 flex items-end" onClick={() => setMenu(false)}>
          <div className="shell w-full rounded-t-3xl bg-card border-t border-line p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setMenu(false); onReport?.(); }} className="btn w-full bg-ink2 py-3 text-amber">🚩 Denunciar</button>
            <button onClick={() => { setMenu(false); onBlock?.(); }} className="btn w-full bg-ink2 py-3 text-glow">🚫 Bloquear</button>
            <button onClick={() => setMenu(false)} className="btn w-full py-3 text-muted">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
