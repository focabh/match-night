'use client';
import { useEffect, useRef, useState } from 'react';

export type PlaceHit = { name: string; address: string; mapUrl: string };

// Campo de endereço com autocomplete (Google Places via /api/places).
// Digitar texto livre já salva como endereço; escolher uma sugestão preenche
// endereço + link do mapa (+ nome do local, se vazio).
export function AddressSearch({ value, onPick }: { value: string; onPick: (r: PlaceHit) => void }) {
  const [q, setQ] = useState(value || '');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<any>(null);

  useEffect(() => { setQ(value || ''); }, [value]);

  function change(v: string) {
    setQ(v);
    onPick({ name: '', address: v, mapUrl: '' }); // texto livre já vale
    clearTimeout(timer.current);
    if (v.trim().length < 3) { setHits([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/places?q=${encodeURIComponent(v)}`);
        const d = await r.json();
        setHits(d.results || []); setOpen((d.results || []).length > 0);
      } catch { setHits([]); }
      finally { setLoading(false); }
    }, 350);
  }

  function choose(h: PlaceHit) { setQ(h.address); onPick(h); setHits([]); setOpen(false); }

  return (
    <div className="relative">
      <input className="input" value={q} onChange={(e) => change(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        placeholder="Busque pelo nome ou endereço…" autoCapitalize="none" autoComplete="off" />
      {loading && <span className="absolute right-3 top-3.5 text-xs text-muted">…</span>}
      {open && hits.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-2xl border border-line bg-ink2 shadow-2xl">
          {hits.map((h, i) => (
            <button key={i} type="button" onClick={() => choose(h)}
              className="flex w-full items-start gap-2 border-b border-line/60 px-3 py-2.5 text-left last:border-0 hover:bg-white/5">
              <span className="mt-0.5">📍</span>
              <span className="min-w-0">
                {h.name && <span className="block truncate text-sm font-bold text-white">{h.name}</span>}
                <span className="block truncate text-xs text-muted">{h.address}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
