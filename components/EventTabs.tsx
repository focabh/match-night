'use client';
import { useRouter } from 'next/navigation';

// Navegação persistente do evento: sempre dá pra ir pro deck, matches e perfil.
const TABS = [
  { k: 'deck', l: 'Descobrir', ic: '🔥' },
  { k: 'matches', l: 'Matches', ic: '💜' },
  { k: 'perfil', l: 'Perfil', ic: '🙂' },
];

export function EventTabs({ code, active, theme, right, matchesBadge = 0 }: { code: string; active: 'deck' | 'matches' | 'perfil'; theme: any; right?: React.ReactNode; matchesBadge?: number }) {
  const router = useRouter();
  return (
    <div className="sticky top-0 z-30 flex items-center gap-1.5 border-b border-line bg-ink/85 px-3 py-2 backdrop-blur">
      {TABS.map((t) => {
        const on = active === t.k;
        const badge = t.k === 'matches' && matchesBadge > 0 ? matchesBadge : 0;
        return (
          <button key={t.k} onClick={() => router.push(`/event/${code}/${t.k}`)}
            className="relative flex-1 rounded-full px-2 py-2 text-[13px] font-bold transition"
            style={on
              ? { background: (theme?.primary || '#ff3d7f') + '22', color: '#fff', border: `1px solid ${theme?.primary || '#ff3d7f'}` }
              : { color: 'var(--muted,#a99fb5)', border: '1px solid transparent' }}>
            <span className="mr-1">{t.ic}</span>{t.l}
            {badge > 0 && <span className="absolute -top-1 right-1 grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-black text-white" style={{ background: theme?.primary || '#ff3d7f' }}>{badge > 9 ? '9+' : badge}</span>}
          </button>
        );
      })}
      {right}
    </div>
  );
}
