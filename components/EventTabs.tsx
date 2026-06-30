'use client';
import { useRouter } from 'next/navigation';

// Navegação persistente do evento: sempre dá pra ir pro deck, matches e perfil.
const TABS = [
  { k: 'deck', l: 'Descobrir', ic: '🔥' },
  { k: 'matches', l: 'Matches', ic: '💜' },
  { k: 'perfil', l: 'Perfil', ic: '🙂' },
];

export function EventTabs({ code, active, theme, right }: { code: string; active: 'deck' | 'matches' | 'perfil'; theme: any; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="sticky top-0 z-30 flex items-center gap-1.5 border-b border-line bg-ink/85 px-3 py-2 backdrop-blur">
      {TABS.map((t) => {
        const on = active === t.k;
        return (
          <button key={t.k} onClick={() => router.push(`/event/${code}/${t.k}`)}
            className="flex-1 rounded-full px-2 py-2 text-[13px] font-bold transition"
            style={on
              ? { background: (theme?.primary || '#ff3d7f') + '22', color: '#fff', border: `1px solid ${theme?.primary || '#ff3d7f'}` }
              : { color: 'var(--muted,#a99fb5)', border: '1px solid transparent' }}>
            <span className="mr-1">{t.ic}</span>{t.l}
          </button>
        );
      })}
      {right}
    </div>
  );
}
